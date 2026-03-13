import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TrendingUp, User, Coins, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { cn, formatSmartCurrency } from "@/lib/utils";
import { useFxRates, convertUsdToNgn } from "@/lib/fx";
import { getCoin } from "@zoralabs/coins-sdk";
import { base } from "viem/chains";

interface CoinCardProps {
  coin: {
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
    chain?: string; // Added for platform coin check
    __typename?: string; // Added for platform coin check
  };
  className?: string;
  onClick?: () => void;
}

export function CoinCard({ coin, className, onClick }: CoinCardProps) {
  const [imageError, setImageError] = useState(false);
  const [liveMarketCap, setLiveMarketCap] = useState<string | null>(null);
  const [liveVolume, setLiveVolume] = useState<string | null>(null);
  const [liveHolders, setLiveHolders] = useState<number | null>(null);
  const [creatorEarnings, setCreatorEarnings] = useState<number>(0);
  const [coinImage, setCoinImage] = useState<string | null>(null);
  const [creatorAvatar, setCreatorAvatar] = useState<string | null>(null);
  const { data: fxRates } = useFxRates();

  // Use platform logo as fallback avatar
  const fallbackAvatar = "https://i.ibb.co/JRQCPsZK/ev122logo-1-1.png";

  // Format holders count
  const formatHolders = (count: number): string => {
    if (count >= 1000000) {
      return `${Math.floor(count / 1000000)}m`;
    } else if (count >= 1000) {
      return `${Math.floor(count / 1000)}k`;
    }
    return count.toString();
  };

  useEffect(() => {
    async function fetchCoinData() {
      if (!coin.address) return;

      try {
        const response = await getCoin({
          address: coin.address as `0x${string}`,
          chain: base.id,
        });

        const coinData = response.data?.zora20Token;
        if (coinData) {
          // Market Cap
          if (coinData.marketCap !== null && coinData.marketCap !== undefined) {
            const mcValue =
              typeof coinData.marketCap === "string"
                ? coinData.marketCap
                : coinData.marketCap.toString();
            setLiveMarketCap(mcValue);
          }

          // Volume 24h
          if (coinData.volume24h !== null && coinData.volume24h !== undefined) {
            const volValue =
              typeof coinData.volume24h === "string"
                ? coinData.volume24h
                : coinData.volume24h.toString();
            setLiveVolume(volValue);
          }

          // Holders count - use any type cast for Zora SDK response
          const coinDataAny = coinData as any;
          if (
            coinDataAny.uniqueHolders !== null &&
            coinDataAny.uniqueHolders !== undefined
          ) {
            setLiveHolders(coinDataAny.uniqueHolders);
          }

          // Coin image from metadata
          if (coinData.mediaContent?.previewImage) {
            const previewImage = coinData.mediaContent.previewImage as any;
            setCoinImage(previewImage.medium || previewImage.small || null);
          }

          // Creator avatar from Zora
          if (coinDataAny.creatorProfile?.avatar) {
            setCreatorAvatar(coinDataAny.creatorProfile.avatar);
          }

          // Creator earnings from Zora
          if (
            coinDataAny.creatorEarnings &&
            coinDataAny.creatorEarnings.length > 0
          ) {
            const earningAmount = parseFloat(
              String(
                coinDataAny.creatorEarnings[0].amountUsd ||
                  coinDataAny.creatorEarnings[0].amount?.amountDecimal ||
                  "0",
              ),
            );
            setCreatorEarnings(earningAmount);
          }
        }
      } catch (error) {
        console.error("Error fetching Zora coin data:", error);
      }
    }

    fetchCoinData();
  }, [coin.address]);

  const marketCapNgn = convertUsdToNgn(liveMarketCap || coin.marketCap, fxRates);
  const volumeNgn = convertUsdToNgn(liveVolume || coin.volume24h, fxRates);
  const creatorEarningsNgn = convertUsdToNgn(creatorEarnings, fxRates);
  const formattedMarketCap = formatSmartCurrency(marketCapNgn);

  // Check if this is a platform coin (not from Zora SDK)
  const isPlatformCoin = !coin.chain && !coin.__typename;

  return (
    <Card
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-3xl border-border/50 bg-card cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1",
        className,
      )}
    >
      {/* Coin Image */}
      <div className="relative w-full aspect-square bg-gradient-to-br from-muted/20 to-muted/10 overflow-hidden">
        <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 rounded px-1.5 py-0.5 z-10">
          <span className="text-[8px] text-muted-foreground font-medium">
            {coin.createdAt
              ? new Date(coin.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : new Date().toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
          </span>
        </div>

        {(coin.category?.toLowerCase() === "zora" ||
          coin.platform?.toLowerCase() === "zora") && (
          <div className="absolute top-1.5 right-1.5 z-10">
            <div className="w-5 h-5 rounded-full overflow-hidden backdrop-blur-sm flex items-center justify-center">
              <img src="" alt="Zora" className="w-full h-full object-contain" />
            </div>
          </div>
        )}

        {isPlatformCoin && (
          <div className="absolute top-1.5 right-1.5 z-10">
            <img
              src="https://i.ibb.co/rK4mPf4Q/e1-logo.png"
              alt="Platform"
              className="w-4 h-4 object-contain"
            />
          </div>
        )}

        {(coinImage || coin.image) && !imageError ? (
          <img
            src={coinImage || coin.image}
            alt={coin.name}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Coins className="w-8 h-8 text-primary/40" />
          </div>
        )}
      </div>

      {/* Coin Info */}
      <div className="p-2 space-y-1.5 flex-1 flex flex-col">
        <div className="flex-1 flex items-start justify-between">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <h3 className="font-semibold text-sm md:text-base truncate">
                {coin.name}
              </h3>
            </div>
            <span className="text-xs md:text-sm text-muted-foreground font-mono shrink-0">
              {coin.symbol}
            </span>
          </div>
          {(creatorAvatar || fallbackAvatar) && (
            <Avatar className="w-4 h-4 ring-1 ring-primary/20">
              <AvatarImage src={creatorAvatar || fallbackAvatar || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-[6px]">
                {coin.creator?.slice(0, 2).toUpperCase() || "??"}
              </AvatarFallback>
            </Avatar>
          )}
        </div>

        {/* Stats */}
        <div className="space-y-1 pt-1.5 border-t border-border/50">
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-0.5">
              <TrendingUp className="h-2.5 w-2.5 text-green-500" />
              <span className="text-muted-foreground">MC:</span>
              <span className="font-semibold text-foreground">
                {formattedMarketCap}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <TrendingUp className="h-2.5 w-2.5 text-purple-500" />
              <span className="text-muted-foreground">Vol:</span>
              <span className="font-semibold text-foreground">
                {formatSmartCurrency(volumeNgn)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-0.5">
              <User className="h-2.5 w-2.5 text-orange-500" />
              <span className="text-muted-foreground"></span>
              <span className="font-semibold text-foreground">
                {formatHolders(liveHolders || coin.holders || 0)}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <Coins className="h-2.5 w-2.5 text-green-500" />
              <span className="text-muted-foreground"></span>
              <span className="font-semibold text-green-500">
                {formatSmartCurrency(creatorEarningsNgn)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
