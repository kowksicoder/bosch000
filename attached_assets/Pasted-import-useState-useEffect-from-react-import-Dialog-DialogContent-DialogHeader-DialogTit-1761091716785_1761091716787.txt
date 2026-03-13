import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import type { Coin } from "@shared/schema";
import { Users, DollarSign, Coins as CoinsIcon, TrendingUp, Award, Share2 } from "lucide-react";
import { getCoin } from "@zoralabs/coins-sdk";
import { base } from "viem/chains";
import { createAvatar } from '@dicebear/core';
import { avataaars } from '@dicebear/collection';
import { formatSmartCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ProfileCardModalProps {
  creatorAddress: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorData?: { name?: string; verified?: boolean }; // Added creatorData prop
}

export default function ProfileCardModal({ creatorAddress, open, onOpenChange, creatorData }: ProfileCardModalProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [totalMarketCap, setTotalMarketCap] = useState<number>(0);
  const [totalHolders, setTotalHolders] = useState<number>(0);
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const { toast } = useToast();

  const { data: coins = [] } = useQuery<Coin[]>({
    queryKey: ["/api/coins"],
  });

  const creatorCoins = coins.filter(
    (coin) => coin.creator_wallet?.toLowerCase() === creatorAddress.toLowerCase()
  );

  // Fetch creator data to get avatar
  const { data: creatorProfile } = useQuery({
    queryKey: ['/api/creators/address', creatorAddress],
    enabled: !!creatorAddress,
  });

  const avatarUrl = creatorProfile?.avatar || creatorProfile?.profileImage || createAvatar(avataaars, {
    seed: creatorAddress,
    size: 96,
  }).toDataUri();

  useEffect(() => {
    const fetchStats = async () => {
      let marketCapSum = 0;
      let holdersSum = 0;
      let earningsSum = 0;

      for (const coin of creatorCoins) {
        if (coin.address) {
          try {
            const response = await getCoin({
              address: coin.address as `0x${string}`,
              chain: base.id,
            });

            const coinData = response.data?.zora20Token;
            if (coinData?.marketCap) {
              marketCapSum += parseFloat(coinData.marketCap);
            }
            if (coinData?.uniqueHolders !== undefined) {
              holdersSum += coinData.uniqueHolders;
            }
            // Calculate creator earnings from total volume (already in USD)
            // Creator gets 50% of 1% total fees = 0.5% of trading volume
            if (coinData?.totalVolume) {
              const totalVolumeUSD = parseFloat(coinData.totalVolume);
              const earningsUSD = totalVolumeUSD * 0.005; // 0.5% of volume
              earningsSum += earningsUSD;
            }
          } catch (error) {
            console.error(`Error fetching stats for ${coin.symbol}:`, error);
          }
        }
      }

      setTotalMarketCap(marketCapSum);
      setTotalHolders(holdersSum);
      setTotalEarnings(earningsSum);
    };

    if (open && creatorCoins.length > 0) {
      fetchStats();
    }
  }, [open, creatorCoins]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleFollowToggle = () => {
    setIsFollowing(!isFollowing);
  };

  // Get the first coin's image for background or use a gradient
  const backgroundImage = creatorCoins[0]?.image;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[280px] sm:max-w-[320px] bg-card border-border/50 p-0 overflow-hidden rounded-2xl sm:rounded-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between p-3 sm:px-5 sm:py-4">
            <DialogTitle className="text-foreground text-xl font-bold flex items-center gap-2">
              {creatorData?.name || formatAddress(creatorAddress)}
              {creatorData?.verified && (
                <Award className="w-5 h-5 text-yellow-500" />
              )}
            </DialogTitle>
          </div>
        </DialogHeader>
        {/* Profile Content */}
        <div className="px-3 pb-3 sm:px-5 sm:pb-5">
          {/* Avatar and Share Icon */}
          <div className="relative mb-2 sm:mb-3 flex items-start justify-between">
            <img
              src={avatarUrl}
              alt="Profile"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 sm:border-4 border-border shadow-lg"
            />

            {/* Share Icon */}
            <button
              onClick={async () => {
                // Use @username if available, otherwise use address
                const profilePath = creatorData?.name 
                  ? `/@${creatorData.name}` 
                  : `/${creatorAddress}`;
                const url = `${window.location.origin}${profilePath}`;
                
                if (navigator.share) {
                  await navigator.share({
                    title: `${creatorData?.name || formatAddress(creatorAddress)} - CoinIT Profile`,
                    url: url,
                  });
                } else {
                  await navigator.clipboard.writeText(url);
                  toast({ title: "Profile link copied!" });
                }
              }}
              className="p-2 sm:p-2.5 bg-background/90 backdrop-blur-sm hover:bg-muted/30 rounded-full transition-colors border border-border/50"
            >
              <Share2 className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Name & Address */}
          <div className="mb-2 sm:mb-3">
            <h3 className="text-base sm:text-lg font-bold text-foreground mb-0.5">
              {formatAddress(creatorAddress)}
            </h3>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-mono truncate">
              {creatorAddress}
            </p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-3 sm:mb-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                <CoinsIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-yellow-500" />
                <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Coins</span>
              </div>
              <p className="text-sm sm:text-base font-bold text-foreground">{creatorCoins.length}</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                <DollarSign className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-green-500" />
                <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Market</span>
              </div>
              <p className="text-sm sm:text-base font-bold text-foreground">
                ${totalMarketCap > 1000 ? `${(totalMarketCap / 1000).toFixed(0)}k` : totalMarketCap.toFixed(0)}
              </p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                <Users className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-500" />
                <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Holders</span>
              </div>
              <p className="text-sm sm:text-base font-bold text-foreground">{totalHolders}</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-green-500" />
                <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Earn</span>
              </div>
              <p className="text-sm sm:text-base font-bold text-green-500">
                {totalEarnings > 1000 ? `$${(totalEarnings / 1000).toFixed(1)}k` : formatSmartCurrency(totalEarnings)}
              </p>
            </div>
          </div>

          {/* Follow Button */}
          <Button
            onClick={handleFollowToggle}
            className={`w-full h-9 sm:h-10 rounded-full text-sm font-semibold transition-all ${
              isFollowing
                ? 'bg-muted/50 text-foreground hover:bg-muted/70 border border-border'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {isFollowing ? 'Unfollow' : 'Follow'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}