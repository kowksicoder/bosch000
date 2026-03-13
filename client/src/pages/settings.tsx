import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePrivy, getAccessToken } from "@privy-io/react-auth";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  User, 
  Palette, 
  HelpCircle,
  Info,
  Star,
  FileText,
  ChevronRight,
  Moon,
  Users,
  Coins
} from "lucide-react";
import type { Creator } from "@shared/schema";
import { createAvatar } from '@dicebear/core';
import { avataaars } from '@dicebear/collection';
import { useToast } from "@/hooks/use-toast";
import { useSmartAccount } from "@/contexts/SmartAccountContext";
import { usePublicClient, useWalletClient } from "wagmi";
import { Button } from "@/components/ui/button";

export default function Settings() {
  const { user: privyUser, authenticated } = usePrivy();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const address = privyUser?.wallet?.address;
  const { smartAccountClient } = useSmartAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const canUpdatePayout = Boolean(smartAccountClient || walletClient);

  const { data: creator } = useQuery<Creator>({
    queryKey: ['/api/creators/address', address],
    enabled: !!address && authenticated,
  });

  const { data: treasuryData } = useQuery({
    queryKey: ["/api/treasury/address"],
    queryFn: async () => {
      const response = await fetch("/api/treasury/address");
      if (!response.ok) throw new Error("Failed to fetch treasury address");
      return response.json() as Promise<{ address: string }>;
    },
  });

  const { data: creatorCoins = [] } = useQuery({
    queryKey: ["/api/coins/creator", address],
    enabled: !!address && authenticated,
    queryFn: async () => {
      const response = await fetch(`/api/coins/creator/${address}`);
      if (!response.ok) throw new Error("Failed to fetch creator coins");
      return response.json();
    },
  });

  const [darkMode, setDarkMode] = useState(true);
  const [autoSettlementEnabled, setAutoSettlementEnabled] = useState(false);
  const [isAutoSettlementUpdating, setIsAutoSettlementUpdating] = useState(false);

  const avatarSvg = createAvatar(avataaars, {
    seed: address || 'anonymous',
    size: 128,
  }).toDataUri();

  const profileImageUrl = creator?.avatar || avatarSvg;

  const treasuryAddress = treasuryData?.address;
  const coinsToUpdate = useMemo(
    () =>
      (creatorCoins || []).filter((coin: any) => {
        if (!coin.address) return false;
        if (!coin.status) return true;
        return coin.status !== "removed";
      }),
    [creatorCoins],
  );

  useEffect(() => {
    const value =
      (creator as any)?.autoSettlementEnabled ??
      (creator as any)?.auto_settlement_enabled;
    if (value !== undefined) {
      setAutoSettlementEnabled(Boolean(value));
    }
  }, [creator]);

  const handleAutoSettlementToggle = async (checked: boolean) => {
    if (!authenticated || !address) {
      toast({
        title: "Connect wallet",
        description: "Please connect your wallet to update this setting.",
        variant: "destructive",
      });
      return;
    }

    if (!treasuryAddress) {
      toast({
        title: "Treasury unavailable",
        description: "Unable to resolve the platform settlement wallet.",
        variant: "destructive",
      });
      return;
    }

    if (!smartAccountClient && !walletClient) {
      toast({
        title: "Wallet required",
        description: "Please connect your wallet to update payout settings.",
        variant: "destructive",
      });
      return;
    }

    const message = checked
      ? "Enabling auto-settlement will route your coin rewards to the platform settlement wallet for automatic Naira payouts. Continue?"
      : "Disabling auto-settlement will send rewards back to your wallet. Continue?";

    if (!window.confirm(message)) {
      return;
    }

    setIsAutoSettlementUpdating(true);

    try {
      const targetRecipient = checked ? treasuryAddress : address;
      const coinAbi = [
        {
          name: "setPayoutRecipient",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [
            {
              name: "newPayoutRecipient",
              type: "address",
            },
          ],
          outputs: [],
        },
      ] as const;

      if (coinsToUpdate.length === 0) {
        toast({
          title: "No active coins",
          description: "Create a coin before enabling auto-settlement.",
        });
      }

      for (const coin of coinsToUpdate) {
        const hash = smartAccountClient
          ? await smartAccountClient.writeContract({
              address: coin.address,
              abi: coinAbi,
              functionName: "setPayoutRecipient",
              args: [targetRecipient],
            })
          : await walletClient!.writeContract({
              address: coin.address,
              abi: coinAbi,
              functionName: "setPayoutRecipient",
              args: [targetRecipient],
            });

        if (hash) {
          await publicClient.waitForTransactionReceipt({ hash });
        }
      }

      const accessToken = await getAccessToken();
      const response = await fetch("/api/creators/auto-settlement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          enabled: checked,
          payoutRecipientAddress: targetRecipient,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || "Failed to update auto-settlement");
      }

      setAutoSettlementEnabled(checked);
      queryClient.invalidateQueries({ queryKey: ["/api/creators/address", address] });

      toast({
        title: checked ? "Auto-settlement enabled" : "Auto-settlement disabled",
        description: checked
          ? "Rewards will now be settled into your Naira wallet automatically."
          : "Rewards will be sent directly to your wallet again.",
      });
    } catch (error) {
      console.error("Auto-settlement update failed:", error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Unable to update auto-settlement",
        variant: "destructive",
      });
    } finally {
      setIsAutoSettlementUpdating(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <SettingsIcon className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground">
            Please connect your wallet to access settings
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Profile Card */}
      <Card 
        className="p-4 rounded-2xl border-2 cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={() => setLocation("/profile")}
      >
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={profileImageUrl} alt={creator?.name || "Profile"} />
            <AvatarFallback>
              <User className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">
              {creator?.name || `${address?.slice(0, 6)}...${address?.slice(-4)}`}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
      </Card>

      {/* Dark Mode Toggle */}
      <Card className="p-4 rounded-2xl border-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Moon className="w-5 h-5" />
            <span className="font-medium">Dark Mode</span>
          </div>
          <Switch
            checked={darkMode}
            onCheckedChange={setDarkMode}
          />
        </div>
      </Card>

      {/* Auto Settlement */}
      <Card className="p-4 rounded-2xl border-2 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Coins className="w-5 h-5" />
            <div>
              <p className="font-medium">Auto-settlement (Naira)</p>
              <p className="text-xs text-muted-foreground">
                Route rewards to the platform wallet for automatic NGN payouts.
              </p>
            </div>
          </div>
          <Switch
            checked={autoSettlementEnabled}
            disabled={isAutoSettlementUpdating || !canUpdatePayout}
            onCheckedChange={handleAutoSettlementToggle}
          />
        </div>
        <div className="rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground space-y-2">
          <p>
            {autoSettlementEnabled
              ? "Enabled: Rewards are settled into your fiat wallet automatically."
              : "Disabled: Rewards stay onchain until you withdraw."}
          </p>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span>Coins: {coinsToUpdate.length}</span>
            {treasuryAddress && (
              <span>Settlement: {treasuryAddress.slice(0, 6)}...{treasuryAddress.slice(-4)}</span>
            )}
          </div>
          {!canUpdatePayout && (
            <p className="text-[11px] text-yellow-500">
              Connect your wallet to update payout settings.
            </p>
          )}
        </div>
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAutoSettlementToggle(!autoSettlementEnabled)}
            disabled={isAutoSettlementUpdating || !canUpdatePayout}
          >
            {isAutoSettlementUpdating ? "Updating..." : autoSettlementEnabled ? "Disable" : "Enable"}
          </Button>
        </div>
      </Card>

      {/* Menu Items */}
      <div className="space-y-2">
        <Card 
          className="p-4 rounded-2xl border-2 cursor-pointer hover:bg-muted/20 transition-colors"
          onClick={() => setLocation("/referrals")}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5" />
              <span className="font-medium">Referrals</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </Card>
      </div>

      {/* Account Info */}
      <Card className="p-4 rounded-2xl bg-muted/20 border-2 mt-6">
        <p className="text-xs text-muted-foreground text-center mb-2">Account Information</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Wallet</span>
            <span className="font-mono text-xs">{address?.slice(0, 8)}...{address?.slice(-6)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Points</span>
            <span className="font-bold text-primary">{creator?.points || 0} E1XP</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
