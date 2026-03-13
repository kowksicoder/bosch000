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
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import GeckoTerminalChart from "@/components/geckoterminal-chart";
import { formatSmartCurrency } from "@/lib/utils";

// Assuming ProfileCardModal component is defined elsewhere and imported
// For demonstration, a placeholder is included here. In a real scenario, import it.
const ProfileCardModal = ({ creatorAddress, open, onOpenChange }: { creatorAddress?: string; open: boolean; onOpenChange: (open: boolean) => void }) => {
  // Placeholder for Profile Card Modal content and logic
  if (!creatorAddress) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Creator Profile</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center p-4">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-lg font-bold text-foreground mb-3">
            {creatorAddress.slice(0, 4).toUpperCase()}
          </div>
          <p className="text-lg font-semibold text-foreground mb-1">{creatorAddress.slice(0, 10)}...</p>
          <p className="text-sm text-muted-foreground mb-3">@{creatorAddress.slice(0, 8)}</p>
          <p className="text-xs text-muted-foreground text-center mb-4">Some placeholder stats like Marketcap, Holders would go here.</p>
          <Button className="w-full rounded-full">Follow</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface TradeModalProps {
  coin: Coin;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TradeModal({ coin, open, onOpenChange }: TradeModalProps) {
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
  const [creatorAvatar, setCreatorAvatar] = useState<string | null>(null);
  
  // Fetch creator data to get avatar
  const { data: creatorProfile } = useQuery({
    queryKey: ['/api/creators/address', coin.creator_wallet],
    enabled: !!coin.creator_wallet && open,
  });
  const [holders, setHolders] = useState<Array<{
    address: string;
    balance: string;
    percentage: number;
    profile?: string | null;
  }>>([]);
  const [totalSupply, setTotalSupply] = useState<string | null>(null);
  const [uniqueHoldersCount, setUniqueHoldersCount] = useState<number>(0);
  const [chartData, setChartData] = useState<Array<{ time: string; price: number }>>([
    { time: '12:00 AM', price: 0.001 },
    { time: '6:00 AM', price: 0.0015 },
    { time: '12:00 PM', price: 0.002 },
    { time: '6:00 PM', price: 0.0025 },
  ]);
  const [timeframe, setTimeframe] = useState<'1H' | '1D' | 'W' | 'M' | 'All'>('1D');
  const [priceChange, setPriceChange] = useState<number>(0);
  const [currentSlide, setCurrentSlide] = useState(0); // Added state for current slide tracking
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false); // State to control profile modal visibility
  const [carouselApi, setCarouselApi] = useState<any>(null); // Carousel API
  const [swapActivities, setSwapActivities] = useState<Array<{
    activityType: string;
    coinAmount: string;
    senderAddress: string;
    blockTimestamp: string;
    transactionHash: string;
  }>>([]);

  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  // Track carousel slide changes
  useEffect(() => {
    if (!carouselApi) return;

    const onSelect = () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    };

    carouselApi.on("select", onSelect);
    return () => {
      carouselApi.off("select", onSelect);
    };
  }, [carouselApi]);

  const GATEWAY_URLS = [
    "ipfs.io",
    "cloudflare-ipfs.com",
    "gateway.pinata.cloud",
  ];

  const [copiedAddress, setCopiedAddress] = useState(false);

  // Fetch comments for this coin
  const { data: comments = [], isLoading: commentsLoading } = useQuery<Comment[]>({
    queryKey: ['/api/comments/coin', coin.address],
    enabled: open && !!coin.address,
  });

  // Mutation for creating a comment
  const createCommentMutation = useMutation({
    mutationFn: async (commentData: { coinAddress: string; userAddress: string; comment: string; transactionHash?: string }) => {
      return await apiRequest('POST', '/api/comments', commentData);
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
    if (!isConnected || !address || !coin.address || !standaloneComment.trim()) return;

    try {
      await createCommentMutation.mutateAsync({
        coinAddress: coin.address,
        userAddress: address,
        comment: standaloneComment.trim(),
      });

      setStandaloneComment("");

      toast({
        title: "Comment added",
        description: "Your comment has been posted",
      });
    } catch (error) {
      console.error('Failed to post comment:', error);
      toast({
        title: "Failed to post comment",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  // Fetch user balance
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

    if (isConnected && open) {
      fetchBalance();
    }
  }, [address, isConnected, publicClient, open]);

  // Fetch chart data
  useEffect(() => {
    async function fetchChartData() {
      if (!coin.address) return;

      try {
        // Get the time range for the chart
        const now = Date.now();
        let startTime: number;

        switch (timeframe) {
          case '1H':
            startTime = now - (60 * 60 * 1000);
            break;
          case '1D':
            startTime = now - (24 * 60 * 60 * 1000);
            break;
          case 'W':
            startTime = now - (7 * 24 * 60 * 60 * 1000);
            break;
          case 'M':
            startTime = now - (30 * 24 * 60 * 60 * 1000);
            break;
          case 'All':
            startTime = 0;
            break;
        }

        // Fetch historical price data from Zora
        const response = await fetch(`https://api.zora.co/graphql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_NEXT_PUBLIC_ZORA_API_KEY || ''}`,
          },
          body: JSON.stringify({
            query: `
              query GetCoinPriceHistory($address: String!, $chainId: Int!) {
                zora20Token(address: $address, chainId: $chainId) {
                  priceHistory {
                    timestamp
                    priceUsd
                  }
                }
              }
            `,
            variables: {
              address: coin.address.toLowerCase(),
              chainId: base.id,
            },
          }),
        });

        const data = await response.json();
        const priceHistory = data?.data?.zora20Token?.priceHistory || [];

        if (priceHistory.length > 0) {
          // Filter by timeframe and format data
          const filtered = priceHistory
            .filter((point: any) => point.timestamp >= startTime)
            .map((point: any) => ({
              time: new Date(point.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              price: parseFloat(point.priceUsd || '0'),
            }));

          setChartData(filtered);

          // Calculate price change percentage
          if (filtered.length >= 2) {
            const firstPrice = filtered[0].price;
            const lastPrice = filtered[filtered.length - 1].price;
            const change = ((lastPrice - firstPrice) / firstPrice) * 100;
            setPriceChange(change);
          }
        } else {
          // Fallback: generate sample data points from market cap if no history
          const basePrice = parseFloat(marketCap || '1000') / 1000000;
          setChartData([
            { time: '12:00 AM', price: basePrice * 0.8 },
            { time: '6:00 AM', price: basePrice * 0.9 },
            { time: '12:00 PM', price: basePrice * 0.95 },
            { time: '6:00 PM', price: basePrice },
          ]);
        }
      } catch (error) {
        console.error('Error fetching chart data:', error);
        // Use fallback data based on market cap
        const basePrice = parseFloat(marketCap || '1000') / 1000000;
        setChartData([
          { time: '12:00 AM', price: basePrice * 0.8 },
          { time: '6:00 AM', price: basePrice * 0.9 },
          { time: '12:00 PM', price: basePrice * 0.95 },
          { time: '6:00 PM', price: basePrice },
        ]);
      }
    }

    if (open && marketCap) {
      fetchChartData();
    }
  }, [coin.address, open, timeframe, marketCap]);

  // Fetch coin stats and creator avatar
  useEffect(() => {
    let isMounted = true; // Flag to track if component is mounted

    async function fetchCoinStats() {
      if (!coin.address) return;

      try {
        const response = await getCoin({
          address: coin.address as `0x${string}`,
          chain: base.id,
        });

        const coinData = response.data?.zora20Token;

        if (coinData && isMounted) {
          console.log('🔍 Zora API response for', coin.name, ':', {
            volume24h: coinData.volume24h,
            creatorEarnings: coinData.creatorEarnings,
            marketCap: coinData.marketCap,
          });

          // Set market cap - handle both string and number
          if (coinData.marketCap !== null && coinData.marketCap !== undefined) {
            const mcValue = typeof coinData.marketCap === 'string'
              ? parseFloat(coinData.marketCap)
              : coinData.marketCap;
            setMarketCap(mcValue.toFixed(2));
          }

          // Set 24h volume - handle both string and number, ensure accurate display
          if (coinData.volume24h !== null && coinData.volume24h !== undefined) {
            const volValue = typeof coinData.volume24h === 'string'
              ? parseFloat(coinData.volume24h)
              : coinData.volume24h;
            if (!isNaN(volValue) && volValue >= 0) {
              setVolume24h(volValue.toString());
              // Calculate creator earnings from volume (0.5% of total volume)
              const estimatedEarnings = volValue * 0.005;
              setCreatorEarnings(estimatedEarnings.toString());
            } else {
              setVolume24h("0");
              setCreatorEarnings("0");
            }
          } else {
            setVolume24h("0");
            setCreatorEarnings("0");
          }

          // Set coin image
          if (coinData.mediaContent?.previewImage) {
            const previewImage = coinData.mediaContent.previewImage as any;
            setCoinImage(previewImage.medium || previewImage.small || null);
          } else if (coin.metadata?.image) {
            setCoinImage(coin.metadata.image);
          }
        }

        // Fetch holder details
        const holdersResponse = await getCoinHolders({
          chainId: base.id,
          address: coin.address as `0x${string}`,
          count: 50, // Get top 50 holders
        });

        const holderBalances = holdersResponse.data?.zora20Token?.tokenBalances?.edges || [];
        const supply = parseFloat(coinData?.totalSupply || "0");

        if (holderBalances.length > 0 && supply > 0) {
          const processedHolders = holderBalances.map((edge: any) => {
            const balance = parseFloat(edge.node.balance || "0");
            const percentage = (balance / supply) * 100;

            return {
              address: edge.node.ownerAddress,
              balance: edge.node.balance,
              percentage: percentage,
              profile: edge.node.ownerProfile?.handle || null,
            };
          });

          setHolders(processedHolders);
        }

        // Fetch swap activities using getCoinSwaps
        const { getCoinSwaps } = await import("@zoralabs/coins-sdk");
        const swapsResponse = await getCoinSwaps({
          address: coin.address as `0x${string}`,
          chain: base.id,
          first: 50,
        });

        const swaps = swapsResponse.data?.zora20Token?.swapActivities?.edges || [];
        console.log('📊 Swap activities data:', swaps.length > 0 ? swaps[0] : 'No swaps');

        if (swaps.length > 0) {
          const processedSwaps = swaps.map((edge: any) => ({
            activityType: edge.node.activityType,
            coinAmount: edge.node.coinAmount,
            senderAddress: edge.node.senderAddress,
            blockTimestamp: edge.node.blockTimestamp,
            transactionHash: edge.node.transactionHash,
          }));
          setSwapActivities(processedSwaps);

          // Calculate 24h volume and creator earnings from swap activities
          const now = Date.now();
          const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);

          let totalVolume24h = 0;
          let totalCreatorFees = 0;

          swaps.forEach((edge: any) => {
            const swap = edge.node;
            const swapTime = new Date(swap.blockTimestamp).getTime();

            // Only count swaps from the last 24 hours
            if (swapTime >= twentyFourHoursAgo) {
              // Get the USD value of the swap
              const swapValueUsd = parseFloat(swap.ethAmount || swap.valueUsd || swap.totalValueUsd || "0");

              if (swapValueUsd > 0) {
                totalVolume24h += swapValueUsd;

                // Creator typically gets a fee (e.g., 2-5% of each trade)
                // Check if there's a creatorFee field, otherwise estimate at 3%
                const creatorFee = parseFloat(swap.creatorFee || swap.creatorFeeUsd || "0");
                if (creatorFee > 0) {
                  totalCreatorFees += creatorFee;
                } else {
                  // Estimate creator fee at 3% if not provided
                  totalCreatorFees += swapValueUsd * 0.03;
                }
              }
            }
          });

          console.log('💰 Calculated from swaps:', { totalVolume24h, totalCreatorFees });

          // Only override if we calculated non-zero values OR if API returned zero
          if (totalVolume24h > 0 || (coinData?.volume24h === "0.0" || !coinData?.volume24h)) {
            setVolume24h(totalVolume24h.toFixed(2));
          }

          if (totalCreatorFees > 0 || !coinData?.creatorEarnings || coinData.creatorEarnings.length === 0) {
            setCreatorEarnings(totalCreatorFees.toFixed(2));
          }
        }
      } catch (error) {
        console.error("Error fetching coin stats:", error);
      }
    }

    if (open) {
      fetchCoinStats();
    }

    return () => {
      isMounted = false; // Cleanup function to set isMounted to false when component unmounts
    };
  }, [
    coin.address,
    open,
    coin.name,
    coin.image,
    coin.metadata?.image,
  ]);

  // Update creator avatar when profile loads
  useEffect(() => {
    if (creatorProfile?.avatar) {
      setCreatorAvatar(creatorProfile.avatar);
    }
  }, [creatorProfile]);

  const getImageSrc = (imageUrl?: string) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith("ipfs://")) {
      const hash = imageUrl.replace("ipfs://", "");
      return `https://${GATEWAY_URLS[0]}/ipfs/${hash}`;
    }
    if (imageUrl.includes("yellow-patient-cheetah-559.mypinata.cloud")) {
      const hash = imageUrl.split("/ipfs/")[1];
      if (hash) {
        return `https://${GATEWAY_URLS[0]}/ipfs/${hash}`;
      }
    }
    return imageUrl;
  };

  const formatAddress = (address?: string) => {
    if (!address) return 'Unknown';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleTrade = async () => {
    if (!isConnected || !address || !walletClient || !publicClient) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    const ethAmountNum = parseFloat(ethAmount);
    if (!ethAmount || ethAmountNum <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid ETH amount",
        variant: "destructive",
      });
      return;
    }

    // Check balance
    const balanceNum = parseFloat(balance);
    if (isBuying && ethAmountNum > balanceNum) {
      toast({
        title: "Insufficient balance",
        description: `You only have ${parseFloat(balance).toFixed(6)} ETH`,
        variant: "destructive",
      });
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

        // Always save trade record (with or without comment)
        if (coin.address) {
          try {
            await createCommentMutation.mutateAsync({
              coinAddress: coin.address,
              userAddress: address,
              comment: comment.trim() || `Traded ${coin.symbol}`,
              transactionHash: result.hash,
            });
          } catch (error) {
            console.error('Failed to save trade record:', error);
            toast({
              title: "Trade record not saved",
              description: "Your trade was successful but the activity record could not be saved",
              variant: "destructive",
            });
          }
        }

        // Create reward records for platform and trade fees
        const ADMIN_REFERRAL_ADDRESS = "0xf25af781c4F1Df40Ac1D06e6B80c17815AD311F7";
        const tradeAmountInWei = (parseFloat(ethAmount) * 1e18).toString();

        // Estimate fees based on trade amount (approximate percentages)
        // Platform fee: ~2% of trade amount (20% of total fees which are ~10% of trade)
        // Trade fee: ~0.4% of trade amount (4% of total fees which are ~10% of trade)
        const platformFeeWei = (parseFloat(ethAmount) * 0.02 * 1e18).toString();
        const tradeFeeWei = (parseFloat(ethAmount) * 0.004 * 1e18).toString();

        // Create platform reward (20%)
        try {
          await apiRequest('POST', '/api/rewards', {
            type: 'platform',
            coinAddress: coin.address,
            coinSymbol: coin.symbol,
            transactionHash: result.hash,
            rewardAmount: platformFeeWei,
            recipientAddress: ADMIN_REFERRAL_ADDRESS
          });
        } catch (error) {
          console.error('Failed to create platform reward:', error);
        }

        // Create trade reward (4%)
        try {
          await apiRequest('POST', '/api/rewards', {
            type: 'trade',
            coinAddress: coin.address,
            coinSymbol: coin.symbol,
            transactionHash: result.hash,
            rewardAmount: tradeFeeWei,
            recipientAddress: ADMIN_REFERRAL_ADDRESS
          });
        } catch (error) {
          console.error('Failed to create trade reward:', error);
        }

        // Create notification for the trade
        const notificationType = isBuying ? 'buy' : 'sell';
        const notificationTitle = isBuying ? '✅ Purchase Successful!' : '✅ Sale Successful!';

        const notificationMessage = isBuying
          ? `You bought ${coin.symbol} for ${ethAmount} ETH`
          : `You sold ${coin.symbol} for ${ethAmount} ETH`;

        try {
          await apiRequest('POST', '/api/notifications', {
            userId: address,
            type: notificationType,
            title: notificationTitle,
            message: notificationMessage,
            coinAddress: coin.address,
            coinSymbol: coin.symbol,
            amount: ethAmount,
            transactionHash: result.hash,
            read: false
          });
          console.log('✅ Trade notification created');
        } catch (error) {
          console.error('Failed to create trade notification:', error);
        }

        toast({
          title: "Trade successful!",
          description: `You ${isBuying ? 'bought' : 'sold'} ${coin.symbol} tokens${comment ? ` - ${comment}` : ''}`,
        });

        // Refresh balance
        const newBal = await publicClient.getBalance({ address });
        setBalance(formatEther(newBal));
      } else {
        throw new Error("Transaction completed but no hash returned");
      }

    } catch (error) {
      console.error("Trade failed:", error);

      const errorMessage = error instanceof Error ? error.message : "Trade failed";

      toast({
        title: "Trade failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsTrading(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setTxHash(null);
      setEthAmount("0.000111");
      setComment("");
      setStandaloneComment("");
      setIsProfileModalOpen(false);
      setIsBuying(true);
      setIsTrading(false);
    }
    onOpenChange(open);
  };

  const setQuickAmount = (amount: string) => {
    if (amount === 'Max') {
      // Set to 90% of balance to leave some for gas
      const maxAmount = (parseFloat(balance) * 0.9).toFixed(6);
      setEthAmount(maxAmount);
    } else {
      setEthAmount(amount);
    }
  };

  const imageUrlFromCoin = coin?.metadata?.animation_url || coin?.image || coin?.metadata?.image || "";
  const isAudio = coin?.type === "audio" || coin?.metadata?.type === "audio" || imageUrlFromCoin?.includes('spotify') || imageUrlFromCoin?.match(/\.(mp3|wav|ogg|m4a)$/i);
  const isVideo = coin?.type === "video" || coin?.metadata?.type === "video" || imageUrlFromCoin?.match(/\.(mp4|webm|mov|avi)$/i);

  const displayImage = coinImage || getImageSrc(imageUrlFromCoin);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="sm:max-w-3xl max-h-[90vh] bg-card/95 backdrop-blur-sm border-border/50 p-0 overflow-hidden sm:rounded-3xl"
        onEscapeKeyDown={(e) => {
          handleClose(false);
        }}
      >
        <div className="flex max-h-[85vh]">
          {/* Left side - Carousel with Image and Chart */}
          <div className="w-5/12 bg-gradient-to-br from-muted/20 to-muted/10 flex flex-col p-4">
            {/* Market Cap and Price Change */}
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-0.5">Market cap</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-xl font-bold text-foreground">
                  ${marketCap || '0'}
                </h3>
                <span className={`text-xs font-semibold ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Carousel - Image & Chart Slides */}
            <div className="flex-1 min-h-[200px] relative px-4">
              <Carousel className="w-full h-full" opts={{ loop: false }} setApi={setCarouselApi}>
                <CarouselContent className="h-full">
                  {/* Slide 1: Coin Image/Video/Audio */}
                  <CarouselItem className="h-full">
                    <div className="h-full flex items-center justify-center bg-gradient-to-br from-muted/10 to-muted/5 rounded-lg overflow-hidden">
                      {displayImage ? (
                        isVideo ? (
                          <video
                            src={displayImage}
                            controls
                            autoPlay
                            loop
                            muted
                            playsInline
                            preload="auto"
                            className="max-w-full max-h-full object-contain"
                          />
                        ) : isAudio ? (
                          <div className="flex flex-col items-center gap-4 p-4">
                            <Coins className="w-16 h-16 text-primary/40" />
                            <audio
                              src={displayImage}
                              controls
                              className="w-full max-w-md"
                            />
                          </div>
                        ) : (
                          <img
                            src={displayImage}
                            alt={(coin as any).metadata?.title || coin.name}
                            className="max-w-full max-h-full object-contain"
                          />
                        )
                      ) : (
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <Coins className="w-16 h-16 mb-2 opacity-30" />
                          <p className="text-sm">No media available</p>
                        </div>
                      )}
                    </div>
                  </CarouselItem>

                  {/* Slide 2: Price Chart */}
                  <CarouselItem className="h-full">
                    <div className="h-full w-full flex items-center justify-center" style={{ minHeight: '200px' }}>
                      {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
                            <XAxis
                              dataKey="time"
                              stroke="#888"
                              fontSize={10}
                              tickLine={false}
                            />
                            <YAxis
                              stroke="#888"
                              fontSize={10}
                              tickLine={false}
                              tickFormatter={(value) => `$${value.toFixed(4)}`}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#1a1a1a',
                                border: '1px solid #333',
                                borderRadius: '8px',
                                fontSize: '12px'
                              }}
                              formatter={(value: any) => [`$${value.toFixed(6)}`, 'Price']}
                            />
                            <Line
                              type="monotone"
                              dataKey="price"
                              stroke="#22c55e"
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <div className="text-center">
                            <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Loading price data...</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CarouselItem>

                  {/* Slide 3: GeckoTerminal Chart */}
                  <CarouselItem className="h-full">
                    <div className="h-full w-full" style={{ minHeight: '250px' }}>
                      <GeckoTerminalChart
                        network="base"
                        tokenAddress={coin.address || undefined}
                        height="250px"
                        chartType="price"
                        resolution="1d"
                        lightChart={false}
                        showInfo={false}
                        showSwaps={false}
                        bgColor="111827"
                        overlayColor="8B5CF6"
                      />
                    </div>
                  </CarouselItem>
                </CarouselContent>
                <CarouselPrevious className="left-0 bg-background/80 hover:bg-background" />
                <CarouselNext className="right-0 bg-background/80 hover:bg-background" />
              </Carousel>
            </div>

            {/* Timeframe Selector - Only show on chart slide */}
            {currentSlide === 1 && (
              <div className="flex gap-1.5 mt-3">
                {(['1H', '1D', 'W', 'M', 'All'] as const).map((tf) => (
                  <Button
                    key={tf}
                    variant={timeframe === tf ? 'default' : 'ghost'}
                    size="sm"
                    className={`flex-1 h-7 text-xs ${
                      timeframe === tf
                        ? 'bg-primary text-black'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setTimeframe(tf)}
                  >
                    {tf}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Right side - Tabbed Interface */}
          <div className="w-7/12 flex flex-col overflow-hidden">
            <DialogHeader className="px-4 pt-4 pb-2">
              <DialogTitle className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{coin.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    @{formatAddress(coin.creator_wallet)}
                  </p>
                </div>
              </DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="trade" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-transparent px-4 h-auto p-0 pointer-events-auto relative z-10">
                <TabsTrigger 
                  value="trade" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2 bg-transparent cursor-pointer pointer-events-auto"
                >
                  Trade
                </TabsTrigger>
                <TabsTrigger 
                  value="comments" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2 bg-transparent cursor-pointer pointer-events-auto"
                >
                  Comments
                </TabsTrigger>
                <TabsTrigger 
                  value="holders" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2 bg-transparent cursor-pointer pointer-events-auto"
                >
                  Holders
                </TabsTrigger>
                <TabsTrigger 
                  value="activity" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2 bg-transparent cursor-pointer pointer-events-auto"
                >
                  Activity
                </TabsTrigger>
                <TabsTrigger 
                  value="details" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2 bg-transparent cursor-pointer pointer-events-auto"
                >
                  Details
                </TabsTrigger>
              </TabsList>

              <TabsContent value="trade" className="flex-1 px-4 pb-4 mt-0 pt-3 overflow-y-auto min-h-[400px]">{/* Trade Tab Content */}

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Market Cap</p>
                <p className="text-sm font-bold text-green-500">
                  {marketCap && typeof marketCap === 'string' ? `$${marketCap}` : marketCap && typeof marketCap === 'number' ? `$${marketCap.toFixed(2)}` : 'Loading...'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">24H Volume</p>
                <p className="text-sm font-semibold text-foreground">
                  {volume24h ? formatSmartCurrency(typeof volume24h === 'string' ? parseFloat(volume24h) : volume24h) : 'Loading...'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Creator Earnings</p>
                <p className="text-sm font-semibold text-foreground">
                  {creatorEarnings ? formatSmartCurrency(typeof creatorEarnings === 'string' ? parseFloat(creatorEarnings) : creatorEarnings) : 'Loading...'}
                </p>
              </div>
            </div>

            {/* Buy/Sell Toggle */}
            <div className="flex gap-2 mb-3">
              <Button
                onClick={() => setIsBuying(true)}
                className={`flex-1 h-9 text-sm font-bold transition-all rounded-full ${
                  isBuying
                    ? 'bg-green-500 hover:bg-green-600 text-foreground'
                    : 'bg-transparent text-muted-foreground hover:bg-muted/50 border border-border/30'
                }`}
                disabled={isTrading || !!txHash}
                variant={isBuying ? "default" : "outline"}
              >
                Buy
              </Button>
              <Button
                onClick={() => setIsBuying(false)}
                className={`flex-1 h-9 text-sm font-bold transition-all rounded-full ${
                  !isBuying
                    ? 'bg-red-500 hover:bg-red-600 text-foreground'
                    : 'bg-transparent text-muted-foreground hover:bg-muted/50 border border-border/30'
                }`}
                disabled={isTrading || !!txHash}
                variant={!isBuying ? "default" : "outline"}
              >
                Sell
              </Button>
            </div>

            {/* Amount Input */}
            <div className="mb-2.5">
              <div className="relative">
                <Input
                  type="number"
                  step="0.000001"
                  min="0"
                  value={ethAmount}
                  onChange={(e) => setEthAmount(e.target.value)}
                  className="h-12 text-xl font-bold pr-20 bg-muted/30 border-border/50 text-foreground rounded-2xl"
                  disabled={isTrading || !!txHash}
                  data-testid="input-eth-amount"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-foreground text-xs font-bold">
                    Ξ
                  </div>
                  <span className="text-sm font-semibold text-foreground">ETH</span>
                </div>
              </div>
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {['0.001', '0.01', '0.1', 'Max'].map((label) => (
                <Button
                  key={label}
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickAmount(label)}
                  disabled={isTrading || !!txHash}
                  className="h-8 text-xs bg-muted/20 hover:bg-muted/40 border-border/30 text-foreground rounded-full"
                >
                  {label === 'Max' ? label : `${label} ETH`}
                </Button>
              ))}
            </div>

            {/* Comment Input */}
            <div className="mb-3">
              <Input
                placeholder="Add a comment (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="h-9 bg-muted/20 border-border/30 text-foreground placeholder:text-muted-foreground rounded-xl text-sm"
                disabled={isTrading || !!txHash}
                maxLength={200}
              />
            </div>

            {/* Action Button */}
            {!txHash ? (
              !isConnected ? (
                <div className="p-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-xs text-yellow-500 text-center font-medium">
                    Please connect your wallet to trade
                  </p>
                </div>
              ) : (
                <Button
                  className={`w-full h-11 text-base font-bold transition-all rounded-full ${
                    isBuying
                      ? 'bg-green-500 hover:bg-green-600'
                      : 'bg-red-500 hover:bg-red-600'
                  } text-foreground`}
                  onClick={handleTrade}
                  disabled={isTrading || createCommentMutation.isPending || !ethAmount || parseFloat(ethAmount) <= 0}
                  data-testid="button-confirm-trade"
                >
                  {isTrading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Trading...
                    </>
                  ) : (
                    `${isBuying ? 'Buy' : 'Sell'} ${coin.symbol}`
                  )}
                </Button>
              )
            ) : (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-green-400 text-sm mb-1.5">
                      Transaction Successful!
                    </div>
                    <a
                      href={`https://basescan.org/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                      data-testid="link-tx-explorer"
                    >
                      View on BaseScan
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* External Links */}
            {coin.address && (
              <div className="flex items-center gap-2 pt-2 mt-2 border-t border-border/30">
                <a
                  href={`https://basescan.org/address/${coin.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors text-xs font-medium text-foreground"
                  title="View on BaseScan"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-3.87-.93-7-5.07-7-9V8.3l7-3.11 7 3.11V11c0 3.93-3.13 8.07-7 9z"/>
                  </svg>
                  BaseScan
                </a>
                <a
                  href={`https://www.geckoterminal.com/base/pools/${coin.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors text-xs font-medium text-foreground"
                  title="View on GeckoTerminal"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
                  </svg>
                  GeckoTerminal
                </a>
                <a
                  href={`https://dexscreener.com/base/${coin.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors text-xs font-medium text-foreground"
                  title="View on DexScreener"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
                  </svg>
                  DexScreener
                </a>
              </div>
            )}

            {/* Balance */}
            <div className="mt-auto pt-3 text-xs text-muted-foreground text-right">
              Balance: {parseFloat(balance).toFixed(6)} ETH
            </div>
          </TabsContent>

          {/* Comments Tab */}
          <TabsContent value="comments" className="flex-1 px-4 pb-4 mt-0 pt-3 overflow-y-auto min-h-[400px]">
            <div className="mb-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Add a comment..."
                  className="h-9 bg-muted/20 border-border/30 text-foreground placeholder:text-muted-foreground flex-1 rounded-xl text-sm"
                  disabled={!isConnected || createCommentMutation.isPending}
                  value={standaloneComment}
                  onChange={(e) => setStandaloneComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleStandaloneComment();
                    }
                  }}
                />
                <Button
                  onClick={handleStandaloneComment}
                  disabled={!isConnected || createCommentMutation.isPending || !standaloneComment.trim()}
                  className="h-9 rounded-full px-4 text-sm"
                >
                  {createCommentMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Post'
                  )}
                </Button>
              </div>
              {!isConnected && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Connect your wallet to comment
                </p>
              )}
            </div>

            <ScrollArea className="flex-1">
              {commentsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : comments && comments.length > 0 ? (
                <div className="space-y-2">
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      className="p-2.5 rounded-lg bg-muted/20 border border-border/30"
                      data-testid={`comment-${c.id}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0">
                          {c.userAddress ? c.userAddress.slice(2, 4).toUpperCase() : '??'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium text-foreground truncate">
                              {c.userAddress ? `${c.userAddress.slice(0, 6)}...${c.userAddress.slice(-4)}` : 'Unknown'}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(c.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground break-words">
                            {c.comment}
                          </p>
                          {c.transactionHash && (
                            <a
                              href={`https://basescan.org/tx/${c.transactionHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary/70 hover:text-primary flex items-center gap-1 mt-1.5"
                              data-testid={`link-comment-tx-${c.id}`}
                            >
                              View transaction <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <MessageCircle className="w-10 h-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm font-medium text-foreground mb-1">No comments yet</p>
                  <p className="text-xs text-muted-foreground">
                    Be the first to add a comment
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Holders Tab */}
          <TabsContent value="holders" className="flex-1 px-4 pb-4 mt-0 pt-3 overflow-y-auto min-h-[400px]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Holders</p>
                <p className="text-lg font-bold text-foreground">{uniqueHoldersCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Supply</p>
                <p className="text-lg font-bold text-foreground">
                  {totalSupply ? parseFloat(totalSupply).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}
                </p>
              </div>
            </div>

            <ScrollArea className="flex-1">
              {holders.length > 0 ? (
                <div className="space-y-2">
                  {holders.map((holder, index) => {
                    const creatorAddress = coin.creator_wallet;
                    const isCreator = creatorAddress ? holder.address.toLowerCase() === creatorAddress.toLowerCase() : false;

                    // Format token balance - convert from wei-like units and format compactly
                    const tokenBalance = parseFloat(holder.balance);
                    let formattedBalance: string;

                    if (tokenBalance > 1e18) {
                      // Very large numbers (wei units) - convert to standard units
                      formattedBalance = (tokenBalance / 1e18).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 2
                      });
                    } else if (tokenBalance > 1e6) {
                      // Millions
                      formattedBalance = (tokenBalance / 1e6).toFixed(2) + 'M';
                    } else if (tokenBalance > 1e3) {
                      // Thousands
                      formattedBalance = (tokenBalance / 1e3).toFixed(2) + 'K';
                    } else {
                      formattedBalance = tokenBalance.toLocaleString(undefined, { maximumFractionDigits: 2 });
                    }

                    // Format percentage - handle edge cases properly
                    let formattedPercentage: string;
                    if (holder.percentage < 0.01 && holder.percentage > 0) {
                      formattedPercentage = '<0.01';
                    } else if (holder.percentage >= 100 || isNaN(holder.percentage)) {
                      // If data is inconsistent, calculate from total holders instead
                      const totalHoldersBalance = holders.reduce((sum, h) => sum + parseFloat(h.balance), 0);
                      const actualPercentage = totalHoldersBalance > 0
                        ? (tokenBalance / totalHoldersBalance) * 100
                        : 0;
                      formattedPercentage = actualPercentage.toFixed(2);
                    } else {
                      formattedPercentage = holder.percentage.toFixed(2);
                    }


                    return (
                      <div
                        key={holder.address}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/10 transition-colors border-b border-border/30"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 min-w-[25px]">
                            <span className="text-xs font-bold text-muted-foreground">#{index + 1}</span>
                          </div>
                          <div className={`w-8 h-8 rounded-full ${
                            index === 0
                              ? 'bg-gradient-to-br from-yellow-500 to-orange-500'
                              : isCreator
                                ? 'bg-gradient-to-br from-primary to-secondary'
                                : 'bg-gradient-to-br from-blue-500 to-cyan-500'
                          } flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0`}
                            // Add onClick to open Profile Card Modal
                            onClick={() => {
                              // You might want to fetch specific creator details here if needed
                              setIsProfileModalOpen(true);
                            }}
                            style={{ cursor: 'pointer' }} // Indicate it's clickable
                          >
                            {holder.address.slice(2, 4).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold text-foreground">
                                {holder.address.slice(0, 6)}...{holder.address.slice(-4)}
                              </p>
                              {isCreator && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                                  Creator
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formattedBalance} tokens
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-foreground">
                            {formattedPercentage}%
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <Users className="w-10 h-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm font-medium text-foreground mb-1">Loading holders...</p>
                  <p className="text-xs text-muted-foreground">
                    Fetching holder information from blockchain
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="flex-1 px-4 pb-4 mt-0 pt-3 overflow-y-auto min-h-[400px]">
            <ScrollArea className="flex-1">
              {swapActivities.length > 0 ? (
                <div className="space-y-1.5">
                  {swapActivities.map((swap, index) => {
                    // Convert coin amount from wei to readable format
                    const coinAmount = parseFloat(swap.coinAmount);
                    let formattedAmount: string;

                    if (coinAmount > 1e18) {
                      // Very large numbers (wei units) - convert to standard units
                      formattedAmount = (coinAmount / 1e18).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 2
                      });
                    } else if (coinAmount > 1e6) {
                      // Millions
                      formattedAmount = (coinAmount / 1e6).toFixed(2) + 'M';
                    } else if (coinAmount > 1e3) {
                      // Thousands
                      formattedAmount = (coinAmount / 1e3).toFixed(2) + 'K';
                    } else {
                      formattedAmount = coinAmount.toLocaleString(undefined, { maximumFractionDigits: 2 });
                    }

                    // Format timestamp - handle both string and number timestamps
                    let formattedDate: string;
                    const timestamp = swap.blockTimestamp;

                    // Parse the timestamp properly
                    let dateObj: Date;
                    if (!timestamp) {
                      dateObj = new Date();
                    } else if (typeof timestamp === 'string') {
                      // Try parsing as ISO string first
                      dateObj = new Date(timestamp);
                      // If invalid, try as number
                      if (isNaN(dateObj.getTime())) {
                        const numTimestamp = parseInt(timestamp);
                        dateObj = numTimestamp > 10000000000
                          ? new Date(numTimestamp)
                          : new Date(numTimestamp * 1000);
                      }
                    } else {
                      // It's a number - check if seconds or milliseconds
                      dateObj = timestamp > 10000000000
                        ? new Date(timestamp)
                        : new Date(timestamp * 1000);
                    }

                    formattedDate = dateObj.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    });

                    return (
                      <div
                        key={`${swap.transactionHash}-${index}`}
                        className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-muted/10 transition-colors border-b border-border/30"
                        data-testid={`activity-${index}`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0 ${
                          swap.activityType === 'BUY'
                            ? 'bg-green-500/20 border border-green-500/30'
                            : 'bg-red-500/20 border border-red-500/30'
                        }`}>
                          {swap.senderAddress.slice(2, 4).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium text-foreground truncate">
                              {swap.senderAddress.slice(0, 6)}...{swap.senderAddress.slice(-4)}
                            </span>
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                              swap.activityType === 'BUY'
                                ? 'bg-green-500/20 text-green-500'
                                : 'bg-red-500/20 text-red-500'
                            }`}>
                              {swap.activityType}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground">
                              {formattedAmount} {coin.symbol}
                            </p>
                            <span className="text-xs text-muted-foreground">•</span>
                            <p className="text-xs text-muted-foreground">
                              {formattedDate}
                            </p>
                          </div>
                        </div>
                        <a
                          href={`https://basescan.org/tx/${swap.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary/70 hover:text-primary flex-shrink-0"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <ActivityIcon className="w-10 h-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm font-medium text-foreground mb-1">No trades yet</p>
                  <p className="text-xs text-muted-foreground">
                    Trading activity will appear here
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="flex-1 px-4 pb-4 mt-0 pt-3 overflow-y-auto min-h-[400px]">
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border/30">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Info className="w-4 h-4" />
                  <span className="text-sm">Created</span>
                </div>
                <span className="text-sm font-medium text-foreground">
                  {coin.createdAt
                    ? new Date(coin.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })
                    : 'N/A'}
                </span>
              </div>

              {coin.address && (
                <div className="flex items-center justify-between py-2 border-b border-border/30">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Coins className="w-4 h-4" />
                    <span className="text-sm">Contract address</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-foreground">
                      {coin.address.slice(0, 6)}...{coin.address.slice(-4)}
                    </span>
                    <button
                      onClick={() => copyToClipboard(coin.address!)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copiedAddress ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between py-2 border-b border-border/30">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ActivityIcon className="w-4 h-4" />
                  <span className="text-sm">Chain</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-foreground">B</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">Base</span>
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border/30">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">Creator</span>
                </div>
                <span className="text-sm font-mono text-foreground">
                  {formatAddress(coin.creator_wallet)}
                </span>
              </div>

              {totalSupply && (
                <div className="flex items-center justify-between py-2 border-b border-border/30">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Coins className="w-4 h-4" />
                    <span className="text-sm">Total Supply</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {parseFloat(totalSupply).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              )}

              {uniqueHoldersCount > 0 && (
                <div className="flex items-center justify-between py-2 border-b border-border/30">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">Unique Holders</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {uniqueHoldersCount}
                  </span>
                </div>
              )}

              {(coin as any).metadata?.originalUrl && (
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ExternalLink className="w-4 h-4" />
                    <span className="text-sm">Original post</span>
                  </div>
                  <a
                    href={(coin as any).metadata.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    View
                  </a>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
          </div>
        </div>
      </DialogContent>

      {/* Profile Card Modal */}
      <ProfileCardModal
        creatorAddress={coin.creator_wallet}
        open={isProfileModalOpen}
        onOpenChange={setIsProfileModalOpen}
      />
    </Dialog>
  );
}