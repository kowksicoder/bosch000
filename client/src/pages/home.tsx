import { useQuery } from "@tanstack/react-query";
import { CreatorCard } from "@/components/creator-card";
import { CoinCard } from "@/components/coin-card";
import { TopCreatorsStories } from "@/components/top-creators-stories";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  TrendingUp,
  Music,
  Palette,
  Tv,
  Search,
  PlusCircle,
  User,
  Users,
} from "lucide-react";
import type { User as UserType } from "@shared/schema";
import { useState, useMemo, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import TradeModalMobile from "@/components/trade-modal-mobile";
import { useLocation } from "wouter";
import { createAvatar } from "@dicebear/core";
import { avataaars } from "@dicebear/collection";
import { getMostValuableCreatorCoins } from "@zoralabs/coins-sdk";
import { useEffect } from "react";
import { updateOGMeta } from "@/lib/og-meta";
import { Card, CardContent } from "@/components/ui/card";

type Coin = {
  id: string;
  name: string;
  symbol: string;
  address: string;
  image?: string;
  marketCap?: string;
  volume24h?: string;
  holders?: number;
  creator?: string;
  createdAt?: string;
  category?: string;
  platform?: string;
  creator_wallet?: string;
  metadata?: any;
};

const getCoinCategoryBucket = (coin: Coin) => {
  const tags: string[] = [];
  if (Array.isArray(coin.metadata?.attributes)) {
    coin.metadata.attributes.forEach((attr: any) => {
      if (typeof attr?.value === "string") tags.push(attr.value.toLowerCase());
    });
  }
  if (typeof coin.metadata?.attributes === "object" && coin.metadata?.attributes) {
    Object.values(coin.metadata.attributes).forEach((value) => {
      if (typeof value === "string") tags.push(value.toLowerCase());
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (typeof item === "string") tags.push(item.toLowerCase());
        });
      }
    });
  }
  if (coin.category) tags.push(coin.category.toLowerCase());

  if (tags.some((tag) => ["collab", "collabs", "collaboration", "collaborations"].includes(tag))) {
    return "collabs";
  }
  if (tags.some((tag) => ["community", "communities", "school", "schools", "event", "events"].includes(tag))) {
    return "community";
  }
  if (tags.some((tag) => ["music", "musician", "song"].includes(tag))) return "music";
  if (tags.some((tag) => ["art", "artist"].includes(tag))) return "art";
  if (tags.some((tag) => ["movie", "movies", "film", "films"].includes(tag))) return "movies";
  if (tags.some((tag) => ["popculture", "pop-culture"].includes(tag))) return "popculture";
  return "other";
};

export default function Home() {
  // Fetch trending creators from Zora for the stories section
  const { data: zoraCreators } = useQuery({
    queryKey: ["/api/zora/creators/most-valuable"],
    queryFn: async () => {
      const response = await getMostValuableCreatorCoins({ count: 20 });
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
            e1xpPoints: Math.floor(parseFloat(coin.marketCap || "0") * 100),
          };
        }) || [];
      return creators;
    },
    refetchInterval: 30000,
  });

  const trendingCreators = zoraCreators || [];

  const { data: featuredProjects, isLoading: loadingProjects } = useQuery({
    queryKey: ["/api/projects/featured"],
  });

  // Fetch pinned coins from platform
  const { data: pinnedCoinsData, isLoading: loadingPinnedCoins } = useQuery({
    queryKey: ["/api/coins/pinned"],
    queryFn: async () => {
      const response = await fetch("/api/coins/pinned?_=" + Date.now());
      if (!response.ok) throw new Error("Failed to fetch pinned coins");
      return response.json();
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Fetch trending coins from Zora
  const { data: zoraCoinsData, isLoading: loadingZoraCoins } = useQuery({
    queryKey: ["/api/zora/coins/top-volume"],
    queryFn: async () => {
      const response = await fetch("/api/zora/coins/top-volume?count=30");
      if (!response.ok) throw new Error("Failed to fetch Zora coins");
      return response.json();
    },
  });

  const [selectedCategory, setSelectedCategory] = useState("trending");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [coinMarketCaps, setCoinMarketCaps] = useState<Record<string, string>>(
    {},
  );
  const [coinVolumes, setCoinVolumes] = useState<Record<string, string>>({});
  const [coinHolders, setCoinHolders] = useState<Record<string, number>>({});
  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();


  const categories = [
    { id: "music", label: "Music", Icon: Music },
    { id: "art", label: "Art", Icon: Palette },
    { id: "movies", label: "Movies", Icon: Tv },
    { id: "popculture", label: "Pop-Culture", Icon: Sparkles },
    { id: "trending", label: "Trending", Icon: TrendingUp },
    { id: "collabs", label: "Collabs", Icon: User },
    { id: "community", label: "Community", Icon: Users },
  ];

  // Transform pinned coins data (max 6)
  const pinnedCoins: Coin[] = useMemo(() => {
    if (!pinnedCoinsData || loadingPinnedCoins) return [];

    const rawCoins = Array.isArray(pinnedCoinsData) ? pinnedCoinsData : [];

    return rawCoins.slice(0, 6).map((coin: any) => ({
      id: coin.id || coin.address,
      name: coin.name || "Unnamed Coin",
      symbol: coin.symbol || "???",
      address: coin.address,
      image: coin.image,
      marketCap: coin.market_cap || coin.marketCap || "0",
      volume24h: coin.volume_24h || coin.volume24h || "0",
      holders: coin.holders || 0,
      creator: coin.creator_wallet || coin.creatorWallet || coin.creator,
      createdAt: coin.created_at || coin.createdAt,
      category: "Platform",
      platform: "platform",
      creator_wallet: coin.creator_wallet || coin.creatorWallet || coin.creator,
      metadata: coin,
    }));
  }, [pinnedCoinsData, loadingPinnedCoins]);

  // Transform Zora coins data to match our Coin type
  const zoraCoins: Coin[] = useMemo(() => {
    if (!zoraCoinsData?.coins) return [];

    return zoraCoinsData.coins.map((coin: any) => ({
      id: coin.id || coin.address,
      name: coin.name || "Unnamed Coin",
      symbol: coin.symbol || "???",
      address: coin.address,
      image:
        coin.mediaContent?.previewImage?.medium ||
        coin.mediaContent?.previewImage?.small,
      marketCap: coin.marketCap ? parseFloat(coin.marketCap).toFixed(2) : "0",
      volume24h: coin.volume24h ? parseFloat(coin.volume24h).toFixed(2) : "0",
      holders: coin.uniqueHolders || 0,
      creator: coin.creatorAddress,
      createdAt: coin.createdAt,
      category: "zora",
      platform: "zora",
      creator_wallet: coin.creatorAddress,
      metadata: coin,
    }));
  }, [zoraCoinsData]);

  // Combine pinned coins first, then Zora coins (limit total to 12)
  const displayCoins: Coin[] = useMemo(() => {
    const combined = [...pinnedCoins, ...zoraCoins];
    return combined.slice(0, 12);
  }, [pinnedCoins, zoraCoins]);

  const filteredCoins = useMemo(() => {
    if (!displayCoins.length) return [];
    if (selectedCategory === "trending") return displayCoins;
    return displayCoins.filter(
      (coin) => getCoinCategoryBucket(coin) === selectedCategory,
    );
  }, [displayCoins, selectedCategory]);

  const filteredCreators = useMemo(() => {
    if (!trendingCreators) return [];
    if (selectedCategory === "trending") return trendingCreators;
    const categoryKey = selectedCategory.toLowerCase();
    return trendingCreators.filter((creator) => {
      const categories =
        creator.categories?.map((category) => category.toLowerCase()) || [];

      if (categoryKey === "collabs") {
        return (
          categories.includes("collab") ||
          categories.includes("collabs") ||
          categories.includes("collaboration") ||
          categories.includes("collaborations")
        );
      }

      if (categoryKey === "community") {
        return (
          categories.includes("community") ||
          categories.includes("communities") ||
          categories.includes("school") ||
          categories.includes("schools") ||
          categories.includes("event") ||
          categories.includes("events")
        );
      }

      return categories.includes(categoryKey);
    });
  }, [trendingCreators, selectedCategory]);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === "left" ? -400 : 400;
      scrollContainerRef.current.scrollBy({
        left: scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const openTradeModal = (coin: Coin) => {
    if (isMobile) {
      setSelectedCoin(coin);
      setIsTradeModalOpen(true);
    } else {
      setLocation(`/coin/${coin.address}`);
    }
  };

  // Check for referral code in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');

    if (refCode) {
      // Fetch OG meta for this referral
      fetch(`/api/og-meta/referral/${encodeURIComponent(refCode)}`)
        .then(res => res.json())
        .then(meta => {
          updateOGMeta({
            title: meta.title,
            description: meta.description,
            image: meta.image,
            url: meta.url,
          });
        })
        .catch(err => console.error('Failed to load referral OG meta:', err));
    }
  }, []);

  const renderMobileNav = () => (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-3 z-50 md:hidden">
      <div className="flex justify-around items-center">
        <button
          onClick={() => setLocation("/")}
          className="flex flex-col items-center text-foreground/70 hover:text-foreground"
        >
          <Sparkles className="w-6 h-6" />
          <span className="text-xs font-medium">Explore</span>
        </button>
        <button
          onClick={() => setLocation("/search")}
          className="flex flex-col items-center text-foreground/70 hover:text-foreground"
        >
          <Search className="w-6 h-6" />
          <span className="text-xs font-medium">Search</span>
        </button>
        <button
          onClick={() => setLocation("/create")}
          className="flex flex-col items-center text-foreground/70 hover:text-foreground"
        >
          <PlusCircle className="w-6 h-6" />
          <span className="text-xs font-medium">Create</span>
        </button>
        <button
          onClick={() => setLocation("/creators")}
          className="flex flex-col items-center text-foreground/70 hover:text-foreground"
        >
          <div className="relative">
            <Users className="w-6 h-6" />
            <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full h-4 min-w-4 px-1 flex items-center justify-center text-[8px] font-bold">
              New
            </div>
          </div>
          <span className="text-xs font-medium">Creators</span>
        </button>
        <button
          onClick={() => setLocation("/profile")}
          className="flex flex-col items-center text-foreground/70 hover:text-foreground"
        >
          <User className="w-6 h-6" />
          <span className="text-xs font-medium">Profile</span>
        </button>
      </div>
    </nav>
  );


  return (
    <div className="container max-w-5xl mx-auto px-4 py-4 space-y-2.5 md:py-8 md:space-y-4">
      {/* Instagram Stories Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between" />
        {!zoraCreators ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex-shrink-0">
                <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        ) : filteredCreators.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">
              No creators available yet. Be the first to create!
            </p>
          </div>
        ) : (
          <TopCreatorsStories creators={filteredCreators} limit={10} />
        )}

        <div className="flex items-center justify-center gap-1 overflow-x-auto pb-0.5">
          {categories.map((category) => (
            <Button
              key={category.id}
              size="sm"
              variant={selectedCategory === category.id ? "default" : "secondary"}
              className="h-[14px] shrink-0 rounded-full px-2 text-[10px] border-0"
              onClick={() => setSelectedCategory(category.id)}
            >
              <category.Icon className="mr-1 h-3 w-3" />
              {category.label}
            </Button>
          ))}
        </div>
      </section>

      {/* Trending Coins */}
      <section className="space-y-4 -mt-2 md:mt-0" data-tour="trending-coins">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1"></div>
        </div>

        {/* Discover heading - Mobile only */}
      <div className="md:hidden">
        <h2 className="text-lg font-semibold text-foreground mb-4">Discover</h2>
      </div>

      {/* Coins Grid */}
      {(loadingZoraCoins || loadingPinnedCoins) ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-1">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="h-64 bg-card rounded-2xl animate-pulse"
                data-testid="skeleton-coin-card"
              />
            ))}
          </div>
        ) : filteredCoins.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-1">
            {filteredCoins.map((coin: Coin) => (
              <CoinCard
                key={coin.id || coin.address}
                coin={coin}
                onClick={() => openTradeModal(coin)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No coins available at the moment
            </p>
          </div>
        )}
      </section>

      {selectedCoin && isMobile && (
        <TradeModalMobile
          coin={selectedCoin}
          open={isTradeModalOpen}
          onOpenChange={setIsTradeModalOpen}
        />
      )}
      {isMobile && renderMobileNav()}
    </div>
  );
}
