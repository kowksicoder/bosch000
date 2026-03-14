
import { useState, useEffect } from "react";
import type { Coin, Comment } from "@shared/schema";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, ExternalLink, Coins, MessageCircle, Users, Activity as ActivityIcon, Info, Copy, Check, TrendingUp } from "lucide-react";
import { getCoin, getCoinHolders } from "@zoralabs/coins-sdk";
import { base } from "viem/chains";
import { formatEther } from "viem";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { formatSmartCurrency } from "@/lib/utils";
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

interface TradeModalDesktopProps {
  coin: CoinProp;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TradeModalDesktop({ coin, open, onOpenChange }: TradeModalDesktopProps) {
  const { toast } = useToast();
  const [ethAmount, setEthAmount] = useState("0.000111");
  const [isTrading, setIsTrading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isBuying, setIsBuying] = useState(true);
  const [comment, setComment] = useState("");
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
  const [isNairaPaying, setIsNairaPaying] = useState(false);
  const { data: fxRates } = useFxRates();
  const { user: privyUser, authenticated } = usePrivy();

  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => setCurrentSlide(carouselApi.selectedScrollSnap());
    carouselApi.on("select", onSelect);
    return () => carouselApi.off("select", onSelect);
  }, [carouselApi]);

  const { data: comments = [], isLoading: commentsLoading } = useQuery<Comment[]>({
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

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
            const priceChangeValue = typeof coinData.priceChange24h === 'string' 
              ? parseFloat(coinData.priceChange24h) 
              : coinData.priceChange24h;
            setPriceChange(priceChangeValue);
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
    if (open) fetchCoinStats();
  }, [coin.address, open, fxRates]);

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

  const marketCapNgn = convertUsdToNgn(marketCap, fxRates);
  const volume24hNgn = convertUsdToNgn(volume24h, fxRates);
  const creatorEarningsNgn = convertUsdToNgn(creatorEarnings, fxRates);
  const ethAmountNgn = convertEthToNgn(ethAmount, fxRates);

  const setQuickAmount = (amount: string) => {
    if (amount === 'Max') {
      setEthAmount((parseFloat(balance) * 0.9).toFixed(6));
    } else {
      setEthAmount(amount);
    }
  };

  const displayImage = coinImage || coin?.image || coin?.metadata?.image;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] bg-card/95 backdrop-blur-sm border-border/50 p-0 overflow-hidden sm:rounded-2xl">
        <div className="flex max-h-[75vh]">
          <div className="w-5/12 bg-gradient-to-br from-muted/20 to-muted/10 flex flex-col p-2.5">
            <div className="mb-2">
              <p className="text-xs text-muted-foreground mb-0.5">Market cap</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-lg font-bold text-foreground">
                  {formatSmartCurrency(marketCapNgn)}
                </h3>
                <span className={`text-xs font-semibold ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="flex-1 min-h-[180px] relative">
              <Carousel className="w-full h-full" opts={{ loop: false }} setApi={setCarouselApi}>
                <CarouselContent className="h-full">
                  <CarouselItem className="h-full px-2">
                    <div className="h-full flex items-center justify-center bg-gradient-to-br from-muted/10 to-muted/5 rounded-lg overflow-hidden">
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

                  <CarouselItem className="h-full px-2">
                    <div className="h-full flex flex-col bg-gradient-to-br from-muted/10 to-muted/5 rounded-lg p-2">
                      <div className="flex-1 min-h-0">
                        {chartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                              <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" style={{ fontSize: '9px' }} />
                              <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: '9px' }} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'hsl(var(--background))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px',
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
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <TrendingUp className="w-10 h-10 mb-1.5 opacity-30" />
                            <p className="text-xs">No chart data available</p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-border/30">
                        {(['1H', '1D', 'W', 'M', 'All'] as const).map((tf) => (
                          <Button
                            key={tf}
                            variant={timeframe === tf ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setTimeframe(tf)}
                            className="h-6 text-xs px-2"
                          >
                            {tf}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CarouselItem>
                </CarouselContent>
                <CarouselPrevious className="left-0 bg-background/80 hover:bg-background" />
                <CarouselNext className="right-0 bg-background/80 hover:bg-background" />
              </Carousel>

              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                {[0, 1].map((index) => (
                  <div
                    key={index}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      currentSlide === index ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="w-7/12 flex flex-col overflow-hidden">
            <DialogHeader className="px-2 pt-2 pb-0.5">
              <DialogTitle className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-foreground leading-tight">{coin.name}</h3>
                  <p className="text-[10px] text-muted-foreground">@{formatAddress(coin.creator_wallet)}</p>
                </div>
              </DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="trade" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-2 h-auto p-0">
                <TabsTrigger value="trade" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-1 text-[10px]">Trade</TabsTrigger>
                <TabsTrigger value="comments" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-1 text-[10px]">Comments</TabsTrigger>
                <TabsTrigger value="holders" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-1 text-[10px]">Holders</TabsTrigger>
                <TabsTrigger value="activity" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-1 text-[10px]">Activity</TabsTrigger>
                <TabsTrigger value="details" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-1 text-[10px]">Details</TabsTrigger>
              </TabsList>

              <TabsContent value="trade" className="flex-1 px-2 pb-2 mt-0 pt-1 overflow-y-auto min-h-0">
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-1 mb-1.5">
                  <div className="bg-muted/30 rounded p-1">
                    <p className="text-[9px] text-muted-foreground leading-tight">Market Cap</p>
                    <p className="text-[10px] font-bold text-green-500 leading-tight">₦{marketCap || '0'}</p>
                  </div>
                  <div className="bg-muted/30 rounded p-1">
                    <p className="text-[9px] text-muted-foreground leading-tight">24H Vol</p>
                    <p className="text-[10px] font-semibold leading-tight">
                      {formatSmartCurrency(volume24hNgn)}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded p-1">
                    <p className="text-[9px] text-muted-foreground leading-tight">Fees</p>
                    <p className="text-[10px] font-semibold leading-tight">
                      {formatSmartCurrency(creatorEarningsNgn)}
                    </p>
                  </div>
                </div>

                {/* Buy / Sell toggle */}
                <div className="flex gap-1 mb-1.5">
                  <Button onClick={() => setIsBuying(true)} variant={isBuying ? "default" : "outline"} size="sm" className={`flex-1 h-7 text-xs ${isBuying ? 'bg-green-500 hover:bg-green-600 text-white' : ''}`} disabled={isTrading || !!txHash}>Buy</Button>
                  <Button onClick={() => setIsBuying(false)} variant={!isBuying ? "default" : "outline"} size="sm" className={`flex-1 h-7 text-xs ${!isBuying ? 'bg-red-500 hover:bg-red-600 text-white' : ''}`} disabled={isTrading || !!txHash}>Sell</Button>
                </div>

                {/* Amount input */}
                <div className="relative mb-1">
                  <Input type="number" value={ethAmount} onChange={(e) => setEthAmount(e.target.value)} className="h-7 text-xs pr-10" disabled={isTrading || !!txHash} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">ETH</span>
                </div>
                <p className="text-[9px] text-muted-foreground mb-1.5">
                  Balance: {parseFloat(balance).toFixed(4)} ETH
                </p>
                {ethAmountNgn !== null && (
                  <p className="text-[9px] text-muted-foreground mb-1.5">
                    ≈ ₦{ethAmountNgn.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </p>
                )}

                {/* Quick amounts */}
                <div className="grid grid-cols-4 gap-1 mb-1.5">
                  {['0.001', '0.01', '0.1', 'Max'].map((label) => (
                    <Button key={label} variant="outline" size="sm" className="h-6 text-[10px] px-0" onClick={() => setQuickAmount(label)} disabled={isTrading || !!txHash}>{label}</Button>
                  ))}
                </div>

                {/* Main action button */}
                <Button onClick={handleTrade} disabled={isTrading || !isConnected} size="sm" className={`w-full h-8 text-xs font-semibold ${isBuying ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}>
                  {isTrading ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Trading...</> : `${isBuying ? 'Buy' : 'Sell'} ${coin.symbol}`}
                </Button>
                {isBuying && (
                  <Button
                    onClick={handleNairaPay}
                    disabled={isNairaPaying || !!txHash}
                    size="sm"
                    variant="outline"
                    className="w-full h-8 text-xs font-semibold mt-1.5"
                  >
                    {isNairaPaying ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                        Starting payment...
                      </>
                    ) : (
                      "Pay with Naira (Beta)"
                    )}
                  </Button>
                )}
              </TabsContent>

              <TabsContent value="comments" className="flex-1 px-2.5 pb-2.5 overflow-y-auto min-h-0 flex flex-col mt-0 pt-1.5">
                <div className="flex gap-2 mb-2">
                  <Input placeholder="Add a comment..." value={standaloneComment} onChange={(e) => setStandaloneComment(e.target.value)} className="h-8 text-sm" />
                  <Button onClick={handleStandaloneComment} size="sm" className="h-8 text-xs">Post</Button>
                </div>
                <ScrollArea className="flex-1">
                  {comments.map((c) => (
                    <div key={c.id} className="p-2 mb-1.5 bg-muted/20 rounded-lg">
                      <p className="text-xs font-medium">{formatAddress(c.userAddress)}</p>
                      <p className="text-xs text-muted-foreground">{c.comment}</p>
                    </div>
                  ))}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="holders" className="flex-1 px-2.5 pb-2.5 overflow-y-auto min-h-0 mt-0 pt-1.5">
                <ScrollArea className="flex-1">
                  {holders.length > 0 ? (
                    holders.map((holder, idx) => (
                      <div key={holder.address} className="flex items-center justify-between p-2 mb-1.5 bg-muted/20 rounded-lg">
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
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                      <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">No holders data available</p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="activity" className="flex-1 px-2.5 pb-2.5 overflow-y-auto min-h-0 mt-0 pt-1.5">
                <ScrollArea className="flex-1">
                  {/* Mock activity data - replace with real trading activity */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center">
                          <img src={displayImage || "/placeholder.svg"} alt="user" className="w-full h-full rounded-full object-cover" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{formatAddress(coin.creator_wallet)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold text-green-500 bg-green-500/20 px-2 py-1 rounded">Buy</span>
                        <p className="text-xs text-muted-foreground mt-1">1.8m · ₦0.25 · 3d</p>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="details" className="flex-1 px-2.5 pb-2.5 overflow-y-auto min-h-0 mt-0 pt-1.5">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <ActivityIcon className="w-4 h-4" />
                      <span className="text-sm">Created</span>
                    </div>
                    <span className="text-sm font-medium">{coin.createdAt ? new Date(coin.createdAt).toLocaleDateString() : 'Unknown'}</span>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Copy className="w-4 h-4" />
                      <span className="text-sm">Contract address</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{formatAddress(coin.address)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(coin.address)}
                      >
                        {copiedAddress ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Coins className="w-4 h-4" />
                      <span className="text-sm">Chain</span>
                    </div>
                    <span className="text-sm font-medium flex items-center gap-1">
                      <span className="w-4 h-4 rounded-full bg-blue-500"></span>
                      Base
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span className="text-sm">Pair</span>
                    </div>
                    <span className="text-sm font-medium">@{coin.symbol || 'Unknown'}</span>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Info className="w-4 h-4" />
                      <span className="text-sm">Media</span>
                    </div>
                    <span className="text-sm font-medium">{displayImage ? 'JPG' : 'None'}</span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
