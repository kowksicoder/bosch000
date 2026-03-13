import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import type { Comment } from "@shared/schema";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, ExternalLink, Coins, MessageCircle, Users, Activity as ActivityIcon, Info, Copy, Check, TrendingUp, ChevronLeft, Share2 } from "lucide-react";
import { getCoin, getCoinHolders } from "@zoralabs/coins-sdk";
import { base } from "viem/chains";
import { formatEther } from "viem";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { formatSmartCurrency } from "@/lib/utils";
import { useFxRates, convertUsdToNgn, convertEthToNgn } from "@/lib/fx";
import { usePrivy, getAccessToken } from "@privy-io/react-auth";
import { ShareModal } from "@/components/share-modal";

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

export default function CoinDetailPage() {
  const [, params] = useRoute("/coin/:address");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [ethAmount, setEthAmount] = useState("0.000111");
  const [isTrading, setIsTrading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isBuying, setIsBuying] = useState(true);
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
  }>>([]);
  const [totalSupply, setTotalSupply] = useState<string | null>(null);
  const [uniqueHoldersCount, setUniqueHoldersCount] = useState<number>(0);
  const [chartData, setChartData] = useState<Array<{ time: string; price: number }>>([]);
  const [timeframe, setTimeframe] = useState<'1H' | '1D' | 'W' | 'M' | 'All'>('1D');
  const [priceChange, setPriceChange] = useState<number>(0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [carouselApi, setCarouselApi] = useState<any>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<string | null>(null);
  const [coin, setCoin] = useState<CoinProp | null>(null);
  const [isNairaPaying, setIsNairaPaying] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const { data: fxRates } = useFxRates();
  const { user: privyUser, authenticated } = usePrivy();

  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const coinAddress = params?.address;

  const handleShareCoin = () => {
    if (!coinAddress) {
      toast({ title: "Share unavailable", description: "Coin address missing.", variant: "destructive" });
      return;
    }
    setIsShareModalOpen(true);
  };

  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => setCurrentSlide(carouselApi.selectedScrollSnap());
    carouselApi.on("select", onSelect);
    return () => carouselApi.off("select", onSelect);
  }, [carouselApi]);

  const { data: comments = [], isLoading: commentsLoading } = useQuery<Comment[]>({
    queryKey: ['/api/comments/coin', coinAddress],
    queryFn: async () => {
      const response = await fetch(`/api/comments/coin/${coinAddress}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch comments');
      return response.json();
    },
    enabled: !!coinAddress,
  });

  const createCommentMutation = useMutation({
    mutationFn: async (commentData: { coinAddress: string; userAddress: string; comment: string; transactionHash?: string }) => {
      return await apiRequest('POST', '/api/comments', commentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/comments/coin', coinAddress] });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleStandaloneComment = async () => {
    if (!isConnected || !address || !coinAddress || !standaloneComment.trim()) return;

    try {
      await createCommentMutation.mutateAsync({
        coinAddress: coinAddress,
        userAddress: address,
        comment: standaloneComment.trim(),
      });
      setStandaloneComment("");
      toast({ title: "Comment added", description: "Your comment has been posted" });
    } catch (error) {
      console.error('Failed to post comment:', error);
      toast({ title: "Failed to post comment", description: "Please try again", variant: "destructive" });
    }
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
    if (isConnected) fetchBalance();
  }, [address, isConnected, publicClient]);

  useEffect(() => {
    async function fetchCoinStats() {
      if (!coinAddress) return;
      try {
        const response = await getCoin({
          address: coinAddress as `0x${string}`,
          chain: base.id,
        });

        const coinData = response.data?.zora20Token;
        if (coinData) {
          setCoin({
            id: coinData.address,
            name: coinData.name || "Unnamed Coin",
            symbol: coinData.symbol || "???",
            address: coinData.address,
            image: coinData.mediaContent?.previewImage?.medium || coinData.mediaContent?.previewImage?.small,
            marketCap: coinData.marketCap ? parseFloat(coinData.marketCap).toFixed(2) : "0",
            volume24h: coinData.volume24h ? parseFloat(coinData.volume24h).toFixed(2) : "0",
            holders: coinData.uniqueHolders || 0,
            creator: coinData.creatorAddress,
            createdAt: coinData.createdAt,
            creator_wallet: coinData.creatorAddress,
            metadata: coinData,
          });

          if (coinData.marketCap !== null && coinData.marketCap !== undefined) {
            const mcValue = typeof coinData.marketCap === 'string' ? parseFloat(coinData.marketCap) : coinData.marketCap;
            setMarketCap(mcValue.toFixed(2));
          }

          if (coinData.volume24h !== null && coinData.volume24h !== undefined) {
            const volValue = typeof coinData.volume24h === 'string' ? parseFloat(coinData.volume24h) : coinData.volume24h;
            setVolume24h(volValue.toString());
            setCreatorEarnings((volValue * 0.005).toString());
          }

          if (coinData.totalSupply) {
            setTotalSupply(coinData.totalSupply);
          }

          if (coinData.price) {
            const price = typeof coinData.price === 'string' ? parseFloat(coinData.price) : coinData.price;
            setCurrentPrice(coinData.price);

            const now = Date.now();
            const hourInMs = 60 * 60 * 1000;
            const data = [];
            const priceMultiplier = fxRates?.usd_ngn ?? 1;

            for (let i = 23; i >= 0; i--) {
              const time = new Date(now - i * hourInMs);
              const variance = (Math.random() - 0.5) * 0.1;
              const pricePoint = price * (1 + variance);
              data.push({
                time: time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
                price: parseFloat((pricePoint * priceMultiplier).toFixed(6))
              });
            }
            setChartData(data);
          }

          if (coinData.priceChange24h !== null && coinData.priceChange24h !== undefined) {
            const priceChangeValue = typeof coinData.priceChange24h === 'string' 
              ? parseFloat(coinData.priceChange24h) 
              : coinData.priceChange24h;
            setPriceChange(priceChangeValue);
          }

          if (coinData.mediaContent?.previewImage) {
            const previewImage = coinData.mediaContent.previewImage as any;
            setCoinImage(previewImage.medium || previewImage.small || null);
          }
        }

        const holdersResponse = await getCoinHolders({
          chainId: base.id,
          address: coinAddress as `0x${string}`,
          count: 50,
        });

        const holderBalances = holdersResponse.data?.zora20Token?.tokenBalances?.edges || [];
        const supply = parseFloat(coinData?.totalSupply || "0");

        if (holderBalances.length > 0 && supply > 0) {
          const processedHolders = holderBalances.map((edge: any) => {
            const balance = parseFloat(edge.node.balance || "0");
            return {
              address: edge.node.ownerAddress,
              balance: edge.node.balance,
              percentage: (balance / supply) * 100,
              profile: edge.node.ownerProfile?.handle || null,
            };
          });
          setHolders(processedHolders);
        }
      } catch (error) {
        console.error("Error fetching coin stats:", error);
      }
    }
    fetchCoinStats();
  }, [coinAddress, fxRates]);

  const handleTrade = async () => {
    if (!isConnected || !address || !walletClient || !publicClient || !coinAddress) {
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
        coinAddress: coinAddress as `0x${string}`,
        ethAmount,
        walletClient,
        publicClient,
        userAddress: address,
        isBuying,
      });

      if (result?.hash) {
        setTxHash(result.hash);
        toast({ title: "Trade successful!", description: `You ${isBuying ? 'bought' : 'sold'} ${coin?.symbol} tokens` });
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
                coinAddress: coinAddress,
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
    if (!coinAddress) {
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
          creatorTokenAddress: coinAddress,
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

  const marketCapNgn = convertUsdToNgn(marketCap, fxRates);
  const volume24hNgn = convertUsdToNgn(volume24h, fxRates);
  const creatorEarningsNgn = convertUsdToNgn(creatorEarnings, fxRates);
  const currentPriceNgn = convertUsdToNgn(currentPrice, fxRates);
  const ethAmountNgn = convertEthToNgn(ethAmount, fxRates);

  const setQuickAmount = (amount: string) => {
    if (amount === 'Max') {
      setEthAmount((parseFloat(balance) * 0.9).toFixed(6));
    } else {
      setEthAmount(amount);
    }
  };

  const displayImage = coinImage || coin?.image || coin?.metadata?.image;

  if (!coin) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto px-4 py-4">
      <Button
        variant="ghost"
        onClick={() => setLocation(-1)}
        className="mb-3"
      >
        <ChevronLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-[400px,1fr] gap-4">
        {/* Left Column - Sticky Image & Chart Carousel */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="bg-card rounded-xl border border-border/50 overflow-hidden aspect-square max-h-[400px]">
            <Carousel className="w-full h-full" opts={{ loop: false }} setApi={setCarouselApi}>
              <CarouselContent className="h-full">
                {/* Image Slide */}
                <CarouselItem className="h-full">
                  <div className="h-full flex items-center justify-center">
                    {displayImage ? (
                      <img src={displayImage} alt={coin.name} className="max-w-full max-h-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Coins className="w-16 h-16 mb-2 opacity-30" />
                        <p className="text-sm">No media available</p>
                      </div>
                    )}
                  </div>
                </CarouselItem>

                {/* Chart Slide */}
                <CarouselItem className="h-full">
                  <div className="h-full flex flex-col p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Price</p>
                        <p className="text-lg font-bold">
                          {currentPriceNgn !== null ? `₦${currentPriceNgn.toFixed(6)}` : '--'}
                        </p>
                      </div>
                      <div className={`flex items-center gap-1 ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        <TrendingUp className={`w-4 h-4 ${priceChange < 0 ? 'rotate-180' : ''}`} />
                        <span className="text-sm font-semibold">{priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%</span>
                      </div>
                    </div>

                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                        <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                          formatter={(value: number) => [`₦${value.toFixed(6)}`, 'Price']}
                        />
                        <Line type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CarouselItem>
              </CarouselContent>
              <CarouselPrevious className="left-2" />
              <CarouselNext className="right-2" />
            </Carousel>

            {/* Slide Indicators */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {[0, 1].map((idx) => (
                <button
                  key={idx}
                  onClick={() => carouselApi?.scrollTo(idx)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    currentSlide === idx ? 'bg-primary w-4' : 'bg-muted-foreground/30'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Scrollable Trade Area */}
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold mb-0.5">{coin.name}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>@{formatAddress(coin.creator_wallet)}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={handleShareCoin}
              aria-label="Share coin"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Compact Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center bg-muted/20 rounded-lg p-2">
              <p className="text-xs text-muted-foreground mb-0.5">Market Cap</p>
              <p className="text-sm font-bold text-green-500">
                {formatSmartCurrency(marketCapNgn)}
              </p>
            </div>
            <div className="text-center bg-muted/20 rounded-lg p-2">
              <p className="text-xs text-muted-foreground mb-0.5">24H Volume</p>
              <p className="text-sm font-semibold">
                {formatSmartCurrency(volume24hNgn)}
              </p>
            </div>
            <div className="text-center bg-muted/20 rounded-lg p-2">
              <p className="text-xs text-muted-foreground mb-0.5">Creator Fees</p>
              <p className="text-sm font-semibold">
                {formatSmartCurrency(creatorEarningsNgn)}
              </p>
            </div>
          </div>

          {/* Buy/Sell Toggle */}
          <div className="grid grid-cols-2 gap-2">
            <Button 
              onClick={() => setIsBuying(true)} 
              className={`h-10 ${isBuying ? 'bg-green-500 hover:bg-green-600' : 'bg-muted hover:bg-muted/80'}`}
              disabled={isTrading || !!txHash}
            >
              Buy
            </Button>
            <Button 
              onClick={() => setIsBuying(false)} 
              className={`h-10 ${!isBuying ? 'bg-red-500 hover:bg-red-600' : 'bg-muted hover:bg-muted/80'}`}
              disabled={isTrading || !!txHash}
            >
              Sell
            </Button>
          </div>

          {/* Amount Input */}
          <div className="space-y-1.5">
            <Input 
              type="number" 
              value={ethAmount} 
              onChange={(e) => setEthAmount(e.target.value)} 
              className="h-11 text-base text-center" 
              placeholder="0.000111"
              disabled={isTrading || !!txHash} 
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>Balance: {parseFloat(balance).toFixed(4)} ETH</span>
            </div>
            {ethAmountNgn !== null && (
              <div className="text-xs text-muted-foreground text-center">
                ≈ ₦{ethAmountNgn.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </div>
            )}
          </div>

          {/* Quick Amount Buttons */}
          <div className="grid grid-cols-4 gap-1.5">
            {['0.001 ETH', '0.01 ETH', '0.1 ETH', 'Max'].map((label) => (
              <Button 
                key={label} 
                variant="outline" 
                size="sm" 
                className="h-8 text-xs" 
                onClick={() => setQuickAmount(label.replace(' ETH', ''))} 
                disabled={isTrading || !!txHash}
              >
                {label}
              </Button>
            ))}
          </div>

          {/* Comment Input */}
          <Input 
            placeholder="Add a comment..." 
            value={standaloneComment} 
            onChange={(e) => setStandaloneComment(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleStandaloneComment();
              }
            }}
            className="h-9"
          />

          {/* Trade Button */}
          <Button 
            onClick={handleTrade} 
            disabled={isTrading || !isConnected || !!txHash} 
            className={`w-full h-11 text-base font-semibold ${isBuying ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"}`}
          >
            {isTrading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Trading...
              </>
            ) : (
              `${isBuying ? "Buy" : "Sell"}`
            )}
          </Button>
          {isBuying && (
            <Button
              onClick={handleNairaPay}
              disabled={isNairaPaying || !!txHash}
              variant="outline"
              className="w-full h-11 text-base font-semibold"
            >
              {isNairaPaying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Starting payment...
                </>
              ) : (
                "Pay with Naira (Beta)"
              )}
            </Button>
          )}

          {/* Success Message */}
          {txHash && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="font-semibold text-green-500 text-sm">Trade Successful!</span>
              </div>
              <a
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary flex items-center gap-1 hover:underline"
              >
                View on BaseScan
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Tabs Section - Scrollable */}
          <div className="mt-4">
            <Tabs defaultValue="comments" className="w-full">
              <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0 gap-4">
                <TabsTrigger value="comments" className="data-[state=active]:border-b-2 data-[state=active]:border-foreground data-[state=active]:text-foreground rounded-none px-0 py-2 text-xs font-medium text-muted-foreground border-b-2 border-transparent">
                  Comments {comments.length > 0 && <span className="ml-1.5 text-muted-foreground">{comments.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="holders" className="data-[state=active]:border-b-2 data-[state=active]:border-foreground data-[state=active]:text-foreground rounded-none px-0 py-2 text-xs font-medium text-muted-foreground border-b-2 border-transparent">
                  Holders {holders.length > 0 && <span className="ml-1.5 text-muted-foreground">{holders.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="activity" className="data-[state=active]:border-b-2 data-[state=active]:border-foreground data-[state=active]:text-foreground rounded-none px-0 py-2 text-xs font-medium text-muted-foreground border-b-2 border-transparent">Activity</TabsTrigger>
                <TabsTrigger value="details" className="data-[state=active]:border-b-2 data-[state=active]:border-foreground data-[state=active]:text-foreground rounded-none px-0 py-2 text-xs font-medium text-muted-foreground border-b-2 border-transparent">Details</TabsTrigger>
              </TabsList>

              <TabsContent value="comments" className="pt-3">
                <ScrollArea className="h-80">
                  {comments.length > 0 ? (
                    <div className="space-y-2">
                      {comments.map((c) => (
                        <div key={c.id} className="p-3 bg-muted/20 rounded-lg">
                          <p className="text-xs font-medium mb-1">{formatAddress(c.userAddress)}</p>
                          <p className="text-sm text-muted-foreground">{c.comment}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 text-center">
                      <MessageCircle className="w-12 h-12 text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">No comments yet. Be the first!</p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="holders" className="pt-3">
                <ScrollArea className="h-80">
                  {holders.length > 0 ? (
                    <div className="space-y-2">
                      {holders.map((holder, idx) => (
                        <div key={holder.address} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                              <span className="text-xs font-semibold">{idx + 1}</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium">{holder.profile || formatAddress(holder.address)}</p>
                              {holder.profile && <p className="text-xs text-muted-foreground">{formatAddress(holder.address)}</p>}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">{holder.percentage.toFixed(2)}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 text-center">
                      <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">No holders data available</p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="activity" className="pt-3">
                <ScrollArea className="h-80">
                  <div className="flex flex-col items-center justify-center h-48 text-center">
                    <ActivityIcon className="w-12 h-12 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">Activity data coming soon</p>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="details" className="pt-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <ActivityIcon className="w-4 h-4" />
                      <span className="text-sm">Created</span>
                    </div>
                    <span className="text-sm font-medium">{coin.createdAt ? new Date(coin.createdAt).toLocaleDateString() : 'Unknown'}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Copy className="w-4 h-4" />
                      <span className="text-sm">Contract address</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium font-mono">{formatAddress(coin.address)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => copyToClipboard(coin.address)}
                      >
                        {copiedAddress ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Coins className="w-4 h-4" />
                      <span className="text-sm">Chain</span>
                    </div>
                    <span className="text-sm font-medium flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-500"></span>
                      Base
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span className="text-sm">Symbol</span>
                    </div>
                    <span className="text-sm font-medium">@{coin.symbol || 'Unknown'}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Info className="w-4 h-4" />
                      <span className="text-sm">Media</span>
                    </div>
                    <span className="text-sm font-medium">{displayImage ? 'Image' : 'None'}</span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
      <ShareModal
        open={isShareModalOpen}
        onOpenChange={setIsShareModalOpen}
        type="coin"
        resourceId={coinAddress || ""}
        title={coin?.name ? `${coin.name} (${coin.symbol})` : "Coin"}
      />
    </div>
  );
}
