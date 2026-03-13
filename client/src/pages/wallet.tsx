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
import type { Creator } from "@shared/schema";

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

type EarningsSummary = {
  last24hNgn: number;
  previous24hNgn: number;
  changePct: number;
  rewardCount: number;
  updatedAt: string;
};

type CollabSummary = {
  totalCollabs: number;
  totalEarningsNgn: number;
  totalVolumeNgn: number;
  updatedAt: string;
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
  const [bankCode, setBankCode] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankName, setBankName] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [showReferralCta, setShowReferralCta] = useState(false);
  const queryClient = useQueryClient();

  const walletAddress = smartAccountAddress || user?.wallet?.address || "";

  useEffect(() => {
    if (!authenticated || !user?.id) {
      setShowReferralCta(false);
      return;
    }
    const appliedKey = `every1_referral_applied_${user.id}`;
    const hasApplied = Boolean(localStorage.getItem(appliedKey));
    const hasPending = Boolean(localStorage.getItem("every1_referral_code"));
    setShowReferralCta(!hasApplied && !hasPending);
  }, [authenticated, user?.id]);

  const openReferralPrompt = () => {
    window.dispatchEvent(new CustomEvent("open-referral-modal"));
  };

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

  const { data: creator } = useQuery<Creator>({
    queryKey: ["/api/creators/address", walletAddress],
    enabled: authenticated && Boolean(walletAddress),
    queryFn: async () => {
      const response = await fetch(`/api/creators/address/${walletAddress}`);
      if (!response.ok) {
        throw new Error("Failed to fetch creator profile");
      }
      return response.json();
    },
  });

  const { data: earningsSummary } = useQuery<EarningsSummary>({
    queryKey: ["/api/earnings/summary", walletAddress],
    enabled: authenticated,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/earnings/summary", {
        credentials: "include",
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch earnings summary");
      }

      return response.json();
    },
  });

  const { data: collabSummary } = useQuery<CollabSummary>({
    queryKey: ["/api/collabs/summary"],
    enabled: authenticated,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/collabs/summary", {
        credentials: "include",
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch collab summary");
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

    if (!bankCode || !bankAccount || !bankName) {
      toast({
        title: "Bank details required",
        description: "Provide bank code, account number, and account name.",
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
          bankCode,
          bankAccount,
          bankName,
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

  useEffect(() => {
    if (!creator) return;
    const creatorBankCode = (creator as any)?.bankCode ?? (creator as any)?.bank_code;
    const creatorBankAccount = (creator as any)?.bankAccount ?? (creator as any)?.bank_account;
    const creatorBankName = (creator as any)?.bankName ?? (creator as any)?.bank_name;

    if (!bankCode && creatorBankCode) setBankCode(creatorBankCode);
    if (!bankAccount && creatorBankAccount) setBankAccount(creatorBankAccount);
    if (!bankName && creatorBankName) setBankName(creatorBankName);
  }, [creator, bankAccount, bankCode, bankName]);

  const fallbackAvatar = "https://i.ibb.co/JRQCPsZK/ev122logo-1-1.png";
  const changePct = earningsSummary?.changePct ?? 0;
  const changeLabel = `${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}%`;
  const changeColor = changePct >= 0 ? "text-green-500" : "text-red-500";
  const tradeProgress = weeklyChallenges
    ? Math.min(
        100,
        (weeklyChallenges.tradeDays.count / weeklyChallenges.tradeDays.target) * 100,
      )
    : 0;
  const supportProgress = weeklyChallenges
    ? Math.min(
        100,
        (weeklyChallenges.supportCreators.count /
          weeklyChallenges.supportCreators.target) *
          100,
      )
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold">Wallet</h1>
              {authenticated && (
                <Badge variant="secondary" className="text-xs">Onchain</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Your creator coin holdings and live Naira value.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/swap">
              <Button className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-300 text-black font-semibold border-0">
                <ArrowDownLeft className="h-4 w-4 mr-2" />
                Buy
              </Button>
            </Link>
            <Link href="/swap?side=sell">
              <Button variant="outline">
                <ArrowUpRight className="h-4 w-4 mr-2" />
                Withdraw
              </Button>
            </Link>
          </div>
        </div>

        <Card className="rounded-3xl border-border/60 bg-card">
          <div className="p-5 md:p-6 space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total wallet value</p>
                <div className="text-2xl md:text-3xl font-semibold">
                  {formatSmartCurrency(totalValueNgn)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {holdings.length} coin{holdings.length === 1 ? "" : "s"} held
                </p>
              </div>

              <div className="flex flex-col gap-2">
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

            <Separator className="bg-border/60" />

            <Card className="rounded-2xl border-border/40 bg-muted/30">
              <div className="p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Naira balance</p>
                  <p className="text-xl font-semibold">
                    {formatSmartCurrency(nairaLedger?.availableNgn || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pending: {formatSmartCurrency(nairaLedger?.pendingNgn || 0)}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2 md:items-end">
                  <div className="text-xs text-muted-foreground">
                    {nairaLedger?.updatedAt
                      ? `Updated ${new Date(nairaLedger.updatedAt).toLocaleString()}`
                      : "Auto-settlement updates this balance"}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setWithdrawOpen(true)}
                    disabled={!authenticated}
                  >
                    Withdraw Naira
                  </Button>
                </div>
              </div>
            </Card>

            {showReferralCta && (
              <Card className="rounded-2xl border-border/40 bg-background/60">
                <div className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Have an invite code?</p>
                    <p className="text-xs text-muted-foreground">
                      Add it once to unlock bonus E1XP rewards.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={openReferralPrompt}>
                    <Gift className="h-4 w-4 mr-2" />
                    Enter code
                  </Button>
                </div>
              </Card>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <Card className="rounded-2xl border-border/40 bg-background/60">
                <div className="p-4 space-y-2">
                  <p className="text-xs text-muted-foreground">Today&apos;s earnings</p>
                  <p className="text-xl font-semibold">
                    {formatSmartCurrency(earningsSummary?.last24hNgn || 0)}
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={changeColor}>{changeLabel}</span>
                    <span className="text-muted-foreground">last 24h</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {earningsSummary?.rewardCount
                      ? `${earningsSummary.rewardCount} rewards in 24h`
                      : "No rewards yet today"}
                  </p>
                </div>
              </Card>

              <Card className="rounded-2xl border-border/40 bg-background/60">
                <div className="p-4 space-y-2">
                  <p className="text-xs text-muted-foreground">Collab earnings</p>
                  <p className="text-xl font-semibold">
                    {formatSmartCurrency(collabSummary?.totalEarningsNgn || 0)}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{collabSummary?.totalCollabs || 0} collabs</span>
                    <span>Volume {formatSmartCurrency(collabSummary?.totalVolumeNgn || 0)}</span>
                  </div>
                </div>
              </Card>

              <Card className="rounded-2xl border-border/40 bg-background/60">
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Weekly challenges</p>
                    {weeklyChallenges?.multiplier && weeklyChallenges.multiplier > 1 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {weeklyChallenges.multiplier}x referral boost
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span>Trade {weeklyChallenges?.tradeDays.target || 3} days</span>
                      <span className="text-muted-foreground">
                        {weeklyChallenges?.tradeDays.count || 0}/
                        {weeklyChallenges?.tradeDays.target || 3}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/40">
                      <div
                        className="h-2 rounded-full bg-green-500 transition-all"
                        style={{ width: `${tradeProgress}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Reward: {weeklyChallenges?.tradeDays.reward.total || 0} E1XP
                      {weeklyChallenges?.tradeDays.rewarded ? " • earned" : ""}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span>Support {weeklyChallenges?.supportCreators.target || 2} creators</span>
                      <span className="text-muted-foreground">
                        {weeklyChallenges?.supportCreators.count || 0}/
                        {weeklyChallenges?.supportCreators.target || 2}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/40">
                      <div
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{ width: `${supportProgress}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Reward: {weeklyChallenges?.supportCreators.reward.total || 0} E1XP
                      {weeklyChallenges?.supportCreators.rewarded ? " • earned" : ""}
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {!authenticated && (
              <div className="text-sm text-muted-foreground">
                Sign in to view your wallet holdings.
              </div>
            )}

            {authenticated && isLoading && (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <Card key={item} className="rounded-2xl border-border/50 bg-muted/20">
                    <div className="p-4 flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {authenticated && !isLoading && holdings.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                No creator coins yet. Buy your first coin to see it here.
              </div>
            )}

            {authenticated && !isLoading && holdings.length > 0 && (
              <div className="space-y-3">
                {holdings.map((holding) => {
                  const priceNgn = convertUsdToNgn(holding.priceUsd, fxRates);
                  const valueNgn = convertUsdToNgn(holding.valueUsd, fxRates);

                  return (
                    <Card
                      key={holding.id}
                      className="rounded-2xl border-border/50 bg-background/60 hover:bg-muted/20 transition"
                    >
                      <div className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 ring-1 ring-primary/20">
                            <AvatarImage src={holding.creatorAvatar || fallbackAvatar} />
                            <AvatarFallback className="bg-primary/10">
                              {holding.symbol.slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold">
                              {holding.name}
                              <span className="text-xs text-muted-foreground ml-2">
                                {holding.symbol}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {holding.creatorHandle ? `@${holding.creatorHandle}` : "Creator coin"}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                          <div className="text-sm">
                            <p className="text-xs text-muted-foreground">Balance</p>
                            <p className="font-semibold">
                              {holding.balance.toLocaleString("en-US", {
                                maximumFractionDigits: 4,
                              })}
                            </p>
                          </div>
                          <div className="text-sm">
                            <p className="text-xs text-muted-foreground">Price</p>
                            <p className="font-semibold">
                              {formatSmartCurrency(priceNgn)}
                            </p>
                          </div>
                          <div className="text-sm">
                            <p className="text-xs text-muted-foreground">Value</p>
                            <p className={cn("font-semibold", valueNgn ? "text-green-500" : "text-muted-foreground")}>
                              {formatSmartCurrency(valueNgn)}
                            </p>
                          </div>
                          <Link href={`/swap?coin=${holding.address}`}>
                            <Button variant="outline" size="sm">Trade</Button>
                          </Link>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Withdraw to Bank</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">
              Available: {formatSmartCurrency(nairaLedger?.availableNgn || 0)}
            </div>

            <div className="space-y-2">
              <Label htmlFor="withdraw-amount">Amount (₦)</Label>
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

            <div className="grid gap-3">
              <div className="space-y-2">
                <Label htmlFor="bank-name">Account Name</Label>
                <Input
                  id="bank-name"
                  placeholder="Account name"
                  value={bankName}
                  onChange={(event) => setBankName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank-account">Account Number</Label>
                <Input
                  id="bank-account"
                  placeholder="0123456789"
                  value={bankAccount}
                  onChange={(event) => setBankAccount(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank-code">Bank Code</Label>
                <Input
                  id="bank-code"
                  placeholder="e.g. 058"
                  value={bankCode}
                  onChange={(event) => setBankCode(event.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setWithdrawOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleWithdrawNaira} disabled={isWithdrawing}>
                {isWithdrawing ? "Processing..." : "Withdraw"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
