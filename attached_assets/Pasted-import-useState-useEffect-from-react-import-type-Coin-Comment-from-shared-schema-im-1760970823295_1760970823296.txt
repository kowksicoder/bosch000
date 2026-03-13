import { useState, useEffect } from "react";
import type { Coin, Comment } from "@shared/schema";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { formatEther } from "viem";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getCoin, getCoinHolders } from "@zoralabs/coins-sdk";
import { base } from "viem/chains";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, ExternalLink, MessageCircle, Users, Activity as ActivityIcon, Info, Copy, Check, Coins, Play } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatSmartCurrency } from "@/lib/utils";

interface MobileTradeModalProps {
  coin: Coin;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MobileTradeModal({ coin, open, onOpenChange }: MobileTradeModalProps) {
  const { toast } = useToast();
  const [ethAmount, setEthAmount] = useState("");
  const [isTrading, setIsTrading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isBuying, setIsBuying] = useState(true);
  const [comment, setComment] = useState("");
  const [standaloneComment, setStandaloneComment] = useState("");
  const [balance, setBalance] = useState<string>("0");
  const [marketCap, setMarketCap] = useState<string | null>(null);
  const [volume24h, setVolume24h] = useState<string | null>(null);
  const [creatorEarnings, setCreatorEarnings] = useState<string | null>(null);
  const [holders, setHolders] = useState<Array<{
    address: string;
    balance: string;
    percentage: number;
    profile?: string | null;
  }>>([]);
  const [totalSupply, setTotalSupply] = useState<string | null>(null);
  const [uniqueHoldersCount, setUniqueHoldersCount] = useState<number>(0);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);

  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  // Effect to manage audio playback
  useEffect(() => {
    if (audioRef) {
      if (isPlaying) {
        audioRef.play().catch(e => console.error("Error playing audio:", e));
      } else {
        audioRef.pause();
      }
    }
    return () => {
      if (audioRef) {
        audioRef.pause();
        audioRef.currentTime = 0;
      }
    };
  }, [isPlaying, audioRef]);

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

  // Fetch coin stats
  useEffect(() => {
    async function fetchCoinStats() {
      if (!coin.address) return;

      try {
        const response = await getCoin({
          collectionAddress: coin.address as `0x${string}`,
          chainId: base.id,
        });

        const coinData = response.data?.zora20Token;

        if (coinData) {
          // Set market cap - handle both string and number
          if (coinData.marketCap !== null && coinData.marketCap !== undefined) {
            const mcValue = typeof coinData.marketCap === 'string'
              ? parseFloat(coinData.marketCap)
              : coinData.marketCap;
            setMarketCap(mcValue.toFixed(2));
          }

          // Set 24h volume - handle both string and number, ensure accurate display
          if (coinData.volume24h !== null && coinData.volume24h !== undefined) {
            const volValue =
              typeof coinData.volume24h === "string"
                ? parseFloat(coinData.volume24h)
                : coinData.volume24h;
            if (!isNaN(volValue) && volValue >= 0) {
              setVolume24h(volValue.toFixed(2));
            } else {
              setVolume24h("0.00");
            }
          } else {
            setVolume24h("0.00");
          }

          // Set creator earnings - properly extract USD value
          if (coinData.creatorEarnings && coinData.creatorEarnings.length > 0) {
            const earnings = coinData.creatorEarnings[0] as any;
            const earningsUsd = earnings.amountUsd || earnings.amount?.amountDecimal?.toString() || "0";
            setCreatorEarnings(earningsUsd);
          }

          if (coinData.totalSupply) {
            setTotalSupply(coinData.totalSupply.toString());
          }

          if (coinData.uniqueHolders !== undefined) {
            setUniqueHoldersCount(Number(coinData.uniqueHolders));
          }
        }

        // Fetch holder details
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
      } catch (error) {
        console.error("Error fetching coin stats:", error);
      }
    }

    if (open) {
      fetchCoinStats();
    }
  }, [coin.address, open]);

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
          }
        }

        // Create reward records for platform and trade fees
        const ADMIN_REFERRAL_ADDRESS = "0xf25af781c4F1Df40Ac1D06e6B80c17815AD311F7";
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
          description: `You ${isBuying ? 'bought' : 'sold'} ${coin.symbol} tokens`,
        });

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

  // Clean up state when modal closes
  useEffect(() => {
    if (!open) {
      setTxHash(null);
      setEthAmount("");
      setComment("");
      setStandaloneComment("");
      setIsPlaying(false);
      setIsBuying(true);
      setIsTrading(false);
    }
  }, [open]);

  const setQuickAmount = (percentage: number) => {
    if (percentage === 100) {
      const maxAmount = (parseFloat(balance) * 0.9).toFixed(6);
      setEthAmount(maxAmount);
    } else {
      const amount = (parseFloat(balance) * percentage / 100 * 0.9).toFixed(6);
      setEthAmount(amount);
    }
  };

  const imageUrl = coin?.metadata?.animation_url || coin?.image || coin?.metadata?.image || "";
  const isAudio = coin?.type === "audio" || coin?.metadata?.type === "audio" || imageUrl?.includes('spotify') || imageUrl?.match(/\.(mp3|wav|ogg|m4a)$/i);
  const isVideo = coin?.type === "video" || coin?.metadata?.type === "video" || imageUrl?.match(/\.(mp4|webm|mov|avi)$/i);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-background border-t border-border/50 max-h-[90vh]">
        <DrawerHeader className="px-4 pt-4 pb-2">
          <DrawerTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {imageUrl ? (
                <div className="relative w-10 h-10">
                  <img src={imageUrl} alt="Coin logo" className="w-10 h-10 rounded-full object-cover" />
                  {(isAudio || isVideo) && (
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-1 shadow-lg hover:bg-primary-hover transition-colors"
                    >
                      {isPlaying ? <Play className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>
                  )}
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-sm font-bold text-foreground">
                  {coin.symbol.slice(0, 2)}
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold text-foreground">{coin.name} ({coin.symbol})</h3>
                <p className="text-xs text-muted-foreground">Creator: @{formatAddress(coin.creator)}</p>
              </div>
            </div>
          </DrawerTitle>
        </DrawerHeader>

        <Tabs defaultValue="trade" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-transparent px-4 h-auto p-0">
            <TabsTrigger
              value="trade"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 py-2 bg-transparent text-xs"
            >
              Trade
            </TabsTrigger>
            <TabsTrigger
              value="comments"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 py-2 bg-transparent text-xs"
            >
              Comments
            </TabsTrigger>
            <TabsTrigger
              value="holders"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 py-2 bg-transparent text-xs"
            >
              Holders
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 py-2 bg-transparent text-xs"
            >
              Activity
            </TabsTrigger>
            <TabsTrigger
              value="details"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 py-2 bg-transparent text-xs"
            >
              Details
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trade" className="flex-1 px-4 pb-6 mt-0 pt-3 overflow-y-auto">
            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Market Cap</p>
                <p className="text-sm font-bold text-green-500">
                  {marketCap ? `$${marketCap}` : 'Loading...'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">24H Volume</p>
                <p className="text-sm font-semibold text-foreground">
                  {volume24h ? formatSmartCurrency(parseFloat(volume24h)) : 'Loading...'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Creator Earnings</p>
                <p className="text-sm font-semibold text-foreground">
                  {creatorEarnings ? formatSmartCurrency(parseFloat(creatorEarnings)) : 'Loading...'}
                </p>
              </div>
            </div>

            {/* Buy/Sell Toggle */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-2">
                <Button
                  onClick={() => setIsBuying(true)}
                  className={`px-6 py-2 text-base font-bold rounded-full transition-all ${
                    isBuying
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : 'bg-transparent text-muted-foreground border border-border/30 hover:bg-muted/50'
                  }`}
                  disabled={isTrading || !!txHash}
                >
                  Buy
                </Button>
                <Button
                  onClick={() => setIsBuying(false)}
                  className={`px-6 py-2 text-base font-bold rounded-full transition-all ${
                    !isBuying
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-transparent text-muted-foreground border border-border/30 hover:bg-muted/50'
                  }`}
                  disabled={isTrading || !!txHash}
                >
                  Sell
                </Button>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className="text-sm font-semibold text-foreground">
                  {parseFloat(balance).toFixed(4)} ETH
                </p>
              </div>
            </div>

            {/* Amount Input */}
            <div className="relative mb-3">
              <Input
                type="number"
                step="0.000001"
                min="0"
                value={ethAmount}
                onChange={(e) => setEthAmount(e.target.value)}
                className="h-16 text-2xl font-bold pr-24 bg-muted/30 border-border/50 text-foreground rounded-2xl"
                disabled={isTrading || !!txHash}
                placeholder="0.0"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">Ξ</span>
                </div>
                <span className="text-base font-semibold text-foreground">ETH</span>
              </div>
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[25, 50, 75, 100].map((percentage) => (
                <Button
                  key={percentage}
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickAmount(percentage)}
                  disabled={isTrading || !!txHash}
                  className="h-10 text-sm bg-muted/20 hover:bg-muted/40 border-border/30 text-foreground rounded-xl font-semibold"
                >
                  {percentage === 100 ? 'Max' : `${percentage}%`}
                </Button>
              ))}
            </div>

            {/* Comment Input */}
            <Textarea
              placeholder="Add a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[80px] bg-muted/20 border-border/30 text-foreground placeholder:text-muted-foreground rounded-xl resize-none mb-3"
              disabled={isTrading || !!txHash}
              maxLength={280}
            />

            {/* Action Button */}
            {!txHash ? (
              !isConnected ? (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <p className="text-sm text-yellow-500 text-center font-medium">
                    Please connect your wallet to trade
                  </p>
                </div>
              ) : (
                <Button
                  className={`w-full h-14 text-lg font-bold transition-all rounded-2xl ${
                    isBuying
                      ? 'bg-green-500 hover:bg-green-600'
                      : 'bg-red-500 hover:bg-red-600'
                  } text-white`}
                  onClick={handleTrade}
                  disabled={isTrading || createCommentMutation.isPending || !ethAmount || parseFloat(ethAmount) <= 0}
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
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-green-400 text-base mb-2">
                      Transaction Successful!
                    </div>
                    <a
                      href={`https://basescan.org/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    >
                      View on BaseScan
                      <ExternalLink className="w-4 h-4" />
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

          <TabsContent value="comments" className="flex-1 px-4 pb-6 mt-0 pt-3 overflow-y-auto">
            <div className="mb-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Add a comment..."
                  className="h-10 bg-muted/20 border-border/30 text-foreground placeholder:text-muted-foreground flex-1 rounded-xl text-sm"
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
                  className="h-10 rounded-full px-4 text-sm"
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

          <TabsContent value="holders" className="flex-1 px-4 pb-6 mt-0 pt-3 overflow-y-auto">
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
                    const isCreator = coin.creator ? holder.address.toLowerCase() === coin.creator.toLowerCase() : false;
                    const tokenBalance = parseFloat(holder.balance);
                    let formattedBalance: string;

                    if (tokenBalance > 1e18) {
                      formattedBalance = (tokenBalance / 1e18).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 2
                      });
                    } else if (tokenBalance > 1e6) {
                      formattedBalance = (tokenBalance / 1e6).toFixed(2) + 'M';
                    } else if (tokenBalance > 1e3) {
                      formattedBalance = (tokenBalance / 1e3).toFixed(2) + 'K';
                    } else {
                      formattedBalance = tokenBalance.toLocaleString(undefined, { maximumFractionDigits: 2 });
                    }

                    let formattedPercentage: string;
                    if (holder.percentage < 0.01 && holder.percentage > 0) {
                      formattedPercentage = '<0.01';
                    } else if (holder.percentage >= 100 || isNaN(holder.percentage)) {
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
                          } flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0`}>
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

          <TabsContent value="activity" className="flex-1 px-4 pb-6 mt-0 pt-3 overflow-y-auto">
            <ScrollArea className="flex-1">
              {commentsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : comments && comments.filter(c => c.transactionHash).length > 0 ? (
                <div className="space-y-1.5">
                  {comments.filter(c => c.transactionHash).map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-muted/10 transition-colors border-b border-border/30"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0">
                        {c.userAddress.slice(2, 4).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-foreground truncate">
                            {c.userAddress.slice(0, 8)}...
                          </span>
                          <span className="text-sm font-bold text-green-500">
                            Traded
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">
                            {new Date(c.createdAt).toLocaleTimeString()} • {new Date(c.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        {c.comment && (
                          <p className="text-xs text-muted-foreground mt-0.5 italic">
                            "{c.comment}"
                          </p>
                        )}
                      </div>
                      <a
                        href={`https://basescan.org/tx/${c.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary/70 hover:text-primary flex-shrink-0"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
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

          <TabsContent value="details" className="flex-1 px-4 pb-6 mt-0 pt-3 overflow-y-auto">
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border/30">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Info className="w-4 h-4" />
                  <span className="text-sm">Created</span>
                </div>
                <span className="text-sm font-medium text-foreground">
                  {coin.createdAt ? new Date(coin.createdAt).toLocaleDateString() : 'Unknown'}
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
                <span className="text-sm font-mono text-white">
                  {formatAddress(coin.creator)}
                </span>
              </div>

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
      </DrawerContent>
      {isAudio && (
        <audio ref={setAudioRef} src={coin.metadata?.animation_url || coin.metadata?.audio_url || ''} />
      )}
    </Drawer>
  );
}