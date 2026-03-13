import { useMemo, useState } from "react";
import { usePrivy, getAccessToken } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Link } from "wouter";

import { formatSmartCurrency } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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

const filters = [
  { value: "all", label: "All" },
  { value: "buy", label: "Buys" },
  { value: "sell", label: "Sells" },
  { value: "deposit", label: "Deposits" },
  { value: "withdrawal", label: "Withdrawals" },
  { value: "receive", label: "Rewards" },
] as const;

export default function TransactionsPage() {
  const { authenticated } = usePrivy();
  const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("all");

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <Card className="rounded-3xl border-border/60 bg-card">
            <div className="p-6 text-center text-sm text-muted-foreground">
              Sign in to view your transaction history.
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const { data: transactions, isLoading } = useQuery<WalletTransaction[]>({
    queryKey: ["/api/wallet/transactions", "all"],
    enabled: authenticated,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/wallet/transactions?range=all&limit=100", {
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

  const filtered = useMemo(() => {
    if (!transactions) return [];
    if (filter === "all") return transactions;
    return transactions.filter((txn) => txn.type === filter);
  }, [transactions, filter]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-10 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Wallet</p>
            <h1 className="text-2xl md:text-3xl font-semibold">Transactions</h1>
            <p className="text-sm text-muted-foreground">
              Track every buy, sell, deposit, withdrawal, and reward.
            </p>
          </div>
          <Link href="/wallet">
            <Button variant="outline" size="sm">
              Back to Wallet
            </Button>
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant={filter === item.value ? "secondary" : "ghost"}
              className="rounded-full px-3 text-[11px]"
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <Card className="rounded-3xl border-border/60 bg-card">
          <div className="p-5 md:p-6 space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((item) => (
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
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                No transactions yet for this filter.
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((txn) => (
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
      </div>
    </div>
  );
}
