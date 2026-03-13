import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Flame, Check } from "lucide-react";
import confetti from "canvas-confetti";
import { useToast } from "@/hooks/use-toast";

export function E1XPClaimModal() {
  const { authenticated, user, getAccessToken } = usePrivy();
  const address = user?.wallet?.address;
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get today's date in YYYY-MM-DD format for localStorage tracking
  const getTodayKey = () => {
    return new Date().toISOString().split('T')[0];
  };
  
  // Check if modal was already shown today
  const wasShownToday = () => {
    const lastShownDate = localStorage.getItem('e1xp-modal-last-shown');
    return lastShownDate === getTodayKey();
  };
  
  // Mark modal as shown today
  const markAsShownToday = () => {
    localStorage.setItem('e1xp-modal-last-shown', getTodayKey());
  };

  const { data: status } = useQuery({
    queryKey: ["/api/e1xp/status", authenticated],
    enabled: authenticated,
    queryFn: async () => {
      const headers: Record<string, string> = {};
      try {
        const accessToken = await getAccessToken();
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }
      } catch (error) {
        console.error('Failed to get access token:', error);
      }
      const response = await fetch("/api/e1xp/status", {
        credentials: "include",
        headers,
      });
      if (!response.ok) throw new Error('Failed to fetch status');
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
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0']
      });

      toast({
        title: "🎉 Points Claimed!",
        description: `You earned ${data.pointsEarned} E1XP! ${data.streak > 1 ? `${data.streak} day streak! 🔥` : ''}`,
        duration: 5000,
      });
      
      // Mark modal as shown today so it doesn't appear again
      markAsShownToday();
      
      // Invalidate all related queries to update the UI everywhere
      queryClient.invalidateQueries({ queryKey: ["/api/e1xp/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/e1xp/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/creators"] });
      queryClient.invalidateQueries({ queryKey: ["/api/login-streak"] });
      
      // Force refetch to ensure data is fresh
      queryClient.refetchQueries({ queryKey: ["/api/e1xp/status"] });
      
      setOpen(false);
    },
    onError: (error: Error) => {
      // Check if already claimed today
      if (error.message.includes("already") || error.message.includes("duplicate")) {
        toast({
          title: "✅ Already Claimed Today!",
          description: "You've already claimed your daily points. Come back tomorrow for more E1XP! 🔥",
        });
        // Mark as shown so modal doesn't appear again today
        markAsShownToday();
        setOpen(false);
      } else {
        toast({
          title: "❌ Error",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  useEffect(() => {
    // Only show modal if:
    // 1. User is authenticated
    // 2. They can claim daily points
    // 3. Modal hasn't been shown today (prevents multiple shows on logout/login)
    if (authenticated && status?.canClaimDaily && status?.authenticated && !wasShownToday()) {
      setOpen(true);
      // Don't mark as shown here - only mark after claim or manual dismiss
    }
  }, [authenticated, status?.canClaimDaily, status?.authenticated]);

  const nextClaimAmount = status?.nextClaimAmount || 10;
  const streak = status?.streak || 0;

  const getDaysOfWeek = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date().getDay();
    const weekDays = [];

    const claimedDaysInWeek = Math.min(streak, 7);

    for (let i = 0; i < 7; i++) {
      const dayIndex = (today - 6 + i + 7) % 7;
      const isToday = i === 6;
      const isClaimed = i >= (7 - claimedDaysInWeek);

      weekDays.push({
        name: days[dayIndex],
        isToday,
        isClaimed,
      });
    }

    return weekDays;
  };

  const weekDays = getDaysOfWeek();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md bg-background border-border/50 p-8">
        <div className="flex flex-col items-center space-y-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-500 flex items-center justify-center">
              <Flame className="h-12 w-12 text-white" />
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 w-full max-w-sm bg-white dark:bg-muted/20 rounded-2xl p-4 shadow-sm">
            {weekDays.map((day, index) => (
              <div key={index} className="flex flex-col items-center gap-2">
                <div 
                  data-testid={`day-indicator-${day.name.toLowerCase()}`}
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                    day.isClaimed
                      ? 'bg-green-500 border-green-500'
                      : day.isToday
                      ? 'bg-gray-100 dark:bg-muted border-gray-300 dark:border-border'
                      : 'bg-gray-100 dark:bg-muted border-gray-200 dark:border-border/50'
                  }`}
                >
                  {day.isClaimed && (
                    <Check className="h-5 w-5 text-white" />
                  )}
                </div>
                <span className="text-xs font-medium text-muted-foreground dark:text-gray-400">
                  {day.name}
                </span>
              </div>
            ))}
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-foreground dark:text-white">
              You've started a streak!
            </h2>
            <p className="text-sm text-muted-foreground dark:text-gray-400 max-w-sm">
              Claim your daily points to build your streak and create a powerful learning habit.
            </p>
          </div>

          <Button
            data-testid="button-continue"
            onClick={() => claimDailyMutation.mutate()}
            disabled={claimDailyMutation.isPending}
            className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
          >
            {claimDailyMutation.isPending ? "Claiming..." : "Continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}