import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePrivy } from "@privy-io/react-auth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { socketClient } from "@/lib/socket-client";
import { getPusherClient, disconnectPusher } from "@/lib/pusher-client";
import type { Notification } from "@shared/schema";

const NotificationIcon = ({ className }: { className?: string }) => (
  <svg width="18" height="20" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M5.35206 18.242C5.78721 18.7922 6.34171 19.2364 6.97367 19.541C7.60564 19.8455 8.29855 20.0025 9.00006 20C9.70158 20.0025 10.3945 19.8455 11.0264 19.541C11.6584 19.2364 12.2129 18.7922 12.6481 18.242C10.2271 18.5702 7.77299 18.5702 5.35206 18.242ZM15.7501 7V7.704C15.7501 8.549 15.9901 9.375 16.4421 10.078L17.5501 11.801C18.5611 13.375 17.7891 15.514 16.0301 16.011C11.4338 17.313 6.56631 17.313 1.97006 16.011C0.211062 15.514 -0.560938 13.375 0.450062 11.801L1.55806 10.078C2.01164 9.36936 2.25217 8.54537 2.25106 7.704V7C2.25106 3.134 5.27306 0 9.00006 0C12.7271 0 15.7501 3.134 15.7501 7Z" fill="currentColor"/>
  </svg>
);

export function NotificationBell() {
  const { authenticated, user, getAccessToken } = usePrivy();
  const { toast } = useToast();
  const previousNotificationIds = useRef<Set<string>>(new Set());
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  const showNotificationToast = useCallback(
    (notification: Notification) => {
      const icons: Record<string, string> = {
        referral: "🎁",
        reward: "🏆",
        trade: "📈",
        streak: "🔥",
        welcome: "👋",
        admin: "💬",
        milestone: "🎯",
        follower: "👥",
        points_earned: "⭐",
        trade_completed: "✅",
      };
      const emoji = icons[notification.type] || "🔔";

      const isReferralBonus =
        notification.type === "referral" ||
        (notification.title || "").toLowerCase().includes("referral");

      toast({
        title: `${emoji} ${notification.title}`,
        description: notification.message,
        duration: isReferralBonus ? 6000 : 4000,
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = "/notifications";
            }}
          >
            View
          </Button>
        ),
      });
    },
    [toast],
  );

  // Shared function to fetch unread message count
  const fetchUnreadMessages = useCallback(async () => {
    if (!authenticated || !user) {
      setUnreadMessageCount(0);
      return;
    }

    try {
      const accessToken = await getAccessToken();
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const response = await fetch("/api/messages/unread-count", {
        credentials: "include",
        headers,
      });
      if (response.ok) {
        const data = await response.json();
        setUnreadMessageCount(data.count || 0);
      }
    } catch (error) {
      console.error("Failed to fetch unread message count:", error);
    }
  }, [authenticated, user, getAccessToken]);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/e1xp/notifications"],
    enabled: authenticated,
    refetchInterval: 10000,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        return [];
      }
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

  // Show toast for new notifications
  useEffect(() => {
    if (!notifications.length) return;

    if (previousNotificationIds.current.size === 0) {
      previousNotificationIds.current = new Set(notifications.map((n) => n.id));
      return;
    }

    const newNotifications = notifications.filter(
      (n) => !previousNotificationIds.current.has(n.id),
    );

    newNotifications.forEach((notification) => {
      showNotificationToast(notification);
    });

    previousNotificationIds.current = new Set(notifications.map((n) => n.id));
  }, [notifications, showNotificationToast]);

  // Get unread message count from conversations
  useEffect(() => {
    if (!authenticated || !user) return;

    fetchUnreadMessages();
    const interval = setInterval(fetchUnreadMessages, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [authenticated, user, fetchUnreadMessages]);

  // Connect to Pusher for realtime notifications
  useEffect(() => {
    if (!authenticated || !user) {
      disconnectPusher();
      return;
    }

    let active = true;
    let channels: any[] = [];

    const connect = async () => {
      const accessToken = await getAccessToken();
      const pusher = getPusherClient(accessToken);
      if (!pusher || !active) return;

      const ids = [user.id, user.wallet?.address].filter(Boolean) as string[];
      channels = ids.map((id) => pusher.subscribe(`private-user-${id}`));

      channels.forEach((channel) => {
        channel.bind("notification", (payload: Notification) => {
          if (!payload?.id) {
            queryClient.invalidateQueries({ queryKey: ["/api/e1xp/notifications"] });
            return;
          }

          if (!previousNotificationIds.current.has(payload.id)) {
            previousNotificationIds.current.add(payload.id);
            showNotificationToast(payload);
            queryClient.setQueryData(
              ["/api/e1xp/notifications"],
              (old: Notification[] | undefined) => {
                if (!old) return [payload];
                const exists = old.some((n) => n.id === payload.id);
                if (exists) return old;
                return [payload, ...old];
              },
            );
          }

          queryClient.invalidateQueries({ queryKey: ["/api/e1xp/notifications"] });
        });
      });
    };

    connect();

    return () => {
      active = false;
      channels.forEach((channel) => {
        channel.unbind_all();
        channel.unsubscribe();
      });
    };
  }, [authenticated, user, getAccessToken]);

  // Connect to Socket.IO and listen for admin messages
  useEffect(() => {
    if (!authenticated || !user) {
      socketClient.disconnect();
      return;
    }

    // Connect to Socket.IO with user's wallet address or Privy ID (for email users)
    const userId = user.wallet?.address || user.id;
    console.log('🔌 Connecting to Socket.IO with userId:', userId);
    socketClient.connect(userId);

    const handleAdminMessage = (data: any) => {
      console.log('📨 Received admin message:', data);
      toast({
        title: "💬 Message from Admin",
        description: data.message,
        duration: 6000,
      });
    };

    const handleAdminBroadcast = (data: any) => {
      console.log('📢 Received admin broadcast:', data);
      toast({
        title: "📢 Announcement from Creatorland",
        description: data.message,
        duration: 6000,
      });
    };

    // Handle new messages from other users
    const handleNewMessage = (message: any) => {
      console.log('💬 Received new message:', message);
      // Increment unread message count
      setUnreadMessageCount((prev) => prev + 1);
      
      // Show toast notification
      toast({
        title: "💬 New Message",
        description: message.content.length > 50 
          ? `${message.content.substring(0, 50)}...` 
          : message.content,
        duration: 5000,
      });
    };

    // Handle conversation updates
    const handleConversationUpdated = () => {
      // Refresh unread count when conversations update
      fetchUnreadMessages();
    };

    socketClient.on('admin_message', handleAdminMessage);
    socketClient.on('admin_broadcast', handleAdminBroadcast);
    socketClient.on('new_message', handleNewMessage);
    socketClient.on('conversation_updated', handleConversationUpdated);

    return () => {
      socketClient.off('admin_message', handleAdminMessage);
      socketClient.off('admin_broadcast', handleAdminBroadcast);
      socketClient.off('new_message', handleNewMessage);
      socketClient.off('conversation_updated', handleConversationUpdated);
    };
  }, [authenticated, user, toast, fetchUnreadMessages]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const totalUnread = unreadCount + unreadMessageCount;

  if (!authenticated) return null;

  return (
    <Link href="/notifications">
      <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
        <NotificationIcon className="h-5 w-5" />
        {totalUnread > 0 && (
          <span className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-full h-4 min-w-4 px-1 flex items-center justify-center text-[10px] font-bold leading-none" data-testid="badge-notification-count">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </Button>
    </Link>
  );
}
