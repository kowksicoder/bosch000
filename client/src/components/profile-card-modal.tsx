import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import type { Coin } from "@shared/schema";
import { Users, DollarSign, Coins as CoinsIcon, TrendingUp, Award, Share2 } from "lucide-react";
import { getProfile, getProfileCoins } from "@zoralabs/coins-sdk";
import { base } from "viem/chains";
import { formatSmartCurrency } from "@/lib/utils";
import { useFxRates, convertUsdToNgn } from "@/lib/fx";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface ProfileCardModalProps {
  creatorAddress: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorData?: { name?: string; verified?: boolean };
}

export default function ProfileCardModal({ creatorAddress, open, onOpenChange, creatorData }: ProfileCardModalProps) {
  const { user: privyUser, authenticated } = usePrivy();
  const currentUserAddress = privyUser?.wallet?.address || privyUser?.id;
  const [, setLocation] = useLocation();
  const [totalMarketCap, setTotalMarketCap] = useState<number>(0);
  const [totalHolders, setTotalHolders] = useState<number>(0);
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const { toast } = useToast();
  const { data: fxRates } = useFxRates();

  // Helper function to format wallet address (fallback only)
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Fetch Zora profile data
  const { data: zoraProfile } = useQuery({
    queryKey: ['/zora/profile', creatorAddress],
    queryFn: async () => {
      const response = await getProfile({ identifier: creatorAddress });
      return response?.data?.profile;
    },
    enabled: !!creatorAddress && open,
  });

  // Fetch creator's coins from Zora
  const { data: zoraCoins } = useQuery({
    queryKey: ['/zora/profile/coins', creatorAddress],
    queryFn: async () => {
      const response = await getProfileCoins({
        identifier: creatorAddress,
        count: 50,
        chainIds: [base.id]
      });
      return response?.data?.profile?.createdCoins?.edges?.map((edge: any) => edge.node) || [];
    },
    enabled: !!creatorAddress && open,
  });

  // Check if following
  const { data: followData } = useQuery({
    queryKey: ['/api/follows/check', currentUserAddress, creatorAddress],
    queryFn: async () => {
      if (!currentUserAddress || !creatorAddress) return { isFollowing: false };
      const response = await fetch(`/api/follows/check/${currentUserAddress}/${creatorAddress}`);
      if (!response.ok) return { isFollowing: false };
      return response.json();
    },
    enabled: !!currentUserAddress && !!creatorAddress && authenticated,
  });

  const isFollowing = followData?.isFollowing || false;

  // Get local creator data for name/bio if available
  const { data: localCreatorProfile } = useQuery({
    queryKey: ['/api/creators/address', creatorAddress],
    queryFn: async () => {
      const response = await fetch(`/api/creators/address/${creatorAddress}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!creatorAddress,
  });

  const { data: followers = [] } = useQuery({
    queryKey: ['/api/follows/followers', creatorAddress],
    queryFn: async () => {
      const response = await fetch(`/api/follows/followers/${creatorAddress}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!creatorAddress && open,
  });

  const { data: following = [] } = useQuery({
    queryKey: ['/api/follows/following', creatorAddress],
    queryFn: async () => {
      const response = await fetch(`/api/follows/following/${creatorAddress}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!creatorAddress && open,
  });

  const followersCount = followers.length || 0;
  const followingCount = following.length || 0;

  // Use Zora profile avatar or local avatar, fallback to platform logo
  const avatarUrl = zoraProfile?.avatar?.medium ||
                    localCreatorProfile?.avatar ||
                    "https://i.ibb.co/JRQCPsZK/ev122logo-1-1.png";

  const emailHandle = localCreatorProfile?.email
    ? String(localCreatorProfile.email).split("@")[0]
    : null;
  const displayName = localCreatorProfile?.name ||
                      creatorData?.name ||
                      zoraProfile?.displayName ||
                      zoraProfile?.handle ||
                      emailHandle ||
                      formatAddress(creatorAddress);
  const displayHandle =
    localCreatorProfile?.name ||
    zoraProfile?.handle ||
    emailHandle ||
    null;

  // Get verified status
  const isVerified = creatorData?.verified || localCreatorProfile?.verified === "true";

  // Use Zora coins as the source of truth
  const creatorCoins = zoraCoins || [];
  const primaryCoin = creatorCoins[0];

  const totalMarketCapNgn = convertUsdToNgn(totalMarketCap, fxRates);
  const totalEarningsNgn = convertUsdToNgn(totalEarnings, fxRates);

  useEffect(() => {
    if (!open || !zoraCoins || zoraCoins.length === 0) {
      setTotalMarketCap(0);
      setTotalHolders(0);
      setTotalEarnings(0);
      return;
    }

    let marketCapSum = 0;
    let holdersSum = 0;
    let earningsSum = 0;

    // Calculate stats from Zora coin data
    zoraCoins.forEach((coin: any) => {
      if (coin?.marketCap) {
        marketCapSum += parseFloat(coin.marketCap);
      }
      if (coin?.uniqueHolders !== undefined) {
        holdersSum += coin.uniqueHolders;
      }
      if (coin?.totalVolume) {
        const totalVolumeUSD = parseFloat(coin.totalVolume);
        // 0.5% creator fee on total volume
        const earningsUSD = totalVolumeUSD * 0.005;
        earningsSum += earningsUSD;
      }
    });

    setTotalMarketCap(marketCapSum);
    setTotalHolders(holdersSum);
    setTotalEarnings(earningsSum);
  }, [open, zoraCoins]);

  // Follow mutation
  const followMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserAddress || !creatorAddress) throw new Error("Not authenticated");
      const response = await fetch('/api/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followerAddress: currentUserAddress,
          followingAddress: creatorAddress,
        }),
      });
      if (!response.ok) throw new Error("Failed to follow");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/follows/check'] });
      queryClient.invalidateQueries({ queryKey: ['/api/follows/followers', creatorAddress] });
      queryClient.invalidateQueries({ queryKey: ['/api/follows/following', currentUserAddress] });
      toast({ title: "Following!", description: `You are now following ${displayName}` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to follow user", variant: "destructive" });
    },
  });

  // Unfollow mutation
  const unfollowMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserAddress || !creatorAddress) throw new Error("Not authenticated");
      const response = await fetch(`/api/follows/${currentUserAddress}/${creatorAddress}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error("Failed to unfollow");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/follows/check'] });
      queryClient.invalidateQueries({ queryKey: ['/api/follows/followers', creatorAddress] });
      queryClient.invalidateQueries({ queryKey: ['/api/follows/following', currentUserAddress] });
      toast({ title: "Unfollowed", description: `You unfollowed ${displayName}` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to unfollow user", variant: "destructive" });
    },
  });

  const handleFollowToggle = () => {
    if (!authenticated || !currentUserAddress) {
      toast({ title: "Connect wallet", description: "Please connect your wallet to follow users", variant: "destructive" });
      return;
    }

    if (currentUserAddress.toLowerCase() === creatorAddress.toLowerCase()) {
      toast({ title: "Cannot follow yourself", variant: "destructive" });
      return;
    }

    if (isFollowing) {
      unfollowMutation.mutate();
    } else {
      followMutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[280px] sm:max-w-[320px] bg-card border-border/50 p-0 overflow-hidden rounded-2xl sm:rounded-3xl">
        <div className="flex items-center justify-end pt-2 pr-14 px-3 sm:pt-2 sm:pr-16 sm:px-5">
          <button
            onClick={async () => {
              const profileIdentifier = zoraProfile?.handle
                ? `@${encodeURIComponent(zoraProfile.handle)}`
                : localCreatorProfile?.name
                ? `@${encodeURIComponent(localCreatorProfile.name)}`
                : `profile/${creatorAddress}`;
              const url = `${window.location.origin}/${profileIdentifier}`;

              if (navigator.share) {
                await navigator.share({
                  title: `${displayName} - CoinIT Profile`,
                  url: url,
                });
              } else {
                await navigator.clipboard.writeText(url);
                toast({ title: "Profile link copied!" });
              }
            }}
            className="p-2 sm:p-2.5 bg-background/90 backdrop-blur-sm hover:bg-muted/30 rounded-full transition-colors border border-border/50"
            data-testid="button-share-profile"
          >
            <Share2 className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="px-3 pb-3 sm:px-5 sm:pb-5">
          <div className="relative mb-2 sm:mb-3 flex items-center gap-3">
            <img
              src={avatarUrl}
              alt="Profile"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 sm:border-4 border-border shadow-lg"
              data-testid="img-profile-card-avatar"
            />
            <div className="flex flex-col gap-1 text-[10px] sm:text-xs">
              <div className="flex items-baseline gap-1">
                <span className="font-semibold text-foreground">{followersCount}</span>
                <span className="text-muted-foreground">Followers</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-semibold text-foreground">{followingCount}</span>
                <span className="text-muted-foreground">Following</span>
              </div>
            </div>
          </div>

          <div className="mb-2 sm:mb-3">
            <h3 className="text-base sm:text-lg font-bold text-foreground mb-0.5 flex items-center gap-2" data-testid="text-profile-card-name">
              {displayName}
              {isVerified && (
                <Award className="w-5 h-5 text-yellow-500" />
              )}
            </h3>
            {displayHandle && (
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5">
                @{displayHandle}
              </p>
            )}
            {zoraProfile?.bio && (
              <p className="text-xs text-muted-foreground mt-1">
                {zoraProfile.bio}
              </p>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-3 sm:mb-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                <CoinsIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-yellow-500" />
                <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Coins</span>
              </div>
              <p className="text-sm sm:text-base font-bold text-foreground" data-testid="text-profile-card-coins">{creatorCoins.length}</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                <DollarSign className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-green-500" />
                <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Market</span>
              </div>
              <p className="text-sm sm:text-base font-bold text-foreground" data-testid="text-profile-card-market">
                ₦{totalMarketCapNgn && totalMarketCapNgn > 1000
                  ? `${(totalMarketCapNgn / 1000).toFixed(0)}k`
                  : (totalMarketCapNgn ?? 0).toFixed(0)}
              </p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                <Users className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-500" />
                <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Holders</span>
              </div>
              <p className="text-sm sm:text-base font-bold text-foreground" data-testid="text-profile-card-holders">{totalHolders}</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-green-500" />
                <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Earn</span>
              </div>
              <p className="text-sm sm:text-base font-bold text-green-500" data-testid="text-profile-card-earnings">
                {totalEarningsNgn && totalEarningsNgn > 1000
                  ? `₦${(totalEarningsNgn / 1000).toFixed(1)}k`
                  : formatSmartCurrency(totalEarningsNgn)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleFollowToggle}
              disabled={followMutation.isPending || unfollowMutation.isPending}
              className={`h-9 sm:h-10 rounded-full text-sm font-semibold transition-all ${
                isFollowing
                  ? 'bg-muted/50 text-foreground hover:bg-muted/70 border border-border'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
              data-testid="button-follow-toggle"
            >
              {followMutation.isPending || unfollowMutation.isPending
                ? 'Loading...'
                : isFollowing ? 'Unfollow' : 'Follow'}
            </Button>

            <Button
              onClick={() => {
                if (!primaryCoin?.address) {
                  toast({ title: "No coin found", description: "This creator does not have a coin yet.", variant: "destructive" });
                  return;
                }

                onOpenChange(false);
                setLocation(`/coin/${primaryCoin.address}`);
              }}
              className="h-9 sm:h-10 rounded-full text-sm font-semibold bg-accent text-accent-foreground hover:bg-accent/90"
              data-testid="button-support"
            >
              Support
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
