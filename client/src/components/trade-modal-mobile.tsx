
import { useState, useEffect, useRef } from "react";
import type { Coin, Comment } from "@shared/schema";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { formatEther } from "viem";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getCoin, getCoinHolders } from "@zoralabs/coins-sdk";
import { base } from "viem/chains";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  CheckCircle2, 
  ExternalLink, 
  MessageCircle, 
  Coins, 
  Users, 
  ActivityIcon,
  TrendingUp,
  Copy,
  Check,
  X,
  Info
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatSmartCurrency } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useFxRates, convertUsdToNgn, convertEthToNgn } from "@/lib/fx";
import { usePrivy, getAccessToken } from "@privy-io/react-auth";

type CoinProp = {
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
  type?: string;
};

interface MobileTradeModalProps {
  coin: CoinProp;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: "trade" | "chart" | "comments" | "holders" | "details" | "activity";
  mode?: "full" | "tab";
}

export default function MobileTradeModal({
  coin,
  open,
  onOpenChange,
  initialTab,
  mode = "full",
}: MobileTradeModalProps) {
  const { toast } = useToast();
  const [ethAmount, setEthAmount] = useState("0.001");
  const [isTrading, setIsTrading] = useState(false);
  const [isNairaPaying, setIsNairaPaying] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isBuying, setIsBuying] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "trade" | "chart" | "comments" | "holders" | "details" | "activity"
  >(initialTab ?? "trade");
  const [standaloneComment, setStandaloneComment] = useState("");
  const [balance, setBalance] = useState<string>("0");
  const [marketCap, setMarketCap] = useState<string | null>(null);
  const [volume24h, setVolume24h] = useState<string | null>(null);
  const [creatorEarnings, setCreatorEarnings] = useState<string | null>(null);
  const [coinImage, setCoinImage] = useState<string | null>(null);
  const [holders, setHolders] = useState<Array<{
    address: string;
    balance: string;
    percentage: number;
    profile?: string | null;
    avatarUrl?: string | null;
    isFollowing?: boolean;
  }>>([]);
  const [holdersTotal, setHoldersTotal] = useState<number>(0);
  const [holdersCursor, setHoldersCursor] = useState<string | null>(null);
  const [holdersHasNext, setHoldersHasNext] = useState(false);
  const [holdersLoadingMore, setHoldersLoadingMore] = useState(false);
  const holdersScrollRef = useRef<HTMLDivElement | null>(null);
  const holdersSentinelRef = useRef<HTMLDivElement | null>(null);
  const [showFollowingOnly, setShowFollowingOnly] = useState(false);
  const [chartData, setChartData] = useState<Array<{ time: string; price: number }>>([]);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [totalSupply, setTotalSupply] = useState<string | null>(null);
  const [priceChange24h, setPriceChange24h] = useState<number>(0);
  const [currentPrice, setCurrentPrice] = useState<string | null>(null);
  const { data: fxRates } = useFxRates();
  const { user: privyUser, authenticated } = usePrivy();
  const [followingAddresses, setFollowingAddresses] = useState<string[]>([]);
  const currentUserAddress = privyUser?.wallet?.address || privyUser?.id || "";
  const isCompact = mode === "tab";

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab ?? "trade");
  }, [open, initialTab, coin.address]);

  useEffect(() => {
    if (!open || activeTab !== "holders" || showFollowingOnly) return;
    const root = holdersScrollRef.current;
    const sentinel = holdersSentinelRef.current;
    if (!root || !sentinel) return;
    const viewport = root.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement | null;
    if (!viewport) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          entry?.isIntersecting &&
          holdersHasNext &&
          !holdersLoadingMore
        ) {
          loadMoreHolders();
        }
      },
      {
        root: viewport,
        rootMargin: "120px",
        threshold: 0.1,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [
    open,
    activeTab,
    holdersHasNext,
    holdersLoadingMore,
    holdersCursor,
    coin.address,
    showFollowingOnly,
  ]);

  useEffect(() => {
    if (!open) return;
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
  }, [open, currentUserAddress]);

  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: ['/api/comments/coin', coin.address],
    queryFn: async () => {
      const response = await fetch(`/api/comments/coin/${coin.address}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch comments');
      return response.json();
    },
    enabled: open && !!coin.address,
  });

  const createCommentMutation = useMutation({
    mutationFn: async (commentData: { coinAddress: string; comment: string; transactionHash?: string }) => {
      const accessToken = await getAccessToken();
      return await apiRequest('POST', '/api/comments', commentData, accessToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/comments/coin', coin.address] });
    },
  });

  const handleStandaloneComment = async () => {
    if (!authenticated) {
      toast({ title: "Sign in required", description: "Please sign in to comment.", variant: "destructive" });
      return;
    }
    if (!coin.address || !standaloneComment.trim()) return;

    try {
      await createCommentMutation.mutateAsync({
        coinAddress: coin.address,
        comment: standaloneComment.trim(),
      });
      setStandaloneComment("");
      toast({ title: "Comment added", description: "Your comment has been posted" });
    } catch (error) {
      console.error('Failed to post comment:', error);
      toast({ title: "Failed to post comment", variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  useEffect(() => {
    async function fetchBalance() {
      if (!address || !publicClient) return;
      try {
        const bal = await publicClient.getBalance({ address });
        setBalance(formatEther(bal));
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    }
    if (isConnected && open) fetchBalance();
  }, [address, isConnected, publicClient, open]);

  useEffect(() => {
    async function fetchCoinStats() {
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
            const mcValue = typeof coinData.marketCap === 'string' ? parseFloat(coinData.marketCap) : coinData.marketCap;
            setMarketCap(mcValue.toFixed(2));
          }
          
          // Volume 24h
          if (coinData.volume24h !== null && coinData.volume24h !== undefined) {
            const volValue = typeof coinData.volume24h === 'string' ? parseFloat(coinData.volume24h) : coinData.volume24h;
            setVolume24h(volValue.toString());
            setCreatorEarnings((volValue * 0.005).toString());
          }
          
          // Total Supply
          if (coinData.totalSupply) {
            setTotalSupply(coinData.totalSupply);
          }
          
          // Current Price
          if (coinData.price) {
            const price = typeof coinData.price === 'string' ? parseFloat(coinData.price) : coinData.price;
            setCurrentPrice(coinData.price);
            
            // Generate realistic chart data based on current price
            const now = Date.now();
            const hourInMs = 60 * 60 * 1000;
            const data = [];
            const priceMultiplier = fxRates?.usd_ngn ?? 1;
            
            for (let i = 23; i >= 0; i--) {
              const time = new Date(now - i * hourInMs);
              const variance = (Math.random() - 0.5) * 0.1; // ±10% variance
              const pricePoint = price * (1 + variance);
              data.push({
                time: time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
                price: parseFloat((pricePoint * priceMultiplier).toFixed(6))
              });
            }
            setChartData(data);
          }
          
          // Price Change 24h
          if (coinData.priceChange24h !== null && coinData.priceChange24h !== undefined) {
            setPriceChange24h(typeof coinData.priceChange24h === 'string' 
              ? parseFloat(coinData.priceChange24h) 
              : coinData.priceChange24h);
          }
          
          // Coin Image
          if (coinData.mediaContent?.previewImage) {
            const previewImage = coinData.mediaContent.previewImage as any;
            setCoinImage(previewImage.medium || previewImage.small || null);
          }
        }

        const holdersResponse = await getCoinHolders({
          chainId: base.id,
          address: coin.address as `0x${string}`,
          count: 20,
        });

        const tokenBalances = holdersResponse.data?.zora20Token?.tokenBalances;
        const holderBalances = tokenBalances?.edges || [];
        if (typeof tokenBalances?.count === "number") {
          setHoldersTotal(tokenBalances.count);
        }
        const pageInfo = tokenBalances?.pageInfo;
        setHoldersCursor(pageInfo?.endCursor || null);
        setHoldersHasNext(Boolean(pageInfo?.hasNextPage));
        const supply = parseFloat(coinData?.totalSupply || "0");
        const followingSet = new Set(
          followingAddresses.map((address) => address.toLowerCase()),
        );

        let followedBalances: Array<{ address: string; balance: number }> = [];
        if (followingAddresses.length > 0) {
          try {
            const followResponse = await fetch("/api/coins/holders/check", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                coinAddress: coin.address,
                addresses: followingAddresses,
              }),
            });
            if (followResponse.ok) {
              const followData = await followResponse.json();
              if (Array.isArray(followData?.holders)) {
                followedBalances = followData.holders;
              }
            }
          } catch (error) {
            console.warn("Failed to check followed holder balances:", error);
          }
        }

        if (holderBalances.length === 0 && followedBalances.length === 0) {
          setHolders([]);
          return;
        }

        if (supply > 0 || holderBalances.length > 0 || followedBalances.length > 0) {
          const processedHolders = holderBalances.map((edge: any) => {
            const balance = parseFloat(edge.node.balance || "0");
            const address = edge.node.ownerAddress;
            const avatar =
              edge.node.ownerProfile?.avatar?.previewImage?.small ||
              edge.node.ownerProfile?.avatar?.previewImage?.medium ||
              edge.node.ownerProfile?.avatar?.small ||
              edge.node.ownerProfile?.avatar?.medium ||
              null;
            return {
              address,
              balance: edge.node.balance,
              percentage: (balance / supply) * 100,
              profile: edge.node.ownerProfile?.handle || null,
              avatarUrl: avatar,
              isFollowing: followingSet.has(address?.toLowerCase?.() || ""),
            };
          });

          const holderAddressSet = new Set(
            processedHolders.map((holder) => holder.address.toLowerCase()),
          );

          followedBalances.forEach((holder) => {
            const address = holder.address;
            if (!address) return;
            const key = address.toLowerCase();
            if (holderAddressSet.has(key)) return;
            holderAddressSet.add(key);
            processedHolders.push({
              address,
              balance: holder.balance.toString(),
              percentage: supply > 0 ? (holder.balance / supply) * 100 : 0,
              profile: null,
              avatarUrl: null,
              isFollowing: true,
            });
          });

          processedHolders.sort((a, b) => {
            if (a.isFollowing === b.isFollowing) {
              return b.percentage - a.percentage;
            }
            return a.isFollowing ? -1 : 1;
          });

          setHolders(processedHolders);
        }
      } catch (error) {
        console.error("Error fetching coin stats:", error);
      }
    }
    if (open) fetchCoinStats();
  }, [coin.address, open, fxRates, followingAddresses]);

  const marketCapNgn = convertUsdToNgn(marketCap, fxRates);
  const volume24hNgn = convertUsdToNgn(volume24h, fxRates);
  const creatorEarningsNgn = convertUsdToNgn(creatorEarnings, fxRates);
  const currentPriceNgn = convertUsdToNgn(currentPrice, fxRates);
  const ethAmountNgn = convertEthToNgn(ethAmount, fxRates);

  const handleTrade = async () => {
    if (!isConnected || !address || !walletClient || !publicClient) {
      toast({ title: "Wallet not connected", description: "Please connect your wallet first", variant: "destructive" });
      return;
    }

    const ethAmountNum = parseFloat(ethAmount);
    if (!ethAmount || ethAmountNum <= 0) {
      toast({ title: "Invalid amount", description: "Please enter a valid ETH amount", variant: "destructive" });
      return;
    }

    setIsTrading(true);
    try {
      const { tradeZoraCoin } = await import("@/lib/zora");
      const result = await tradeZoraCoin({
        coinAddress: coin.address as `0x${string}`,
        ethAmount,
        walletClient,
        publicClient,
        userAddress: address,
        isBuying,
      });

      if (result?.hash) {
        setTxHash(result.hash);
        toast({ title: "Trade successful!", description: `You ${isBuying ? 'bought' : 'sold'} ${coin.symbol} tokens` });
        try {
          const accessToken = await getAccessToken();
          if (accessToken) {
            await fetch("/api/trades/record", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                coinAddress: coin.address,
                side: isBuying ? "buy" : "sell",
                txHash: result.hash,
                amountEth: ethAmount,
              }),
            });
          }
        } catch (recordError) {
          console.warn("Failed to record trade", recordError);
        }
        const newBal = await publicClient.getBalance({ address });
        setBalance(formatEther(newBal));
      }
    } catch (error) {
      console.error("Trade failed:", error);
      toast({ title: "Trade failed", description: error instanceof Error ? error.message : "Trade failed", variant: "destructive" });
    } finally {
      setIsTrading(false);
    }
  };

  const handleNairaPay = async () => {
    if (!authenticated) {
      toast({ title: "Sign in required", description: "Please sign in to pay with Naira", variant: "destructive" });
      return;
    }
    if (!coin.address) {
      toast({ title: "Invalid coin", description: "Missing coin address", variant: "destructive" });
      return;
    }
    if (!ethAmountNgn || ethAmountNgn <= 0) {
      toast({ title: "Invalid amount", description: "Enter a valid amount", variant: "destructive" });
      return;
    }

    setIsNairaPaying(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Missing auth token");
      }

      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          amountNgn: Number(ethAmountNgn.toFixed(2)),
          creatorTokenAddress: coin.address,
          recipientAddress: privyUser?.wallet?.address,
          email: privyUser?.email?.address || undefined,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || "Payment initialization failed");
      }

      const data = await response.json();
      if (data?.authorizationUrl) {
        window.open(data.authorizationUrl, "_blank", "noopener,noreferrer");
        toast({ title: "Payment started", description: "Complete payment to receive your coins." });
      } else {
        throw new Error("Missing payment URL");
      }
    } catch (error) {
      console.error("Naira payment error:", error);
      toast({
        title: "Payment error",
        description: error instanceof Error ? error.message : "Failed to start payment",
        variant: "destructive",
      });
    } finally {
      setIsNairaPaying(false);
    }
  };

  const formatAddress = (address?: string) => {
    if (!address) return 'Unknown';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const setQuickAmount = (amount: string) => {
    if (amount === 'Max') {
      setEthAmount((parseFloat(balance) * 0.9).toFixed(6));
    } else {
      setEthAmount(amount);
    }
  };

  const scrollToFirstFollowing = () => {
    const root = holdersScrollRef.current;
    if (!root) return;
    const viewport = root.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement | null;
    if (!viewport) return;
    const target = viewport.querySelector(
      "[data-holder-following='true']",
    ) as HTMLElement | null;
    if (target) {
      target.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  };

  const loadMoreHolders = async () => {
    if (!coin.address || !holdersHasNext || holdersLoadingMore) return;

    setHoldersLoadingMore(true);
    try {
      const response = await getCoinHolders({
        chainId: base.id,
        address: coin.address as `0x${string}`,
        count: 20,
        after: holdersCursor || undefined,
      });

      const tokenBalances = response.data?.zora20Token?.tokenBalances;
      const holderBalances = tokenBalances?.edges || [];
      const pageInfo = tokenBalances?.pageInfo;
      const supply = parseFloat(totalSupply || "0");
      const followingSet = new Set(
        followingAddresses.map((address) => address.toLowerCase()),
      );

      const newHolders = holderBalances.map((edge: any) => {
        const balance = parseFloat(edge.node.balance || "0");
        const address = edge.node.ownerAddress;
        const avatar =
          edge.node.ownerProfile?.avatar?.previewImage?.small ||
          edge.node.ownerProfile?.avatar?.previewImage?.medium ||
          edge.node.ownerProfile?.avatar?.small ||
          edge.node.ownerProfile?.avatar?.medium ||
          null;
        return {
          address,
          balance: edge.node.balance,
          percentage: supply > 0 ? (balance / supply) * 100 : 0,
          profile: edge.node.ownerProfile?.handle || null,
          avatarUrl: avatar,
          isFollowing: followingSet.has(address?.toLowerCase?.() || ""),
        };
      });

      setHolders((prev) => {
        const merged = [...prev, ...newHolders];
        const uniqueMap = new Map<string, typeof merged[number]>();
        merged.forEach((holder) => {
          if (!holder?.address) return;
          uniqueMap.set(holder.address.toLowerCase(), holder);
        });
        const unique = Array.from(uniqueMap.values());
        unique.sort((a, b) => {
          if (a.isFollowing === b.isFollowing) {
            return b.percentage - a.percentage;
          }
          return a.isFollowing ? -1 : 1;
        });
        return unique;
      });

      if (typeof tokenBalances?.count === "number") {
        setHoldersTotal(tokenBalances.count);
      }
      setHoldersCursor(pageInfo?.endCursor || null);
      setHoldersHasNext(Boolean(pageInfo?.hasNextPage));
    } catch (error) {
      console.error("Load more holders error:", error);
    } finally {
      setHoldersLoadingMore(false);
    }
  };

  const displayImage = coinImage || coin?.image || coin?.metadata?.image;
  const displayedHolders = showFollowingOnly
    ? holders.filter((holder) => holder.isFollowing)
    : holders;
  const hasFollowingHolders = holders.some((holder) => holder.isFollowing);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={`${isCompact ? "max-h-[65vh]" : "max-h-[90vh]"} bg-background border-none`}
      >
        {isCompact ? (
          <div className="sticky top-0 z-10 bg-background px-3 pb-2 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-muted/50 flex items-center justify-center">
                  {displayImage ? (
                    <img src={displayImage} alt={coin.name} className="w-full h-full object-cover" />
                  ) : (
                    <Coins className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {activeTab === "comments"
                      ? "Comments"
                      : activeTab === "activity"
                        ? "Activity"
                        : "Trade"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                    {coin.name}
                  </p>
                </div>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </DrawerClose>
            </div>
          </div>
        ) : (
          <div className="sticky top-0 z-10 bg-background">
            <DrawerHeader className="px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-muted/50 flex items-center justify-center">
                    {displayImage ? (
                      <img src={displayImage} alt={coin.name} className="w-full h-full object-cover" />
                    ) : (
                      <Coins className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <DrawerTitle className="text-base font-bold">{coin.name}</DrawerTitle>
                    <p className="text-xs text-muted-foreground">@{coin.symbol}</p>
                  </div>
                </div>
                <DrawerClose asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 absolute right-2 top-2">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </DrawerClose>
              </div>
            </DrawerHeader>

            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-1.5 px-3 pb-2">
              <div className="bg-muted/20 rounded-lg p-1.5 text-center">
                <p className="text-[10px] text-muted-foreground">Market Cap</p>
                <p className="text-xs font-bold text-green-500">
                  {formatSmartCurrency(marketCapNgn)}
                </p>
              </div>
              <div className="bg-muted/20 rounded-lg p-1.5 text-center">
                <p className="text-[10px] text-muted-foreground">24H Vol</p>
                <p className="text-xs font-semibold">
                  {formatSmartCurrency(volume24hNgn)}
                </p>
              </div>
              <div className="bg-muted/20 rounded-lg p-1.5 text-center">
                <p className="text-[10px] text-muted-foreground">Holders</p>
                <p className="text-xs font-semibold">{holdersTotal || holders.length || 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(
              value as "trade" | "chart" | "comments" | "holders" | "details" | "activity"
            )
          }
          className="flex-1 flex flex-col overflow-hidden"
        >
          {!isCompact ? (
            <TabsList className="w-full grid grid-cols-5 mx-3 mt-1.5 mb-1 bg-transparent border-none h-8">
              <TabsTrigger value="trade" className="text-[11px] h-7 data-[state=active]:bg-primary data-[state=active]:text-black">Trade</TabsTrigger>
              <TabsTrigger value="chart" className="text-[11px] h-7 data-[state=active]:bg-primary data-[state=active]:text-black">Chart</TabsTrigger>
              <TabsTrigger value="comments" className="text-[11px] h-7 data-[state=active]:bg-primary data-[state=active]:text-black">Chat</TabsTrigger>
              <TabsTrigger value="holders" className="text-[11px] h-7 data-[state=active]:bg-primary data-[state=active]:text-black">Top</TabsTrigger>
              <TabsTrigger value="details" className="text-[11px] h-7 data-[state=active]:bg-primary data-[state=active]:text-black">Info</TabsTrigger>
            </TabsList>
          ) : (
            activeTab === "comments" || activeTab === "activity" ? (
              <div className="px-3 pt-1 pb-2">
                <TabsList className="w-full grid grid-cols-2 bg-muted/30 border-none h-8">
                  <TabsTrigger value="comments" className="text-[11px] h-7 data-[state=active]:bg-primary data-[state=active]:text-black">Comment</TabsTrigger>
                  <TabsTrigger value="activity" className="text-[11px] h-7 data-[state=active]:bg-primary data-[state=active]:text-black">Activity</TabsTrigger>
                </TabsList>
              </div>
            ) : null
          )}

          <TabsContent
            value="trade"
            className={`flex-1 px-3 pb-3 overflow-y-auto mt-0 ${
              isCompact ? "pt-1 min-h-[320px]" : "min-h-[400px]"
            }`}
          >
            <div className="space-y-2.5">
              {/* Buy/Sell Toggle */}
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  onClick={() => setIsBuying(true)}
                  className={`h-10 border-none ${isBuying ? 'bg-green-500 hover:bg-green-600' : 'bg-muted/30 hover:bg-muted/50 text-muted-foreground'}`}
                  disabled={isTrading || !!txHash}
                >
                  <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                  <span className="text-sm font-semibold">Buy</span>
                </Button>
                <Button
                  onClick={() => setIsBuying(false)}
                  className={`h-10 border-none ${!isBuying ? 'bg-red-500 hover:bg-red-600' : 'bg-muted/30 hover:bg-muted/50 text-muted-foreground'}`}
                  disabled={isTrading || !!txHash}
                >
                  <TrendingUp className="w-3.5 h-3.5 mr-1.5 rotate-180" />
                  <span className="text-sm font-semibold">Sell</span>
                </Button>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Amount (ETH)</label>
                <Input
                  type="number"
                  value={ethAmount}
                  onChange={(e) => setEthAmount(e.target.value)}
                  className="h-10 text-base border-none bg-muted/30"
                  placeholder="0.0"
                  disabled={isTrading || !!txHash}
                />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                  <span>Balance: {parseFloat(balance).toFixed(4)} ETH</span>
                  {ethAmountNgn !== null && (
                    <span>
                      ≈ ₦{ethAmountNgn.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-4 gap-1.5">
                {['0.001', '0.01', '0.1', 'Max'].map((label) => (
                  <Button
                    key={label}
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuickAmount(label)}
                    disabled={isTrading || !!txHash}
                    className="h-8 text-xs bg-muted/30 hover:bg-muted/50 border-none"
                  >
                    {label}
                  </Button>
                ))}
              </div>

              {/* Trade Button */}
              <Button
                onClick={handleTrade}
                disabled={isTrading || !isConnected || !!txHash}
                className="w-full h-10 text-sm font-semibold border-none"
              >
                {isTrading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Trading...
                  </>
                ) : (
                  `${isBuying ? 'Buy' : 'Sell'} ${coin.symbol}`
                )}
              </Button>
              {isBuying && (
                <Button
                  onClick={handleNairaPay}
                  disabled={isNairaPaying || !!txHash}
                  className="w-full h-10 text-sm font-semibold border-none bg-muted/30 hover:bg-muted/50"
                >
                  {isNairaPaying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Starting payment...
                    </>
                  ) : (
                    "Pay with Naira (Beta)"
                  )}
                </Button>
              )}

              {/* Success Message */}
              {txHash && (
                <div className="p-2.5 bg-green-500/10 border-none rounded-lg">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-semibold text-green-500">Trade Successful!</span>
                  </div>
                  <a
                    href={`https://basescan.org/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary flex items-center gap-1"
                  >
                    View on BaseScan
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="chart" className="flex-1 px-3 pb-3 overflow-y-auto mt-0 min-h-[400px]">
            <div className="space-y-2">
              {/* Price Info */}
              <div className="bg-muted/20 rounded-lg p-2.5">
                <p className="text-[10px] text-muted-foreground mb-1">Current Price</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-lg font-bold">
                    {currentPriceNgn !== null ? `₦${currentPriceNgn.toFixed(6)}` : 'N/A'}
                  </p>
                  {priceChange24h !== 0 && (
                    <span className={`text-xs font-medium ${priceChange24h > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {priceChange24h > 0 ? '+' : ''}{priceChange24h.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Chart */}
              {chartData.length > 0 ? (
                <div className="w-full h-[280px] bg-muted/10 rounded-lg p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" opacity={0.3} />
                      <XAxis 
                        dataKey="time" 
                        tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                        stroke="hsl(var(--muted-foreground))"
                        opacity={0.5}
                      />
                      <YAxis 
                        tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                        stroke="hsl(var(--muted-foreground))"
                        opacity={0.5}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '11px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="price" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[280px] bg-muted/10 rounded-lg">
                  <TrendingUp className="w-10 h-10 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">Chart data loading...</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent
            value="comments"
            className={`flex-1 px-3 pb-3 overflow-hidden mt-0 flex flex-col ${
              isCompact ? "pt-1 min-h-[320px]" : "min-h-[400px]"
            }`}
          >
            <div className="flex gap-1.5 mb-2">
              <Input
                placeholder="Add a comment..."
                value={standaloneComment}
                onChange={(e) => setStandaloneComment(e.target.value)}
                className="flex-1 h-9 text-sm border-none bg-muted/30"
              />
              <Button onClick={handleStandaloneComment} size="icon" className="shrink-0 h-9 w-9 border-none">
                <MessageCircle className="w-3.5 h-3.5" />
              </Button>
            </div>
            
            <ScrollArea className="flex-1 -mx-4 px-4">
              {comments.length > 0 ? (
                <div className="space-y-1.5">
                  {comments.map((c) => (
                    <div key={c.id} className="p-2 bg-muted/20 rounded-lg">
                      <p className="text-[10px] font-medium text-muted-foreground mb-0.5">{formatAddress(c.userAddress)}</p>
                      <p className="text-xs">{c.comment}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-10">
                  <MessageCircle className="w-10 h-10 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">No comments yet. Be the first!</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent
            value="activity"
            className={`flex-1 px-3 pb-3 overflow-hidden mt-0 flex flex-col ${
              isCompact ? "pt-1 min-h-[320px]" : "min-h-[400px]"
            }`}
          >
            <div className="flex flex-1 flex-col items-center justify-center text-center py-10">
              <ActivityIcon className="w-10 h-10 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">Activity coming soon</p>
            </div>
          </TabsContent>

          <TabsContent value="holders" className="flex-1 px-3 pb-3 overflow-y-auto mt-0 min-h-[400px]">
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur px-1 pb-2 pt-1">
              <div className="flex items-center gap-2">
                <Button
                  variant={showFollowingOnly ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => setShowFollowingOnly((prev) => !prev)}
                  disabled={!hasFollowingHolders}
                >
                  Following
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={scrollToFirstFollowing}
                  disabled={!hasFollowingHolders}
                >
                  Jump to following
                </Button>
              </div>
            </div>
            <ScrollArea ref={holdersScrollRef} className="flex-1 -mx-3">
              {displayedHolders.length > 0 ? (
                <div className="space-y-1 px-4">
                  {displayedHolders.map((holder, idx) => (
                    <div
                      key={holder.address}
                      data-holder-following={holder.isFollowing ? "true" : "false"}
                      className={`flex items-center justify-between p-2 rounded-lg ${
                        holder.isFollowing
                          ? "bg-emerald-500/10 border border-emerald-500/20"
                          : "bg-muted/20"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-[10px] text-muted-foreground">
                          #{idx + 1}
                        </span>
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                          {holder.avatarUrl ? (
                            <img
                              src={holder.avatarUrl}
                              alt={holder.profile || holder.address}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-[10px] font-bold">
                              {(holder.profile || holder.address)
                                ?.replace(/^0x/, "")
                                ?.slice(0, 1)
                                ?.toUpperCase() || "H"}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-medium">{holder.profile || formatAddress(holder.address)}</p>
                            {holder.isFollowing && (
                              <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] text-emerald-200">
                                Following
                              </span>
                            )}
                          </div>
                          {holder.profile && <p className="text-[10px] text-muted-foreground">{formatAddress(holder.address)}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-primary">{holder.percentage.toFixed(2)}%</p>
                      </div>
                    </div>
                  ))}
                  {holdersHasNext && !showFollowingOnly && (
                    <div ref={holdersSentinelRef} className="py-3 text-center text-[11px] text-muted-foreground">
                      {holdersLoadingMore ? "Loading more holders..." : "Scroll to load more"}
                    </div>
                  )}
                  {holdersLoadingMore && !showFollowingOnly && (
                    <div className="space-y-1.5 py-2">
                      {Array.from({ length: 4 }).map((_, idx) => (
                        <div
                          key={`holder-skeleton-${idx}`}
                          className="h-10 rounded-lg bg-muted/20 animate-pulse"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-10">
                  <Users className="w-10 h-10 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {showFollowingOnly ? "No followed holders yet" : "No holders data available"}
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="details" className="flex-1 px-3 pb-3 overflow-y-auto mt-0 min-h-[400px]">
            <div className="space-y-1">
              <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <ActivityIcon className="w-3.5 h-3.5" />
                  <span className="text-xs">Created</span>
                </div>
                <span className="text-xs font-medium">{coin.createdAt ? new Date(coin.createdAt).toLocaleDateString() : 'Unknown'}</span>
              </div>

              <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-xs">Contract</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono">{formatAddress(coin.address)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 border-none"
                    onClick={() => copyToClipboard(coin.address)}
                  >
                    {copiedAddress ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Coins className="w-3.5 h-3.5" />
                  <span className="text-xs">Chain</span>
                </div>
                <span className="text-xs font-medium flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  Base
                </span>
              </div>

              <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Info className="w-3.5 h-3.5" />
                  <span className="text-xs">Creator Earnings</span>
                </div>
                <span className="text-xs font-medium">
                  {formatSmartCurrency(creatorEarningsNgn)}
                </span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DrawerContent>
    </Drawer>
  );
}
