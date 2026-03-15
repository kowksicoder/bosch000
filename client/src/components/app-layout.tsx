import { Link, useLocation } from "wouter";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect } from "react";
import {
  Home,
  TrendingUp,
  Users,
  MessageCircle,
  Settings,
  Search,
  Flame,
  ShoppingBag,
  Sparkles,
  User, // Added User icon
  Wallet,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Compass,
  BookOpen,
  HelpCircle,
  Menu,
  X,
  PlusCircle,
  MessageSquare,
  Zap,
  ArrowDownUp,
  Trophy,
  Gift,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";
import { subscribeToPushNotifications } from "@/lib/push-notifications";
import { UserMenu } from "./user-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { socketClient } from "@/lib/socket-client";
import { useCallback } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "./ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { Badge } from "./ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

// Custom SVG icon components
const CompassIcon = ({ className }: { className?: string }) => (
  <svg
    width="19"
    height="19"
    viewBox="0 0 19 19"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M13.5825 0.396566L4.5525 3.39657C-1.5175 5.42657 -1.5175 8.73657 4.5525 10.7566L7.2325 11.6466L8.1225 14.3266C10.1425 20.3966 13.4625 20.3966 15.4825 14.3266L18.4925 5.30657C19.8325 1.25657 17.6325 -0.953434 13.5825 0.396566ZM13.9025 5.77657L10.1025 9.59657C9.9525 9.74657 9.7625 9.81657 9.5725 9.81657C9.3825 9.81657 9.1925 9.74657 9.0425 9.59657C8.7525 9.30657 8.7525 8.82657 9.0425 8.53657L12.8425 4.71657C13.1325 4.42657 13.6125 4.42657 13.9025 4.71657C14.1925 5.00657 14.1925 5.48657 13.9025 5.77657Z"
      fill="currentColor"
    />
  </svg>
);

const UsersIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M9 2C6.38 2 4.25 4.13 4.25 6.75C4.25 9.32 6.26 11.4 8.88 11.49C8.96 11.48 9.04 11.48 9.1 11.49C9.12 11.49 9.13 11.49 9.15 11.49C9.16 11.49 9.16 11.49 9.17 11.49C11.73 11.4 13.74 9.32 13.75 6.75C13.75 4.13 11.62 2 9 2Z"
      fill="currentColor"
    />
    <path
      d="M14.08 14.15C11.29 12.29 6.73996 12.29 3.92996 14.15C2.65996 15 1.95996 16.15 1.95996 17.38C1.95996 18.61 2.65996 19.75 3.91996 20.59C5.31996 21.53 7.15996 22 8.99996 22C10.84 22 12.68 21.53 14.08 20.59C15.34 19.74 16.04 18.6 16.04 17.36C16.03 16.13 15.34 14.99 14.08 14.15Z"
      fill="currentColor"
    />
    <path
      d="M19.99 7.34C20.15 9.28 18.77 10.98 16.86 11.21C16.85 11.21 16.85 11.21 16.84 11.21H16.81C16.75 11.21 16.69 11.21 16.64 11.23C15.67 11.28 14.78 10.97 14.11 10.4C15.14 9.48 15.73 8.1 15.61 6.6C15.54 5.79 15.26 5.05 14.84 4.42C15.22 4.23 15.66 4.11 16.11 4.07C18.07 3.90 19.82 5.36 19.99 7.34Z"
      fill="currentColor"
    />
    <path
      d="M21.99 16.59C21.91 17.56 21.29 18.4 20.25 18.97C19.25 19.52 17.99 19.78 16.74 19.75C17.46 19.1 17.88 18.29 17.96 17.43C18.06 16.19 17.47 15 16.29 14.05C15.62 13.52 14.84 13.1 13.99 12.79C16.2 12.15 18.98 12.58 20.69 13.96C21.61 14.7 22.08 15.63 21.99 16.59Z"
      fill="currentColor"
    />
  </svg>
);

const SearchIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M23.3183 20.0568L21.0303 17.7688C22.223 15.9675 22.9289 13.8012 22.9289 11.4645C22.9289 5.1359 17.793 0 11.4644 0C5.13588 0 0 5.1359 0 11.4645C0 17.7931 5.13588 22.929 11.4644 22.929C13.8011 22.929 15.9431 22.2231 17.7687 21.0304L20.0567 23.3185C20.5192 23.7809 21.1033 24 21.7119 24C22.3204 24 22.9045 23.7809 23.367 23.3185C24.2189 22.4422 24.2189 20.9817 23.3183 20.0568Z"
      fill="currentColor"
    />
  </svg>
);

const CreateIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M16.19 2H7.81C4.17 2 2 4.17 2 7.81V16.18C2 19.83 4.17 22 7.81 22H16.18C19.82 22 21.99 19.83 21.99 16.19V7.81C22 4.17 19.83 2 16.19 2ZM16 12.75H12.75V16C12.75 16.41 12.41 16.75 12 16.75C11.59 16.75 11.25 16.41 11.25 16V12.75H8C7.59 12.75 7.25 12.41 7.25 12C7.25 11.59 7.59 11.25 8 11.25H11.25V8C11.25 7.59 11.59 7.25 12 7.25C12.41 7.25 12.75 7.59 12.75 8V11.25H16C16.41 11.25 16.75 11.59 16.75 12C16.75 12.41 16.41 12.75 16 12.75Z"
      fill="currentColor"
    />
  </svg>
);

const MessageIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M19.5 8C20.8807 8 22 6.88071 22 5.5C22 4.11929 20.8807 3 19.5 3C18.1193 3 17 4.11929 17 5.5C17 6.88071 18.1193 8 19.5 8Z"
      fill="currentColor"
    />
    <path
      d="M20.72 9.31C20.02 9.53 19.25 9.57 18.45 9.37C17.11 9.02 16.02 7.95 15.65 6.61C15.47 5.96 15.46 5.32 15.57 4.74C15.7 4.1 15.25 3.5 14.61 3.5H7C4 3.5 2 5 2 8.5V15.5C2 19 4 20.5 7 20.5H17C20 20.5 22 19 22 15.5V10.26C22 9.6 21.36 9.1 20.72 9.31ZM15.52 11.15L14.34 12.09C13.68 12.62 12.84 12.88 12 12.88C11.16 12.88 10.31 12.62 9.66 12.09L6.53 9.59C6.21 9.33 6.16 8.85 6.41 8.53C6.67 8.21 7.14 8.15 7.46 8.41L10.59 10.91C11.35 11.52 12.64 11.52 13.4 10.91L14.58 9.97C14.9 9.71 15.38 9.76 15.63 10.09C15.89 10.41 15.84 10.89 15.52 11.15Z"
      fill="currentColor"
    />
  </svg>
);

const FlameIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M12.62 2.21C12.46 2.07 12.24 2 12 2C11.76 2 11.54 2.07 11.38 2.21C11.14 2.42 6 6.9 6 12.5C6 16.64 9.36 20 13.5 20C14.06 20 14.61 19.94 15.13 19.82C14.42 19.28 13.76 18.64 13.18 17.91C12.79 18.01 12.38 18.06 11.96 18.05C9.2 18.05 6.96 15.81 6.96 13.05C6.96 9.43 10.16 6.23 12 4.39C13.84 6.23 17.04 9.43 17.04 13.05C17.04 13.55 16.97 14.03 16.85 14.5C17.63 15.17 18.5 15.71 19.43 16.1C19.8 15.3 20 14.41 20 13.5C20 6.9 14.86 2.42 12.62 2.21Z"
      fill="currentColor"
    />
    <path
      d="M17.5 22C19.9853 22 22 19.9853 22 17.5C22 15.0147 19.9853 13 17.5 13C15.0147 13 13 15.0147 13 17.5C13 19.9853 15.0147 22 17.5 22Z"
      fill="currentColor"
    />
  </svg>
);

const DocsIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M21 7V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V7C3 4 4.5 2 8 2H16C19.5 2 21 4 21 7Z"
      fill="currentColor"
    />
    <path
      d="M14.5 4.5V6.5C14.5 7.6 15.4 8.5 16.5 8.5H18.5"
      fill="currentColor"
    />
    <path
      d="M8 13H12"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 17H16"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FAQIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M12 2C6.49 2 2 6.49 2 12C2 17.51 6.49 22 12 22C17.51 22 22 17.51 22 12C22 6.49 17.51 2 12 2ZM11.25 8C11.25 7.59 11.59 7.25 12 7.25C12.96 7.25 13.75 8.04 13.75 9C13.75 9.64 13.42 10.22 12.89 10.54C12.48 10.79 12.25 11.24 12.25 11.71V12C12.25 12.41 11.91 12.75 11.5 12.75C11.09 12.75 10.75 12.41 10.75 12V11.71C10.75 10.71 11.29 9.79 12.17 9.29C12.41 9.15 12.25 9.08 12.25 9C12.25 8.86 12.14 8.75 12 8.75C11.59 8.75 11.25 8.41 11.25 8ZM12.92 16.38C12.87 16.51 12.8 16.61 12.71 16.71C12.61 16.8 12.51 16.87 12.38 16.92C12.26 16.97 12.13 17 12 17C11.87 17 11.74 16.97 11.62 16.92C11.49 16.87 11.39 16.8 11.29 16.71C11.2 16.61 11.13 16.51 11.08 16.38C11.03 16.26 11 16.13 11 16C11 15.87 11.03 15.74 11.08 15.62C11.13 15.49 11.2 15.39 11.29 15.29C11.39 15.2 11.49 15.13 11.62 15.08C11.86 14.98 12.14 14.98 12.38 15.08C12.51 15.13 12.61 15.2 12.71 15.29C12.8 15.39 12.87 15.49 12.92 15.62C12.97 15.74 13 15.87 13 16C13 16.13 12.97 16.26 12.92 16.38Z"
      fill="currentColor"
    />
  </svg>
);

const publicNavigationItems = [
  {
    icon: CompassIcon,
    label: "Explore",
    path: "/",
  },
  {
    icon: UsersIcon,
    label: "Creators",
    path: "/creators",
  },
  {
    icon: Trophy,
    label: "Leaderboard",
    path: "/leaderboard",
  },
  {
    icon: CreateIcon,
    label: "Create",
    path: "/create",
  },
  {
    icon: Gift,
    label: "Fan Missions",
    path: "/fans-missions",
  },
  {
    icon: ArrowDownUp,
    label: "Swap",
    path: "/swap",
  },
];

const authenticatedNavigationItems = [
  {
    icon: CompassIcon,
    label: "Explore",
    path: "/",
  },
  {
    icon: UsersIcon,
    label: "Creators",
    path: "/creators",
  },
  {
    icon: Trophy,
    label: "Leaderboard",
    path: "/leaderboard",
  },
  {
    icon: MessageIcon,
    label: "Inbox",
    path: "/inbox",
    showBadge: true, // Enable badge for inbox
  },
  {
    icon: CreateIcon,
    label: "Create",
    path: "/create",
  },
  {
    icon: Gift,
    label: "Fan Missions",
    path: "/fans-missions",
  },
  {
    icon: ArrowDownUp,
    label: "Swap",
    path: "/swap",
  },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation(); // Added setLocation
  const { authenticated, user, logout, login, getAccessToken } = usePrivy();
  const { toast } = useToast();
  const isAdminRoute = location.startsWith("/admin");
  const navigationItems = authenticated
    ? authenticatedNavigationItems
    : publicNavigationItems;
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const referralStorageKey = "every1_referral_code";
  const appliedReferralPrefix = "every1_referral_applied_";
  const [hasSyncedUser, setHasSyncedUser] = useState(false);
  const getNavTourTag = (path: string) => {
    if (path === "/create") return "nav-create";
    if (path === "/swap") return "nav-swap";
    if (path === "/fans-missions") return "nav-missions";
    if (path === "/leaderboard") return "nav-leaderboard";
    return undefined;
  };
  const { data: walletLedger } = useQuery({
    queryKey: ["/api/ledger/naira", user?.id],
    enabled: authenticated,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const headers: Record<string, string> = {};
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const response = await fetch("/api/ledger/naira", {
        credentials: "include",
        headers,
      });
      if (!response.ok) {
        throw new Error("Failed to fetch wallet balance");
      }
      return response.json();
    },
  });

  // Fetch coins count
  const { data: coinsData } = useQuery({
    queryKey: ["/api/zora/coins/top-volume"],
  });

  // Fetch creators count
  const { data: creatorsData } = useQuery({
    queryKey: ["/api/creators"],
  });

  // Fetch creator profile for mobile footer avatar
  const privyId = user?.id;
  const { data: creatorData } = useQuery({
    queryKey: ['/api/creators/privy', privyId],
    enabled: !!privyId && authenticated,
  });

  const coinsCount = (coinsData as any)?.coins?.length || 0;
  const creatorsCount = (creatorsData as any)?.length || 0;

  // Ensure user/creator records exist on first login (welcome notification depends on this)
  useEffect(() => {
    if (!authenticated || !user?.id || hasSyncedUser) return;

    const syncUser = async () => {
      try {
        const accessToken = await getAccessToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }

        await fetch("/api/creators/sync", {
          method: "POST",
          headers,
          body: JSON.stringify({
            privyId: user.id,
            address: user.wallet?.address || null,
            email: user.email?.address || null,
          }),
        });
      } catch (error) {
        console.warn("[AppLayout] Failed to sync user on login:", error);
      } finally {
        setHasSyncedUser(true);
      }
    };

    syncUser();
  }, [authenticated, user, getAccessToken, hasSyncedUser]);

  const applyReferralCode = useCallback(
    async (
      code: string,
      options?: { showToast?: boolean; source?: "auto" | "manual" },
    ) => {
      if (!authenticated || !user?.id) return false;
      const trimmed = code.trim();
      if (!trimmed) {
        return false;
      }

      const appliedKey = `${appliedReferralPrefix}${user.id}`;
      if (localStorage.getItem(appliedKey)) {
        if (options?.showToast !== false) {
          toast({
            title: "Referral already applied",
            description: "Your account already has a referral linked.",
          });
        }
        return true;
      }

      try {
        const accessToken = await getAccessToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }

        await fetch("/api/creators/sync", {
          method: "POST",
          headers,
          body: JSON.stringify({
            privyId: user.id,
            address: user.wallet?.address || null,
            email: user.email?.address || null,
          }),
        });

        const response = await fetch("/api/referrals/apply", {
          method: "POST",
          headers,
          body: JSON.stringify({
            referralCode: trimmed,
            referredPrivyId: user.id,
            referredAddress: user.wallet?.address || undefined,
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const errorMessage = data?.error || "Failed to apply referral";
          if (
            options?.source === "auto" &&
            (errorMessage.includes("already exists") ||
              errorMessage.includes("Cannot refer yourself") ||
              errorMessage.includes("Invalid referral code"))
          ) {
            localStorage.setItem(appliedKey, "true");
            localStorage.removeItem(referralStorageKey);
          }
          if (options?.showToast !== false) {
            toast({
              title: "Referral not applied",
              description: errorMessage,
              variant: "destructive",
            });
          }
          return false;
        }

        localStorage.setItem(appliedKey, "true");
        localStorage.removeItem(referralStorageKey);
        if (options?.showToast !== false) {
          toast({
            title: "Referral applied",
            description: "Rewards are now active on your account!",
          });
        }
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to apply referral code.";
        if (options?.showToast !== false) {
          toast({
            title: "Referral not applied",
            description: message,
            variant: "destructive",
          });
        }
        return false;
      }
    },
    [authenticated, user, getAccessToken, toast],
  );

  // Fetch unread message count
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
        cache: 'no-store'
      });
      if (response.ok) {
        const data = await response.json();
        console.log('[AppLayout] Unread message count:', data.count);
        setUnreadMessageCount(data.count || 0);
      }
    } catch (error) {
      console.error("[AppLayout] Failed to fetch unread message count:", error);
    }
  }, [authenticated, user, getAccessToken]);

  // Socket.IO integration for real-time unread message count
  useEffect(() => {
    if (!authenticated || !user) {
      setUnreadMessageCount(0);
      return;
    }

    // Fetch initial unread count
    fetchUnreadMessages();

    // Connect to Socket.IO
    const userId = user.wallet?.address || user.id;
    socketClient.connect(userId);

    // Listen for new messages to refresh count
    const handleNewMessage = () => {
      fetchUnreadMessages();
    };

    // Listen for conversation updates to refresh count
    const handleConversationUpdated = () => {
      fetchUnreadMessages();
    };

    socketClient.on('new_message', handleNewMessage);
    socketClient.on('conversation_updated', handleConversationUpdated);

    // Refresh count periodically
    const interval = setInterval(fetchUnreadMessages, 30000); // Every 30 seconds

    return () => {
      socketClient.off('new_message', handleNewMessage);
      socketClient.off('conversation_updated', handleConversationUpdated);
      clearInterval(interval);
    };
  }, [authenticated, user, fetchUnreadMessages]);

  // Capture referral code from URL and persist for post-login apply
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get("ref");
    if (!refCode) return;

    try {
      localStorage.setItem(referralStorageKey, refCode.trim());
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("ref");
      window.history.replaceState({}, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
    } catch (error) {
      console.warn("[Referral] Failed to persist referral code:", error);
    }
  }, []);

  // Apply referral after authentication
  useEffect(() => {
    if (!authenticated || !user?.id) return;

    const pendingRef = localStorage.getItem(referralStorageKey);
    if (!pendingRef) return;

    const appliedKey = `${appliedReferralPrefix}${user.id}`;
    if (localStorage.getItem(appliedKey)) return;

    applyReferralCode(pendingRef, { source: "auto" });
  }, [authenticated, user, applyReferralCode]);

  // Trigger daily E1XP reminder notification once per day on login
  useEffect(() => {
    if (!authenticated || !user?.id) return;

    const todayKey = new Date().toISOString().split("T")[0];
    const reminderKey = `every1_streak_reminder_${user.id}_${todayKey}`;
    if (localStorage.getItem(reminderKey)) return;

    const checkUnclaimed = async () => {
      try {
        const response = await fetch("/api/login-streak/check-unclaimed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: user.wallet?.address || null,
            privyId: user.id,
          }),
        });
        if (response.ok) {
          const data = await response.json().catch(() => null);
          if (data?.hasUnclaimed) {
            toast({
              title: "Daily points ready",
              description:
                data.isFirstTime
                  ? "You’ve got a welcome bonus waiting. Tap E1XP to claim."
                  : `Claim ${data.pointsAvailable || 10} E1XP to keep your streak alive.`,
              duration: 3500,
            });
          }
        }
      } catch (error) {
        console.warn("[Streak Reminder] Failed to check unclaimed points:", error);
      } finally {
        localStorage.setItem(reminderKey, "true");
      }
    };

    checkUnclaimed();
  }, [authenticated, user]);


  // Always sync creator profile after login to ensure user records exist
  useEffect(() => {
    if (!authenticated || !user?.id) return;
    const syncKey = `every1_creator_sync_${user.id}`;
    if (sessionStorage.getItem(syncKey)) return;

    const syncProfile = async () => {
      try {
        const accessToken = await getAccessToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }
        await fetch("/api/creators/sync", {
          method: "POST",
          headers,
          body: JSON.stringify({
            privyId: user.id,
            address: user.wallet?.address || null,
            email: user.email?.address || null,
          }),
        });
        sessionStorage.setItem(syncKey, "true");
      } catch (error) {
        console.warn("[Creator Sync] Failed to sync on login:", error);
      }
    };

    syncProfile();
  }, [authenticated, user, getAccessToken]);

  // One-time E1XP points sync on login (per session)
  useEffect(() => {
    if (!authenticated || !user?.id) return;
    const syncKey = `every1_points_sync_${user.id}`;
    if (sessionStorage.getItem(syncKey)) return;

    const syncPoints = async () => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) return;
        await fetch("/api/e1xp/sync-points", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
      } catch (error) {
        console.warn("[E1XP Sync] Failed to sync points on login:", error);
      } finally {
        sessionStorage.setItem(syncKey, "true");
      }
    };

    syncPoints();
  }, [authenticated, user, getAccessToken]);

  // One-time push subscription on login (per session)
  useEffect(() => {
    if (!authenticated || !user?.id) return;
    const pushKey = `every1_push_subscribe_${user.id}`;
    if (sessionStorage.getItem(pushKey)) return;

    const subscribe = async () => {
      try {
        const identifier = user.wallet?.address || user.id;
        if (!identifier) return;
        const subscription = await subscribeToPushNotifications(identifier);
        if (subscription) {
          toast({
            title: "Notifications enabled",
            description: "You’ll get real-time updates for trades, milestones, and messages.",
            duration: 3000,
          });
        }
      } catch (error) {
        console.warn("[Push] Failed to auto-subscribe:", error);
      } finally {
        sessionStorage.setItem(pushKey, "true");
      }
    };

    subscribe();
  }, [authenticated, user]);


  const handleLogin = () => {
    try {
      login();
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  // Get badge count for menu items
  const getMenuBadgeCount = (path: string) => {
    if (path === "/") return coinsCount;
    if (path === "/creators") return creatorsCount;
    if (path === "/inbox") return unreadMessageCount;
    return null;
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background pb-16 md:pb-0">
        {/* Sidebar - Hidden on mobile */}
        {!isAdminRoute && (
          <Sidebar
            collapsible="icon"
            className="border-r border-transparent hidden md:flex"
          >
            <SidebarHeader className="border-b border-border p-4">
              <div className="flex items-center justify-between gap-3 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-2">
                <Link href="/" className="flex items-center gap-3 group-data-[collapsible=icon]:gap-0">
                  <img
                    src="https://i.ibb.co/JRQCPsZK/ev122logo-1-1.png"
                    alt="Every1"
                    className="h-8 w-8 object-contain shrink-0 group-data-[collapsible=icon]:h-7 group-data-[collapsible=icon]:w-7"
                  />
                </Link>
                <SidebarTrigger className="h-8 w-8 group-data-[collapsible=icon]:h-7 group-data-[collapsible=icon]:w-7" />
              </div>
            </SidebarHeader>

            <SidebarContent className="p-2">
              {/* General Section */}
              <div className="mb-6">
                <SidebarGroup>
                  <SidebarGroupLabel>General</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {navigationItems.map((item) => {
                        const isActive = location === item.path;
                        const badgeCount = getMenuBadgeCount(item.path);
                        return (
                          <SidebarMenuItem key={item.path}>
                            <SidebarMenuButton
                              asChild
                              isActive={isActive}
                              tooltip={item.label}
                              className="h-10 relative"
                            >
                              <Link href={item.path} data-tour={getNavTourTag(item.path)}>
                                <item.icon className="h-4 w-4 shrink-0" />
                                <span className="group-data-[collapsible=icon]:hidden">
                                  {item.label}
                                </span>
                                {badgeCount && badgeCount > 0 && (
                                  <>
                                    {/* Badge when sidebar is expanded */}
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 bg-destructive text-destructive-foreground rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center text-[10px] font-bold group-data-[collapsible=icon]:hidden">
                                      {badgeCount > 99 ? "99+" : badgeCount}
                                    </span>
                                    {/* Badge when sidebar is collapsed (icon mode) */}
                                    <span className="hidden group-data-[collapsible=icon]:flex absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-full h-3 min-w-3 px-0.5 items-center justify-center text-[8px] font-bold leading-none z-10">
                                      {badgeCount > 9 ? "9+" : badgeCount}
                                    </span>
                                  </>
                                )}
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </div>

              {/* Resources Section */}
              <SidebarGroup>
                <SidebarGroupLabel>Resources</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild tooltip="Showcase" className="h-10">
                        <Link href="/showcase">
                          <BookOpen className="h-4 w-4 shrink-0" />
                          <span className="group-data-[collapsible=icon]:hidden">
                            Showcase
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild tooltip="About" className="h-10">
                        <Link href="/about">
                          <DocsIcon className="h-4 w-4 shrink-0" />
                          <span className="group-data-[collapsible=icon]:hidden">
                            About
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild tooltip="FAQ" className="h-10">
                        <Link href="/faq">
                          <FAQIcon className="h-4 w-4 shrink-0" />
                          <span className="group-data-[collapsible=icon]:hidden">
                            FAQ
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t border-border p-2">
              <div className="flex items-center gap-2 px-2 group-data-[collapsible=icon]:justify-center">
                <ThemeToggle />
              </div>
            </SidebarFooter>
          </Sidebar>
        )}

        {/* Main Content Area */}
        <SidebarInset className="flex flex-col w-full">
          {/* Top Navigation - Desktop (hidden on admin routes) */}
          {!isAdminRoute && (
            <header className="sticky top-0 z-50 border-b border-transparent bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <div className="flex h-16 items-center justify-between px-4 w-full gap-4">
                {/* Mobile Logo */}
                <Link href="/" className="flex md:hidden items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <h1 className="text-sm font-bold tracking-tight">
                      Every1
                    </h1>
                  </div>
                </Link>

                {/* Stats Buttons - Centered */}
                <div className="hidden lg:flex items-center gap-2 flex-1 justify-center max-w-5xl mx-auto">
                  <Link href="/search" className="hidden lg:flex" data-testid="button-desktop-searchbar">
                    <div className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 h-9 min-w-[240px]">
                      <SearchIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Search creators or coins</span>
                    </div>
                  </Link>
                  <Button variant="outline" size="sm" className="h-9">
                    <TrendingUp className="h-4 w-4 mr-1.5 text-green-500" />
                    <span className="text-xs font-semibold">MC: ₦2.5M</span>
                  </Button>
                  <Button variant="outline" size="sm" className="h-9">
                    <Sparkles className="h-4 w-4 mr-1.5 text-primary" />
                    <span className="text-xs font-semibold">Coins: 1,2k</span>
                  </Button>
                </div>

                {/* Right Section */}
                <div className="flex items-center gap-3">
                  {/* Search icon - desktop only */}
                  <Link href="/search" className="hidden md:flex lg:hidden" data-testid="button-desktop-search">
                    <Button variant="ghost" size="icon">
                      <SearchIcon className="h-5 w-5" />
                    </Button>
                  </Link>
                  {authenticated && (
                    <Link href="/wallet" className="hidden md:flex">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-full"
                        data-testid="button-wallet-balance"
                      >
                        ₦{Number(walletLedger?.availableNgn || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                      </Button>
                    </Link>
                  )}
                  <ThemeToggle />
                  <NotificationBell />
                  {authenticated ? (
                    <>
                      <UserMenu />
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={handleLogin}
                        variant="default"
                        size="sm"
                        className="hidden md:flex bg-gradient-to-r from-purple-400 via-pink-400 to-blue-300 text-black font-semibold rounded-lg border-0 hover:opacity-90"
                        data-testid="button-login"
                      >
                        Signin
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </header>
          )}

          {/* Mobile Header */}
          <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-transparent">
            <div className="flex items-center justify-between h-14 px-4">
              <Link href="/">
                <img src="https://i.ibb.co/JRQCPsZK/ev122logo-1-1.png" alt="E1" className="h-8 w-auto" />
              </Link>
              <div className="flex items-center gap-2">
                {authenticated ? (
                  <>
                    <Link href="/search">
                      <Button variant="ghost" size="icon" data-testid="button-mobile-search">
                        <SearchIcon className="h-5 w-5" />
                      </Button>
                    </Link>
                    <Link href="/inbox">
                      <Button variant="ghost" size="icon" className="relative">
                        <MessageIcon className="h-5 w-5" />
                        {unreadMessageCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground rounded-full h-4 min-w-4 px-1 flex items-center justify-center text-[10px] font-bold">
                            {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
                          </span>
                        )}
                      </Button>
                    </Link>
                    <NotificationBell />
                    <ThemeToggle />
                    {authenticated && (
                      <Link href="/wallet">
                        <Button variant="outline" size="sm" className="h-8 rounded-full px-3">
                          ₦{Number(walletLedger?.availableNgn || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </Button>
                      </Link>
                    )}
                    <UserMenu />
                  </>
                ) : (
                  <>
                    <Link href="/search">
                      <Button variant="ghost" size="icon" data-testid="button-mobile-search-guest">
                        <SearchIcon className="h-5 w-5" />
                      </Button>
                    </Link>
                    <ThemeToggle />
                    <Button
                      onClick={handleLogin}
                      variant="default"
                      size="sm"
                      className="bg-gradient-to-r from-purple-200 via-pink-400 to-blue-300 text-black font-semibold border-0 rounded-lg hover:opacity-90"
                      data-testid="button-mobile-login"
                    >
                      Signin
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

        {/* Page Content */}
          <main className="flex-1 overflow-auto">{children}</main>

        </SidebarInset>

        {/* Mobile Bottom Navigation - Compact design */}
        {!isAdminRoute && (
          <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
            <div className="bg-card/95 backdrop-blur-xl border-t border-transparent">
              <div className="flex items-center justify-around h-16 px-1">
                <Link href="/">
                  <div
                    className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-all relative ${
                      location === "/"
                        ? "text-primary"
                        : "text-muted-foreground active:opacity-70"
                    }`}
                  >
                    <div className="relative">
                      <CompassIcon className="h-5 w-5" />
                      {coinsCount > 0 && (
                        <div className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-4 min-w-4 px-1 flex items-center justify-center text-[8px] font-bold">
                          {coinsCount > 99 ? "99+" : coinsCount}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-medium">Explore</span>
                  </div>
                </Link>

                <Link href="/swap">
                  <div
                    data-tour="nav-swap"
                    className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-all ${
                      location === "/swap"
                        ? "text-primary"
                        : "text-muted-foreground active:opacity-70"
                    }`}
                  >
                    <ArrowDownUp className="h-5 w-5" />
                    <span className="text-[10px] font-medium">Swap</span>
                  </div>
                </Link>

                <Link href="/create" data-testid="link-create-mobile">
                  <div
                    data-tour="nav-create"
                    className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-all ${
                      location === "/create"
                        ? "text-primary"
                        : "text-muted-foreground active:opacity-70"
                    }`}
                  >
                    <CreateIcon className="h-5 w-5" />
                    <span className="text-[10px] font-medium">Create</span>
                  </div>
                </Link>

                <Link href="/creators">
                  <div
                    className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-all relative ${
                      location === "/creators"
                        ? "text-primary"
                        : "text-muted-foreground active:opacity-70"
                    }`}
                  >
                    <div className="relative">
                      <UsersIcon className="h-5 w-5" />
                      {creatorsCount > 0 && (
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full h-4 min-w-4 px-1 flex items-center justify-center text-[8px] font-bold">
                          {creatorsCount > 99 ? "99+" : creatorsCount}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-medium">Creators</span>
                  </div>
                </Link>

                <Link href="/profile">
                  <div
                    className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-all ${
                      location === "/profile"
                        ? "text-primary"
                        : "text-muted-foreground active:opacity-70"
                    }`}
                  >
                    {authenticated && (creatorData as any)?.avatar ? (
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={(creatorData as any).avatar} alt="Profile" />
                        <AvatarFallback className="bg-gradient-to-br from-purple-400 to-pink-400">
                          <User className="h-3 w-3 text-white" />
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <img 
                        src="https://i.ibb.co/JRQCPsZK/ev122logo-1-1.png" 
                        alt="Profile" 
                        className="h-5 w-5 rounded-full object-cover"
                      />
                    )}
                    <span className="text-[10px] font-medium">Profile</span>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarProvider>
  );
}
