import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { usePrivy, getAccessToken } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import { formatSmartCurrency } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";

interface WithdrawEarningsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WithdrawEarningsModal({
  open,
  onOpenChange,
}: WithdrawEarningsModalProps) {
  const { toast } = useToast();
  const { user, authenticated } = usePrivy();
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const { data: nairaLedger } = useQuery<any>({
    queryKey: ["/api/ledger/naira"],
    enabled: authenticated,
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const accessToken = await getAccessToken();
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

  const handleWithdraw = async () => {
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
      onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleWithdraw} disabled={isWithdrawing}>
              {isWithdrawing ? "Processing..." : "Withdraw with Paystack"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
