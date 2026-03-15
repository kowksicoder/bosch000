import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Coins } from "lucide-react";
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
    creator_wallet?: string;
    creatorWallet?: string;
    createdAt?: string;
    category?: string;
    platform?: string;
    chain?: string; // Added for platform coin check
    __typename?: string; // Added for platform coin check
    metadata?: any;
  };
  className?: string;
  onClick?: () => void;
  onTrade?: () => void;
}

export function CoinCard({ coin, className, onClick, onTrade }: CoinCardProps) {
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
  const creatorAddress =
    coin.creator ||
    coin.creator_wallet ||
    coin.creatorWallet ||
    coin.metadata?.creator_wallet ||
    coin.metadata?.creatorAddress ||
    "";

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

          if (coinDataAny.creatorProfile?.avatar) {
            const previewImage = coinDataAny.creatorProfile.avatar?.previewImage;
            const avatarUrl =
              previewImage?.medium ||
              previewImage?.small ||
              coinDataAny.creatorProfile.avatar?.medium ||
              coinDataAny.creatorProfile.avatar?.small ||
              null;
            if (avatarUrl) {
              setCreatorAvatar(avatarUrl);
            }
          }

          // Creator earnings from Zora (fallback to 0.5% of volume if missing)
          let earningsUsd: number | null = null;
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
            if (Number.isFinite(earningAmount) && earningAmount > 0) {
              earningsUsd = earningAmount;
            }
          }

          if (earningsUsd === null) {
            const volumeValue = typeof coinData.volume24h === "string"
              ? parseFloat(coinData.volume24h)
              : Number(coinData.volume24h);
            if (Number.isFinite(volumeValue) && volumeValue > 0) {
              earningsUsd = volumeValue * 0.005;
            }
          }

          if (earningsUsd !== null) {
            setCreatorEarnings(earningsUsd);
          }
        }
      } catch (error) {
        console.error("Error fetching Zora coin data:", error);
      }
    }

    fetchCoinData();
  }, [coin.address]);

  useEffect(() => {
    let cancelled = false;
    const loadCreatorAvatar = async () => {
      if (!creatorAddress || !creatorAddress.startsWith("0x")) return;
      if (creatorAvatar) return;
      try {
        const response = await fetch(
          `/api/creators/address/${encodeURIComponent(creatorAddress)}`,
        );
        if (!response.ok) return;
        const data = await response.json();
        const avatar =
          data?.avatar ||
          data?.avatarUrl ||
          data?.creator?.avatar ||
          data?.creator?.avatarUrl ||
          null;
        if (!cancelled && avatar) {
          setCreatorAvatar(avatar);
        }
      } catch (error) {
        console.error("Error fetching creator avatar:", error);
      }
    };

    loadCreatorAvatar();

    return () => {
      cancelled = true;
    };
  }, [creatorAddress, creatorAvatar]);

  const marketCapNgn = convertUsdToNgn(liveMarketCap || coin.marketCap, fxRates);
  const volumeNgn = convertUsdToNgn(liveVolume || coin.volume24h, fxRates);
  const creatorEarningsNgn = convertUsdToNgn(creatorEarnings, fxRates);
  const formattedMarketCap = formatSmartCurrency(marketCapNgn);

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

        <div className="absolute top-1.5 right-1.5 z-10">
          <div className="w-5 h-5 rounded-full overflow-hidden bg-black/40 ring-1 ring-white/30 flex items-center justify-center">
            <img
              src={creatorAvatar || fallbackAvatar}
              alt="Creator"
              className="w-full h-full object-cover"
              onError={(event) => {
                (event.currentTarget as HTMLImageElement).src = fallbackAvatar;
              }}
            />
          </div>
        </div>

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
      <div className="p-2 space-y-0.5 flex-1 flex flex-col">
        <div className="flex-1 flex items-start justify-between">
          <div className="flex items-start justify-between gap-2 mb-1 w-full">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-[11px] md:text-sm truncate max-w-[120px] md:max-w-[160px]">
                {coin.name}
              </h3>
              <span className="block text-[9px] md:text-xs text-muted-foreground font-mono truncate max-w-[80px] md:max-w-[110px]">
                ₦{coin.symbol}
              </span>
            </div>
            <Button
              size="sm"
              className="min-h-0 h-4 md:h-4.5 px-1.5 md:px-2 text-[8px] md:text-[9px] leading-none rounded-[4px] bg-emerald-500/90 text-white hover:bg-emerald-500 border-0"
              onClick={(event) => {
                event.stopPropagation();
                onTrade?.();
              }}
            >
              Trade
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-0.5 pt-1 border-t border-border/50">
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-0.5">
              <span className="text-muted-foreground">MC:</span>
              <span className="font-semibold text-foreground">
                {formattedMarketCap}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
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
