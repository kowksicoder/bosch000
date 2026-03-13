
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { usePrivy } from "@privy-io/react-auth";
import { Loader2, Wallet, TrendingUp } from "lucide-react";
import type { Address } from "viem";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { useQuery } from "@tanstack/react-query";
import type { Coin } from "@shared/schema";
import { useSmartAccount } from "@/contexts/SmartAccountContext";

interface WithdrawEarningsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userCoins: Coin[]; // Coins deployed by the user
}

// ABI for Zora CreatorCoin withdraw function
const CREATOR_COIN_ABI = [
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  },
  {
    name: "creatorEarnings",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "creator", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const;

export default function WithdrawEarningsModal({
  open,
  onOpenChange,
  userCoins,
}: WithdrawEarningsModalProps) {
  const { toast } = useToast();
  const { user, authenticated } = usePrivy();
  const { smartAccountClient, smartAccountAddress } = useSmartAccount();
  const [recipientAddress, setRecipientAddress] = useState("");
  const [selectedCoinAddress, setSelectedCoinAddress] = useState<string>("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [coinEarnings, setCoinEarnings] = useState<Record<string, string>>({});

  const userAddress = smartAccountAddress || user?.wallet?.address;

  // Fetch earnings for each coin from Zora
  useEffect(() => {
    if (!open || !userCoins.length || !userAddress) return;

    const fetchEarnings = async () => {
      const { getCoin } = await import("@zoralabs/coins-sdk");
      const earnings: Record<string, string> = {};

      for (const coin of userCoins) {
        if (!coin.address) continue;
        try {
          const coinData = await getCoin({
            address: coin.address as `0x${string}`,
            chain: base,
          });

          const tokenData = coinData.data?.zora20Token;
          if (tokenData?.creatorEarnings && tokenData.creatorEarnings.length > 0) {
            const earningAmount = tokenData.creatorEarnings[0].amount?.amountDecimal || "0";
            earnings[coin.address] = earningAmount;
          } else {
            earnings[coin.address] = "0";
          }
        } catch (error) {
          console.error(`Error fetching earnings for ${coin.address}:`, error);
          earnings[coin.address] = "0";
        }
      }

      setCoinEarnings(earnings);
    };

    fetchEarnings();
  }, [open, userCoins, userAddress]);

  const handleWithdraw = async () => {
    // Validate address
    if (!recipientAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid Ethereum address",
        variant: "destructive",
      });
      return;
    }

    if (!selectedCoinAddress) {
      toast({
        title: "Select a Coin",
        description: "Please select a coin to withdraw earnings from",
        variant: "destructive",
      });
      return;
    }

    if (!authenticated || !userAddress) {
      toast({
        title: "Not Authenticated",
        description: "Please connect your wallet",
        variant: "destructive",
      });
      return;
    }

    const earnings = coinEarnings[selectedCoinAddress];
    if (!earnings || parseFloat(earnings) <= 0) {
      toast({
        title: "No Earnings",
        description: "This coin has no earnings to withdraw",
        variant: "destructive",
      });
      return;
    }

    setIsWithdrawing(true);

    try {
      let hash: `0x${string}`;

      // Use smart account client for gasless withdrawal (email users)
      if (smartAccountClient) {
        console.log("💰 [Gasless] Initiating gasless withdrawal via smart account...");
        
        hash = await smartAccountClient.writeContract({
          address: selectedCoinAddress as Address,
          abi: CREATOR_COIN_ABI,
          functionName: "withdraw",
          args: [recipientAddress as Address, BigInt(Math.floor(parseFloat(earnings) * 1e18))],
        });

        console.log("✅ [Gasless] Withdrawal transaction sent (gas sponsored by Base Paymaster)");
      } else {
        // Fallback to regular wallet client for wallet users
        console.log("💰 [Regular] Initiating withdrawal via external wallet...");
        
        const provider = await (window as any).ethereum;
        if (!provider) {
          throw new Error("No Ethereum provider found");
        }

        const { createWalletClient, custom } = await import("viem");
        const walletClient = createWalletClient({
          account: userAddress as Address,
          chain: base,
          transport: custom(provider),
        });

        hash = await walletClient.writeContract({
          address: selectedCoinAddress as Address,
          abi: CREATOR_COIN_ABI,
          functionName: "withdraw",
          args: [recipientAddress as Address, BigInt(Math.floor(parseFloat(earnings) * 1e18))],
        });

        console.log("✅ [Regular] Withdrawal transaction sent");
      }

      toast({
        title: "Withdrawal Initiated!",
        description: `Withdrawing ${parseFloat(earnings).toFixed(6)} ETH to ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`,
      });

      // Wait for confirmation
      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      await publicClient.waitForTransactionReceipt({ hash });

      toast({
        title: "Withdrawal Successful! 🎉",
        description: `${parseFloat(earnings).toFixed(6)} ETH sent successfully${smartAccountClient ? ' (gas-free!)' : ''}`,
      });

      onOpenChange(false);
      setRecipientAddress("");
      setSelectedCoinAddress("");
    } catch (error) {
      console.error("Withdrawal error:", error);
      toast({
        title: "Withdrawal Failed",
        description: error instanceof Error ? error.message : "Failed to withdraw earnings",
        variant: "destructive",
      });
    } finally {
      setIsWithdrawing(false);
    }
  };

  const totalEarnings = Object.values(coinEarnings).reduce(
    (sum, earning) => sum + parseFloat(earning || "0"),
    0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Withdraw Earnings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-3">
          <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg p-3">
            <p className="text-2xl font-bold text-green-500">{totalEarnings.toFixed(6)} ETH</p>
            <p className="text-xs text-muted-foreground">{userCoins.length} coin(s)</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="coin-select" className="text-sm">Select Coin</Label>
            <select
              id="coin-select"
              value={selectedCoinAddress}
              onChange={(e) => setSelectedCoinAddress(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm"
            >
              <option value="">-- Select a coin --</option>
              {userCoins
                .filter(coin => coin.address && parseFloat(coinEarnings[coin.address] || "0") > 0)
                .map((coin) => (
                  <option key={coin.id} value={coin.address}>
                    {coin.name} ({coin.symbol}) - {parseFloat(coinEarnings[coin.address!] || "0").toFixed(6)} ETH
                  </option>
                ))}
            </select>
          </div>

          {selectedCoinAddress && (
            <div className="bg-muted/30 rounded-lg p-2.5">
              <p className="text-sm text-muted-foreground">Amount</p>
              <p className="text-lg font-bold text-foreground">
                {parseFloat(coinEarnings[selectedCoinAddress] || "0").toFixed(6)} ETH
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="recipient-address" className="text-sm">Recipient Address</Label>
            <Input
              id="recipient-address"
              placeholder="0x..."
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isWithdrawing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleWithdraw}
            disabled={isWithdrawing || !recipientAddress || !selectedCoinAddress}
            className="bg-green-600 hover:bg-green-700"
          >
            {isWithdrawing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Withdrawing...
              </>
            ) : (
              "Withdraw Earnings"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
