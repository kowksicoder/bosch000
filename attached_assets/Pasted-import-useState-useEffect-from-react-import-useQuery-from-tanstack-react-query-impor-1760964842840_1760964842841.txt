import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Creator, Coin } from "@shared/schema";
import {
  Users,
  TrendingUp,
  Award,
  Star,
  ExternalLink,
  Coins as CoinsIcon,
  Flame,
} from "lucide-react";
import Layout from "@/components/layout";
import { formatEther } from "viem";
import { useLocation } from "wouter";
import { createAvatar } from '@dicebear/core';
import { avataaars } from '@dicebear/collection';
import { getCoin, getProfileCoins } from "@zoralabs/coins-sdk";
import { base } from "viem/chains";
import { Button } from "@/components/ui/button";
import TradeModal from "@/components/trade-modal";
import ProfileCardModal from "@/components/profile-card-modal";
import { useAccount } from "wagmi";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatSmartCurrency } from "@/lib/utils";

export default function Creators() {
  const [, navigate] = useLocation();
  const [selectedTab, setSelectedTab] = useState<"top" | "rising" | "new">(
    "top",
  );
  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);
  const [selectedCreatorAddress, setSelectedCreatorAddress] = useState<string>("");
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [creatorEarnings, setCreatorEarnings] = useState<Record<string, number>>({});
  const { address: currentUserAddress } = useAccount();
  const isMobile = useIsMobile();

  const { data: creators = [], isLoading: creatorsLoading } = useQuery<
    Creator[]
  >({
    queryKey: ["/api/creators"],
  });

  const { data: coins = [], isLoading: coinsLoading } = useQuery<Coin[]>({
    queryKey: ["/api/coins"],
  });

  // Calculate creator stats from real data
  const [creatorMarketCaps, setCreatorMarketCaps] = useState<Record<string, string>>({});
  const [creatorHolders, setCreatorHolders] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchStats = async () => {
      const marketCapData: Record<string, string> = {};
      const holdersData: Record<string, number> = {};
      const earningsData: Record<string, number> = {};
      
      for (const creator of creators) {
        const creatorCoins = coins.filter(
          (coin) => coin.creator_wallet?.toLowerCase() === creator.address.toLowerCase(),
        );

        let totalMarketCapUSD = 0;
        let totalHolders = 0;
        let totalEarnings = 0;
        
        // Fetch market cap, holders, and earnings for each coin that has an address
        await Promise.all(
          creatorCoins.map(async (coin) => {
            if (coin.address) {
              try {
                const response = await getCoin({
                  address: coin.address as `0x${string}`,
                  chain: base.id,
                });
                
                const coinData = response.data?.zora20Token;
                if (coinData?.marketCap) {
                  // marketCap from API is already in USD
                  totalMarketCapUSD += parseFloat(coinData.marketCap);
                }
                if (coinData?.uniqueHolders !== undefined) {
                  totalHolders += coinData.uniqueHolders;
                }
                
                // Calculate creator earnings from total volume (already in USD)
                // Creator gets 50% of 1% total fees = 0.5% of trading volume
                if (coinData?.totalVolume) {
                  const totalVolumeUSD = parseFloat(coinData.totalVolume);
                  const earningsUSD = totalVolumeUSD * 0.005; // 0.5% of volume
                  totalEarnings += earningsUSD;
                }
              } catch (error) {
                console.error(`Error fetching stats for ${coin.symbol}:`, error);
              }
            }
          })
        );

        marketCapData[creator.address] = totalMarketCapUSD.toFixed(2);
        holdersData[creator.address] = totalHolders;
        earningsData[creator.address] = totalEarnings;
      }
      
      setCreatorMarketCaps(marketCapData);
      setCreatorHolders(holdersData);
      setCreatorEarnings(earningsData);
    };

    if (creators.length > 0 && coins.length > 0) {
      fetchStats();
    }
  }, [creators, coins]);

  // Fetch creator stats for e1xp points
  const { data: creatorStats = {} } = useQuery({
    queryKey: ['/api/creators/stats'],
    enabled: creators.length > 0,
  });

  const enrichedCreators = creators.map((creator) => {
    const creatorCoins = coins.filter(
      (coin) => coin.creator_wallet?.toLowerCase() === creator.address.toLowerCase(),
    );

    // Use real market cap from fetched data, or 0 if not available yet
    const totalMarketCap = creatorMarketCaps[creator.address] || "0.0000";
    const totalHolders = creatorHolders[creator.address] || 0;
    const totalEarnings = creatorEarnings[creator.address] || 0;
    const e1xpPoints = creatorStats[creator.address]?.e1xpPoints || 0;

    // Calculate total volume from coin creation (mock for now as we don't track actual trading volume)
    const totalVolume = (creatorCoins.length * 0.001).toFixed(3);

    return {
      ...creator,
      totalCoins: creatorCoins.length,
      totalVolume,
      totalMarketCap,
      totalHolders,
      totalEarnings,
      e1xpPoints,
      coins: creatorCoins,
      // Use database avatar (prioritize avatar field, then profileImage) or generate dicebear avatar as fallback only if no custom avatar exists
      avatarUrl: creator.avatar || creator.profileImage || createAvatar(avataaars, {
        seed: creator.address,
        size: 56,
      }).toDataUri(),
      // Mock followers based on coin count and address
      followers: Math.floor(
        creatorCoins.length * 50 + parseInt(creator.address.slice(-2), 16) * 10,
      ),
      verified: creatorCoins.length >= 3, // Auto-verify creators with 3+ coins
    };
  });

  // Filter creators based on selected tab
  const filteredCreators = enrichedCreators
    .filter((creator) => creator.totalCoins > 0) // Only show creators with coins
    .sort((a, b) => {
      switch (selectedTab) {
        case "top":
          // Sort by earnings first, then by coins
          return (b.totalEarnings || 0) - (a.totalEarnings || 0) || b.totalCoins - a.totalCoins;
        case "rising":
          // Sort by recent activity (coins created in last 7 days)
          const recentCoinsA = coins.filter(
            (coin) =>
              coin.creator_wallet?.toLowerCase() === a.address.toLowerCase() &&
              new Date(coin.createdAt).getTime() >
                Date.now() - 7 * 24 * 60 * 60 * 1000,
          ).length;
          const recentCoinsB = coins.filter(
            (coin) =>
              coin.creator_wallet?.toLowerCase() === b.address.toLowerCase() &&
              new Date(coin.createdAt).getTime() >
                Date.now() - 7 * 24 * 60 * 60 * 1000,
          ).length;
          return recentCoinsB - recentCoinsA || b.totalCoins - a.totalCoins;
        case "new":
          // Sort by creation date (newest first)
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        default:
          return b.totalCoins - a.totalCoins;
      }
    });

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatAge = (dateString: string) => {
    const now = new Date();
    const created = new Date(dateString);
    const diff = now.getTime() - created.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 1) return "today";
    if (days < 30) return days + "d";
    if (days < 365) return Math.floor(days / 30) + "m";
    return Math.floor(days / 365) + "y";
  };

  const getAvatarBgColor = (index: number) => {
    const colors = [
      'bg-pink-200 dark:bg-pink-300',
      'bg-purple-200 dark:bg-purple-300', 
      'bg-yellow-200 dark:bg-yellow-300',
      'bg-blue-200 dark:bg-blue-300',
      'bg-green-200 dark:bg-green-300',
      'bg-orange-200 dark:bg-orange-300',
      'bg-red-200 dark:bg-red-300',
      'bg-indigo-200 dark:bg-indigo-300',
    ];
    return colors[index % colors.length];
  };

  const getRankColor = (index: number) => {
    const colors = [
      'text-pink-600 dark:text-pink-500',
      'text-purple-600 dark:text-purple-500',
      'text-yellow-600 dark:text-yellow-500',
      'text-blue-600 dark:text-blue-500',
      'text-green-600 dark:text-green-500',
      'text-orange-600 dark:text-orange-500',
      'text-red-600 dark:text-red-500',
      'text-indigo-600 dark:text-indigo-500',
    ];
    return colors[index % colors.length];
  };

  const isLoading = creatorsLoading || coinsLoading;

  return (
    <Layout>
      <div className="p-4 sm:p-8 overflow-x-hidden">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-black mb-3 sm:mb-4 text-foreground">
                  Top <span className="spotify-green">Creators</span>
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Discover the most successful content creators on CoinIT.
                </p>
              </div>

              {/* Inline Stats */}
              <div className="flex flex-wrap gap-4 sm:gap-6 text-left lg:text-right">
                <div className="text-center lg:text-right">
                  <div className="text-lg sm:text-xl font-black text-foreground">
                    {filteredCreators.length}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                    Active Creators
                  </div>
                </div>
                <div className="text-center lg:text-right">
                  <div className="text-lg sm:text-xl font-black text-foreground">
                    $
                    {filteredCreators
                      .reduce(
                        (acc, creator) => acc + parseFloat(creator.totalMarketCap),
                        0,
                      )
                      .toFixed(2)}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                    Total Market Cap
                  </div>
                </div>
                <div className="text-center lg:text-right">
                  <div className="text-lg sm:text-xl font-black text-green-500">
                    {formatSmartCurrency(
                      filteredCreators
                        .reduce(
                          (acc, creator) => acc + (creator.totalEarnings || 0),
                          0,
                        )
                    )}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                    Total Earnings
                  </div>
                </div>
                <div className="text-center lg:text-right">
                  <div className="text-lg sm:text-xl font-black text-foreground">
                    {filteredCreators.length > 0
                      ? Math.round(
                          filteredCreators.reduce(
                            (acc, creator) => acc + creator.totalCoins,
                            0,
                          ) / filteredCreators.length,
                        )
                      : 0}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                    Avg. Coins
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 sm:gap-4 mb-6 sm:mb-8 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
            <button
              onClick={() => setSelectedTab("top")}
              className={`px-4 sm:px-6 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${
                selectedTab === "top"
                  ? "bg-primary text-black"
                  : "bg-muted/20 text-muted-foreground hover:text-foreground"
              }`}
            >
              Top Creators
            </button>
            <button
              onClick={() => setSelectedTab("rising")}
              className={`px-4 sm:px-6 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${
                selectedTab === "rising"
                  ? "bg-primary text-black"
                  : "bg-muted/20 text-muted-foreground hover:text-foreground"
              }`}
            >
              Rising Stars
            </button>
            <button
              onClick={() => setSelectedTab("new")}
              className={`px-4 sm:px-6 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${
                selectedTab === "new"
                  ? "bg-primary text-black"
                  : "bg-muted/20 text-muted-foreground hover:text-foreground"
              }`}
            >
              New Creators
            </button>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="spotify-card rounded-xl p-4 sm:p-6">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-muted/20 rounded-full animate-pulse flex-shrink-0"></div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="h-5 bg-muted/20 rounded w-32 sm:w-40 animate-pulse"></div>
                      <div className="h-4 bg-muted/20 rounded w-24 sm:w-32 animate-pulse"></div>
                    </div>
                    <div className="text-right space-y-2 flex-shrink-0">
                      <div className="h-5 bg-muted/20 rounded w-20 animate-pulse"></div>
                      <div className="h-4 bg-muted/20 rounded w-16 animate-pulse"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredCreators.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                No creators yet
              </h3>
              <p className="text-muted-foreground mb-6">
                Be the first to create a coin and become a creator!
              </p>
            </div>
          ) : (
            /* Creators List - Mobile Leaderboard Style */
            <div className="space-y-3">
              {filteredCreators.map((creator, index) => {
                const isCurrentUser = currentUserAddress && creator.address.toLowerCase() === currentUserAddress.toLowerCase();
                const createdDaysAgo = Math.floor((Date.now() - new Date(creator.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                const isVeteran = createdDaysAgo >= 365; // 1+ year

                return (
                  <div
                    key={creator.id}
                    className={`rounded-2xl overflow-hidden transition-all ${
                      isCurrentUser 
                        ? 'bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30' 
                        : 'bg-card'
                    }`}
                    data-testid={`creator-${creator.address}`}
                  >
                    {/* Mobile Layout */}
                    <div className="flex sm:hidden flex-col p-3">
                      {/* First Row: Rank, Avatar, Name, Trade Button */}
                      <div className="flex items-center gap-2 mb-2">
                        {/* Rank Number */}
                        <div className={`text-2xl font-black ${getRankColor(index)} flex-shrink-0 w-8`}>
                          {index + 1}
                        </div>

                        {/* Avatar with colored background */}
                        <div 
                          className={`relative flex-shrink-0 cursor-pointer rounded-full p-0.5 ${getAvatarBgColor(index)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCreatorAddress(creator.address);
                            setIsProfileModalOpen(true);
                          }}
                        >
                          <img
                            src={creator.avatarUrl}
                            alt={creator.name || creator.address}
                            className="w-9 h-9 rounded-full"
                            data-testid={`avatar-${creator.address}`}
                          />
                        </div>

                        {/* Creator Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-foreground font-bold text-sm truncate" data-testid={`name-${creator.address}`}>
                              {isCurrentUser ? 'You' : (creator.name || formatAddress(creator.address))}
                            </h3>
                            {index === 0 && (
                              <Award className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                            )}
                          </div>
                          {isVeteran && (
                            <div className="flex items-center gap-1 mt-1">
                              <Flame className="w-3 h-3 text-orange-500" />
                              <span className="text-xs text-orange-600 dark:text-orange-500 font-medium">1+ year</span>
                            </div>
                          )}
                        </div>

                        
                      </div>

                      {/* Second Row: Stats Grid */}
                      <div className="grid grid-cols-4 gap-1.5 pl-11">
                        <div className="text-center">
                          <div className="text-foreground font-bold text-xs" data-testid={`mobile-coins-${creator.address}`}>
                            {creator.totalCoins}
                          </div>
                          <div className="text-muted-foreground text-[10px]">
                            Coins
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-foreground font-bold text-sm" data-testid={`mobile-marketcap-${creator.address}`}>
                            ${creator.totalMarketCap}
                          </div>
                          <div className="text-muted-foreground text-[10px]">
                            Market Cap
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-foreground font-bold text-sm" data-testid={`mobile-holders-${creator.address}`}>
                            {creator.totalHolders}
                          </div>
                          <div className="text-muted-foreground text-[10px]">
                            Holders
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-green-500 font-bold text-sm" data-testid={`mobile-earnings-${creator.address}`}>
                            {formatSmartCurrency(creator.totalEarnings)}
                          </div>
                          <div className="text-muted-foreground text-[10px]">
                            Earnings
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-yellow-500 font-bold text-sm flex items-center justify-center gap-1" data-testid={`mobile-e1xp-${creator.address}`}>
                            <Star className="w-3 h-3" />
                            {creator.e1xpPoints || 0}
                          </div>
                          <div className="text-muted-foreground text-[10px]">
                            E1XP
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden sm:flex items-center gap-2 p-2 hover:bg-muted/5 transition-colors">
                      <div 
                        className="relative flex-shrink-0 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCreatorAddress(creator.address);
                          setIsProfileModalOpen(true);
                        }}
                      >
                        <img
                          src={creator.avatarUrl}
                          alt={creator.name || creator.address}
                          className="w-10 h-10 rounded-full hover:ring-2 hover:ring-primary transition-all"
                          data-testid={`avatar-${creator.address}`}
                        />
                        {index < 3 && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center text-[10px] font-bold text-black">
                            {index + 1}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 grid grid-cols-6 gap-2 items-center">
                        <div className="min-w-0">
                          <h3 className="text-foreground font-bold text-sm truncate flex items-center gap-1" data-testid={`name-${creator.address}`}>
                            {creator.name || formatAddress(creator.address)}
                            {index === 0 && (
                              <Award className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                            )}
                          </h3>
                          <p className="text-muted-foreground text-[10px] font-mono">
                            {formatAddress(creator.address)}
                          </p>
                        </div>
                        <div className="text-center">
                          <div className="text-foreground font-bold text-sm" data-testid={`coins-${creator.address}`}>
                            {creator.totalCoins}
                          </div>
                          <div className="text-muted-foreground text-[10px]">
                            Coins
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-foreground font-bold text-sm" data-testid={`marketcap-${creator.address}`}>
                            ${creator.totalMarketCap}
                          </div>
                          <div className="text-muted-foreground text-[10px]">
                            Market Cap
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-foreground font-bold text-sm" data-testid={`holders-${creator.address}`}>
                            {creator.totalHolders}
                          </div>
                          <div className="text-muted-foreground text-[10px]">
                            Holders
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-green-500 font-bold text-sm" data-testid={`earnings-${creator.address}`}>
                            {formatSmartCurrency(creator.totalEarnings)}
                          </div>
                          <div className="text-muted-foreground text-[10px]">
                            Earnings
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-yellow-500 font-bold text-sm flex items-center justify-center gap-1" data-testid={`e1xp-${creator.address}`}>
                            <Star className="w-3 h-3" />
                            {creator.e1xpPoints || 0}
                          </div>
                          <div className="text-muted-foreground text-[10px]">
                            E1XP
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Trade Modal */}
      {selectedCoin && (
        <TradeModal
          coin={selectedCoin}
          open={isTradeModalOpen}
          onOpenChange={setIsTradeModalOpen}
        />
      )}

      {/* Profile Card Modal */}
      <ProfileCardModal
        creatorAddress={selectedCreatorAddress}
        open={isProfileModalOpen}
        onOpenChange={setIsProfileModalOpen}
      />
    </Layout>
  );
}
