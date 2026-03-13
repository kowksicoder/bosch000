import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { safeNavigate } from "@/lib/navigation";
import type { Coin } from "@shared/schema";
import CoinCard from "@/components/coin-card";
import Layout from "@/components/layout";
import {
  Coins as CoinsIcon,
  ChevronLeft,
  ChevronRight,
  Globe,
  PenTool,
  Music,
} from "lucide-react";
import {
  SiYoutube,
  SiFarcaster,
  SiTiktok,
  SiInstagram,
  SiMedium,
  SiSubstack,
  SiGithub,
  SiX,
} from "react-icons/si";
import { useState, useMemo, useRef, useEffect } from "react";
import { getCoins } from "@zoralabs/coins-sdk";
import { base } from "viem/chains";
import { KarmaIcon } from "@/components/karma-icon";
import { GitcoinIcon } from "@/components/gitcoin-icon";
import { FarcasterIcon } from "@/components/farcaster-icon";
import { useAccount } from "wagmi";
import StreakDisplay from "@/components/streak-display";


type CoinWithPlatform = Coin & { platform?: string };

export default function Home() {
  const { address, isConnected } = useAccount();
  const [, setLocation] = useLocation();
  const { data: coins = [], isLoading } = useQuery<CoinWithPlatform[]>({
    queryKey: ["/api/coins"],
  });

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [scrollPosition, setScrollPosition] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const getCoinCount = (platformId: string) => {
    if (platformId === "all") return coins.length;
    return coins.filter((coin) => coin.platform === platformId).length;
  };

  // Hiding /channels page by not including it in the categories
  const categories = [
    { id: "all", label: "All", Icon: Globe },
    // { id: "youtube", label: "Channels", Icon: SiYoutube }, // Hidden
    { id: "farcaster", label: "Farcaster", Icon: FarcasterIcon },
    { id: "gitcoin", label: "Gitcoin", Icon: GitcoinIcon },
    { id: "karmagap", label: "KarmaGap", Icon: KarmaIcon },
    { id: "publicgoods", label: "Public Goods", Icon: CoinsIcon },
    { id: "music", label: "Music", Icon: Music },
    { id: "tiktok", label: "TikTok", Icon: SiTiktok },
    { id: "instagram", label: "Instagram", Icon: SiInstagram },
    { id: "medium", label: "Medium", Icon: SiMedium },
    { id: "giveth", label: "Giveth", Icon: CoinsIcon },
    { id: "twitter", label: "Twitter", Icon: SiX },
    { id: "blog", label: "Blog", Icon: PenTool },
  ];

  const filteredCoins = useMemo(() => {
    if (selectedCategory === "all") return coins;
    return coins.filter((coin) => coin.platform === selectedCategory);
  }, [coins, selectedCategory]);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === "left" ? -400 : 400;
      scrollContainerRef.current.scrollBy({
        left: scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <Layout>
      {/* Category Bar */}
      <section className="p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative group">
            {/* Left Arrow - Hidden on mobile */}
            <button
              onClick={() => scroll("left")}
              className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm p-2 rounded-full border border-border/50 hover:bg-muted/30 transition-all opacity-0 group-hover:opacity-100"
              data-testid="button-scroll-left"
            >
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>

            {/* Category Chips */}
            <div
              ref={scrollContainerRef}
              className="flex gap-2 sm:gap-3 overflow-x-auto scrollbar-hide pb-2"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {categories.map((category) => {
                const IconComponent = category.Icon;
                return (
                  <button
                    key={category.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Only change state, don't navigate
                      if (category.id !== selectedCategory) {
                        setSelectedCategory(category.id);
                      }
                    }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    type="button"
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                      selectedCategory === category.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/20 text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                    }`}
                    data-testid={`button-category-${category.id}`}
                  >
                    <IconComponent
                      className={`w-4 h-4 platform-icon-${category.id}`}
                    />
                    {category.label}
                  </button>
                );
              })}
            </div>

            {/* Right Arrow - Hidden on mobile */}
            <button
              onClick={() => scroll("right")}
              className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm p-2 rounded-full border border-border/50 hover:bg-muted/30 transition-all opacity-0 group-hover:opacity-100"
              data-testid="button-scroll-right"
            >
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </section>

      {/* Streak Display Section */}
      {isConnected && address && (
        <section className="p-4 sm:p-6">
          <div className="max-w-md mx-auto">
            <StreakDisplay userAddress={address} />
          </div>
        </section>
      )}

      {/* Trending Coins Section */}
      <section className="p-4 sm:p-8">
        <div className="max-w-5xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="spotify-card rounded-xl overflow-hidden p-3 sm:p-4 space-y-3"
                >
                  <div className="aspect-square w-full bg-muted/20 rounded-lg animate-pulse"></div>
                  <div className="space-y-2">
                    <div className="h-5 bg-muted/20 rounded w-3/4 animate-pulse"></div>
                    <div className="h-4 bg-muted/20 rounded w-1/2 animate-pulse"></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="h-4 bg-muted/20 rounded w-16 animate-pulse"></div>
                    <div className="h-4 bg-muted/20 rounded w-16 animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredCoins.length === 0 ? (
            <div className="text-center py-8 sm:py-16">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <CoinsIcon className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2">
                No coins yet
              </h3>
              <p className="text-muted-foreground mb-4 sm:mb-6 px-4">
                Import your content, earn forever!
              </p>
              <Link href="/create">
                {/* Applying compact and rounded styles to Create button */}
                <button className="spotify-button px-4 py-2 rounded-md font-semibold">Create a coin</button>
              </Link>
            </div>
          ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
              {filteredCoins.map((coin) => (
                <CoinCard 
                  key={coin.id} 
                  coin={coin as any} 
                  handleCardClick={() => coin.address && safeNavigate(setLocation, `/coin/${coin.symbol}/${coin.address}`)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      </Layout>
  );
}