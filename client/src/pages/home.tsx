import { useQuery } from "@tanstack/react-query";
import { CreatorCard } from "@/components/creator-card";
import { CoinCard } from "@/components/coin-card";
import { TopCreatorsStories } from "@/components/top-creators-stories";
import { Button } from "@/components/ui/button";
import ProfileCardModal from "@/components/profile-card-modal";
import { useToast } from "@/hooks/use-toast";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ShareModal } from "@/components/share-modal";
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
  UserPlus,
  UserCheck,
  MessageCircle,
  Share2,
  ChevronLeft,
  Heart,
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
import { useFxRates, convertUsdToNgn } from "@/lib/fx";
import { formatSmartCurrency } from "@/lib/utils";

type Coin = {
  id: string;
  name: string;
  symbol: string;
  address: string;
  image?: string;
  marketCap?: string;
  volume24h?: string;
  totalSupply?: string;
  tokenPriceUsd?: string;
  holders?: number;
  creator?: string;
  createdAt?: string;
  category?: string;
  platform?: string;
  creator_wallet?: string;
  metadata?: any;
};

const formatCompactCount = (value: number) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

type SwapActivityEdge = {
  node: {
    coinAmount: string;
    blockTimestamp: string;
    currencyAmountWithPrice?: {
      priceUsdc?: string;
      currencyAmount?: { amountDecimal: number };
    };
  };
};

type SwapActivitiesResponse = {
  edges?: SwapActivityEdge[];
};

type HolderPreview = {
  address: string;
  avatarUrl?: string | null;
  handle?: string | null;
  isFollowing?: boolean;
};

function CoinMCSparkline({
  coin,
  marketCapNgn,
  volumeNgn,
  fxRates,
  enabled,
}: {
  coin: Coin;
  marketCapNgn: number | null;
  volumeNgn: number | null;
  fxRates?: { usd_ngn: number } | null;
  enabled: boolean;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { data: swapsData } = useQuery<SwapActivitiesResponse>({
    queryKey: ["/api/zora/coins/swaps", coin.address],
    enabled: enabled && Boolean(coin.address),
    queryFn: async () => {
      const response = await fetch(`/api/zora/coins/swaps/${coin.address}?first=24`);
      if (!response.ok) throw new Error("Failed to fetch coin swaps");
      return response.json();
    },
    staleTime: 15_000,
    refetchInterval: enabled ? 15_000 : false,
  });

  const { data: coinDetails } = useQuery<any>({
    queryKey: ["/api/zora/coin", coin.address],
    enabled: enabled && Boolean(coin.address) && (!coin.totalSupply || !coin.tokenPriceUsd),
    queryFn: async () => {
      const response = await fetch(`/api/zora/coin/${coin.address}`);
      if (!response.ok) throw new Error("Failed to fetch coin details");
      return response.json();
    },
    staleTime: 60_000,
  });

  const totalSupplyRaw = coin.totalSupply || coinDetails?.totalSupply;
  const tokenPriceUsdRaw = coin.tokenPriceUsd || coinDetails?.tokenPrice?.priceInUsdc;
  const marketCapUsdRaw = coin.marketCap || coinDetails?.marketCap;

  let totalSupply = totalSupplyRaw ? parseFloat(totalSupplyRaw) : NaN;
  if (!Number.isFinite(totalSupply) || totalSupply <= 0) {
    const priceUsd = tokenPriceUsdRaw ? parseFloat(tokenPriceUsdRaw) : NaN;
    const mcUsd = marketCapUsdRaw ? parseFloat(marketCapUsdRaw) : NaN;
    if (Number.isFinite(priceUsd) && priceUsd > 0 && Number.isFinite(mcUsd)) {
      totalSupply = mcUsd / priceUsd;
    }
  }

  const swapEdges = swapsData?.edges || [];
  const mcSeries = useMemo(() => {
    if (!swapEdges.length || !Number.isFinite(totalSupply) || totalSupply <= 0) {
      return [];
    }

    const series = swapEdges
      .map((edge) => edge.node)
      .filter(
        (node) =>
          node?.currencyAmountWithPrice?.priceUsdc &&
          node?.currencyAmountWithPrice?.currencyAmount?.amountDecimal &&
          node?.coinAmount,
      )
      .map((node) => {
        const priceUsdc = parseFloat(node.currencyAmountWithPrice!.priceUsdc!);
        const currencyAmount = Number(
          node.currencyAmountWithPrice!.currencyAmount!.amountDecimal,
        );
        const coinAmount = parseFloat(node.coinAmount);
        if (!priceUsdc || !currencyAmount || !coinAmount) return null;
        const pricePerCoinUsd = (currencyAmount * priceUsdc) / coinAmount;
        const mcUsd = pricePerCoinUsd * totalSupply;
        const mcNgn = convertUsdToNgn(mcUsd, fxRates as any);
        return {
          timestamp: node.blockTimestamp,
          mcNgn: mcNgn ?? mcUsd,
        };
      })
      .filter((item): item is { timestamp: string; mcNgn: number } => Boolean(item))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return series;
  }, [swapEdges, totalSupply, fxRates]);

  const values = mcSeries.map((point) => point.mcNgn);
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 0;

  const points = values.map((value, i) => {
    const x = values.length > 1 ? (i / (values.length - 1)) * 100 : 50;
    const normalized = (value - minValue) / (maxValue - minValue || 1);
    const y = 24 - normalized * 16;
    return { x, y, value };
  });

  const sparkPoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const sparkAreaPoints = `0,28 ${sparkPoints} 100,28`;
  const sparkIdBase = `${coin.id || coin.address}`.replace(/[^a-zA-Z0-9]/g, "");
  const sparkId = (sparkIdBase || `spark${coin.address}`).slice(0, 12);

  const activeIndex =
    hoverIndex !== null && points[hoverIndex]
      ? hoverIndex
      : points.length
        ? points.length - 1
        : null;
  const activePoint = activeIndex !== null ? points[activeIndex] : null;
  const displayMarketCap =
    activePoint?.value ??
    marketCapNgn ??
    convertUsdToNgn(marketCapUsdRaw, fxRates as any) ??
    0;

  return (
    <div className="flex flex-col items-end gap-2 text-white/70">
      <div className="rounded-lg border border-white/5 bg-white/5 px-2 py-1.5 backdrop-blur-sm">
        <svg
          viewBox="0 0 100 28"
          className="h-6 w-[84px]"
          preserveAspectRatio="none"
          onPointerMove={(event) => {
            if (!points.length) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = (event.clientX - rect.left) / rect.width;
            const index = Math.round(ratio * (points.length - 1));
            const clamped = Math.max(0, Math.min(points.length - 1, index));
            setHoverIndex(clamped);
          }}
          onPointerLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient
              id={`spark-fill-${sparkId}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#1CAC78" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#1CAC78" stopOpacity="0.08" />
            </linearGradient>
          </defs>
          {points.length ? (
            <>
              <polygon points={sparkAreaPoints} fill={`url(#spark-fill-${sparkId})`} />
            </>
          ) : null}
        </svg>
      </div>
      <div className="flex flex-col items-end text-[10px]">
        <span>MC {formatSmartCurrency(displayMarketCap)}</span>
        <span>Vol {formatSmartCurrency(volumeNgn ?? 0)}</span>
      </div>
    </div>
  );
}

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
  const [tradeModalTab, setTradeModalTab] = useState<
    "trade" | "chart" | "comments" | "holders" | "details" | "activity"
  >("trade");
  const [isProfileCardOpen, setIsProfileCardOpen] = useState(false);
  const [profileCardAddress, setProfileCardAddress] = useState("");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareResourceId, setShareResourceId] = useState("");
  const [shareTitle, setShareTitle] = useState("");
  const [isMobileViewerOpen, setIsMobileViewerOpen] = useState(false);
  const [mobileViewerIndex, setMobileViewerIndex] = useState(0);
  const mobileViewerRef = useRef<HTMLDivElement>(null);
  const mobileTouchStartYRef = useRef<number | null>(null);
  const mobileTouchStartIndexRef = useRef(0);
  const mobileTouchActiveRef = useRef(false);
  const mobileFeaturedSeedRef = useRef(Math.random());
  const [featuredPriceByAddress, setFeaturedPriceByAddress] = useState<
    Record<string, number>
  >({});
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  const { data: fxRates } = useFxRates();
  const { toast } = useToast();
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const currentUserAddress =
    wallets[0]?.address || user?.wallet?.address || user?.id || "";
  const [followStatusByCreator, setFollowStatusByCreator] = useState<
    Record<string, { isFollowing: boolean; followersCount: number }>
  >({});
  const [likeStatusByCoin, setLikeStatusByCoin] = useState<
    Record<string, { liked: boolean; likesCount: number }>
  >({});
  const [followingAddresses, setFollowingAddresses] = useState<string[]>([]);
  const [holderPreviewByCoin, setHolderPreviewByCoin] = useState<
    Record<string, { holders: HolderPreview[]; total: number }>
  >({});


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
      totalSupply: coin.total_supply || coin.totalSupply || "0",
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
      totalSupply: coin.totalSupply || "0",
      tokenPriceUsd: coin.tokenPrice?.priceInUsdc,
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

  const featuredCandidates = useMemo(() => {
    if (!filteredCoins.length) return [];
    const withVolume = filteredCoins.filter((coin) => {
      const volume = typeof coin.volume24h === "string"
        ? parseFloat(coin.volume24h)
        : Number(coin.volume24h || 0);
      return Number.isFinite(volume) && volume > 0;
    });
    const sorted = [...withVolume].sort((a, b) => {
      const volA = typeof a.volume24h === "string" ? parseFloat(a.volume24h) : Number(a.volume24h || 0);
      const volB = typeof b.volume24h === "string" ? parseFloat(b.volume24h) : Number(b.volume24h || 0);
      return volB - volA;
    });
    const top = sorted.slice(0, Math.min(8, sorted.length));
    return top.length ? top : filteredCoins;
  }, [filteredCoins]);

  const featuredPool = useMemo(() => {
    if (!featuredCandidates.length) return [];
    let seed = Math.floor(mobileFeaturedSeedRef.current * 233280) || 1;
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const shuffled = [...featuredCandidates];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [featuredCandidates]);

  useEffect(() => {
    if (!isMobile || !featuredPool.length) return;
    let cancelled = false;

    const loadPrices = async () => {
      const missing = featuredPool.filter(
        (coin) =>
          coin.address &&
          featuredPriceByAddress[coin.address] === undefined,
      );
      if (!missing.length) return;

      await Promise.all(
        missing.slice(0, 6).map(async (coin) => {
          if (!coin.address) return;
          try {
            const response = await fetch(`/api/zora/coin/${coin.address}`);
            if (!response.ok) return;
            const data = await response.json();
            const priceUsdRaw = data?.tokenPrice?.priceInUsdc;
            const priceUsd =
              typeof priceUsdRaw === "string"
                ? parseFloat(priceUsdRaw)
                : Number(priceUsdRaw);
            if (!Number.isFinite(priceUsd) || priceUsd <= 0) return;
            if (cancelled) return;
            setFeaturedPriceByAddress((prev) => ({
              ...prev,
              [coin.address]: priceUsd,
            }));
          } catch (error) {
            console.warn("Failed to fetch featured coin price:", error);
          }
        }),
      );
    };

    loadPrices();

    return () => {
      cancelled = true;
    };
  }, [isMobile, featuredPool, featuredPriceByAddress]);

  const mobileExploreItems = useMemo(() => {
    if (!isMobile) return [];
    const indexByKey = new Map<string, number>();
    filteredCoins.forEach((coin, idx) => {
      if (coin.address) indexByKey.set(coin.address, idx);
      if (coin.id) indexByKey.set(coin.id, idx);
    });
    const items: Array<{
      type: "coin" | "featured";
      coin: Coin;
      coinIndex: number;
      key: string;
    }> = [];
    let featuredCursor = 0;
    filteredCoins.forEach((coin, index) => {
      const key = coin.id || coin.address || `coin-${index}`;
      items.push({ type: "coin", coin, coinIndex: index, key });
      if ((index + 1) % 4 === 0 && index < filteredCoins.length - 1 && featuredPool.length) {
        let featuredCoin = featuredPool[featuredCursor % featuredPool.length];
        if (
          featuredPool.length > 1 &&
          featuredCoin.address &&
          featuredCoin.address === coin.address
        ) {
          featuredCursor += 1;
          featuredCoin = featuredPool[featuredCursor % featuredPool.length];
        }
        featuredCursor += 1;
        const featuredKey = featuredCoin.address || featuredCoin.id || `featured-${featuredCursor}`;
        const featuredIndex =
          (featuredCoin.address && indexByKey.get(featuredCoin.address)) ??
          (featuredCoin.id && indexByKey.get(featuredCoin.id)) ??
          index;
        items.push({
          type: "featured",
          coin: featuredCoin,
          coinIndex: featuredIndex,
          key: `featured-${featuredKey}-${featuredCursor}`,
        });
      }
    });

    return items;
  }, [filteredCoins, isMobile, featuredPool]);

  const getFeaturedMedia = (coin: Coin, fallback?: string | null) => {
    const items: string[] = [];
    const baseImage = fallback || coin.image || coin.metadata?.image || coin.metadata?.imageUrl;
    if (baseImage) items.push(baseImage);
    const media = Array.isArray(coin.metadata?.media) ? coin.metadata.media : [];
    media.forEach((entry: any) => {
      if (items.length >= 3) return;
      if (typeof entry === "string") {
        items.push(entry);
        return;
      }
      if (entry?.url) {
        items.push(entry.url);
      } else if (entry?.image) {
        items.push(entry.image);
      }
    });
    return items.filter(Boolean).slice(0, 3);
  };

  const renderFeaturedCoin = (coin: Coin, coinIndex: number) => {
    const displayImage =
      coin.image || coin.metadata?.image || coin.metadata?.imageUrl;
    const marketCapNgn = convertUsdToNgn(coin.marketCap, fxRates);
    const volumeNgn = convertUsdToNgn(coin.volume24h, fxRates);
    const mediaItems = getFeaturedMedia(coin, displayImage);
    const holdersCount = coin.holders || 0;
    const fallbackPriceUsd =
      typeof coin.tokenPriceUsd === "string"
        ? parseFloat(coin.tokenPriceUsd)
        : Number(coin.tokenPriceUsd);
    const resolvedPriceUsd =
      (coin.address && featuredPriceByAddress[coin.address]) ||
      (Number.isFinite(fallbackPriceUsd) && fallbackPriceUsd > 0
        ? fallbackPriceUsd
        : null);
    const priceNgn = resolvedPriceUsd
      ? convertUsdToNgn(resolvedPriceUsd, fxRates)
      : null;
    const formatOrDash = (value: number | null) =>
      value === null ? "—" : formatSmartCurrency(value);

    return (
      <div
        key={`featured-${coin.id || coin.address}-${coinIndex}`}
        className="col-span-2"
        onClick={() => openExploreViewer(coin, coinIndex)}
      >
        <div className="rounded-2xl border border-border/40 bg-card/80 p-2 shadow-sm">
          <div className="flex items-center justify-between text-[9px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1">
                {displayImage ? (
                  <>
                    <div className="h-6 w-6 overflow-hidden rounded-full border border-border/60 bg-muted/30">
                      <img
                        src={displayImage}
                        alt={coin.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="h-6 w-6 overflow-hidden rounded-full border border-border/60 bg-muted/30">
                      <img
                        src={displayImage}
                        alt={coin.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </>
                ) : (
                  <div className="h-6 w-6 rounded-full border border-border/60 bg-muted/30" />
                )}
              </div>
              {volumeNgn !== null ? (
                <span className="text-foreground">
                  {formatSmartCurrency(volumeNgn)} traded in 24h
                </span>
              ) : (
                <span className="text-muted-foreground">No 24h volume yet</span>
              )}
            </div>
            <span className="text-[9px] text-muted-foreground">24h</span>
          </div>

          <div className="mt-2 rounded-2xl border border-border/40 bg-muted/10 p-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-10 w-10 overflow-hidden rounded-full bg-muted/30">
                  {displayImage ? (
                    <img
                      src={displayImage}
                      alt={coin.name}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold truncate max-w-[140px]">
                    {coin.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    ₦{coin.symbol}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[12px] font-semibold">
                  {formatOrDash(marketCapNgn)}
                </p>
                <p className="text-[9px] text-muted-foreground">Market Cap</p>
              </div>
            </div>

            {mediaItems.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {mediaItems.map((src, idx) => (
                  <div
                    key={`${coin.id || coin.address}-media-${idx}`}
                    className="h-14 overflow-hidden rounded-lg bg-muted/30"
                  >
                    <img
                      src={src}
                      alt={`${coin.name} media ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-2 grid grid-cols-3 gap-2 text-[9px] text-muted-foreground">
              <div>
                <p className="uppercase text-[8px] tracking-wide">Price</p>
                <p className="text-[12px] font-semibold text-foreground">
                  {formatOrDash(priceNgn)}
                </p>
              </div>
              <div>
                <p className="uppercase text-[8px] tracking-wide">Vol</p>
                <p className="text-[12px] font-semibold text-foreground">
                  {formatOrDash(volumeNgn)}
                </p>
              </div>
              <div>
                <p className="uppercase text-[8px] tracking-wide">Holders</p>
                <p className="text-[12px] font-semibold text-foreground">
                  {holdersCount > 0 ? formatCompactCount(holdersCount) : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === "left" ? -400 : 400;
      scrollContainerRef.current.scrollBy({
        left: scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const getCreatorAddress = (coin: Coin) =>
    coin.creator_wallet || coin.creator || coin.metadata?.creatorAddress || "";

  const getCoinKey = (coin: Coin) => coin.id || coin.address;

  const openExploreViewer = (coin: Coin, index: number) => {
    if (isMobile) {
      setSelectedCoin(coin);
      setMobileViewerIndex(index);
      setIsMobileViewerOpen(true);
    } else {
      setLocation(`/coin/${coin.address}`);
    }
  };

  const openTradeFromViewer = (coin: Coin) => {
    setTradeModalTab("trade");
    setSelectedCoin(coin);
    setIsTradeModalOpen(true);
  };

  const openCommentsFromViewer = (coin: Coin) => {
    setTradeModalTab("comments");
    setSelectedCoin(coin);
    setIsTradeModalOpen(true);
  };

  const openHoldersFromViewer = (coin: Coin) => {
    setTradeModalTab("holders");
    setSelectedCoin(coin);
    setIsTradeModalOpen(true);
  };

  const openProfileCard = (creatorAddress: string) => {
    if (!creatorAddress) {
      toast({
        title: "Profile unavailable",
        description: "This creator profile is not available yet.",
      });
      return;
    }
    setProfileCardAddress(creatorAddress);
    setIsProfileCardOpen(true);
  };

  const toggleFollow = async (creatorAddress: string) => {
    if (!creatorAddress) return;
    if (!currentUserAddress) {
      toast({
        title: "Sign in required",
        description: "Please sign in to follow creators.",
        variant: "destructive",
      });
      return;
    }
    if (creatorAddress === currentUserAddress) {
      toast({
        title: "Cannot follow yourself",
        variant: "destructive",
      });
      return;
    }

    const current = followStatusByCreator[creatorAddress];
    const isFollowing = current?.isFollowing ?? false;

    try {
      if (isFollowing) {
        const response = await fetch(
          `/api/follows/${encodeURIComponent(currentUserAddress)}/${encodeURIComponent(creatorAddress)}`,
          { method: "DELETE" },
        );
        if (!response.ok) throw new Error("Failed to unfollow");
      } else {
        const response = await fetch("/api/follows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            followerAddress: currentUserAddress,
            followingAddress: creatorAddress,
          }),
        });
        if (!response.ok) throw new Error("Failed to follow");
      }

      const followersRes = await fetch(
        `/api/follows/followers/${encodeURIComponent(creatorAddress)}`,
      );
      const followers = followersRes.ok ? await followersRes.json() : [];
      setFollowStatusByCreator((prev) => ({
        ...prev,
        [creatorAddress]: {
          isFollowing: !isFollowing,
          followersCount: Array.isArray(followers) ? followers.length : 0,
        },
      }));
    } catch (error) {
      console.error("Follow toggle error:", error);
      toast({
        title: "Follow failed",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleLike = async (coinKey: string) => {
    if (!coinKey) return;
    if (!currentUserAddress) {
      toast({
        title: "Sign in required",
        description: "Please sign in to like coins.",
        variant: "destructive",
      });
      return;
    }

    const current = likeStatusByCoin[coinKey];
    const liked = current?.liked ?? false;

    try {
      const response = await fetch(`/api/coins/${encodeURIComponent(coinKey)}/likes`, {
        method: liked ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserAddress }),
      });
      if (!response.ok) throw new Error("Failed to update like");
      const data = await response.json();
      setLikeStatusByCoin((prev) => ({
        ...prev,
        [coinKey]: {
          liked: Boolean(data?.liked),
          likesCount: Number(data?.count || 0),
        },
      }));
    } catch (error) {
      console.error("Like toggle error:", error);
      toast({
        title: "Like failed",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const shareFromViewer = async (coin: Coin) => {
    const target = coin.address || coin.id;
    if (!target) return;
    setShareResourceId(String(target));
    setShareTitle(coin.name || "Coin");
    setIsShareModalOpen(true);
  };

  const goToMobileIndex = (index: number) => {
    const clamped = Math.max(0, Math.min(filteredCoins.length - 1, index));
    setMobileViewerIndex(clamped);
  };

  useEffect(() => {
    if (!isMobileViewerOpen) return;
    const activeCoin = filteredCoins[mobileViewerIndex];
    if (!activeCoin) return;

    const creatorAddress = getCreatorAddress(activeCoin);
    const coinKey = getCoinKey(activeCoin);
    let cancelled = false;

    const loadFollow = async () => {
      if (!creatorAddress) return;
      try {
        const followersRes = await fetch(
          `/api/follows/followers/${encodeURIComponent(creatorAddress)}`,
        );
        const followers = followersRes.ok ? await followersRes.json() : [];
        let isFollowing = false;
          if (currentUserAddress && creatorAddress !== currentUserAddress) {
            const followRes = await fetch(
              `/api/follows/check/${encodeURIComponent(currentUserAddress)}/${encodeURIComponent(creatorAddress)}`,
            );
          const followData = followRes.ok ? await followRes.json() : null;
          isFollowing = Boolean(followData?.isFollowing);
        }
        if (!cancelled) {
          setFollowStatusByCreator((prev) => ({
            ...prev,
            [creatorAddress]: {
              isFollowing,
              followersCount: Array.isArray(followers) ? followers.length : 0,
            },
          }));
        }
      } catch (error) {
        console.error("Load follow state error:", error);
      }
    };

    const loadLikes = async () => {
      if (!coinKey) return;
      try {
        const response = await fetch(
          `/api/coins/${encodeURIComponent(coinKey)}/likes${currentUserAddress ? `?userId=${encodeURIComponent(currentUserAddress)}` : ""}`,
        );
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) {
          setLikeStatusByCoin((prev) => ({
            ...prev,
            [coinKey]: {
              liked: Boolean(data?.liked),
              likesCount: Number(data?.count || 0),
            },
          }));
        }
      } catch (error) {
        console.error("Load like state error:", error);
      }
    };

    loadFollow();
    loadLikes();

    return () => {
      cancelled = true;
    };
  }, [
    isMobileViewerOpen,
    mobileViewerIndex,
    filteredCoins,
    currentUserAddress,
  ]);

  useEffect(() => {
    if (!isMobileViewerOpen) return;
    if (!currentUserAddress) {
      setFollowingAddresses([]);
      return;
    }

    let cancelled = false;
    const loadFollowing = async () => {
      try {
        const response = await fetch(
          `/api/follows/following/${encodeURIComponent(currentUserAddress)}`,
        );
        if (!response.ok) {
          if (!cancelled) setFollowingAddresses([]);
          return;
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
          if (!cancelled) setFollowingAddresses([]);
          return;
        }
        const addresses = data
          .map(
            (follow) =>
              follow?.followingAddress ||
              follow?.creator_address ||
              follow?.following_address,
          )
          .filter(
            (address) => typeof address === "string" && address.startsWith("0x"),
          )
          .map((address) => address.toLowerCase());
        if (!cancelled) setFollowingAddresses(addresses);
      } catch (error) {
        console.error("Load following error:", error);
        if (!cancelled) setFollowingAddresses([]);
      }
    };

    loadFollowing();

    return () => {
      cancelled = true;
    };
  }, [isMobileViewerOpen, currentUserAddress]);

  useEffect(() => {
    if (!isMobileViewerOpen) return;
    const activeCoin = filteredCoins[mobileViewerIndex];
    if (!activeCoin?.address) return;
    const coinKey = getCoinKey(activeCoin);
    if (!coinKey) return;

    let cancelled = false;
    const loadHolderPreview = async () => {
      try {
        const response = await fetch(
          `/api/zora/coins/holders/${activeCoin.address}?count=40`,
        );
        if (!response.ok) throw new Error("Failed to fetch holders");
        const data = await response.json();
        const edges = Array.isArray(data?.edges) ? data.edges : [];
        const total =
          typeof data?.count === "number"
            ? data.count
            : activeCoin.holders || edges.length;
        const followingSet = new Set(
          followingAddresses.map((address) => address.toLowerCase()),
        );

        let followedHolders: Array<{ address: string; balance: number }> = [];
        if (followingAddresses.length > 0) {
          try {
            const followResponse = await fetch("/api/coins/holders/check", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                coinAddress: activeCoin.address,
                addresses: followingAddresses,
              }),
            });
            if (followResponse.ok) {
              const followData = await followResponse.json();
              if (Array.isArray(followData?.holders)) {
                followedHolders = followData.holders;
              }
            }
          } catch (error) {
            console.warn("Failed to check followed holder balances:", error);
          }
        }

        const holders = edges
          .map((edge: any) => {
            const node = edge?.node || edge;
            const address =
              node?.ownerAddress ||
              node?.owner_address ||
              node?.address ||
              "";
            if (!address) return null;
            const profile = node?.ownerProfile || {};
            const preview = profile?.avatar?.previewImage || {};
            const avatarUrl =
              preview?.small ||
              preview?.medium ||
              profile?.avatar?.small ||
              profile?.avatar?.medium ||
              null;
            const isFollowing = followingSet.has(address.toLowerCase());
            return {
              address,
              avatarUrl,
              handle: profile?.handle || null,
              isFollowing,
            };
          })
          .filter(Boolean) as HolderPreview[];

        const holderAddressSet = new Set(
          holders.map((holder) => holder.address.toLowerCase()),
        );

        followedHolders.forEach((holder) => {
          const address = holder.address;
          if (!address) return;
          const key = address.toLowerCase();
          if (holderAddressSet.has(key)) return;
          holderAddressSet.add(key);
          holders.push({
            address,
            avatarUrl: null,
            handle: null,
            isFollowing: true,
          });
        });

        holders.sort((a, b) => {
          if (a.isFollowing === b.isFollowing) return 0;
          return a.isFollowing ? -1 : 1;
        });

        const unique: HolderPreview[] = [];
        const seen = new Set<string>();
        for (const holder of holders) {
          const key = holder.address.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          unique.push(holder);
        }

        if (!cancelled) {
          setHolderPreviewByCoin((prev) => ({
            ...prev,
            [coinKey]: {
              holders: unique,
              total,
            },
          }));
        }
      } catch (error) {
        console.error("Load holder preview error:", error);
        if (!cancelled) {
          setHolderPreviewByCoin((prev) => ({
            ...prev,
            [coinKey]: {
              holders: [],
              total: activeCoin.holders || 0,
            },
          }));
        }
      }
    };

    loadHolderPreview();

    return () => {
      cancelled = true;
    };
  }, [isMobileViewerOpen, mobileViewerIndex, filteredCoins, followingAddresses]);

  useEffect(() => {
    if (!isMobileViewerOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileViewerOpen, mobileViewerIndex, filteredCoins.length]);

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
    <div className="container max-w-5xl mx-auto px-4 pt-2 pb-4 space-y-2 md:py-8 md:space-y-4">
      {/* Instagram Stories Section */}
      <section className="space-y-2 md:space-y-3">
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

        <div className="flex items-center justify-center gap-1 overflow-x-auto pb-0">
          {categories.map((category) => (
            <Button
              key={category.id}
              size="sm"
              variant={selectedCategory === category.id ? "default" : "secondary"}
              className="min-h-0 h-5 md:h-6 shrink-0 rounded-[6px] md:rounded-full px-1.5 md:px-2.5 py-0 text-[9px] md:text-[10px] leading-none border-0 gap-1.5 [&_svg]:size-3 md:[&_svg]:size-3"
              onClick={() => setSelectedCategory(category.id)}
              aria-label={category.label}
            >
              <category.Icon
                className={selectedCategory === category.id ? "mr-1" : "mr-0 md:mr-1"}
              />
              <span
                className="inline md:inline"
              >
                {category.label}
              </span>
            </Button>
          ))}
        </div>
      </section>

      {/* Trending Coins */}
      <section className="space-y-2 -mt-2 md:mt-0" data-tour="trending-coins">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1"></div>
        </div>

      {/* Discover heading - Mobile only */}
      <div className="md:hidden">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold text-foreground">Discover</h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-2 text-[9px] text-muted-foreground"
            onClick={() => setLocation("/creators")}
          >
            See All
          </Button>
        </div>
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
            {isMobile
              ? mobileExploreItems.map((item) =>
                  item.type === "featured" ? (
                    renderFeaturedCoin(item.coin, item.coinIndex)
                  ) : (
                    <CoinCard
                      key={item.key}
                      coin={item.coin}
                      onClick={() =>
                        openExploreViewer(item.coin, item.coinIndex)
                      }
                      onTrade={() => {
                        if (isMobile) {
                          openTradeFromViewer(item.coin);
                        } else {
                          setLocation(`/coin/${item.coin.address}`);
                        }
                      }}
                    />
                  ),
                )
              : filteredCoins.map((coin: Coin, index: number) => (
                  <CoinCard
                    key={coin.id || coin.address}
                    coin={coin}
                    onClick={() => openExploreViewer(coin, index)}
                    onTrade={() => {
                      if (isMobile) {
                        openTradeFromViewer(coin);
                      } else {
                        setLocation(`/coin/${coin.address}`);
                      }
                    }}
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

      {isMobile && isMobileViewerOpen && (
        <div className="fixed inset-0 z-[60] bg-black text-white">
          <div
            ref={mobileViewerRef}
            className="h-full overflow-hidden"
            style={{
              overscrollBehaviorY: "contain",
              touchAction: "none",
            }}
            onTouchStart={(event) => {
              const container = mobileViewerRef.current;
              if (!container) return;
              mobileTouchActiveRef.current = true;
              mobileTouchStartYRef.current = event.touches[0]?.clientY ?? null;
              mobileTouchStartIndexRef.current = mobileViewerIndex;
            }}
            onTouchMove={(event) => {
              if (mobileTouchActiveRef.current) {
                event.preventDefault();
              }
            }}
            onTouchEnd={(event) => {
              const startY = mobileTouchStartYRef.current;
              const endY = event.changedTouches[0]?.clientY ?? null;
              const container = mobileViewerRef.current;
              if (startY === null || endY === null || !container) {
                mobileTouchActiveRef.current = false;
                return;
              }
              const delta = startY - endY;
              const threshold = 60;
              let targetIndex = mobileTouchStartIndexRef.current;
              if (Math.abs(delta) > threshold) {
                targetIndex += delta > 0 ? 1 : -1;
              }
              mobileTouchActiveRef.current = false;
              goToMobileIndex(targetIndex);
            }}
          >
            <div
              className="h-full w-full transition-transform duration-300 ease-out"
              style={{
                height: `${filteredCoins.length * 100}dvh`,
                transform: `translateY(-${mobileViewerIndex * 100}dvh)`,
              }}
            >
              {filteredCoins.map((coin, index) => {
                const displayImage =
                  coin.image || coin.metadata?.image || coin.metadata?.imageUrl;
                const marketCapNgn = convertUsdToNgn(coin.marketCap, fxRates);
                const volumeNgn = convertUsdToNgn(coin.volume24h, fxRates);
                const creatorHandle = coin.symbol
                  ? `@${coin.symbol.toLowerCase()}`
                  : "@creator";
                const description =
                  coin.metadata?.description ||
                  coin.metadata?.bio ||
                  coin.metadata?.tagline;
                const isActive = Math.abs(index - mobileViewerIndex) <= 1;
                const creatorAddress = getCreatorAddress(coin);
                const followInfo = creatorAddress
                  ? followStatusByCreator[creatorAddress]
                  : undefined;
                const followersCount = followInfo?.followersCount ?? 0;
                const isFollowing = followInfo?.isFollowing ?? false;
                const coinKey = getCoinKey(coin);
                const likeInfo = coinKey ? likeStatusByCoin[coinKey] : undefined;
                const likesCount = likeInfo?.likesCount ?? 0;
                const isLiked = likeInfo?.liked ?? false;
                const holderPreview = coinKey
                  ? holderPreviewByCoin[coinKey]
                  : undefined;
                const holderTotal =
                  holderPreview?.total ?? coin.holders ?? 0;
                const holdersForPreview = holderPreview?.holders || [];
                const previewHolders = holdersForPreview.slice(0, 3);
                const othersCount = Math.max(0, holderTotal - previewHolders.length);

                return (
                  <div
                    key={coin.id || coin.address}
                    data-coin-index={index}
                    className="relative h-[100dvh] overflow-hidden"
                  >
                  {displayImage ? (
                    <img
                      src={displayImage}
                      alt={coin.name}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-black to-neutral-900" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/10" />

                  <div className="absolute left-4 top-4 z-20 flex items-center gap-2 text-[11px] text-white/80">
                    <button
                      type="button"
                      onClick={() => setIsMobileViewerOpen(false)}
                      className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-3 py-1 backdrop-blur"
                      aria-label="Back to Explore"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="absolute right-4 top-4 z-20">
                    <CoinMCSparkline
                      coin={coin}
                      marketCapNgn={marketCapNgn}
                      volumeNgn={volumeNgn}
                      fxRates={fxRates ?? null}
                      enabled={isActive}
                    />
                  </div>

                  <div className="relative z-10 flex h-full flex-col justify-end px-4 pb-6">
                    <div className="flex items-end justify-between gap-4">
                      <div className="max-w-[78%] space-y-2.5">
                        <div className="flex items-center gap-2">
                          <div className="relative h-8 w-8">
                            <button
                              type="button"
                              onClick={() => openProfileCard(creatorAddress)}
                              className="h-full w-full overflow-hidden rounded-full border border-white/60 bg-white/10"
                              aria-label="Open creator profile"
                            >
                              {displayImage ? (
                                <img
                                  src={displayImage}
                                  alt={coin.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-sm font-semibold">
                                  {coin.name?.[0] || "E"}
                                </div>
                              )}
                            </button>
                            <span className="pointer-events-none absolute -bottom-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full border border-white/80 bg-emerald-400 text-[8px] font-semibold text-black shadow">
                              ✓
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold">
                                {coin.name}
                              </p>
                            </div>
                            <p className="text-[11px] text-white/70">
                              {creatorHandle}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-3.5 rounded-[3px] border border-emerald-400/60 bg-emerald-500/90 px-1.5 text-[8px] text-white shadow-sm hover:bg-emerald-500"
                            onClick={() => openTradeFromViewer(coin)}
                          >
                            Trade
                          </Button>
                        </div>

                        {description ? (
                          <p className="text-[11px] text-white/80 line-clamp-2">
                            {description}
                          </p>
                        ) : null}

                        {holderTotal > 0 ? (
                          <button
                            type="button"
                            onClick={() => openHoldersFromViewer(coin)}
                            className="flex items-center gap-2 text-[10px] text-white/70 hover:text-white"
                            aria-label="View holders"
                          >
                            {previewHolders.length > 0 ? (
                              <div className="flex -space-x-1">
                                {previewHolders.map((holder) => {
                                  const initial =
                                    holder.handle?.[0] ||
                                    holder.address?.replace(/^0x/, "")?.[0] ||
                                    "H";
                                  return (
                                    <div
                                      key={holder.address}
                                      className="h-4 w-4 overflow-hidden rounded-full border border-white/40 bg-white/10"
                                      title={holder.handle || holder.address}
                                    >
                                      {holder.avatarUrl ? (
                                        <img
                                          src={holder.avatarUrl}
                                          alt={holder.handle || holder.address}
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-[7px] font-semibold text-white/70">
                                          {String(initial).toUpperCase()}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                            <span>
                              {previewHolders.length > 0
                                ? othersCount > 0
                                  ? `and ${formatCompactCount(othersCount)} others holding this coin`
                                  : `${formatCompactCount(holderTotal)} holding this coin`
                                : `${formatCompactCount(holderTotal)} holders`}
                            </span>
                          </button>
                        ) : null}

                        <div className="flex flex-nowrap items-center gap-3 text-[11px] text-white/80 whitespace-nowrap">
                          <button
                            type="button"
                            className="flex items-center gap-1.5 hover:text-white"
                            aria-label={isFollowing ? "Unfollow" : "Follow"}
                            onClick={() => toggleFollow(creatorAddress)}
                          >
                            {isFollowing ? (
                              <UserCheck className="h-4.5 w-4.5 text-emerald-300" />
                            ) : (
                              <UserPlus className="h-4.5 w-4.5" />
                            )}
                            <span className="text-[11px]">{followersCount}</span>
                          </button>
                          <button
                            type="button"
                            className="flex items-center gap-1.5 hover:text-white"
                            aria-label="Comment"
                            onClick={() => openCommentsFromViewer(coin)}
                          >
                            <MessageCircle className="h-4.5 w-4.5" />
                            <span className="text-[11px]">0</span>
                          </button>
                          <button
                            type="button"
                            className="flex items-center gap-1.5 hover:text-white"
                            aria-label="Like"
                            onClick={() => toggleLike(coinKey)}
                          >
                            <Heart
                              className={`h-4.5 w-4.5 ${isLiked ? "text-rose-300" : ""}`}
                              fill={isLiked ? "currentColor" : "none"}
                            />
                            <span className="text-[11px]">{likesCount}</span>
                          </button>
                          <button
                            type="button"
                            className="flex items-center gap-1.5 hover:text-white"
                            aria-label="Share"
                            onClick={() => shareFromViewer(coin)}
                          >
                            <Share2 className="h-4.5 w-4.5" />
                            <span className="text-[11px]">0</span>
                          </button>
                        </div>

                        
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {selectedCoin && isMobile && (
        <TradeModalMobile
          coin={selectedCoin}
          open={isTradeModalOpen}
          onOpenChange={setIsTradeModalOpen}
          initialTab={tradeModalTab}
          mode="tab"
        />
      )}
      {profileCardAddress && (
        <ProfileCardModal
          creatorAddress={profileCardAddress}
          open={isProfileCardOpen}
          onOpenChange={setIsProfileCardOpen}
        />
      )}
      {shareResourceId && (
        <ShareModal
          open={isShareModalOpen}
          onOpenChange={setIsShareModalOpen}
          type="coin"
          resourceId={shareResourceId}
          title={shareTitle}
        />
      )}
      {isMobile && renderMobileNav()}
    </div>
  );
}
