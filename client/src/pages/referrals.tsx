
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Copy, Check, Gift, QrCode, Trophy, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Referral, Creator } from "@shared/schema";
import QRCode from "qrcode";
import { updateOGMeta } from "@/lib/og-meta";

export default function Referrals() {
  const { user: privyUser, authenticated, getAccessToken } = usePrivy();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  const address = privyUser?.wallet?.address;

  const { data: creator } = useQuery<Creator>({
    queryKey: ['/api/creators/address', address],
    enabled: !!address && authenticated,
  });

  const { data: referrals = [] } = useQuery<Referral[]>({
    queryKey: ['/api/referrals/referrer', address],
    enabled: !!address && authenticated,
  });

  const { data: referralStats } = useQuery({
    queryKey: ['/api/referrals/stats', address],
    enabled: !!address && authenticated,
  });

  const { data: e1xpStatus } = useQuery({
    queryKey: ['/api/e1xp/status'],
    enabled: !!address && authenticated,
  });

  const referralCode = creator?.referralCode || creator?.name || address?.slice(0, 8);
  const referralLink = `${window.location.origin}?ref=${referralCode}`;
  const points = e1xpStatus?.points || parseInt(creator?.points || "0");
  const totalReferrals = referrals.length;
  const earnedPoints =
    referralStats?.referralPoints ??
    referrals.reduce((sum, referral: any) => {
      const points = referral.pointsEarned ?? referral.points_earned ?? 0;
      return sum + Number(points || 0);
    }, 0);
  const claimableReferralRewards = earnedPoints;
  const activeReferrals =
    referralStats?.activeReferrals ??
    referrals.filter((referral: any) => {
      const status = referral.status ?? (referral.claimed ? "rewarded" : "pending");
      return status === "active" || status === "rewarded" || referral.hasTradedOrCreated;
    }).length;
  const unclaimedRewards = e1xpStatus?.unclaimedRewards || 0;

  // Update OG meta tags when referral code is available
  useEffect(() => {
    if (creator && referralCode) {
      updateOGMeta({
        title: `Join Every1.fun with ${creator.name || creator.username || 'me'}!`,
        description: `Get started on Every1.fun and earn bonus E1XP points! Use my referral code: ${referralCode}`,
        image: creator.avatarUrl || `${window.location.origin}/assets/logos/zorb.png`,
        url: referralLink,
      });
    }
  }, [creator, referralCode, referralLink]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Referral link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleShowQR = async () => {
    if (!qrCodeUrl) {
      const url = await QRCode.toDataURL(referralLink, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      setQrCodeUrl(url);
    }
    setShowQR(!showQR);
  };

  const handleClaimReferralRewards = async () => {
    if (!authenticated) return;

    try {
      const accessToken = await getAccessToken();
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch("/api/e1xp/rewards/unclaimed", {
        credentials: "include",
        headers,
      });

      if (!response.ok) {
        throw new Error("Failed to load rewards");
      }

      const rewards = await response.json();
      const referralRewards = (rewards || []).filter((reward: any) => reward.type === "referral");

      if (!referralRewards.length) {
        toast({
          title: "No referral rewards",
          description: "You have no referral rewards to claim right now.",
        });
        return;
      }

      for (const reward of referralRewards) {
        const claimResponse = await fetch(`/api/e1xp/rewards/${reward.id}/claim`, {
          method: "POST",
          credentials: "include",
          headers,
        });
        if (!claimResponse.ok) {
          throw new Error("Failed to claim reward");
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/e1xp/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/referrals/stats", address] });
      queryClient.invalidateQueries({ queryKey: ["/api/referrals/referrer", address] });

      toast({
        title: "Referral rewards claimed",
        description: `Claimed ${referralRewards.length} reward${referralRewards.length === 1 ? "" : "s"}.`,
      });
    } catch (error) {
      toast({
        title: "Claim failed",
        description: error instanceof Error ? error.message : "Unable to claim rewards",
        variant: "destructive",
      });
    }
  };

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground">
            Please connect your wallet to view your referrals
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Compact Header */}
      <Card className="p-4 rounded-2xl border-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Hello, {creator?.name || 'Creator'}👋</h1>
            <p className="text-sm text-muted-foreground">Welcome back!</p>
          </div>
          <Gift className="h-8 w-8 text-primary" />
        </div>
      </Card>

      {/* Compact Points Display - Only show if user has referrals */}
      {totalReferrals > 0 && (
        <Card className="p-4 rounded-2xl border-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-amber-500" />
              <div>
                <div className="text-xs text-muted-foreground">Your E1XP Points</div>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-500">{points.toLocaleString()}</div>
                {unclaimedRewards > 0 && (
                  <div className="text-xs text-green-600 dark:text-green-500 font-semibold">
                    🎁 {unclaimedRewards} unclaimed rewards!
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Referrals</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-500">{totalReferrals}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button 
              size="sm"
              className="rounded-xl bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90 h-9 font-semibold"
              onClick={handleClaimReferralRewards}
              disabled={claimableReferralRewards <= 0}
            >
              Claim {claimableReferralRewards} E1XP
            </Button>
            <Button 
              size="sm"
              variant="outline"
              onClick={handleShowQR}
              className="rounded-xl h-9 font-semibold border-2"
            >
              <QrCode className="h-4 w-4 mr-1" />
              QR Code
            </Button>
          </div>
        </Card>
      )}

      {/* QR Code Display */}
      {showQR && qrCodeUrl && (
        <Card className="p-6 rounded-3xl text-center border-2">
          <h3 className="font-bold text-lg mb-4">Scan to Refer</h3>
          <div className="bg-white p-4 rounded-2xl inline-block">
            <img src={qrCodeUrl} alt="Referral QR Code" className="w-64 h-64" />
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Use this QR code when you checkout to get points 🎁
          </p>
        </Card>
      )}

      {/* Referral Link */}
      <Card className="p-5 rounded-3xl border-2">
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-muted/30 rounded-2xl px-4 py-3 text-sm font-mono truncate">
            {referralLink}
          </div>
          <Button
            size="icon"
            onClick={handleCopy}
            className="rounded-xl h-12 w-12 shrink-0"
          >
            {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Use this referral link when you checkout to get points 🎁
        </p>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5 rounded-3xl text-center bg-gradient-to-br from-primary/5 to-accent/5 border-2">
          <Users className="h-8 w-8 text-primary mx-auto mb-2" />
          <div className="text-3xl font-bold mb-1">{totalReferrals}</div>
          <div className="text-xs text-muted-foreground">Total Referrals</div>
        </Card>

        <Card className="p-5 rounded-3xl text-center bg-gradient-to-br from-chart-4/5 to-green-500/5 border-2">
          <Sparkles className="h-8 w-8 text-chart-4 mx-auto mb-2" />
          <div className="text-3xl font-bold mb-1">{earnedPoints}</div>
          <div className="text-xs text-muted-foreground">Points Earned</div>
        </Card>
      </div>

      {activeReferrals > 0 && (
        <Card className="p-4 rounded-2xl border-2 bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Active Referrals</div>
              <div className="text-xl font-semibold">{activeReferrals}</div>
            </div>
            <Badge className="bg-primary text-primary-foreground">Active</Badge>
          </div>
        </Card>
      )}

      {/* Recent Referrals */}
      {referrals.length > 0 && (
        <Card className="p-6 rounded-3xl">
          <h3 className="font-bold text-lg mb-4">Recent Referrals</h3>
          <div className="space-y-3">
            {referrals.slice(0, 5).map((referral, index) => (
              <div key={referral.id} className="flex items-center gap-3 p-3 rounded-2xl bg-muted/20">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">
                    {referral.referredAddress?.slice(0, 6)}...{referral.referredAddress?.slice(-4)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {referral.createdAt ? new Date(referral.createdAt).toLocaleDateString() : '—'}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className="bg-green-500 text-white">
                    +{referral.pointsEarned ?? referral.points_earned ?? 0}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] uppercase">
                    {referral.status ?? (referral.claimed ? "rewarded" : "pending")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* How It Works */}
      <Card className="p-6 rounded-3xl bg-gradient-to-br from-primary/5 to-accent/5 border-2">
        <h3 className="font-bold text-lg mb-4">How It Works</h3>
        <ul className="space-y-3 text-sm">
          <li className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">1</span>
            </div>
            <span className="text-muted-foreground">Share your unique referral link with friends</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">2</span>
            </div>
            <span className="text-muted-foreground">They sign up and create their first coin</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">3</span>
            </div>
            <span className="text-muted-foreground">You both earn 100 E1XP points! 🎉</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
