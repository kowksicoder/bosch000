import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell } from "lucide-react";
import type { Notification } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { getPusherClient, disconnectPusher } from "@/lib/pusher-client";

export default function Notifications() {
  const { authenticated, user, getAccessToken } = usePrivy();
  const queryClient = useQueryClient();
  const userAddress = user?.wallet?.address;
  const seenNotificationIds = useRef<Set<string>>(new Set());
  const [recentIds, setRecentIds] = useState<Set<string>>(new Set());
  const recentTimeouts = useRef<Map<string, number>>(new Map());

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
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

  useEffect(() => {
    if (!notifications.length) return;
    const currentIds = notifications.map((notification) => notification.id);
    seenNotificationIds.current = new Set(currentIds);
  }, [notifications]);

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
          if (!payload?.id) return;
          if (seenNotificationIds.current.has(payload.id)) return;

          seenNotificationIds.current.add(payload.id);

          queryClient.setQueryData<Notification[]>(
            ["/api/e1xp/notifications"],
            (current = []) => {
              const exists = current.some((item) => item.id === payload.id);
              if (exists) return current;
              return [payload, ...current];
            },
          );

          setRecentIds((prev) => {
            const next = new Set(prev);
            next.add(payload.id);
            return next;
          });

          if (!recentTimeouts.current.has(payload.id)) {
            const timeoutId = window.setTimeout(() => {
              setRecentIds((prev) => {
                const next = new Set(prev);
                next.delete(payload.id);
                return next;
              });
              recentTimeouts.current.delete(payload.id);
            }, 8000);

            recentTimeouts.current.set(payload.id, timeoutId);
          }
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
      recentTimeouts.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      recentTimeouts.current.clear();
    };
  }, [authenticated, user, getAccessToken, queryClient]);

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const accessToken = await getAccessToken();
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const response = await fetch(
        `/api/e1xp/notifications/${notificationId}/read`,
        {
          method: "PATCH",
          headers,
        },
      );
      if (!response.ok) throw new Error("Failed to mark as read");
      return response.json();
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ["/api/e1xp/notifications"] });
      const previous = queryClient.getQueryData<Notification[]>([
        "/api/e1xp/notifications",
      ]);

      queryClient.setQueryData<Notification[]>(
        ["/api/e1xp/notifications"],
        (current = []) =>
          current.map((notification) =>
            notification.id === notificationId
              ? { ...notification, read: true }
              : notification,
          ),
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["/api/e1xp/notifications"],
          context.previous,
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/e1xp/notifications"],
      });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const accessToken = await getAccessToken();
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const response = await fetch(
        `/api/e1xp/notifications/read-all`,
        {
          method: "PATCH",
          headers,
        },
      );
      if (!response.ok) throw new Error("Failed to mark all as read");
      return response.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["/api/e1xp/notifications"] });
      const previous = queryClient.getQueryData<Notification[]>([
        "/api/e1xp/notifications",
      ]);

      queryClient.setQueryData<Notification[]>(
        ["/api/e1xp/notifications"],
        (current = []) =>
          current.map((notification) => ({ ...notification, read: true })),
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["/api/e1xp/notifications"],
          context.previous,
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/e1xp/notifications"],
      });
    },
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  const handleMarkAllAsRead = () => {
    if (unreadCount > 0) {
      markAllAsReadMutation.mutate();
    }
  };

  // Group notifications by date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayNotifications = notifications.filter((n) => {
    if (!n.createdAt) return false;
    const notifDate = new Date(n.createdAt);
    notifDate.setHours(0, 0, 0, 0);
    return notifDate.getTime() === today.getTime();
  });

  const yesterdayNotifications = notifications.filter((n) => {
    if (!n.createdAt) return false;
    const notifDate = new Date(n.createdAt);
    notifDate.setHours(0, 0, 0, 0);
    return notifDate.getTime() === yesterday.getTime();
  });

  const olderNotifications = notifications.filter((n) => {
    if (!n.createdAt) return false;
    const notifDate = new Date(n.createdAt);
    notifDate.setHours(0, 0, 0, 0);
    return notifDate.getTime() < yesterday.getTime();
  });

  const undatedNotifications = notifications.filter((n) => !n.createdAt);

  const unreadNotifications = notifications.filter((n) => !n.read);

  const getNotificationIcon = (type: string) => {
    const icons = {
        referral: { emoji: "🎁", color: "from-lime-500 to-lime-600" },
        reward: { emoji: "🏆", color: "from-yellow-500 to-orange-500" },
        trade: { emoji: "📈", color: "from-blue-500 to-blue-600" },
        streak: { emoji: "🔥", color: "from-orange-500 to-red-500" },
        welcome: { emoji: "👋", color: "from-green-500 to-emerald-600" },
        admin: { emoji: "💬", color: "from-purple-500 to-purple-600" },
        milestone: { emoji: "🎯", color: "from-pink-500 to-pink-600" },
        follower: { emoji: "👥", color: "from-indigo-500 to-indigo-600" },
        points_earned: { emoji: "⭐", color: "from-amber-500 to-amber-600" },
        trade_completed: { emoji: "✅", color: "from-teal-500 to-teal-600" },
        points: { emoji: "⚡", color: "from-yellow-400 to-yellow-500" },
        reminder: { emoji: "⏰", color: "from-blue-400 to-blue-500" },
        coin_created: { emoji: "🪙", color: "from-purple-400 to-purple-500" },
        message: { emoji: "💬", color: "from-cyan-500 to-cyan-600" },
      };

    return (
      icons[type as keyof typeof icons] || {
        emoji: "🔔",
        color: "from-gray-500 to-gray-600",
      }
    );
  };

  const formatTimeAgo = (date: Date | string | undefined) => {
    if (!date) return "recently";

    const notifDate = new Date(date);
    if (isNaN(notifDate.getTime())) return "recently";

    const now = new Date();
    const seconds = Math.floor((now.getTime() - notifDate.getTime()) / 1000);

    // Handle future dates (shouldn't happen, but just in case)
    if (seconds < 0) {
      const hours = notifDate.getHours();
      const minutes = notifDate.getMinutes();
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    }

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    // For older notifications, show the date
    const monthDay = `${notifDate.getMonth() + 1}/${notifDate.getDate()}`;
    if (seconds < 31536000) return monthDay; // Less than a year
    
    return `${monthDay}/${notifDate.getFullYear().toString().slice(-2)}`;
  };

  const NotificationItem = ({
    notification,
    isNew,
  }: {
    notification: Notification;
    isNew?: boolean;
  }) => {
    const icon = getNotificationIcon(notification.type);

    return (
      <div
        onClick={() => handleNotificationClick(notification)}
        className={`flex items-start gap-3 px-3 py-2.5 hover:bg-accent/50 cursor-pointer transition-all border-b rounded-lg border-border/40 last:border-0 ${
          !notification.read ? "bg-primary/5 dark:bg-primary/10" : ""
        } ${isNew ? "ring-1 ring-primary/40" : ""}`}
        data-testid={`notification-item-${notification.id}`}
      >
        {!notification.read && (
          <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
        )}
        <div
          className={`h-9 w-9 flex-shrink-0 bg-gradient-to-br ${icon.color} rounded-full flex items-center justify-center text-lg shadow-sm`}
        >
          {icon.emoji}
        </div>
        <div className="flex-1 min-w-0 pr-2">
          <p className="text-sm font-medium text-foreground leading-tight mb-0.5">
            {notification.title}
          </p>
          <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
            {notification.message}
          </p>
          {notification.coinSymbol && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 mt-1">
              {notification.coinSymbol}
            </Badge>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground/70 whitespace-nowrap flex-shrink-0 mt-0.5">
          {formatTimeAgo(notification.createdAt)}
        </span>
      </div>
    );
  };

  if (!authenticated) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 py-6">
        <div className="text-center space-y-4 py-12">
          <Bell className="h-16 w-16 text-muted-foreground mx-auto" />
          <h2 className="text-2xl font-bold">Connect Your Wallet</h2>
          <p className="text-muted-foreground">
            Please connect your wallet to view your notifications
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 py-4 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-9 w-full" />
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex gap-3 p-3 border-b">
              <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-full" />
              </div>
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-1xl font-bold flex items-center gap-2">
          Notifications
          {unreadCount > 0 && (
            <Badge className="h-5 px-2 bg-primary text-primary-foreground">
              {unreadCount}
            </Badge>
          )}
        </h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleMarkAllAsRead}
          disabled={unreadCount === 0 || markAllAsReadMutation.isPending}
          className="text-xs h-8"
        >
          Mark all as read
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="w-full justify-start h-9 bg-transparent border-b border-border rounded-none p-0">
          <TabsTrigger
            value="all"
            className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4"
          >
            All
          </TabsTrigger>
          <TabsTrigger
            value="unread"
            className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4"
          >
            Unread
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="all"
          className="mt-0 border rounded-lg overflow-hidden bg-card"
        >
          {notifications.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="h-12 w-12 mx-auto opacity-20 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No notifications yet
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                You'll see updates here
              </p>
            </div>
          ) : (
            <>
              {todayNotifications.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-[11px] font-bold text-muted-foreground/80 bg-muted/30 uppercase tracking-wide">
                    Today
                  </div>
                  {todayNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      isNew={recentIds.has(notification.id)}
                    />
                  ))}
                </div>
              )}
              {yesterdayNotifications.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-[11px] font-bold text-muted-foreground/80 bg-muted/30 uppercase tracking-wide">
                    Yesterday
                  </div>
                  {yesterdayNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      isNew={recentIds.has(notification.id)}
                    />
                  ))}
                </div>
              )}
              {olderNotifications.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-[11px] font-bold text-muted-foreground/80 bg-muted/30 uppercase tracking-wide">
                    Older
                  </div>
                  {olderNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      isNew={recentIds.has(notification.id)}
                    />
                  ))}
                </div>
              )}
              {undatedNotifications.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-[11px] font-bold text-muted-foreground/80 bg-muted/30 uppercase tracking-wide">
                    Recent
                  </div>
                  {undatedNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      isNew={recentIds.has(notification.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent
          value="unread"
          className="mt-0 border rounded-lg overflow-hidden bg-card"
        >
          {unreadNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="h-12 w-12 mx-auto opacity-20 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                All caught up!
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                No unread notifications
              </p>
            </div>
          ) : (
            unreadNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                isNew={recentIds.has(notification.id)}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
