import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getCoin } from "@zoralabs/coins-sdk";
import { base } from "viem/chains";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { AlertTriangle, ArrowDownUp, ChevronDown, Gift, Settings, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFxRates, convertUsdToNgn } from "@/lib/fx";
import { usePrivy, getAccessToken } from "@privy-io/react-auth";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { erc20Abi, parseUnits } from "viem";

type CoinOption = {
  id: string;
  name: string;
  symbol: string;
  address: string;
  image?: string | null;
};

export default function Swap() {
  const { toast } = useToast();
  const { data: fxRates } = useFxRates();
  const { user: privyUser, authenticated } = usePrivy();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [selectedCoin, setSelectedCoin] = useState<CoinOption | null>(null);
  const [currentPrice, setCurrentPrice] = useState<string | null>(null);
  const [priceChange24h, setPriceChange24h] = useState<number>(0);
  const [chartData, setChartData] = useState<Array<{ time: string; price: number }>>([]);
  const [tradeMode, setTradeMode] = useState<"naira" | "wallet">("naira");
  const [tradeSide, setTradeSide] = useState<"buy" | "sell">("buy");
  const [nairaAmount, setNairaAmount] = useState<string>("6000");
  const [walletAmount, setWalletAmount] = useState<string>("0.01");
  const [bankCode, setBankCode] = useState<string>("");
  const [bankAccount, setBankAccount] = useState<string>("");
  const [bankName, setBankName] = useState<string>("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isTrading, setIsTrading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [hasAppliedParams, setHasAppliedParams] = useState(false);

  const { data: coins = [] } = useQuery<CoinOption[]>({
    queryKey: ["/api/coins"],
    queryFn: async () => {
      const response = await fetch("/api/coins");
      if (!response.ok) throw new Error("Failed to fetch coins");
      return response.json();
    },
  });

  const coinsWithAddress = useMemo(
    () => coins.filter((coin) => coin.address && coin.address.startsWith("0x")),
    [coins],
  );

  useEffect(() => {
    if (!selectedCoin && coinsWithAddress.length > 0) {
      setSelectedCoin({
        id: coinsWithAddress[0].id,
        name: coinsWithAddress[0].name,
        symbol: coinsWithAddress[0].symbol,
        address: coinsWithAddress[0].address,
        image: coinsWithAddress[0].image || null,
      });
    }
  }, [coinsWithAddress, selectedCoin]);

  useEffect(() => {
    if (hasAppliedParams || coinsWithAddress.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const coinParam = params.get("coin");
    const sideParam = params.get("side");
    const modeParam = params.get("mode");

    if (coinParam) {
      const match = coinsWithAddress.find(
        (coin) => coin.address.toLowerCase() === coinParam.toLowerCase(),
      );
      if (match) {
        setSelectedCoin({
          id: match.id,
          name: match.name,
          symbol: match.symbol,
          address: match.address,
          image: match.image || null,
        });
      }
    }

    if (sideParam === "buy" || sideParam === "sell") {
      setTradeSide(sideParam);
    }

    if (modeParam === "naira" || modeParam === "wallet") {
      setTradeMode(modeParam);
    }

    setHasAppliedParams(true);
  }, [coinsWithAddress, hasAppliedParams]);

  useEffect(() => {
    async function fetchCoinStats() {
      if (!selectedCoin?.address) return;
      try {
        const response = await getCoin({
          address: selectedCoin.address as `0x${string}`,
          chain: base.id,
        });
        const coinData = response.data?.zora20Token;
        if (!coinData) return;

        if (coinData.price) {
          setCurrentPrice(coinData.price);
          const price = typeof coinData.price === "string" ? parseFloat(coinData.price) : coinData.price;
          const now = Date.now();
          const hourInMs = 60 * 60 * 1000;
          const data: Array<{ time: string; price: number }> = [];
          const priceMultiplier = fxRates?.usd_ngn ?? 1;

          for (let i = 23; i >= 0; i--) {
            const time = new Date(now - i * hourInMs);
            const variance = (Math.random() - 0.5) * 0.1;
            const pricePoint = price * (1 + variance);
            data.push({
              time: time.toLocaleTimeString("en-US", { hour: "numeric", hour12: true }),
              price: parseFloat((pricePoint * priceMultiplier).toFixed(6)),
            });
          }
          setChartData(data);
        }

        if (coinData.priceChange24h !== null && coinData.priceChange24h !== undefined) {
          const priceChangeValue = typeof coinData.priceChange24h === "string"
            ? parseFloat(coinData.priceChange24h)
            : coinData.priceChange24h;
          setPriceChange24h(priceChangeValue);
        }
      } catch (error) {
        console.error("Swap coin stats error:", error);
      }
    }

    fetchCoinStats();
  }, [selectedCoin?.address, fxRates]);

  const currentPriceNgn = convertUsdToNgn(currentPrice, fxRates);
  const sparkColor = priceChange24h >= 0 ? "#16a34a" : "#ec4899";
  const sparkGradientId = priceChange24h >= 0 ? "sparkGreen" : "sparkPink";
  const mockChartData = useMemo(
    () => [
      { time: "1", price: 12 },
      { time: "2", price: 14 },
      { time: "3", price: 13 },
      { time: "4", price: 16 },
      { time: "5", price: 15 },
      { time: "6", price: 18 },
      { time: "7", price: 17 },
      { time: "8", price: 19 },
      { time: "9", price: 18 },
      { time: "10", price: 21 },
      { time: "11", price: 20 },
      { time: "12", price: 22 },
    ],
    [],
  );
  const chartSeries = chartData.length > 0 ? chartData : mockChartData;
  const amountNgnValue = useMemo(() => {
    const amount = parseFloat(nairaAmount);
    return Number.isFinite(amount) ? amount : 0;
  }, [nairaAmount]);

  const estimatedCoins = useMemo(() => {
    if (!currentPriceNgn || currentPriceNgn <= 0) return null;
    return amountNgnValue / currentPriceNgn;
  }, [amountNgnValue, currentPriceNgn]);

  const nairaSellEstimated = useMemo(() => {
    if (!currentPriceNgn || currentPriceNgn <= 0) return null;
    if (tradeSide !== "sell" || tradeMode !== "naira") return null;
    return amountNgnValue * currentPriceNgn;
  }, [amountNgnValue, currentPriceNgn, tradeSide, tradeMode]);

  const walletAmountValue = useMemo(() => {
    const amount = parseFloat(walletAmount);
    return Number.isFinite(amount) ? amount : 0;
  }, [walletAmount]);

  const priceUsdValue = useMemo(() => {
    const price = parseFloat(currentPrice || "0");
    return Number.isFinite(price) ? price : 0;
  }, [currentPrice]);

  const walletEstimatedCoins = useMemo(() => {
    if (!priceUsdValue || !fxRates?.eth_usd) return null;
    if (tradeSide !== "buy") return null;
    const usdValue = walletAmountValue * fxRates.eth_usd;
    return usdValue / priceUsdValue;
  }, [walletAmountValue, priceUsdValue, fxRates?.eth_usd, tradeSide]);

  const walletEstimatedNgn = useMemo(() => {
    if (!priceUsdValue || !fxRates?.usd_ngn) return null;
    if (tradeSide !== "sell") return null;
    const usdValue = walletAmountValue * priceUsdValue;
    return usdValue * fxRates.usd_ngn;
  }, [walletAmountValue, priceUsdValue, fxRates?.usd_ngn, tradeSide]);

  const handlePayWithNaira = async () => {
    if (!authenticated) {
      toast({ title: "Sign in required", description: "Please sign in to pay with Naira", variant: "destructive" });
      return;
    }
    if (!selectedCoin?.address) {
      toast({ title: "Select a coin", description: "Please choose a creator coin", variant: "destructive" });
      return;
    }
    if (!amountNgnValue || amountNgnValue <= 0) {
      toast({ title: "Invalid amount", description: "Enter a valid amount", variant: "destructive" });
      return;
    }

    setIsPaying(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Missing auth token");

      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          amountNgn: Number(amountNgnValue.toFixed(2)),
          creatorTokenAddress: selectedCoin.address,
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
      console.error("Swap Naira payment error:", error);
      toast({
        title: "Payment error",
        description: error instanceof Error ? error.message : "Failed to start payment",
        variant: "destructive",
      });
    } finally {
      setIsPaying(false);
    }
  };

  const handleWalletTrade = async () => {
    if (!isConnected || !address || !walletClient || !publicClient) {
      toast({ title: "Wallet not connected", description: "Connect your wallet to trade", variant: "destructive" });
      return;
    }
    if (!selectedCoin?.address) {
      toast({ title: "Select a coin", description: "Please choose a creator coin", variant: "destructive" });
      return;
    }
    if (!walletAmountValue || walletAmountValue <= 0) {
      toast({ title: "Invalid amount", description: "Enter a valid amount", variant: "destructive" });
      return;
    }

    setIsTrading(true);
    try {
      const { tradeZoraCoin } = await import("@/lib/zora");
      const result = await tradeZoraCoin({
        coinAddress: selectedCoin.address as `0x${string}`,
        ethAmount: walletAmountValue.toString(),
        walletClient,
        publicClient,
        userAddress: address,
        isBuying: tradeSide === "buy",
      });

      if (result?.hash) {
        setTxHash(result.hash);
        toast({ title: "Trade successful", description: `You ${tradeSide} ${selectedCoin.symbol}` });
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
                coinAddress: selectedCoin.address,
                side: tradeSide,
                txHash: result.hash,
                amountEth: walletAmountValue.toString(),
              }),
            });
          }
        } catch (recordError) {
          console.warn("Failed to record trade", recordError);
        }
      }
    } catch (error) {
      console.error("Wallet trade failed:", error);
      toast({
        title: "Trade failed",
        description: error instanceof Error ? error.message : "Trade failed",
        variant: "destructive",
      });
    } finally {
      setIsTrading(false);
    }
  };

  const handleNairaWithdraw = async () => {
    if (!authenticated) {
      toast({ title: "Sign in required", description: "Please sign in to withdraw", variant: "destructive" });
      return;
    }
    if (!isConnected || !address || !walletClient || !publicClient) {
      toast({ title: "Wallet required", description: "Connect your wallet to sell coins", variant: "destructive" });
      return;
    }
    if (!selectedCoin?.address) {
      toast({ title: "Select a coin", description: "Please choose a creator coin", variant: "destructive" });
      return;
    }
    if (!amountNgnValue || amountNgnValue <= 0) {
      toast({ title: "Invalid amount", description: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (!bankCode || !bankAccount || !bankName) {
      toast({ title: "Bank details required", description: "Enter bank code, account number, and name", variant: "destructive" });
      return;
    }

    setIsWithdrawing(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Missing auth token");

      const initResponse = await fetch("/api/withdrawals/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          tokenAddress: selectedCoin.address,
          tokenAmount: amountNgnValue.toString(),
          bankCode,
          accountNumber: bankAccount,
          accountName: bankName,
          walletAddress: address,
        }),
      });

      if (!initResponse.ok) {
        const errorBody = await initResponse.json().catch(() => ({}));
        throw new Error(errorBody.error || "Withdrawal initialization failed");
      }

      const initData = await initResponse.json();
      const treasuryAddress = initData?.treasuryAddress as `0x${string}` | undefined;
      if (!treasuryAddress) {
        throw new Error("Missing treasury address");
      }

      let decimals = 18;
      try {
        const onchainDecimals = await publicClient.readContract({
          address: selectedCoin.address as `0x${string}`,
          abi: erc20Abi,
          functionName: "decimals",
        });
        decimals = Number(onchainDecimals);
      } catch (error) {
        console.warn("Failed to read token decimals, defaulting to 18", error);
      }

      const amountUnits = parseUnits(amountNgnValue.toString(), decimals);
      const txHash = await walletClient.writeContract({
        address: selectedCoin.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "transfer",
        args: [treasuryAddress, amountUnits],
        account: address,
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      const confirmResponse = await fetch("/api/withdrawals/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          withdrawalId: initData?.withdrawalId,
          txHash,
        }),
      });

      if (!confirmResponse.ok) {
        const errorBody = await confirmResponse.json().catch(() => ({}));
        throw new Error(errorBody.error || "Withdrawal confirmation failed");
      }

      setTxHash(txHash);
      toast({ title: "Withdrawal started", description: "Your payout is being processed." });
    } catch (error) {
      console.error("Naira withdrawal error:", error);
      toast({
        title: "Withdrawal error",
        description: error instanceof Error ? error.message : "Failed to withdraw",
        variant: "destructive",
      });
    } finally {
      setIsWithdrawing(false);
    }
  };

  const isNairaSell = tradeMode === "naira" && tradeSide === "sell";
  const outputPreview = tradeSide === "buy"
    ? (estimatedCoins ? `≈ ${estimatedCoins.toFixed(2)} ${selectedCoin?.symbol || ""}` : "≈ --")
    : (nairaSellEstimated ? `≈ ₦${nairaSellEstimated.toFixed(2)}` : "≈ --");
  const outputTokenLabel = tradeSide === "buy" ? (selectedCoin?.symbol || "COIN") : "NGN";

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto w-full max-w-[360px] space-y-3">
        <div className="rounded-[24px] border border-border/60 bg-card px-4 py-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-muted/40 overflow-hidden">
                {selectedCoin?.image ? (
                  <img src={selectedCoin.image} alt={selectedCoin.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-sm font-semibold text-muted-foreground">
                    {selectedCoin?.symbol?.slice(0, 2) || "CO"}
                  </div>
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-semibold text-foreground">
                    {selectedCoin?.name || "Creator Coin"}
                  </p>
                  <p className="text-lg font-semibold text-foreground/80">
                    {currentPriceNgn ? `₦${currentPriceNgn.toFixed(0)}` : "₦0"}
                  </p>
                  <p
                    className={`text-sm font-semibold ${priceChange24h >= 0 ? "text-green-600 dark:text-green-400" : "text-pink-500 dark:text-pink-400"}`}
                  >
                    {priceChange24h >= 0 ? "+" : ""}{priceChange24h.toFixed(1)}% Today
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-muted-foreground hover:bg-muted/40"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>

          <div className="mt-3 h-14 relative">
            {chartSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartSeries}>
                  <defs>
                    <linearGradient id={sparkGradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={sparkColor} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={sparkColor}
                    strokeWidth={2}
                    fill={`url(#${sparkGradientId})`}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full rounded-2xl bg-muted/30" />
            )}
            <span className="absolute right-0 bottom-0 text-xs text-muted-foreground">7D</span>
          </div>

          <div className="mt-3 rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Price Trend (7 Days)</p>
                <p className="text-xs text-muted-foreground">Holders: 450 • Volume: ₦210K</p>
              </div>
              <div className="h-12 w-24">
                {chartSeries.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartSeries}>
                      <defs>
                        <linearGradient id={`${sparkGradientId}-mini`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={sparkColor} stopOpacity={0.25} />
                          <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke={sparkColor}
                        strokeWidth={2}
                        fill={`url(#${sparkGradientId}-mini)`}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full rounded-xl bg-muted/30" />
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-full overflow-hidden border border-border/60">
                <div className="grid h-full w-full grid-cols-3">
                  <span className="bg-primary" />
                  <span className="bg-card" />
                  <span className="bg-primary" />
                </div>
              </div>
              <div className="relative flex-1">
                <select
                  value={selectedCoin?.address || ""}
                  onChange={(e) => {
                    const coin = coinsWithAddress.find((c) => c.address === e.target.value);
                    if (coin) {
                      setSelectedCoin({
                        id: coin.id,
                        name: coin.name,
                        symbol: coin.symbol,
                        address: coin.address,
                        image: coin.image || null,
                      });
                    }
                  }}
                  className="w-full appearance-none bg-transparent pr-6 text-sm font-semibold text-foreground/80 outline-none"
                >
                  {coinsWithAddress.map((coin) => (
                    <option key={coin.address} value={coin.address}>
                      {coin.name} ({coin.symbol})
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          </div>

          <div className="mt-2 text-sm text-muted-foreground">
            Balance: <span className="font-semibold text-foreground">₦0</span>
          </div>

          <div className="mt-2 grid gap-2">
            <div className="rounded-2xl border border-border/60 bg-card px-4 py-3">
              <div className="flex items-center gap-2">
                {tradeSide === "buy" && <span className="text-2xl font-semibold text-foreground">₦</span>}
                <Input
                  type="number"
                  className="border-none px-0 text-2xl font-semibold text-foreground placeholder:text-muted-foreground/50"
                  value={tradeMode === "naira" ? nairaAmount : walletAmount}
                  onChange={(e) => (tradeMode === "naira" ? setNairaAmount(e.target.value) : setWalletAmount(e.target.value))}
                  placeholder={tradeSide === "buy" ? "0" : selectedCoin?.symbol || "0"}
                />
              </div>
            </div>

            <div className="relative flex items-center justify-center lg:h-full">
              <div className="hidden lg:block h-px w-full bg-border/60" />
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full border border-border/60 bg-card text-muted-foreground hover:bg-muted/40"
                onClick={() => setTradeSide(tradeSide === "buy" ? "sell" : "buy")}
              >
                <ArrowDownUp className="h-4 w-4" />
              </Button>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-muted/50 overflow-hidden">
                    {selectedCoin?.image ? (
                      <img src={selectedCoin.image} alt={selectedCoin.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground">
                        {selectedCoin?.symbol?.slice(0, 1) || "C"}
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-foreground/80">{outputPreview}</p>
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary dark:bg-primary/20">
                    {tradeSide === "buy" ? (selectedCoin?.symbol?.slice(0, 1) || "C") : "₦"}
                  </span>
                  {outputTokenLabel}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 text-sm text-muted-foreground">
            Balance: <span className="font-semibold text-foreground">0 {selectedCoin?.symbol || "COIN"}</span>
          </div>

          {isNairaSell && (
            <div className="mt-3 grid gap-2">
              <Input
                type="text"
                className="h-10 border border-border/60 text-sm text-foreground/80"
                placeholder="Bank code (e.g. 058)"
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
              />
              <Input
                type="text"
                className="h-10 border border-border/60 text-sm text-foreground/80"
                placeholder="Account number"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
              />
              <Input
                type="text"
                className="h-10 border border-border/60 text-sm text-foreground/80"
                placeholder="Account name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </div>
          )}

          <div className="mt-2 flex items-start gap-2 rounded-2xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <span>Note: Price may change by the time the swap completes.</span>
          </div>

          <Button
            className="mt-3 h-11 w-full rounded-2xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
            onClick={
              isNairaSell
                ? handleNairaWithdraw
                : tradeMode === "naira"
                  ? handlePayWithNaira
                  : handleWalletTrade
            }
            disabled={
              !selectedCoin ||
              (tradeMode === "naira" && tradeSide === "buy" ? isPaying : false) ||
              (tradeMode === "wallet" ? isTrading : false) ||
              (isNairaSell ? isWithdrawing : false)
            }
          >
            {isNairaSell
              ? (isWithdrawing ? "Processing payout..." : `Sell ${selectedCoin?.name || "Coin"}`)
              : tradeMode === "naira"
                ? (isPaying ? "Starting payment..." : `Buy ${selectedCoin?.name || "Coin"}`)
                : (isTrading ? "Trading..." : tradeSide === "buy" ? "Buy" : "Sell")}
          </Button>

          <p className="mt-2 text-center text-xs italic text-muted-foreground">
            Instant transaction. No crypto needed.
          </p>

          {txHash && (
            <div className="mt-3 text-xs text-muted-foreground">
              Trade confirmed: {txHash.slice(0, 10)}...
            </div>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto rounded-2xl border border-border/60 bg-card px-3 py-2">
          {coinsWithAddress.slice(0, 4).map((coin) => (
            <button
              key={coin.address}
              onClick={() =>
                setSelectedCoin({
                  id: coin.id,
                  name: coin.name,
                  symbol: coin.symbol,
                  address: coin.address,
                  image: coin.image || null,
                })
              }
              className="flex shrink-0 items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-2 text-xs font-semibold text-foreground/80"
            >
              <div className="h-6 w-6 rounded-full bg-muted/50 overflow-hidden">
                {coin.image ? (
                  <img src={coin.image} alt={coin.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground">
                    {coin.symbol?.slice(0, 1)}
                  </div>
                )}
              </div>
              {coin.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}




