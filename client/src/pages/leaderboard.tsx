import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, TrendingUp, Award, Star, Flame, Trophy, Medal } from "lucide-react";
import { createAvatar } from "@dicebear/core";
import { avataaars } from "@dicebear/collection";
import { usePrivy } from "@privy-io/react-auth";
import {
  getMostValuableCreatorCoins,
  getCreatorCoins,
} from "@zoralabs/coins-sdk";
import ProfileCardModal from "@/components/profile-card-modal";
import { formatSmartCurrency } from "@/lib/utils";
import { useFxRates, convertUsdToNgn } from "@/lib/fx";

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

export default function Leaderboard() {
  const { user: privyUser } = usePrivy();
  const [selectedTab, setSelectedTab] = useState<"marketcap" | "volume" | "e1xp">("marketcap");
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const { data: fxRates } = useFxRates();

  const { data: zoraCreatorsData, isLoading: creatorsLoading } = useQuery({
    queryKey: ["/api/zora/leaderboard", selectedTab],
    queryFn: async () => {
      let response;
      if (selectedTab === "marketcap") {
        response = await getMostValuableCreatorCoins({ count: 50 });
      } else {
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
            totalProfileViews: Math.floor((coin.uniqueHolders || 0) * 3),
            e1xpPoints: Math.floor(parseFloat(coin.marketCap || "0") * 100),
            marketCap: coin.marketCap,
            volume24h: coin.volume24h,
          };
        }) || [];

      return creators;
    },
    refetchInterval: 30000,
  });

  const creators = zoraCreatorsData || [];

  const filteredCreators = creators
    .filter((creator: any) => creator.totalConnections && creator.totalConnections > 0)
    .sort((a: any, b: any) => {
      switch (selectedTab) {
        case "marketcap":
          return parseFloat(b.marketCap || "0") - parseFloat(a.marketCap || "0");
        case "volume":
          return parseFloat(b.volume24h || "0") - parseFloat(a.volume24h || "0");
        case "e1xp":
          return (b.e1xpPoints || 0) - (a.e1xpPoints || 0);
        default:
          return parseFloat(b.marketCap || "0") - parseFloat(a.marketCap || "0");
      }
    });

  const formatNumber = (num: number): string => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1).replace(/\.0$/, "")}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1).replace(/\.0$/, "")}K`;
    return num.toFixed(0);
  };

  const formatCurrency = (num: number): string => {
    return formatSmartCurrency(convertUsdToNgn(num, fxRates));
  };

  const getAvatarBgColor = (index: number) => {
    const colors = [
      "bg-yellow-200 dark:bg-yellow-300",
      "bg-slate-200 dark:bg-slate-300",
      "bg-orange-200 dark:bg-orange-300",
      "bg-pink-200 dark:bg-pink-300",
      "bg-purple-200 dark:bg-purple-300",
      "bg-blue-200 dark:bg-blue-300",
      "bg-green-200 dark:bg-green-300",
      "bg-indigo-200 dark:bg-indigo-300",
    ];
    return colors[index % colors.length];
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return { bg: "bg-yellow-400", text: "text-yellow-900" };
    if (index === 1) return { bg: "bg-slate-300", text: "text-slate-800" };
    if (index === 2) return { bg: "bg-orange-400", text: "text-orange-900" };
    return { bg: "bg-muted", text: "text-muted-foreground" };
  };

  const totalMarketCap = filteredCreators.reduce(
    (acc: number, creator: any) => acc + parseFloat(creator.marketCap || "0"),
    0,
  );
  const totalVolume = filteredCreators.reduce(
    (acc: number, creator: any) => acc + parseFloat(creator.volume24h || "0"),
    0,
  );
  const totalMarketCapNgn = convertUsdToNgn(totalMarketCap, fxRates);
  const totalVolumeNgn = convertUsdToNgn(totalVolume, fxRates);
  const avgHolders =
    filteredCreators.length > 0
      ? filteredCreators.reduce((acc: number, creator: any) => acc + (creator.totalConnections || 0), 0) /
        filteredCreators.length
      : 0;

  return (
    <div className="container max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-8">
      {/* Stats */}
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
          <div className="text-sm font-bold text-blue-500">
            {formatSmartCurrency(totalVolumeNgn)}
          </div>
          <div className="text-[9px] text-muted-foreground">Total Vol</div>
        </div>
        <div className="text-center bg-muted/20 rounded-lg p-1.5">
          <div className="text-sm font-bold text-foreground">
            {creatorsLoading ? "-" : formatNumber(avgHolders)}
          </div>
          <div className="text-[9px] text-muted-foreground">Avg. Holders</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 sm:gap-4 -mt-2 sm:mt-0 mb-4 sm:mb-6 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 sm:overflow-visible">
        <button
          onClick={() => setSelectedTab("marketcap")}
          className={`flex-1 px-2 sm:px-6 py-1.5 sm:py-2 rounded-lg font-medium transition-all text-xs sm:text-base whitespace-nowrap ${
            selectedTab === "marketcap"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted"
          }`}
          data-testid="tab-leaderboard-marketcap"
        >
          <div className="flex items-center justify-center gap-1 sm:gap-2">
            <Award className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Market Cap</span>
            <span className="sm:hidden">M.Cap</span>
          </div>
        </button>
        <button
          onClick={() => setSelectedTab("volume")}
          className={`flex-1 px-2 sm:px-6 py-1.5 sm:py-2 rounded-lg font-medium transition-all text-xs sm:text-base whitespace-nowrap ${
            selectedTab === "volume"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted"
          }`}
          data-testid="tab-leaderboard-volume"
        >
          <div className="flex items-center justify-center gap-1 sm:gap-2">
            <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">24h Volume</span>
            <span className="sm:hidden">Volume</span>
          </div>
        </button>
        <button
          onClick={() => setSelectedTab("e1xp")}
          className={`flex-1 px-2 sm:px-6 py-1.5 sm:py-2 rounded-lg font-medium transition-all text-xs sm:text-base whitespace-nowrap ${
            selectedTab === "e1xp"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted"
          }`}
          data-testid="tab-leaderboard-e1xp"
        >
          <div className="flex items-center justify-center gap-1 sm:gap-2">
            <Star className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">E1XP Points</span>
            <span className="sm:hidden">E1XP</span>
          </div>
        </button>
      </div>

      {/* List */}
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
          <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-xl font-bold text-foreground mb-2">No entries yet</h3>
          <p className="text-muted-foreground">The leaderboard will populate as creators join!</p>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {filteredCreators.map((creator: any, index: number) => {
            const isCurrentUser =
              privyUser?.wallet?.address && creator.id === privyUser.wallet.address;
            const rank = getRankBadge(index);

            return (
              <div
                key={creator.id}
                className={`rounded-2xl overflow-hidden transition-all ${
                  isCurrentUser
                    ? "bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30"
                    : "bg-card"
                }`}
                data-testid={`card-leaderboard-${index}`}
              >
                {/* Mobile Layout */}
                <div className="flex sm:hidden gap-2 p-1.5">
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div
                      className={`relative cursor-pointer rounded-full p-0.5 ${getAvatarBgColor(index)}`}
                      onClick={() => {
                        setSelectedCreator(creator.address);
                        setIsProfileModalOpen(true);
                      }}
                      data-testid={`button-leaderboard-avatar-mobile-${index}`}
                    >
                      <img
                        src={creator.avatarUrl}
                        alt={creator.displayName || creator.username}
                        className="w-10 h-10 rounded-full"
                      />
                      <div
                        className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${rank.bg} ${rank.text}`}
                      >
                        {index + 1}
                      </div>
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
                        <div className="text-muted-foreground text-[8px]">Holders</div>
                      </div>
                      <div className="text-center">
                        <div className="text-foreground font-bold text-[10px]">
                          {formatCurrency(parseFloat(creator.marketCap || "0"))}
                        </div>
                        <div className="text-muted-foreground text-[8px]">M.Cap</div>
                      </div>
                      <div className="text-center">
                        <div className="text-foreground font-bold text-[10px]">
                          {formatCurrency(parseFloat(creator.volume24h || "0"))}
                        </div>
                        <div className="text-muted-foreground text-[8px]">Vol</div>
                      </div>
                      <div className="text-center">
                        <div className="text-yellow-500 font-bold text-[10px] flex items-center justify-center gap-0.5">
                          <Star className="w-2 h-2" />
                          {formatNumber(creator.e1xpPoints || 0)}
                        </div>
                        <div className="text-muted-foreground text-[8px]">E1XP</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden sm:flex items-center gap-2 p-2 hover:bg-muted/5 transition-colors">
                  {/* Rank badge */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${rank.bg} ${rank.text}`}
                  >
                    {index + 1}
                  </div>

                  <div
                    className="relative flex-shrink-0 cursor-pointer"
                    onClick={() => {
                      setSelectedCreator(creator.address);
                      setIsProfileModalOpen(true);
                    }}
                    data-testid={`button-leaderboard-avatar-desktop-${index}`}
                  >
                    <img
                      src={creator.avatarUrl}
                      alt={creator.displayName || creator.username}
                      className="w-10 h-10 rounded-full hover:ring-2 hover:ring-primary transition-all"
                    />
                    {index < 3 && (
                      <div className="absolute -bottom-1 -right-1">
                        {index === 0 && <span className="text-sm">🥇</span>}
                        {index === 1 && <span className="text-sm">🥈</span>}
                        {index === 2 && <span className="text-sm">🥉</span>}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 grid grid-cols-5 gap-2 items-center">
                    <div className="min-w-0">
                      <h3 className="text-foreground font-bold text-sm truncate flex items-center gap-1">
                        {creator.displayName || creator.username}
                        {index === 0 && <Trophy className="w-3 h-3 text-yellow-500 flex-shrink-0" />}
                      </h3>
                      <p className="text-muted-foreground text-[10px]">{creator.username}</p>
                    </div>
                    <div className="text-center">
                      <div className="text-foreground font-bold text-sm">
                        {formatNumber(creator.totalConnections || 0)}
                      </div>
                      <div className="text-muted-foreground text-[10px]">Holders</div>
                    </div>
                    <div className="text-center">
                      <div className="text-foreground font-bold text-sm">
                        {formatCurrency(parseFloat(creator.marketCap || "0"))}
                      </div>
                      <div className="text-muted-foreground text-[10px]">Market Cap</div>
                    </div>
                    <div className="text-center">
                      <div className="text-foreground font-bold text-sm">
                        {formatCurrency(parseFloat(creator.volume24h || "0"))}
                      </div>
                      <div className="text-muted-foreground text-[10px]">24h Vol</div>
                    </div>
                    <div className="text-center">
                      <div className="text-yellow-500 font-bold text-sm flex items-center justify-center gap-1">
                        <Star className="w-3 h-3" />
                        {formatNumber(creator.e1xpPoints || 0)}
                      </div>
                      <div className="text-muted-foreground text-[10px]">E1XP</div>
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
