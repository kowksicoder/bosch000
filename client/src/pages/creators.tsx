import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { Users, TrendingUp, Award, Star, Flame } from "lucide-react";
import { createAvatar } from "@dicebear/core";
import { avataaars } from "@dicebear/collection";
import { usePrivy } from "@privy-io/react-auth";
import {
  getMostValuableCreatorCoins,
  getCreatorCoins,
} from "@zoralabs/coins-sdk";
import ProfileCardModal from "@/components/profile-card-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { formatSmartCurrency } from "@/lib/utils";
import { useFxRates, convertUsdToNgn } from "@/lib/fx";

// Creator type from Zora data
type Creator = {
  id: string;
  address: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  createdAt: string;
  totalConnections: number;
  totalProfileViews: number;
  e1xpPoints: number;
  marketCap: string;
  volume24h: string;
};

export default function Creators() {
  const { user: privyUser, login } = usePrivy();
  const [selectedTab, setSelectedTab] = useState<"top" | "rising" | "new">(
    "top",
  );
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const { data: fxRates } = useFxRates();

  // Fetch Zora creator coins data
  const { data: zoraCreatorsData, isLoading: creatorsLoading } = useQuery({
    queryKey: ["/api/zora/creators", selectedTab],
    queryFn: async () => {
      let response;

      if (selectedTab === "top") {
        response = await getMostValuableCreatorCoins({ count: 50 });
      } else if (selectedTab === "new") {
        response = await getCreatorCoins({ count: 50 });
      } else {
        // Rising stars - use regular creator coins
        response = await getCreatorCoins({ count: 50 });
      }

      const creators =
        response.data?.exploreList?.edges?.map((edge: any) => {
          const coin = edge.node;
          return {
            id: coin.creatorAddress || coin.address,
            address: coin.creatorAddress || coin.address,
            username: coin.symbol || "creator",
            displayName: coin.name || "Creator",
            bio: coin.description || "",
            avatarUrl:
              coin.mediaContent?.previewImage?.medium ||
              coin.mediaContent?.previewImage?.small ||
              createAvatar(avataaars, {
                seed: coin.creatorAddress,
                size: 56,
              }).toDataUri(),
            createdAt: coin.createdAt || new Date().toISOString(),
            totalConnections: coin.uniqueHolders || 0,
            totalProfileViews: Math.floor((coin.uniqueHolders || 0) * 3), // Estimate
            e1xpPoints: Math.floor(parseFloat(coin.marketCap || "0") * 100),
            marketCap: coin.marketCap,
            volume24h: coin.volume24h,
          };
        }) || [];

      return creators;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const creators = zoraCreatorsData || [];

  const filteredCreators = creators
    .filter(
      (creator: any) =>
        creator.totalConnections && creator.totalConnections > 0,
    )
    .sort((a: any, b: any) => {
      switch (selectedTab) {
        case "top":
          return (b.totalConnections || 0) - (a.totalConnections || 0);
        case "rising":
          return (b.totalProfileViews || 0) - (a.totalProfileViews || 0);
        case "new":
          return (
            new Date(b.createdAt || "").getTime() -
            new Date(a.createdAt || "").getTime()
          );
        default:
          return (b.totalConnections || 0) - (a.totalConnections || 0);
      }
    });

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getAvatarBgColor = (index: number) => {
    const colors = [
      "bg-pink-200 dark:bg-pink-300",
      "bg-purple-200 dark:bg-purple-300",
      "bg-yellow-200 dark:bg-yellow-300",
      "bg-blue-200 dark:bg-blue-300",
      "bg-green-200 dark:bg-green-300",
      "bg-orange-200 dark:bg-orange-300",
      "bg-red-200 dark:bg-red-300",
      "bg-indigo-200 dark:bg-indigo-300",
    ];
    return colors[index % colors.length];
  };

  const getRankColor = (index: number) => {
    const colors = [
      "text-pink-600 dark:text-pink-500",
      "text-purple-600 dark:text-purple-500",
      "text-yellow-600 dark:text-yellow-500",
      "text-blue-600 dark:text-blue-500",
      "text-green-600 dark:text-green-500",
      "text-orange-600 dark:text-orange-500",
      "text-red-600 dark:text-red-500",
      "text-indigo-600 dark:text-indigo-500",
    ];
    return colors[index % colors.length];
  };

  const totalMarketCap = filteredCreators.reduce(
    (acc: number, creator: any) => acc + parseFloat(creator.marketCap || "0"),
    0,
  );
  const totalMarketCapNgn = convertUsdToNgn(totalMarketCap, fxRates);

  const totalEarnings = filteredCreators.reduce(
    (acc: number, creator: any) => acc + (creator.e1xpPoints || 0) * 0.001,
    0,
  );

  const formatNumber = (num: number): string => {
    if (num >= 1000000000) {
      return `${(num / 1000000000).toFixed(1).replace(/\.0$/, '')}B`;
    } else if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1).replace(/\.0$/, '')}K`;
    }
    return num.toFixed(0);
  };

  const formatCurrency = (num: number): string => {
    return formatSmartCurrency(convertUsdToNgn(num, fxRates));
  };

  const avgHolders =
    filteredCreators.length > 0
      ? filteredCreators.reduce(
          (acc: number, creator: any) => acc + (creator.totalConnections || 0),
          0,
        ) / filteredCreators.length
      : 0;

  return (
    <div className="container max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-8">
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col items-center gap-1 sm:gap-2">
          {/* Stats - Compact single line on mobile */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            <div className="text-center bg-muted/20 rounded-lg p-1.5">
              <div className="text-sm font-bold text-primary">
                {creatorsLoading ? "-" : filteredCreators.length}
              </div>
              <div className="text-[9px] text-muted-foreground">Creators</div>
            </div>
            <div className="text-center bg-muted/20 rounded-lg p-1.5">
              <div className="text-sm font-bold text-green-500">
                {formatSmartCurrency(totalMarketCapNgn)}
              </div>
              <div className="text-[9px] text-muted-foreground">Market Cap</div>
            </div>
            <div className="text-center bg-muted/20 rounded-lg p-1.5">
              <div className="text-sm font-bold text-green-500">
                {formatSmartCurrency(totalEarnings)}
              </div>
              <div className="text-[9px] text-muted-foreground">Earnings</div>
            </div>
            <div className="text-center bg-muted/20 rounded-lg p-1.5">
              <div className="text-sm font-bold text-foreground">
                {creatorsLoading ? "-" : formatNumber(avgHolders)}
              </div>
              <div className="text-[9px] text-muted-foreground">
                Avg. Holders
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 sm:gap-4 -mt-2 sm:mt-0 mb-4 sm:mb-6 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 sm:overflow-visible">
        <button
          onClick={() => setSelectedTab("top")}
          className={`flex-1 px-2 sm:px-6 py-1.5 sm:py-2 rounded-lg font-medium transition-all text-xs sm:text-base whitespace-nowrap ${
            selectedTab === "top"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          <div className="flex items-center justify-center gap-1 sm:gap-2">
            <Award className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Top Creators</span>
            <span className="sm:hidden">Top</span>
          </div>
        </button>
        <button
          onClick={() => setSelectedTab("rising")}
          className={`flex-1 px-2 sm:px-6 py-1.5 sm:py-2 rounded-lg font-medium transition-all text-xs sm:text-base whitespace-nowrap ${
            selectedTab === "rising"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          <div className="flex items-center justify-center gap-1 sm:gap-2">
            <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Rising Stars</span>
            <span className="sm:hidden">Rising</span>
          </div>
        </button>
        <button
          onClick={() => setSelectedTab("new")}
          className={`flex-1 px-2 sm:px-6 py-1.5 sm:py-2 rounded-lg font-medium transition-all text-xs sm:text-base whitespace-nowrap ${
            selectedTab === "new"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          <div className="flex items-center justify-center gap-1 sm:gap-2">
            <Flame className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">New Creators</span>
            <span className="sm:hidden">New</span>
          </div>
        </button>
      </div>

      {creatorsLoading ? (
        <div className="space-y-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-card rounded-xl p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-muted/20 rounded-full animate-pulse flex-shrink-0"></div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-5 bg-muted/20 rounded w-32 sm:w-40 animate-pulse"></div>
                  <div className="h-4 bg-muted/20 rounded w-24 sm:w-32 animate-pulse"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredCreators.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-8 h-8 text-muted-foreground" />
          <h3 className="text-xl font-bold text-foreground mb-2">
            No creators yet
          </h3>
          <p className="text-muted-foreground mb-6">
            Be the first to create content and become a creator!
          </p>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {filteredCreators.map((creator: any, index: number) => {
            const isCurrentUser =
              privyUser?.wallet?.address &&
              creator.id === privyUser.wallet.address;
            const createdDaysAgo = Math.floor(
              (Date.now() - new Date(creator.createdAt || "").getTime()) /
                (1000 * 60 * 60 * 24),
            );
            const isVeteran = createdDaysAgo >= 365;

            return (
              <div
                key={creator.id}
                className={`rounded-2xl overflow-hidden transition-all ${
                  isCurrentUser
                    ? "bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30"
                    : "bg-card"
                }`}
              >
                <div className="flex sm:hidden gap-2 p-1.5">
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div
                      className={`relative cursor-pointer rounded-full p-0.5 ${getAvatarBgColor(index)}`}
                      onClick={() => {
                        setSelectedCreator(creator.address);
                        setIsProfileModalOpen(true);
                      }}
                      data-testid={`button-avatar-mobile-${index}`}
                    >
                      <img
                        src={creator.avatarUrl}
                        alt={creator.displayName || creator.username}
                        className="w-10 h-10 rounded-full"
                      />
                      {index === 0 && (
                        <Award className="absolute -top-1 -right-1 w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                    <p className="text-muted-foreground text-[9px] max-w-[48px] truncate text-center">
                      @{creator.username}
                    </p>
                  </div>

                  <div className="flex-1 min-w-0 flex items-center">
                    <div className="grid grid-cols-4 gap-0.5 w-full">
                      <div className="text-center">
                        <div className="text-foreground font-bold text-[10px]">
                          {formatNumber(creator.totalConnections || 0)}
                        </div>
                        <div className="text-muted-foreground text-[8px]">
                          Holders
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-foreground font-bold text-[10px]">
                          {formatCurrency(parseFloat(creator.marketCap || "0"))}
                        </div>
                        <div className="text-muted-foreground text-[8px]">
                          M.Cap
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-foreground font-bold text-[10px]">
                          {formatCurrency(parseFloat(creator.volume24h || "0"))}
                        </div>
                        <div className="text-muted-foreground text-[8px]">
                          Vol
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-yellow-500 font-bold text-[10px] flex items-center justify-center gap-0.5">
                          <Star className="w-2 h-2" />
                          {formatNumber(creator.e1xpPoints || 0)}
                        </div>
                        <div className="text-muted-foreground text-[8px]">
                          E1XP
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-2 p-2 hover:bg-muted/5 transition-colors">
                  <div
                    className="relative flex-shrink-0 cursor-pointer"
                    onClick={() => {
                      setSelectedCreator(creator.address);
                      setIsProfileModalOpen(true);
                    }}
                    data-testid={`button-avatar-desktop-${index}`}
                  >
                    <img
                      src={creator.avatarUrl}
                      alt={creator.displayName || creator.username}
                      className="w-10 h-10 rounded-full hover:ring-2 hover:ring-primary transition-all"
                    />
                    {index < 3 && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                        {index + 1}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 grid grid-cols-5 gap-2 items-center">
                    <div className="min-w-0">
                      <h3 className="text-foreground font-bold text-sm truncate flex items-center gap-1">
                        {creator.displayName || creator.username}
                        {index === 0 && (
                          <Award className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                        )}
                      </h3>
                      <p className="text-muted-foreground text-[10px]">
                        {creator.username}
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="text-foreground font-bold text-sm">
                        {formatNumber(creator.totalConnections || 0)}
                      </div>
                      <div className="text-muted-foreground text-[10px]">
                        Holders
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-foreground font-bold text-sm">
                        {formatCurrency(parseFloat(creator.marketCap || "0"))}
                      </div>
                      <div className="text-muted-foreground text-[10px]">
                        Market Cap
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-foreground font-bold text-sm">
                        {formatCurrency(parseFloat(creator.volume24h || "0"))}
                      </div>
                      <div className="text-muted-foreground text-[10px]">
                        24h Vol
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-yellow-500 font-bold text-sm flex items-center justify-center gap-1">
                        <Star className="w-3 h-3" />
                        {formatNumber(creator.e1xpPoints || 0)}
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

      {selectedCreator && (
        <ProfileCardModal
          creatorAddress={selectedCreator}
          open={isProfileModalOpen}
          onOpenChange={setIsProfileModalOpen}
        />
      )}
    </div>
  );
}
