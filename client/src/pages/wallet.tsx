import { useEffect, useMemo, useState } from "react";
import { usePrivy, getAccessToken } from "@privy-io/react-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProfileBalances } from "@zoralabs/coins-sdk";
import { base } from "viem/chains";
import { ArrowDownLeft, ArrowUpRight, Check, Copy, Gift, Wallet } from "lucide-react";
import { Link } from "wouter";

import { useFxRates, convertUsdToNgn } from "@/lib/fx";
import { cn, formatSmartCurrency } from "@/lib/utils";
import { useSmartAccount } from "@/contexts/SmartAccountContext";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

type WalletHolding = {
  id: string;
  name: string;
  symbol: string;
  address: string;
  creatorHandle?: string | null;
  creatorAvatar?: string | null;
  balance: number;
  priceUsd: number | null;
  valueUsd: number | null;
};

type WalletTransaction = {
  id: string;
  type: "buy" | "sell" | "deposit" | "withdrawal" | "receive";
  amountNgn: number;
  status: "completed" | "pending";
  label: string;
  time: string;
  coinAddress?: string | null;
  coinSymbol?: string | null;
  coinImage?: string | null;
};

type WeeklyChallenges = {
  multiplier: number;
  tradeDays: {
    count: number;
    target: number;
    completed: boolean;
    rewarded: boolean;
    reward: { base: number; total: number };
  };
  supportCreators: {
    count: number;
    target: number;
    completed: boolean;
    rewarded: boolean;
    reward: { base: number; total: number };
  };
};

export default function WalletPage() {
  const { user, authenticated } = usePrivy();
  const { smartAccountAddress } = useSmartAccount();
  const { toast } = useToast();
  const { data: fxRates } = useFxRates();
  const [copied, setCopied] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [activityRange, setActivityRange] = useState<"30d" | "all">("30d");
  const queryClient = useQueryClient();

  const walletAddress = smartAccountAddress || user?.wallet?.address || "";


  const { data: nairaLedger } = useQuery({
    queryKey: ["/api/ledger/naira", walletAddress, authenticated],
    enabled: authenticated,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const response = await fetch("/api/ledger/naira", {
        credentials: "include",
        headers,
      });
      if (!response.ok) {
        throw new Error("Failed to fetch Naira balance");
      }
      return response.json();
    },
  });

  const { data: weeklyChallenges } = useQuery<WeeklyChallenges>({
    queryKey: ["/api/challenges/weekly", walletAddress],
    enabled: authenticated,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/challenges/weekly", {
        credentials: "include",
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch weekly challenges");
      }

      return response.json();
    },
  });

  const { data: balancesData, isLoading } = useQuery({
    queryKey: ["zora", "profile-balances", walletAddress],
    enabled: Boolean(walletAddress),
    queryFn: async () => {
      const response = await getProfileBalances({
        identifier: walletAddress,
        count: 50,
        sortOption: "USD_VALUE",
        excludeHidden: true,
        chainIds: [base.id],
      });

      return response.data?.profile?.coinBalances?.edges || [];
    },
  });

  const holdings = useMemo<WalletHolding[]>(() => {
    if (!balancesData?.length) return [];

    return balancesData
      .map((edge: any) => {
        const node = edge?.node;
        const coin = node?.coin;
        if (!node || !coin) return null;

        const balance = parseFloat(node.balance || "0");
        if (!Number.isFinite(balance) || balance <= 0) return null;

        const priceUsd = coin.tokenPrice?.priceInUsdc
          ? parseFloat(coin.tokenPrice.priceInUsdc)
          : null;
        const valueUsd = priceUsd ? balance * priceUsd : null;

        return {
          id: node.id,
          name: coin.name,
          symbol: coin.symbol,
          address: coin.address,
          creatorHandle: coin.creatorProfile?.handle || null,
          creatorAvatar: coin.creatorProfile?.avatar?.previewImage?.small || null,
          balance,
          priceUsd,
          valueUsd,
        } as WalletHolding;
      })
      .filter(Boolean) as WalletHolding[];
  }, [balancesData]);

  const totalValueNgn = useMemo(() => {
    return holdings.reduce((sum, holding) => {
      const ngnValue = convertUsdToNgn(holding.valueUsd, fxRates);
      return sum + (ngnValue || 0);
    }, 0);
  }, [holdings, fxRates]);

  const activityRangeLabel = useMemo(() => {
    if (activityRange === "all") {
      return "All activity";
    }
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 30);
    const startLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `Showing ${startLabel} – ${endLabel}`;
  }, [activityRange]);

  const { data: transactionsData, isLoading: transactionsLoading } = useQuery<WalletTransaction[]>({
    queryKey: ["/api/wallet/transactions", walletAddress, activityRange],
    enabled: authenticated,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const response = await fetch(`/api/wallet/transactions?range=${activityRange}`, {
        credentials: "include",
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch transactions");
      }

      return response.json();
    },
  });

  const recentTransactions = transactionsData ?? [];

  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      toast({ title: "Wallet copied", description: "Address copied to clipboard." });
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy wallet address.",
        variant: "destructive",
      });
    }
  };

  const handleWithdrawNaira = async () => {
    if (!authenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to withdraw your Naira balance.",
        variant: "destructive",
      });
      return;
    }

    const amountValue = parseFloat(withdrawAmount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      toast({
        title: "Enter a valid amount",
        description: "Withdrawal amount must be greater than zero.",
        variant: "destructive",
      });
      return;
    }

    const available = parseFloat(String(nairaLedger?.availableNgn || "0"));
    if (Number.isFinite(available) && amountValue > available) {
      toast({
        title: "Insufficient balance",
        description: "You do not have enough Naira available to withdraw.",
        variant: "destructive",
      });
      return;
    }

    setIsWithdrawing(true);

    try {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/ledger/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          amountNgn: amountValue,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || "Failed to withdraw funds");
      }

      setWithdrawAmount("");
      setWithdrawOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["/api/ledger/naira"] });

      toast({
        title: "Withdrawal initiated",
        description: "Your bank transfer is on the way.",
      });
    } catch (error) {
      toast({
        title: "Withdrawal failed",
        description: error instanceof Error ? error.message : "Unable to process payout.",
        variant: "destructive",
      });
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleDepositNaira = async () => {
    if (!authenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to add money to your wallet.",
        variant: "destructive",
      });
      return;
    }

    const amountValue = parseFloat(depositAmount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      toast({
        title: "Enter a valid amount",
        description: "Deposit amount must be greater than zero.",
        variant: "destructive",
      });
      return;
    }

    setIsDepositing(true);

    try {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/ledger/deposit/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          amountNgn: amountValue,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to initialize deposit");
      }

      setDepositAmount("");
      setDepositOpen(false);

      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }

      toast({
        title: "Deposit initialized",
        description: "Follow the Paystack checkout to complete your deposit.",
      });
    } catch (error) {
      toast({
        title: "Deposit failed",
        description: error instanceof Error ? error.message : "Unable to start deposit.",
        variant: "destructive",
      });
    } finally {
      setIsDepositing(false);
    }
  };


  const fallbackAvatar = "https://i.ibb.co/JRQCPsZK/ev122logo-1-1.png";
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="hidden md:block space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Wallet</p>
            <h1 className="text-2xl md:text-3xl font-semibold">Wallet</h1>
            <p className="text-sm text-muted-foreground">
              Track your creator coin balances and Naira holdings in one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={activityRange === "30d" ? "secondary" : "ghost"}
              className="rounded-full px-3 text-[11px]"
              onClick={() => setActivityRange("30d")}
            >
              Last 30 days
            </Button>
            <Button
              size="sm"
              variant={activityRange === "all" ? "secondary" : "ghost"}
              className="rounded-full px-3 text-[11px]"
              onClick={() => setActivityRange("all")}
            >
              All activity
            </Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">{activityRangeLabel}</div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-3xl border-border/60 bg-card">
            <div className="p-5 md:p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Total balance</p>
                  <div className="text-2xl md:text-3xl font-semibold">
                    {formatSmartCurrency(totalValueNgn)}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    1 USD = {fxRates?.usd_ngn ? fxRates.usd_ngn.toLocaleString("en-US") : "-"} NGN
                  </p>
                </div>
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-[10px]">
                  {holdings.length} coin{holdings.length === 1 ? "" : "s"}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link href="/swap">
                  <Button className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-300 text-black font-semibold border-0">
                    <ArrowDownLeft className="h-4 w-4 mr-2" />
                    Buy
                  </Button>
                </Link>
                <Button variant="outline" onClick={() => setDepositOpen(true)} disabled={!authenticated}>
                  <Wallet className="h-4 w-4 mr-2" />
                  Deposit
                </Button>
                <Button variant="outline" onClick={() => setWithdrawOpen(true)} disabled={!authenticated}>
                  <ArrowUpRight className="h-4 w-4 mr-2" />
                  Withdraw
                </Button>
              </div>

              <Separator className="bg-border/60" />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/40 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Naira balance</p>
                  <p className="text-lg font-semibold">
                    {formatSmartCurrency(nairaLedger?.availableNgn || 0)}
                  </p>
                  {Number(nairaLedger?.pendingNgn || 0) > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      Pending {formatSmartCurrency(nairaLedger?.pendingNgn || 0)}
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border border-border/40 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Wallet address</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-muted/40 px-2 py-1 rounded-full">
                      {walletAddress
                        ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                        : "Not connected"}
                    </span>
                    {walletAddress && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleCopyAddress}
                        className="h-8 w-8"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {!authenticated && (
                <div className="text-sm text-muted-foreground">
                  Sign in to view your wallet holdings.
                </div>
              )}
            </div>
          </Card>

          <Card className="rounded-3xl border-border/60 bg-card">
            <div className="p-5 md:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Spending & earnings</p>
                  <p className="text-sm font-semibold">
                    {activityRange === "all" ? "All-time overview" : "Last 30 days overview"}
                  </p>
                </div>
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-[10px]">
                  Auto updates
                </Badge>
              </div>

              <div className="h-32 rounded-2xl border border-border/40 bg-muted/20 p-3 flex items-end gap-1">
                {Array.from({ length: activityRange === "all" ? 24 : 18 }).map((_, index) => {
                  const height = 20 + ((index * 13) % 70);
                  return (
                    <div
                      key={`bar-${index}`}
                      className="flex-1 rounded-full bg-gradient-to-t from-emerald-400/40 to-emerald-500/90"
                      style={{ height: `${height}%` }}
                    />
                  );
                })}
              </div>

              <div className="text-xs text-muted-foreground">
                We&apos;ll show live wallet flows here once you trade more coins.
              </div>
            </div>
          </Card>
        </div>

        <Card className="rounded-3xl border-border/60 bg-card">
          <div className="p-5 md:p-6 space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Recent transactions</h2>
                <p className="text-xs text-muted-foreground">
                  Buys, sells, deposits, withdrawals, and rewards.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-[10px]">
                  {activityRange === "all" ? "All-time" : "Last 30 days"}
                </Badge>
                <Link href="/transactions">
                  <Button size="sm" variant="outline">
                    View all
                  </Button>
                </Link>
              </div>
            </div>

            {transactionsLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <Card key={item} className="rounded-2xl border-border/50 bg-muted/20">
                    <div className="p-4 flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                No recent transactions yet. Your buys, sells, and withdrawals will show here.
              </div>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((txn) => (
                  <Card
                    key={txn.id}
                    className="rounded-2xl border-border/50 bg-background/60 hover:bg-muted/20 transition"
                  >
                    <div className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-10 w-10 bg-muted/40">
                            <AvatarImage src={txn.coinImage || undefined} />
                            <AvatarFallback className="bg-muted/40 text-[10px] font-semibold">
                              {txn.coinSymbol ? txn.coinSymbol.slice(0, 2) : "TX"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-background border border-border/60 flex items-center justify-center">
                            {txn.type === "buy" || txn.type === "deposit" || txn.type === "receive" ? (
                              <ArrowDownLeft className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <ArrowUpRight className="h-3 w-3 text-rose-500" />
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="font-semibold capitalize">{txn.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {txn.coinSymbol && <span className="mr-2">{txn.coinSymbol}</span>}
                            {txn.time ? new Date(txn.time).toLocaleString() : "-"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-sm">
                          <p className="text-xs text-muted-foreground">Amount</p>
                          <p className="font-semibold">{formatSmartCurrency(txn.amountNgn)}</p>
                        </div>
                        <Badge variant={txn.status === "completed" ? "secondary" : "outline"} className="text-[10px]">
                          {txn.status === "completed" ? "Completed" : "Pending"}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Withdraw with Paystack</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">
                Available: {formatSmartCurrency(nairaLedger?.availableNgn || 0)}
              </div>

              <div className="space-y-2">
                <Label htmlFor="withdraw-amount">Amount (NGN)</Label>
                <Input
                  id="withdraw-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 5000"
                  value={withdrawAmount}
                  onChange={(event) => setWithdrawAmount(event.target.value)}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Paystack will securely handle your payout.
              </p>

              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setWithdrawOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleWithdrawNaira} disabled={isWithdrawing}>
                  {isWithdrawing ? "Processing..." : "Withdraw with Paystack"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Deposit with Paystack</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">
                Add money to your Every1 wallet to trade on the swap page.
              </div>

              <div className="space-y-2">
                <Label htmlFor="deposit-amount">Amount (NGN)</Label>
                <Input
                  id="deposit-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 10000"
                  value={depositAmount}
                  onChange={(event) => setDepositAmount(event.target.value)}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                You&apos;ll be redirected to Paystack to complete the deposit.
              </p>

              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setDepositOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleDepositNaira} disabled={isDepositing}>
                  {isDepositing ? "Processing..." : "Continue to Paystack"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
