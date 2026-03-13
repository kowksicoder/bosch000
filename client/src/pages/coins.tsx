import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CoinCard } from "@/components/coin-card";
import { Button } from "@/components/ui/button";
import { Coins } from "lucide-react";
import TradeModalMobile from "@/components/trade-modal-mobile";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

type ZoraCoin = {
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

export default function CoinsPage() {
  const [selectedCoin, setSelectedCoin] = useState<ZoraCoin | null>(null);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();

  // Fetch pinned coins
  const { data: pinnedCoinsData, isLoading: isLoadingPinned } = useQuery({
    queryKey: ["/api/coins/pinned"],
    queryFn: async () => {
      const response = await fetch("/api/coins/pinned?_=" + Date.now());
      if (!response.ok) throw new Error("Failed to fetch pinned coins");
      const data = await response.json();
      console.log("Pinned coins API response:", data);
      console.log("Type of response:", typeof data, Array.isArray(data));
      return data;
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Fetch platform coins (from database)
  const { data: coinsData, isLoading: isLoadingCoins } = useQuery({
    queryKey: ["/api/coins"],
    queryFn: async () => {
      const response = await fetch("/api/coins");
      if (!response.ok) throw new Error("Failed to fetch coins");
      return response.json();
    },
  });

  // Convert pinned coins to ZoraCoin format (limit to 6)
  const pinnedCoins: ZoraCoin[] = useMemo(() => {
    if (!pinnedCoinsData || isLoadingPinned) return [];
    
    const rawCoins = Array.isArray(pinnedCoinsData) ? pinnedCoinsData : [];
    console.log("Processing pinned coins:", rawCoins.length);
    
    return rawCoins.slice(0, 6).map((coin: any) => {
      console.log("Mapping pinned coin:", {
        name: coin.name,
        address: coin.address,
        pinOrder: coin.pin_order || coin.pinOrder
      });
      
      return {
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
      };
    });
  }, [pinnedCoinsData, isLoadingPinned]);

  console.log("Final pinned coins count:", pinnedCoins.length);
  if (pinnedCoins.length > 0) {
    console.log("First pinned coin:", pinnedCoins[0]);
  }

  const regularCoins: ZoraCoin[] = Array.isArray(coinsData) ? coinsData.map((coin: any) => ({
    id: coin.id || coin.coin_address,
    name: coin.name || "Unnamed Coin",
    symbol: coin.symbol || "???",
    address: coin.coin_address,
    image: coin.metadata?.image,
    marketCap: "0",
    volume24h: "0",
    holders: 0,
    creator: coin.creator_wallet,
    createdAt: coin.created_at,
    category: "Platform",
    platform: coin.metadata?.platform || "platform",
    creator_wallet: coin.creator_wallet,
    metadata: coin.metadata,
  })) : [];

  // Filter out any regular coins that are also pinned (to avoid duplicates)
  const pinnedAddresses = new Set(pinnedCoins.map(c => c.address));
  const filteredRegularCoins = regularCoins.filter(c => !pinnedAddresses.has(c.address));

  // Combine pinned coins at the top (max 6) with regular coins
  const coins: ZoraCoin[] = [...pinnedCoins, ...filteredRegularCoins];
  
  console.log("Total coins count:", coins.length);
  console.log("First 6 coins platforms:", coins.slice(0, 6).map(c => c.platform));

  const openTradeModal = (coin: ZoraCoin) => {
    if (isMobile) {
      setSelectedCoin(coin);
      setIsTradeModalOpen(true);
    } else {
      setLocation(`/coin/${coin.address}`);
    }
  };

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-2">
        <Coins className="h-8 w-8 text-primary" />
        <h1 className="text-4xl font-bold">Explore Coins</h1>
      </div>

      

      {/* Coins Grid */}
      {(isLoadingCoins || isLoadingPinned) ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-1">
          {[...Array(24)].map((_, i) => (
            <Skeleton
              key={i}
              className="h-64 w-full rounded-2xl"
            />
          ))}
        </div>
      ) : coins.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-1">
          {coins.map((coin) => (
            <CoinCard
              key={coin.id}
              coin={coin}
              onClick={() => openTradeModal(coin)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Coins className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">No coins found</h3>
          <p className="text-muted-foreground">
            Try selecting a different category
          </p>
        </div>
      )}

      {/* Trade Modal - Mobile only */}
      {selectedCoin && isMobile && (
        <TradeModalMobile
          coin={selectedCoin}
          open={isTradeModalOpen}
          onOpenChange={setIsTradeModalOpen}
        />
      )}
    </div>
  );
}