import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Zap, Trophy, Star, TrendingUp, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";
import { usePrivy } from "@privy-io/react-auth";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";

export default function Points() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { authenticated, user, getAccessToken } = usePrivy();
  const address = user?.wallet?.address;

  const {
    data: status,
    isLoading: statusLoading,
    isError: statusError,
  } = useQuery({
    queryKey: ["/api/e1xp/status", authenticated],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      if (authenticated) {
        try {
          const accessToken = await getAccessToken();
          if (accessToken) {
            headers.Authorization = `Bearer ${accessToken}`;
          }
        } catch (error) {
          console.error('Failed to get access token:', error);
        }
      }
      const response = await fetch("/api/e1xp/status", {
        credentials: "include",
        headers,
      });
      if (!response.ok) throw new Error('Failed to fetch status');
      return response.json();
    },
  });

  const {
    data: notifications,
    isLoading: notificationsLoading,
    isError: notificationsError,
  } = useQuery({
    queryKey: ["/api/e1xp/notifications"],
    enabled: authenticated,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const response = await fetch("/api/e1xp/notifications", {
        credentials: "include",
        headers,
      });
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return response.json();
    },
  });

  const {
    data: unclaimedRewards,
    isLoading: unclaimedRewardsLoading,
    isError: unclaimedRewardsError,
  } = useQuery({
    queryKey: ["/api/e1xp/rewards/unclaimed"],
    enabled: authenticated,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const response = await fetch("/api/e1xp/rewards/unclaimed", {
        credentials: "include",
        headers,
      });
      if (!response.ok) throw new Error('Failed to fetch unclaimed rewards');
      return response.json();
    },
  });

  const claimDailyMutation = useMutation({
    mutationFn: async () => {
      const accessToken = await getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const response = await fetch("/api/e1xp/claim-daily", {
        method: "POST",
        headers,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to claim daily points");
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Trigger confetti celebration
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0']
      });

      toast({
        title: "🎉 Points Claimed!",
        description: `You earned ${data.pointsEarned} E1XP! ${data.streak > 1 ? `${data.streak} day streak! 🔥` : ''}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/e1xp/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/e1xp/notifications"] });
    },
    onError: (error: Error) => {
      // Check if already claimed today
      if (error.message.includes("already") || error.message.includes("duplicate")) {
        toast({
          title: "✅ Already Claimed Today!",
          description: "You've already claimed your daily points. Come back tomorrow for more E1XP! 🔥",
        });
      } else {
        toast({
          title: "❌ Error",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const claimRewardMutation = useMutation({
    mutationFn: async (rewardId: string) => {
      const accessToken = await getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const response = await fetch(`/api/e1xp/rewards/${rewardId}/claim`, {
        method: "POST",
        headers,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to claim reward");
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Trigger confetti celebration
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#a855f7', '#ec4899', '#f472b6', '#fb923c']
      });

      toast({
        title: "🎉 Reward Claimed!",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/e1xp/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/e1xp/rewards/unclaimed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/e1xp/notifications"] });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const points = status?.points || 0;
  const streak = status?.streak || 0;
  const nextClaimAmount = status?.nextClaimAmount || 10;
  const canClaimDaily = status?.canClaimDaily ?? true;
  const daysUntilBonus = status?.daysUntilBonus || 7;

  if (!authenticated) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 py-6">
        <div className="text-center space-y-4 py-12">
          <Zap className="h-16 w-16 text-muted-foreground mx-auto" />
          <h2 className="text-2xl font-bold">Sign In Required</h2>
          <p className="text-muted-foreground">
            Please sign in to view your E1XP points and rewards
          </p>
        </div>
      </div>
    );
  }

  if (statusLoading) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="text-center space-y-2">
          <Skeleton className="h-9 w-48 mx-auto" />
          <Skeleton className="h-5 w-64 mx-auto" />
        </div>

        <Card className="p-6 rounded-2xl border">
          <div className="text-center space-y-4">
            <Skeleton className="w-24 h-24 rounded-full mx-auto" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32 mx-auto" />
              <Skeleton className="h-6 w-24 mx-auto" />
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-2xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-12 w-48" />
              <Skeleton className="h-12 w-20" />
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
        </Card>

        <Card className="p-6 rounded-2xl">
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">E1XP Points</h1>
        <p className="text-muted-foreground">Earn rewards for your activity</p>
      </div>

      {/* Total Points Card */}
      <Card className="p-6 rounded-2xl border">
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            <div className="relative bg-primary/10 rounded-full w-24 h-24 mx-auto flex items-center justify-center">
              <div className="text-center">
                <Zap className="h-8 w-8 text-primary mx-auto mb-1" />
                <div className="text-3xl font-bold text-primary">
                  {points}
                </div>
              </div>
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Total E1XP Points</div>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                🔥 {streak} day streak
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Daily Claim Card */}
      <Card className="p-6 rounded-2xl">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Gift className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold">Daily Bonus</div>
                <div className="text-sm text-muted-foreground">
                  {canClaimDaily ? "Available to claim!" : "Come back tomorrow"}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">+{nextClaimAmount}</div>
              <div className="text-xs text-muted-foreground">E1XP</div>
            </div>
          </div>

          <Button
            onClick={() => claimDailyMutation.mutate()}
            disabled={!canClaimDaily || claimDailyMutation.isPending}
            className="w-full h-10"
          >
            {claimDailyMutation.isPending ? (
              "Claiming..."
            ) : canClaimDaily ? (
              <>
                <Gift className="h-4 w-4 mr-2" />
                Claim Daily Bonus
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4 mr-2" />
                Already Claimed Today
              </>
            )}
          </Button>

          {daysUntilBonus < 7 && (
            <div className="p-3 rounded-lg bg-accent/50">
              <div className="flex items-center gap-2 text-sm">
                <Star className="h-4 w-4 text-primary" />
                <span>{daysUntilBonus} days until 7-day streak bonus!</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* How to Earn Points */}
      <Card className="p-6 rounded-2xl">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          How to Earn E1XP
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/30">
            <div className="text-xl">🎁</div>
            <div className="flex-1">
              <div className="font-medium text-sm">Daily Login</div>
              <div className="text-xs text-muted-foreground">10+ points every day</div>
            </div>
            <Badge variant="secondary" className="text-xs">10 E1XP</Badge>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/30">
            <div className="text-xl">🔥</div>
            <div className="flex-1">
              <div className="font-medium text-sm">7-Day Streak</div>
              <div className="text-xs text-muted-foreground">Keep logging in</div>
            </div>
            <Badge variant="secondary" className="text-xs">50 E1XP</Badge>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/30">
            <div className="text-xl">💰</div>
            <div className="flex-1">
              <div className="font-medium text-sm">Trade Coins</div>
              <div className="text-xs text-muted-foreground">Buy or sell</div>
            </div>
            <Badge variant="secondary" className="text-xs">5 E1XP</Badge>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/30">
            <div className="text-xl">🎨</div>
            <div className="flex-1">
              <div className="font-medium text-sm">Create Coin</div>
              <div className="text-xs text-muted-foreground">Launch your coin</div>
            </div>
            <Badge variant="secondary" className="text-xs">100 E1XP</Badge>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/30">
            <div className="text-xl">🤝</div>
            <div className="flex-1">
              <div className="font-medium text-sm">Refer Friends</div>
              <div className="text-xs text-muted-foreground">Get signup bonus</div>
            </div>
            <Badge variant="secondary" className="text-xs">500 E1XP</Badge>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/30">
            <div className="text-xl">🏆</div>
            <div className="flex-1">
              <div className="font-medium text-sm">Unlock Badges</div>
              <div className="text-xs text-muted-foreground">Reach milestones</div>
            </div>
            <Badge variant="secondary" className="text-xs">50 E1XP</Badge>
          </div>
        </div>
      </Card>

      {/* Unclaimed Rewards */}
      {unclaimedRewards && unclaimedRewards.length > 0 && (
        <Card className="p-6 rounded-2xl border-primary/20">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Unclaimed Rewards
          </h3>
          <div className="space-y-2">
            {unclaimedRewards.map((reward: any) => (
              <div
                key={reward.id}
                className="p-3 rounded-lg bg-accent/30 border"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-medium text-sm mb-1">{reward.title}</div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {reward.message}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        <Zap className="h-3 w-3 mr-1" />
                        {reward.amount} E1XP
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {reward.type === 'coin_creation' && '🪙 Coin'}
                        {reward.type === 'referral' && '👥 Referral'}
                        {reward.type === 'daily_streak' && '🔥 Streak'}
                        {reward.type === 'first_trade' && '💰 Trade'}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    onClick={() => claimRewardMutation.mutate(reward.id)}
                    disabled={claimRewardMutation.isPending}
                    size="sm"
                  >
                    {claimRewardMutation.isPending ? (
                      "Claiming..."
                    ) : (
                      <>
                        <Gift className="h-4 w-4 mr-1" />
                        Claim
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Activity */}
      {notifications && Array.isArray(notifications) && notifications.length > 0 && (
        <Card className="p-6 rounded-2xl">
          <h3 className="font-bold text-lg mb-4">Recent Activity</h3>
          <div className="space-y-2">
            {notifications.slice(0, 5).map((notification: any) => (
              <div
                key={notification.id}
                className={`p-3 rounded-lg ${
                  !notification.read ? "bg-accent/50" : "bg-accent/20"
                }`}
              >
                <div className="font-medium text-sm">{notification.title}</div>
                <div className="text-xs text-muted-foreground">
                  {notification.message}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}