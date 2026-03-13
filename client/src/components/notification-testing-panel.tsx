
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Bell, Send, Zap } from "lucide-react";

export function NotificationTestingPanel() {
  const [testUserId, setTestUserId] = useState("");
  const [notificationType, setNotificationType] = useState("streak");
  const [triggerType, setTriggerType] = useState("daily_streak_reminders");
  const { toast } = useToast();

  const testNotificationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/test-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: testUserId,
          type: notificationType,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send test notification");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Test Notification Sent",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const triggerNotificationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/trigger-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: triggerType,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to trigger notifications");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Notifications Triggered",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Test Individual Notification
          </CardTitle>
          <CardDescription>
            Send a test notification to a specific user
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-user-id">User Address</Label>
            <Input
              id="test-user-id"
              placeholder="0x..."
              value={testUserId}
              onChange={(e) => setTestUserId(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notification-type">Notification Type</Label>
            <Select value={notificationType} onValueChange={setNotificationType}>
              <SelectTrigger id="notification-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="streak">Daily Login Streak</SelectItem>
                <SelectItem value="reminder">E1XP Claim Reminder</SelectItem>
                <SelectItem value="referral">Referral Bonus</SelectItem>
                <SelectItem value="trade">New Trade</SelectItem>
                <SelectItem value="points">E1XP Points Earned</SelectItem>
                <SelectItem value="follower">New Follower</SelectItem>
                <SelectItem value="milestone">Milestone Reached</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => testNotificationMutation.mutate()}
            disabled={!testUserId || testNotificationMutation.isPending}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {testNotificationMutation.isPending ? "Sending..." : "Send Test Notification"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Trigger Mass Notifications
          </CardTitle>
          <CardDescription>
            Trigger notifications to all eligible users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trigger-type">Trigger Type</Label>
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger id="trigger-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily_streak_reminders">Daily Streak Reminders</SelectItem>
                <SelectItem value="new_creators_suggestions">New Creators Suggestions</SelectItem>
                <SelectItem value="new_coins">New Coins Promotion</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => triggerNotificationMutation.mutate()}
            disabled={triggerNotificationMutation.isPending}
            className="w-full"
            variant="secondary"
          >
            <Zap className="h-4 w-4 mr-2" />
            {triggerNotificationMutation.isPending ? "Triggering..." : "Trigger Notifications"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
