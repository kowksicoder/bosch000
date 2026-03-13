import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flame, Trophy, Calendar, Zap, Star, Award, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { LoginStreak } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";


const daysOfWeek = ["M", "T", "W", "Th", "F", "Sa", "Su"];
const fullDaysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Streaks() {
  const { user: privyUser, authenticated } = usePrivy();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const address = privyUser?.wallet?.address;

  // Use E1XP status endpoint for streak data
  const { data: e1xpStatus, isLoading } = useQuery({
    queryKey: ["/api/e1xp/status"],
    enabled: authenticated,
    refetchInterval: 5000,
  });

  const weeklyCalendar = e1xpStatus?.weeklyCalendar || [false, false, false, false, false, false, false];
  const currentStreak = e1xpStatus?.streak || 0;
  const longestStreak = e1xpStatus?.longestStreak || 0;
  const totalPoints = e1xpStatus?.points || 0;

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const privyId = privyUser?.id;
      console.log('[Streak Check-In] User clicked button, starting check-in...', { address, privyId });
      
      const response = await fetch("/api/login-streak/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          address: address || undefined,
          privyId: privyId || undefined
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('[Streak Check-In] Error:', error);
        throw new Error(error.error || "Failed to check in");
      }
      
      const data = await response.json();
      console.log('[Streak Check-In] Success:', data);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/e1xp/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/creators/address", address] });
      queryClient.invalidateQueries({ queryKey: ["/api/creators/privy", privyUser?.id] });

      if (data.alreadyCheckedIn) {
        toast({
          title: "Already Checked In! ✅",
          description: "You've already claimed your points today. Come back tomorrow!",
        });
      } else {
        toast({
          title: `🎉 ${data.pointsEarned} E1XP Earned!`,
          description: data.isFirstLogin 
            ? "Welcome! You earned your first daily bonus!"
            : `Day ${data.currentStreak || 1} streak! Keep it going! 🔥`,
        });
      }
    },
    onError: (error: Error) => {
      console.error('[Streak Check-In] Failed:', error);
      toast({
        title: "Check-In Failed",
        description: error.message || "Unable to claim your daily points. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-8">
        <div className="text-center">
          <Flame className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground">
            Please connect your wallet to view your streaks
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Hero Streak Display */}
      <div className="text-center space-y-4">
        <div className="relative inline-block">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-pink-500/20 blur-3xl rounded-full"></div>
          <div className="relative bg-gradient-to-br from-orange-50 to-pink-50 dark:from-orange-950/30 dark:to-pink-950/30 rounded-full w-40 h-40 mx-auto flex items-center justify-center border-8 border-background shadow-2xl">
            <div className="text-center">
              <Flame className="h-12 w-12 text-orange-500 mx-auto mb-2" />
              <div className="text-5xl font-black bg-gradient-to-br from-orange-500 to-pink-500 bg-clip-text text-transparent" data-testid="text-current-streak">
                {isLoading ? <Skeleton className="h-12 w-24 mx-auto" /> : currentStreak}
              </div>
            </div>
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-bold mb-1">Week Streak</h1>
          <p className="text-muted-foreground">You are doing really great! 🎉</p>
        </div>
      </div>

      {/* Weekly Calendar */}
      <Card className="p-4 rounded-3xl border-2">
        <div className="grid grid-cols-7 gap-2">
          {daysOfWeek.map((day, index) => {
            const isCompleted = weeklyCalendar[index];
            const isToday = new Date().getDay() === (index + 1) % 7;

            return (
              <div
                key={day}
                className="text-center space-y-2"
                data-testid={`day-${fullDaysOfWeek[index].toLowerCase()}`}
              >
                <div className="text-xs text-muted-foreground font-medium">
                  {day}
                </div>
                <div
                  className={`aspect-square rounded-full flex items-center justify-center transition-all ${
                    isCompleted
                      ? "bg-gradient-to-br from-orange-500 to-pink-500 shadow-lg"
                      : isToday
                      ? "bg-primary/10 border-2 border-primary"
                      : "bg-muted/30"
                  }`}
                >
                  {isCompleted && <CheckCircle2 className="h-5 w-5 text-white" />}
                  {!isCompleted && isToday && (
                    <div className="text-xs font-bold text-primary">{new Date().getDate()}</div>
                  )}
                  {!isCompleted && !isToday && (
                    <div className="text-xs text-muted-foreground">{29 + index}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Stats Card */}
      <Card className="p-6 rounded-3xl bg-gradient-to-br from-accent/5 to-chart-4/5">
        <div className="text-center mb-4">
          <p className="text-sm text-muted-foreground font-medium mb-3">Your Stats</p>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold mb-1" data-testid="text-days">
              {isLoading ? <Skeleton className="h-8 w-16 mx-auto" /> : currentStreak}
            </div>
            <div className="text-xs text-muted-foreground">Days</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold mb-1" data-testid="text-longest-streak">
              {isLoading ? <Skeleton className="h-8 w-16 mx-auto" /> : longestStreak}
            </div>
            <div className="text-xs text-muted-foreground">Best</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold mb-1" data-testid="text-total-points">
              {isLoading ? <Skeleton className="h-8 w-16 mx-auto" /> : totalPoints}
            </div>
            <div className="text-xs text-muted-foreground">E1XP</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold mb-1">
              {isLoading ? <Skeleton className="h-8 w-16 mx-auto" /> : Math.min(Math.floor(currentStreak / 7), 5)}
            </div>
            <div className="text-xs text-muted-foreground">Level</div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2 text-sm">
            <Star className="h-4 w-4 text-chart-4" />
            <span className="text-muted-foreground">
              {isLoading ? <Skeleton className="h-6 w-48" /> : (currentStreak >= 7 ? '2 Insights Available' : 'Keep going to unlock insights!')}
            </span>
          </div>
        </div>
      </Card>

      {/* Check In Button */}
      <Button 
        size="lg" 
        onClick={() => {
          // Only trigger check-in when button is explicitly clicked
          if (!checkInMutation.isPending) {
            checkInMutation.mutate();
          }
        }}
        disabled={checkInMutation.isPending || !e1xpStatus?.canClaimDaily}
        className="w-full h-14 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold rounded-2xl shadow-xl text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="button-check-in"
      >
        <Zap className="h-5 w-5 mr-2" />
        {checkInMutation.isPending 
          ? "Checking In..." 
          : !e1xpStatus?.canClaimDaily 
          ? "Already Claimed Today ✅" 
          : "Check In Today"}
      </Button>

      {/* Milestones */}
      <Card className="p-6 rounded-3xl">
        <h3 className="font-bold text-lg mb-4">Unlock Rewards</h3>

        <div className="space-y-3">
          <div className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
            currentStreak >= 7 ? 'border-primary bg-primary/5' : 'border-border bg-card'
          }`}>
            <div className={`p-3 rounded-xl ${currentStreak >= 7 ? 'bg-primary/20' : 'bg-muted/20'}`}>
              <Flame className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">7-Day Streak</div>
              <div className="text-xs text-muted-foreground">2x points bonus</div>
            </div>
            {currentStreak >= 7 && <Badge className="bg-green-500">✓</Badge>}
          </div>

          <div className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
            currentStreak >= 30 ? 'border-accent bg-accent/5' : 'border-border bg-card'
          }`}>
            <div className={`p-3 rounded-xl ${currentStreak >= 30 ? 'bg-accent/20' : 'bg-muted/20'}`}>
              <Trophy className="h-5 w-5 text-accent" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">30-Day Streak</div>
              <div className="text-xs text-muted-foreground">Creator badge</div>
            </div>
            {currentStreak >= 30 && <Badge className="bg-green-500">✓</Badge>}
          </div>

          <div className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
            currentStreak >= 90 ? 'border-chart-4 bg-chart-4/5' : 'border-border bg-card'
          }`}>
            <div className={`p-3 rounded-xl ${currentStreak >= 90 ? 'bg-chart-4/20' : 'bg-muted/20'}`}>
              <Award className="h-5 w-5 text-chart-4" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">90-Day Legend</div>
              <div className="text-xs text-muted-foreground">Exclusive tools</div>
            </div>
            {currentStreak >= 90 && <Badge className="bg-green-500">✓</Badge>}
          </div>
        </div>
      </Card>
    </div>
  );
}