import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import type { Coin } from "@shared/schema";
import Layout from "@/components/layout";
import CoinCard from "@/components/coin-card";
import {
  Share2,
  Grid3x3,
  List,
  DollarSign,
  TrendingUp,
  Users,
  Coins as CoinsIcon,
  Copy,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getCoin } from "@zoralabs/coins-sdk";
import { base } from "viem/chains";
import { createAvatar } from '@dicebear/core';
import { avataaars } from '@dicebear/collection';
import { formatSmartCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function PublicProfile() {
  const [, params] = useRoute("/:identifier");
  const rawIdentifier = params?.identifier || "";

  // Remove @ prefix if present (for @username routes)
  const identifier = rawIdentifier.startsWith("@") ? rawIdentifier.slice(1) : rawIdentifier;

  // Determine if identifier is a username (starts with @) or wallet address
  const isUsername = identifier.startsWith('@');
  const cleanIdentifier = isUsername ? identifier.slice(1) : identifier;

  // Redirect to home if identifier is invalid
  if (!cleanIdentifier || cleanIdentifier === '[object Object]' || cleanIdentifier === 'undefined') {
    window.location.href = '/';
    return null;
  }

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const [totalMarketCap, setTotalMarketCap] = useState<number>(0);
  const [totalHolders, setTotalHolders] = useState<number>(0);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const { toast } = useToast();

  // Determine if identifier is address or username
  const isAddress = identifier.startsWith("0x");

  // Fetch creator by address or username
  const { data: creatorData, isLoading: isLoadingCreatorData } = useQuery({
    queryKey: ['/api/creators', isAddress ? 'address' : 'username', identifier],
    queryFn: async () => {
      const endpoint = isAddress 
        ? `/api/creators/address/${identifier}`
        : `/api/creators/username/${identifier}`;
      const response = await fetch(endpoint);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!identifier,
  });

  const address = creatorData?.address;

  const avatarSvg = creatorData?.avatar || creatorData?.profileImage || createAvatar(avataaars, {
    seed: address || 'anonymous',
    size: 128,
  }).toDataUri();

  const { data: coins = [], isLoading: isLoadingCoins } = useQuery<Coin[]>({
    queryKey: ["/api/coins"],
  });

  const createdCoins = useMemo(() => {
    if (!address) return [];
    return coins.filter(coin =>
      coin.creator_wallet && coin.creator_wallet.toLowerCase() === address.toLowerCase()
    );
  }, [coins, address]);

  const displayedCoins = createdCoins.filter(coin => coin.address !== null) as Array<typeof createdCoins[0] & { address: string }>;

  useEffect(() => {
    if (!address || !createdCoins.length) {
      setTotalEarnings(0);
      setTotalMarketCap(0);
      setTotalHolders(0);
      setIsLoadingStats(false);
      return;
    }

    let isMounted = true;
    setIsLoadingStats(true);

    async function fetchAllStats() {
      try {
        let earnings = 0;
        let marketCap = 0;
        let holders = 0;

        for (const coin of createdCoins) {
          if (coin.address && coin.status === 'active') {
            try {
              const coinData = await getCoin({
                collectionAddress: coin.address as `0x${string}`,
                chainId: base.id,
              });

              const tokenData = coinData.data?.zora20Token;

              if (tokenData?.creatorEarnings && tokenData.creatorEarnings.length > 0) {
                const earningAmount = parseFloat(String(tokenData.creatorEarnings[0].amountUsd || tokenData.creatorEarnings[0].amount?.amountDecimal || "0"));
                earnings += earningAmount;
              }

              if (tokenData?.marketCap) {
                marketCap += parseFloat(tokenData.marketCap);
              }

              if (tokenData?.uniqueHolders) {
                holders += tokenData.uniqueHolders;
              }
            } catch (err) {
              console.error(`Error fetching coin stats for ${coin.address}:`, err);
            }
          }
        }

        if (isMounted) {
          setTotalEarnings(earnings);
          setTotalMarketCap(marketCap);
          setTotalHolders(holders);
          setIsLoadingStats(false);
        }
      } catch (error) {
        console.error("Error fetching creator stats:", error);
        if (isMounted) {
          setTotalEarnings(0);
          setTotalMarketCap(0);
          setTotalHolders(0);
          setIsLoadingStats(false);
        }
      }
    }

    fetchAllStats();

    return () => {
      isMounted = false;
    };
  }, [address, createdCoins]);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleShare = async () => {
    // Use @username if available, otherwise use address
    const profilePath = creatorData?.name 
      ? `/@${creatorData.name}` 
      : `/${address}`;
    const url = `${window.location.origin}${profilePath}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${creatorData?.name || formatAddress(address)} - CoinIT Profile`,
          text: `Check out this profile on CoinIT!`,
          url: url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast({
          title: "Link copied",
          description: "Profile link copied to clipboard",
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  if (isLoadingCreatorData) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-16 h-16 bg-muted/20 rounded-full animate-pulse mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!creatorData) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh] p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Profile Not Found</h2>
            <p className="text-muted-foreground">
              This creator doesn't exist or hasn't created any coins yet.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <div className="relative mb-6">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-4">
              <img
                src={avatarSvg}
                alt="Profile Avatar"
                className="w-28 h-28 rounded-3xl border-4 border-border shadow-xl object-cover"
              />
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-1">
              {creatorData?.name || formatAddress(address)}
            </h1>

            <p className="text-sm text-muted-foreground mb-4">
              @{address ? `${address.slice(2, 8)}` : ''}
            </p>

            {creatorData?.bio && (
              <p className="text-muted-foreground text-sm mb-4 max-w-md px-4">
                {creatorData.bio}
              </p>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2 mb-6">
            <div className="text-center">
              <div className="text-xl font-bold text-foreground mb-1">
                {isLoadingStats || isLoadingCoins ? '-' : createdCoins.length}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Coins</div>
            </div>

            <div className="text-center">
              <div className="text-xl font-bold text-foreground mb-1">
                {isLoadingStats ? '-' : totalMarketCap >= 1000000
                  ? `$${(totalMarketCap / 1000000).toFixed(2)}M`
                  : totalMarketCap >= 1000
                    ? `$${(totalMarketCap / 1000).toFixed(1)}k`
                    : `$${totalMarketCap.toFixed(2)}`}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Market Cap</div>
            </div>

            <div className="text-center">
              <div className="text-xl font-bold text-foreground mb-1">
                {isLoadingStats ? '-' : totalHolders}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Holders</div>
            </div>

            <div className="text-center">
              <div className="text-xl font-bold text-green-600 dark:text-green-500 mb-1">
                {isLoadingStats ? '-' : formatSmartCurrency(totalEarnings)}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Earnings</div>
            </div>
          </div>

          <div className="flex gap-3 mb-6">
            <Button
              onClick={handleShare}
              className="flex-1 bg-primary hover:bg-primary/90 text-black font-bold rounded-xl h-11"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Profile
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground">
            Created Coins {createdCoins.length > 0 && `(${createdCoins.length})`}
          </h2>

          <div className="flex gap-1 bg-muted/20 rounded-full p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-full transition-colors ${
                viewMode === "grid"
                  ? "bg-white text-black"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-full transition-colors ${
                viewMode === "list"
                  ? "bg-white text-black"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isLoadingCoins ? (
          <div className="grid grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="spotify-card rounded-xl overflow-hidden p-3 space-y-3">
                <div className="aspect-square w-full bg-muted/20 rounded-lg animate-pulse"></div>
              </div>
            ))}
          </div>
        ) : displayedCoins.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CoinsIcon className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No coins created yet</h3>
          </div>
        ) : (
          <div className={viewMode === "grid" ? "grid grid-cols-2 gap-4" : "space-y-4"}>
            {displayedCoins.map((coin) => (
              <CoinCard
                key={coin.id}
                coin={{
                  ...coin,
                  createdAt: typeof coin.createdAt === 'string'
                    ? coin.createdAt
                    : coin.createdAt
                      ? coin.createdAt.toISOString()
                      : new Date().toISOString(),
                  ipfsUri: coin.ipfsUri ?? undefined
                }}
                isOwnCoin={false}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}