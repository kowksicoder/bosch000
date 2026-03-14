import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, DollarSign, TrendingUp, Users, Coins, Activity, BarChart3, BellRing, Settings, Wallet, EyeOff, Eye, Menu, Plus, Search, Gift, LineChart, Pin, PinOff, LogOut, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatSmartCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NotificationTestingPanel } from "@/components/notification-testing-panel";
import { AdminMessagingPanel } from "@/components/admin-messaging-panel";
import { AdminMessageComposer } from "@/components/admin-message-composer";
import { AdminBlogPanel } from "@/components/admin-blog-panel";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminNetwork from "./admin-network";
import AdminCreate from "./admin-create";
import { useLocation } from 'wouter';

const PLATFORM_FEE_ADDRESS = "0xf25af781c4F1Df40Ac1D06e6B80c17815AD311F7";

export default function Admin() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('overview');
  const [notifType, setNotifType] = useState("points_earned");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [targetAddress, setTargetAddress] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  // Check admin session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/admin/session', {
          credentials: 'include',
        });
        const data = await response.json();

        if (!data.authenticated) {
          toast({
            title: "Authentication Required",
            description: "Please log in to access the admin panel",
            variant: "destructive",
          });
          setLocation('/admin-login');
        }
      } catch (error) {
        console.error('Session check failed:', error);
        setLocation('/admin-login');
      }
    };

    checkSession();
  }, [setLocation, toast]);

  const { data: stats, isLoading: isLoadingStats } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: creators = [], isLoading: isLoadingCreators, refetch: refetchCreators } = useQuery<any[]>({
    queryKey: ["/api/creators"],
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  const { data: users = [], isLoading: isLoadingUsersTable, refetch: refetchUsers } = useQuery<any[]>({
    queryKey: ["/api/users"],
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  const { data: coins = [], isLoading: isLoadingCoins } = useQuery<any[]>({
    queryKey: ["/api/coins"],
  });

  const { data: userRewards = { users: [] }, isLoading: isLoadingRewards } = useQuery<any>({
    queryKey: ["/api/admin/user-rewards"],
    enabled: activeTab === 'tracking',
  });

  const { data: feesTracking, isLoading: isLoadingFees } = useQuery<any>({
    queryKey: ["/api/admin/fees-tracking"],
    enabled: activeTab === 'tracking',
  });

  const { data: missions = [], isLoading: isLoadingMissions, refetch: refetchMissions } = useQuery<any[]>({
    queryKey: ["/api/admin/missions"],
    enabled: activeTab === 'missions',
  });

  const { data: pendingMissionFulfillments = [], isLoading: isLoadingPendingFulfillments, refetch: refetchPendingFulfillments } = useQuery<any[]>({
    queryKey: ["/api/admin/missions/pending-fulfillment"],
    enabled: activeTab === 'missions',
  });

  const missionSummary = useMemo(() => {
    const totalMissions = missions.length;
    const activeMissions = missions.filter((mission) => (mission.status || mission.missionStatus) === 'active').length;
    const totalCompletions = missions.reduce((sum, mission) => sum + (mission.completions || 0), 0);
    const totalPayouts = missions.reduce((sum, mission) => sum + (mission.rewardPayouts || 0), 0);
    return { totalMissions, activeMissions, totalCompletions, totalPayouts };
  }, [missions]);

  const { data: reconciliation, isLoading: isLoadingReconciliation } = useQuery<any>({
    queryKey: ["/api/admin/reconciliation"],
    enabled: activeTab === 'reconciliation',
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async (data: { type: string; title: string; message: string; address: string }) => {
      const response = await apiRequest("POST", "/api/notifications/send-test", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Test Notification Sent",
        description: "Notification has been sent successfully",
      });
      setNotifTitle("");
      setNotifMessage("");
      setTargetAddress("");
    },
    onError: (error: Error) => {
      toast({
        title: "Send Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const closeMissionMutation = useMutation({
    mutationFn: async (missionId: string) => {
      const response = await apiRequest("POST", `/api/admin/missions/${missionId}/close`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Mission closed", description: "Mission has been closed." });
      refetchMissions();
    },
    onError: () => {
      toast({ title: "Failed to close mission", variant: "destructive" });
    },
  });

  const approveMissionMutation = useMutation({
    mutationFn: async (missionId: string) => {
      const response = await apiRequest("POST", `/api/admin/missions/${missionId}/approve`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Mission approved", description: "Mission is now active." });
      refetchMissions();
    },
    onError: () => {
      toast({ title: "Failed to approve mission", variant: "destructive" });
    },
  });

  const fulfillMissionMutation = useMutation({
    mutationFn: async (payload: { missionId: string; userId: string; deliveryValue?: string }) => {
      const response = await apiRequest(
        "POST",
        `/api/admin/missions/${payload.missionId}/fulfill`,
        { userId: payload.userId, deliveryValue: payload.deliveryValue },
      );
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Reward delivered", description: "User has been notified." });
      refetchPendingFulfillments();
    },
    onError: () => {
      toast({ title: "Delivery failed", variant: "destructive" });
    },
  });

  const hideCoinMutation = useMutation({
    mutationFn: async (coinAddress: string) => {
      const response = await apiRequest("POST", `/api/admin/hide-coin/${coinAddress}`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Coin Hidden",
        description: "The coin has been hidden from the frontend",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/coins"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Action Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const showCoinMutation = useMutation({
    mutationFn: async (coinAddress: string) => {
      const response = await apiRequest("POST", `/api/admin/show-coin/${coinAddress}`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Coin Shown",
        description: "The coin is now visible on the frontend",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/coins"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Action Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncPointsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/points/sync", {});
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Points synced",
        description: `Updated ${data?.updated ?? 0} creator records.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendNotification = () => {
    if (!notifTitle || !notifMessage) {
      toast({
        title: "Missing Fields",
        description: "Please fill in title and message",
        variant: "destructive",
      });
      return;
    }

    sendNotificationMutation.mutate({
      type: notifType,
      title: notifTitle,
      message: notifMessage,
      address: targetAddress || "all",
    });
  };

  const menuItems = [
    { id: 'overview', icon: BarChart3, label: 'Dashboard' },
    { id: 'earnings', icon: DollarSign, label: 'Earnings' },
    { id: 'users', icon: Users, label: 'Creators' },
    { id: 'coins', icon: Coins, label: 'Coins' },
    { id: 'create', icon: Plus, label: 'Create' },
    { id: 'blog', icon: BookOpen, label: 'Blog' },
    { id: 'rewards', icon: Gift, label: 'Rewards' },
    { id: 'tracking', icon: LineChart, label: 'Tracking' },
    { id: 'reconciliation', icon: Wallet, label: 'Reconciliation' },
    { id: 'network', icon: Activity, label: 'Network' },
    { id: 'notifications', icon: BellRing, label: 'Notifications' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  const activeCoins = coins.filter((c: any) => c.status === 'active').length;
  const pendingCoins = coins.filter((c: any) => c.status === 'pending').length;
  const hiddenCoins = coins.filter((c: any) => c.hidden === true).length;

  const handleLogout = async () => {
    try {
      await apiRequest('POST', '/api/admin/logout', {});
      toast({ title: 'Logged out', description: 'You have been logged out successfully' });
      setLocation('/admin-login');
    } catch (err: any) {
      toast({ title: 'Logout failed', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold">Admin Panel</h1>
            <p className="text-xs text-muted-foreground">Creatorland</p>
          </div>
        </div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="p-4 border-b">
              <SheetTitle className="text-sm font-semibold">Navigation</SheetTitle>
            </div>
            <div className="p-2">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1",
                    activeTab === item.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 flex-col border-r border-border bg-card">
        {/* Sidebar Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-semibold">Admin Panel</h1>
              <p className="text-xs text-muted-foreground">Creatorland</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 p-3">
          <div className="mb-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Main
          </div>
          <div className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  activeTab === item.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                data-testid={`button-tab-${item.id}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-border">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
            Log out
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="hidden md:flex h-16 items-center justify-between px-6 border-b border-border bg-card">
          <div>
            <h2 className="text-lg font-semibold">
              {menuItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
            </h2>
            <p className="text-sm text-muted-foreground">Welcome back to your admin dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-9 w-64 h-9 bg-background"
              />
            </div>
            <Button
              size="sm"
              variant="destructive"
              className="gap-2"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              Log out
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 mt-16 md:mt-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-12">
              <TabsTrigger value="overview">Dashboard</TabsTrigger>
              <TabsTrigger value="earnings">Earnings</TabsTrigger>
              <TabsTrigger value="users">Creators</TabsTrigger>
              <TabsTrigger value="coins">Coins</TabsTrigger>
              <TabsTrigger value="create">Create</TabsTrigger>
              <TabsTrigger value="blog">Blog</TabsTrigger>
              <TabsTrigger value="rewards">Rewards</TabsTrigger>
              <TabsTrigger value="missions">Missions</TabsTrigger>
              <TabsTrigger value="tracking">Tracking</TabsTrigger>
              <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6 space-y-6 max-w-7xl">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-blue-500">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                        <h3 className="text-2xl font-bold mt-2">
                          {isLoadingUsersTable || isLoadingCreators ? '...' : users.length + creators.length}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {isLoadingUsersTable || isLoadingCreators ? '...' : `${users.length} active + ${creators.length} legacy`}
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <Users className="w-6 h-6 text-blue-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Coins</p>
                        <h3 className="text-2xl font-bold mt-2">
                          {isLoadingCoins ? '...' : coins.length}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">Across all creators</p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                        <Coins className="w-6 h-6 text-green-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-purple-500">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Active Coins</p>
                        <h3 className="text-2xl font-bold mt-2">{activeCoins}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{pendingCoins} pending</p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                        <Activity className="w-6 h-6 text-purple-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-yellow-500">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">24h Volume</p>
                        <h3 className="text-2xl font-bold mt-2">${stats?.totalVolume || '0.00'}</h3>
                        <p className="text-xs text-muted-foreground mt-1">Total trading</p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-yellow-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Platform Config */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">Platform Configuration</CardTitle>
                        <CardDescription>System settings and addresses</CardDescription>
                      </div>
                      <Settings className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">Platform Fee Address</Label>
                        <div className="flex items-center gap-2 mt-2 p-3 bg-muted rounded-lg">
                          <code className="text-xs font-mono flex-1 truncate">
                            {PLATFORM_FEE_ADDRESS}
                          </code>
                          <a
                            href={`https://basescan.org/address/${PLATFORM_FEE_ADDRESS}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80"
                          >
                            <Wallet className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Coin Status</CardTitle>
                    <CardDescription>Distribution overview</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-green-500/5 rounded-lg border border-green-500/20">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Active</p>
                          <p className="text-lg font-bold text-green-600">{activeCoins}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                          <Activity className="w-5 h-5 text-green-600" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-yellow-500/5 rounded-lg border border-yellow-500/20">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Pending</p>
                          <p className="text-lg font-bold text-yellow-600">{pendingCoins}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-yellow-600" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-red-500/5 rounded-lg border border-red-500/20">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Hidden</p>
                          <p className="text-lg font-bold text-red-600">{hiddenCoins}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                          <EyeOff className="w-5 h-5 text-red-600" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="earnings" className="mt-6 space-y-6 max-w-7xl">
              <Card>
                <CardHeader>
                  <CardTitle>Platform Earnings</CardTitle>
                  <CardDescription>Real-time platform revenue and fee tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-3">
                    <div className="p-4 border border-border rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                          <DollarSign className="w-5 h-5 text-green-500" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">Total Earnings</p>
                      </div>
                      <p className="text-3xl font-bold text-green-500">
                        ${stats?.totalEarnings || '0.00'}
                      </p>
                    </div>
                    <div className="p-4 border border-border rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                          <Coins className="w-5 h-5 text-blue-500" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">Platform Fees</p>
                      </div>
                      <p className="text-3xl font-bold text-blue-500">
                        ${stats?.platformFees || '0.00'}
                      </p>
                    </div>
                    <div className="p-4 border border-border rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-purple-500" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">Trade Fees</p>
                      </div>
                      <p className="text-3xl font-bold text-purple-500">
                        ${stats?.tradeFees || '0.00'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tracking" className="mt-6 space-y-6 max-w-7xl">
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Users Tracked</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{userRewards?.users?.length || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">Registered users</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Platform Fees</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{feesTracking?.summary?.totalPlatformFees || '0.0000'}</div>
                    <p className="text-xs text-muted-foreground mt-1">{feesTracking?.summary?.platformFeeCount || 0} transactions</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Trade Fees</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{feesTracking?.summary?.totalTradeFees || '0.0000'}</div>
                    <p className="text-xs text-muted-foreground mt-1">{feesTracking?.summary?.tradeFeeCount || 0} transactions</p>
                  </CardContent>
                </Card>
              </div>

              {/* User Rewards Table */}
              <Card>
                <CardHeader>
                  <CardTitle>User Rewards Breakdown</CardTitle>
                  <CardDescription>E1XP and Zora rewards per user</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingRewards ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : !userRewards?.users || userRewards.users.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>No user rewards data available</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-3">
                        {userRewards.users.map((user: any) => (
                          <div key={user.userId} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{user.username}</p>
                              <p className="text-xs text-muted-foreground font-mono">{user.address.slice(0, 10)}...{user.address.slice(-8)}</p>
                            </div>
                            <div className="flex gap-6 text-right">
                              <div>
                                <p className="text-[10px] text-muted-foreground">Coins</p>
                                <p className="text-xs font-semibold">{user.totalCoins || 0}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">Earnings</p>
                                <p className="text-xs font-semibold text-green-500">
                                  ₦{(parseFloat(user.totalEarnings || '0')).toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">E1XP</p>
                                <p className="font-semibold">{user.e1xpRewards?.total || 0}</p>
                                <p className="text-xs text-muted-foreground">({user.e1xpRewards?.count || 0} rewards)</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Zora</p>
                                <p className="font-semibold">{user.zoraRewards?.total || '0.0000'}</p>
                                <p className="text-xs text-muted-foreground">({user.zoraRewards?.count || 0} rewards)</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Total Points</p>
                                <p className="font-semibold">{user.totalPoints || 0}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Fees by Coin */}
              <Card>
                <CardHeader>
                  <CardTitle>Fees by Coin</CardTitle>
                  <CardDescription>Platform and trade fees breakdown per coin</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingFees ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : !feesTracking?.feesByCoin || feesTracking.feesByCoin.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Coins className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>No fee tracking data available</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3">
                        {feesTracking.feesByCoin.map((coin: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{coin.coinSymbol}</p>
                              <p className="text-xs text-muted-foreground font-mono">{coin.coinAddress?.slice(0, 10)}...{coin.coinAddress?.slice(-8)}</p>
                            </div>
                            <div className="flex gap-6 text-right">
                              <div>
                                <p className="text-xs text-muted-foreground">Platform Fees</p>
                                <p className="font-semibold">{coin.platformFees?.toFixed(4) || '0.0000'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Trade Fees</p>
                                <p className="font-semibold">{coin.tradeFees?.toFixed(4) || '0.0000'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Transactions</p>
                                <p className="font-semibold">{coin.transactionCount || 0}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reconciliation" className="mt-6 space-y-6 max-w-7xl">
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Paystack NGN Balance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingReconciliation ? (
                      <div className="text-sm text-muted-foreground">Loading…</div>
                    ) : (
                      <div className="text-2xl font-bold">
                        {formatSmartCurrency(reconciliation?.paystack?.balanceNgn || 0)}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Ledger Available</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingReconciliation ? (
                      <div className="text-sm text-muted-foreground">Loading…</div>
                    ) : (
                      <div className="text-2xl font-bold">
                        {formatSmartCurrency(reconciliation?.ledger?.availableNgn || 0)}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Ledger Pending</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingReconciliation ? (
                      <div className="text-sm text-muted-foreground">Loading…</div>
                    ) : (
                      <div className="text-2xl font-bold">
                        {formatSmartCurrency(reconciliation?.ledger?.pendingNgn || 0)}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Coverage</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingReconciliation ? (
                      <div className="text-sm text-muted-foreground">Loading…</div>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-2xl font-bold">
                          {formatSmartCurrency(
                            (reconciliation?.paystack?.balanceNgn || 0) -
                              (reconciliation?.ledger?.availableNgn || 0),
                          )}
                        </div>
                        <Badge
                          variant="secondary"
                          className={
                            (reconciliation?.paystack?.balanceNgn || 0) >=
                            (reconciliation?.ledger?.availableNgn || 0)
                              ? "bg-green-500/10 text-green-600"
                              : "bg-red-500/10 text-red-600"
                          }
                        >
                          {(reconciliation?.paystack?.balanceNgn || 0) >=
                          (reconciliation?.ledger?.availableNgn || 0)
                            ? "Healthy"
                            : "Shortfall"}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {pendingMissionFulfillments.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Pending reward fulfillment</CardTitle>
                    <CardDescription>Non‑E1XP rewards awaiting delivery</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingPendingFulfillments ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pendingMissionFulfillments.map((item) => (
                          <div
                            key={`${item.userMissionId}-${item.userId}`}
                            className="border border-border/60 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <p className="text-sm font-semibold">{item.missionTitle}</p>
                              <p className="text-xs text-muted-foreground">
                                Reward: {item.rewardType}
                                {item.rewardValue ? ` • ${item.rewardValue}` : ""}
                              </p>
                              <p className="text-xs text-muted-foreground">User: {item.userId}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full"
                              onClick={() =>
                                fulfillMissionMutation.mutate({
                                  missionId: item.missionId,
                                  userId: item.userId,
                                  deliveryValue: item.rewardValue || undefined,
                                })
                              }
                              disabled={fulfillMissionMutation.isLoading}
                            >
                              Mark delivered
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Recent Ledger Activity</CardTitle>
                  <CardDescription>Latest payout credits and debits</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingReconciliation ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : !reconciliation?.recentEntries?.length ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Wallet className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>No ledger activity yet</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[320px]">
                      <div className="space-y-3">
                        {reconciliation.recentEntries.map((entry: any) => {
                          const status = entry.metadata?.status;
                          return (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between p-4 border rounded-lg"
                            >
                              <div className="flex-1">
                                <p className="text-sm font-medium capitalize">{entry.entry_type}</p>
                                <p className="text-xs text-muted-foreground font-mono">
                                  {entry.recipient_address?.slice(0, 10)}…{entry.recipient_address?.slice(-6)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(entry.created_at).toLocaleString()}
                                </p>
                              </div>
                              <div className="text-right space-y-1">
                                <p className="font-semibold">
                                  {formatSmartCurrency(entry.amount_ngn || 0)}
                                </p>
                                <Badge variant="secondary" className="text-[10px] uppercase">
                                  {entry.source || "ledger"}
                                </Badge>
                                {status && (
                                  <Badge
                                    variant="secondary"
                                    className={
                                      status === "success"
                                        ? "bg-green-500/10 text-green-600"
                                        : status === "failed"
                                          ? "bg-red-500/10 text-red-600"
                                          : "bg-yellow-500/10 text-yellow-700"
                                    }
                                  >
                                    {status}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="mt-6 space-y-6 max-w-7xl">
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                    <CardDescription>All registered users</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{users.length + creators.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">Active + Legacy</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                    <CardDescription>Privy authentication</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{users.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">New system</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Legacy Users</CardTitle>
                    <CardDescription>Old authentication</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{creators.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">May have duplicates</p>
                  </CardContent>
                </Card>
              </div>

              {/* Unified Users Table */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>All Users</CardTitle>
                      <CardDescription>Complete user database (Active + Legacy)</CardDescription>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        refetchUsers();
                        refetchCreators();
                        toast({ title: "Refreshed", description: "User lists updated" });
                      }}
                      data-testid="button-refresh-users"
                    >
                      <Activity className="w-4 h-4 mr-1" />
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px] pr-4">
                    <div className="space-y-2">
                      {isLoadingUsersTable || isLoadingCreators ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <>
                          {/* Active Users First - sorted by date */}
                          {[...users]
                            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                            .map((user: any) => (
                            <div key={`user-${user.id}`} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Avatar className="w-10 h-10 flex-shrink-0">
                                  <AvatarImage src={user.avatarUrl} />
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {(user.displayName || user.username || 'A').charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-medium text-sm truncate">{user.displayName || user.username || 'Anonymous'}</p>
                                    <Badge variant="default" className="text-[10px] bg-green-600">Active</Badge>
                                    {user.isAdmin === 1 && (
                                      <Badge variant="destructive" className="text-[10px]">Admin</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 flex-wrap text-[10px] text-muted-foreground">
                                    <span>@{user.username}</span>
                                    <span className="font-mono">{user.walletAddress?.slice(0, 6)}...{user.walletAddress?.slice(-4)}</span>
                                    <span>📅 {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                                    {user.totalConnections > 0 && <span>👥 {user.totalConnections}</span>}
                                    {user.totalProfileViews > 0 && <span>👁️ {user.totalProfileViews}</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                <div className="text-right mr-2">
                                  <p className="text-[10px] text-muted-foreground">Coins</p>
                                  <p className="text-xs font-semibold">{user.totalCoins || 0}</p>
                                </div>
                                <div className="text-right mr-2">
                                  <p className="text-[10px] text-muted-foreground">Earnings</p>
                                  <p className="text-xs font-semibold text-green-500">
                                    ₦{(parseFloat(user.totalEarnings || '0')).toFixed(2)}
                                  </p>
                                </div>
                                <div className="text-right mr-2">
                                  <p className="text-[10px] text-muted-foreground">E1XP</p>
                                  <p className="text-sm font-semibold">{user.e1xpPoints || 0}</p>
                                </div>
                                {!user.isAdmin && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 px-2 text-xs"
                                      onClick={async () => {
                                        try {
                                          await apiRequest('POST', `/api/admin/hide-creator/${user.walletAddress}`, {});
                                          toast({ title: 'User Hidden', description: `${user.username} has been hidden` });
                                          queryClient.invalidateQueries({ queryKey: ['/api/users'] });
                                        } catch (err: any) {
                                          toast({ title: 'Failed', description: err.message || String(err), variant: 'destructive' });
                                        }
                                      }}
                                    >
                                      Hide
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="h-8 px-2 text-xs"
                                      onClick={async () => {
                                        if (!confirm(`Remove user ${user.username}? This will ban their account.`)) return;
                                        try {
                                          await apiRequest('POST', `/api/admin/remove-creator/${user.walletAddress}`, {});
                                          toast({ title: 'User Removed', description: `${user.username} has been removed` });
                                          queryClient.invalidateQueries({ queryKey: ['/api/users'] });
                                        } catch (err: any) {
                                          toast({ title: 'Failed', description: err.message || String(err), variant: 'destructive' });
                                        }
                                      }}
                                    >
                                      Remove
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}

                          {/* Legacy Creators - sorted by date */}
                          {[...creators]
                            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                            .map((creator: any) => (
                            <div key={`creator-${creator.id}`} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors bg-muted/10">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Avatar className="w-10 h-10 flex-shrink-0">
                                  <AvatarImage src={creator.avatar} />
                                  <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                                    {(creator.name || 'L').charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-medium text-sm truncate">{creator.name || 'No Name'}</p>
                                    <Badge variant="secondary" className="text-[10px]">Legacy</Badge>
                                    {creator.verified === 'true' && (
                                      <Badge variant="default" className="text-[10px]">Verified</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 flex-wrap text-[10px] text-muted-foreground">
                                    <span className="font-mono">{creator.address?.slice(0, 6)}...{creator.address?.slice(-4)}</span>
                                    <span>📅 {new Date(creator.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                                    {creator.totalCoins && parseInt(creator.totalCoins) > 0 && <span>🪙 {creator.totalCoins} coins</span>}
                                    {creator.privyId && <span>🔗 Privy</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                <div className="text-right mr-2">
                                  <p className="text-[10px] text-muted-foreground">Coins</p>
                                  <p className="text-xs font-semibold">{creator.totalCoins || 0}</p>
                                </div>
                                <div className="text-right mr-2">
                                  <p className="text-[10px] text-muted-foreground">Earnings</p>
                                  <p className="text-xs font-semibold text-green-500">
                                    ₦{(parseFloat(creator.totalEarnings || '0')).toFixed(2)}
                                  </p>
                                </div>
                                <div className="text-right mr-2">
                                  <p className="text-[10px] text-muted-foreground">Points</p>
                                  <p className="text-sm font-semibold">{creator.points || 0}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2 text-xs"
                                  onClick={async () => {
                                    try {
                                      await apiRequest('POST', `/api/admin/hide-creator/${creator.address}`, {});
                                      toast({ title: 'Creator Hidden', description: `${creator.name || creator.address} has been hidden` });
                                      queryClient.invalidateQueries({ queryKey: ['/api/creators'] });
                                    } catch (err: any) {
                                      toast({ title: 'Failed', description: err.message || String(err), variant: 'destructive' });
                                    }
                                  }}
                                >
                                  Hide
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-8 px-2 text-xs"
                                  onClick={async () => {
                                    if (!confirm(`Remove creator ${creator.name || creator.address}? This will ban their account.`)) return;
                                    try {
                                      await apiRequest('POST', `/api/admin/remove-creator/${creator.address}`, {});
                                      toast({ title: 'Creator Removed', description: `${creator.name || creator.address} has been removed` });
                                      queryClient.invalidateQueries({ queryKey: ['/api/creators'] });
                                    } catch (err: any) {
                                      toast({ title: 'Failed', description: err.message || String(err), variant: 'destructive' });
                                    }
                                  }}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ))}

                          {users.length === 0 && creators.length === 0 && (
                            <div className="text-center py-12 text-muted-foreground">
                              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                              <p>No users found</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="coins" className="mt-6 space-y-6 max-w-7xl">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Coin Management</CardTitle>
                      <CardDescription>Manage coin visibility and status</CardDescription>
                    </div>
                    <Button size="sm" className="gap-2">
                      <Plus className="w-4 h-4" />
                      Add Coin
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-3">
                      {isLoadingCoins ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : coins.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <Coins className="w-12 h-12 mx-auto mb-3 opacity-20" />
                          <p>No coins found</p>
                        </div>
                      ) : (
                        coins.map((coin: any) => (
                          <div key={coin.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border">
                                {coin.image ? (
                                  <img src={coin.image} alt={coin.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Coins className="w-5 h-5 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm">{coin.name}</p>
                                  <p className="text-xs text-muted-foreground font-mono">${coin.symbol}</p>
                                </div>
                                {coin.address && (
                                  <p className="text-[10px] text-muted-foreground font-mono">
                                    📍 {coin.address.slice(0, 10)}...{coin.address.slice(-8)}
                                  </p>
                                )}
                                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                  <p className="text-[10px] text-muted-foreground">
                                    📅 Created: {new Date(coin.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(coin.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                  </p>
                                  {coin.registeredAt && (
                                    <p className="text-[10px] text-muted-foreground">
                                      ⛓️ Registered: {new Date(coin.registeredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(coin.registeredAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                    </p>
                                  )}
                                  {coin.creatorWallet && (
                                    <p className="text-[10px] text-muted-foreground font-mono">
                                      👤 Creator: {coin.creatorWallet.slice(0, 6)}...{coin.creatorWallet.slice(-4)}
                                    </p>
                                  )}
                                  {coin.chainId && (
                                    <p className="text-[10px] text-muted-foreground">
                                      🔗 Chain ID: {coin.chainId}
                                    </p>
                                  )}
                                  {coin.registryTxHash && (
                                    <p className="text-[10px] text-muted-foreground font-mono">
                                      📜 Registry Tx: {coin.registryTxHash.slice(0, 8)}...{coin.registryTxHash.slice(-6)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={coin.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                                {coin.status}
                              </Badge>
                              {coin.hidden && (
                                <Badge variant="destructive" className="text-xs">Hidden</Badge>
                              )}
                              {coin.pinOrder && (
                                <Badge variant="default" className="text-xs bg-primary/10 text-primary border-primary/20">
                                  <Pin className="w-3 h-3 mr-1" />
                                  Pinned #{coin.pinOrder}
                                </Badge>
                              )}
                              <Button
                                size="sm"
                                variant={coin.pinOrder ? "outline" : "ghost"}
                                className={coin.pinOrder ? "border-primary/20 text-primary hover:bg-primary/10" : "hover:bg-accent"}
                                onClick={async () => {
                                  try {
                                    const action = coin.pinOrder ? 'unpin' : 'pin';
                                    await apiRequest('POST', `/api/admin/${action}-coin/${coin.address}`, {});
                                    toast({
                                      title: coin.pinOrder ? 'Coin Unpinned' : 'Coin Pinned',
                                      description: coin.pinOrder ? `${coin.symbol} removed from home page` : `${coin.symbol} will appear on home page`
                                    });
                                    queryClient.invalidateQueries({ queryKey: ['/api/coins'] });
                                  } catch (err: any) {
                                    toast({
                                      title: 'Failed',
                                      description: err.message || String(err),
                                      variant: 'destructive'
                                    });
                                  }
                                }}
                                title={coin.pinOrder ? 'Unpin from home page' : 'Pin to home page (max 6)'}
                              >
                                {coin.pinOrder ? (
                                  <PinOff className="w-4 h-4" />
                                ) : (
                                  <Pin className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => coin.hidden ? showCoinMutation.mutate(coin.address) : hideCoinMutation.mutate(coin.address)}
                                disabled={hideCoinMutation.isPending || showCoinMutation.isPending}
                                data-testid={`button-toggle-${coin.id}`}
                              >
                                {coin.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>

                  <div className="mt-6 pt-6 border-t border-border">
                    <h3 className="text-sm font-semibold mb-4">Create New Coin</h3>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Input placeholder="Name" id="admin-coin-name" className="h-9" />
                      <Input placeholder="Symbol" id="admin-coin-symbol" className="h-9" />
                      <Input placeholder="Creator Address (optional)" id="admin-coin-creator" className="h-9" />
                    </div>
                    <Button
                      className="mt-3 gap-2"
                      size="sm"
                      onClick={async () => {
                        const name = (document.getElementById('admin-coin-name') as HTMLInputElement).value;
                        const symbol = (document.getElementById('admin-coin-symbol') as HTMLInputElement).value;
                        const creator = (document.getElementById('admin-coin-creator') as HTMLInputElement).value;
                        if (!name || !symbol) {
                          toast({ title: 'Missing fields', description: 'Name and symbol required', variant: 'destructive' });
                          return;
                        }
                        try {
                          await apiRequest('POST', '/api/admin/create-coin', { name, symbol, creatorAddress: creator });
                          toast({ title: 'Coin created', description: 'Coin created successfully' });
                          queryClient.invalidateQueries({ queryKey: ['/api/coins'] });
                        } catch (err: any) {
                          toast({ title: 'Create failed', description: err.message || String(err), variant: 'destructive' });
                        }
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      Create Coin
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="create" className="mt-6 space-y-6 max-w-4xl">
              <AdminCreate />
            </TabsContent>

            <TabsContent value="blog" className="mt-6 space-y-6 max-w-4xl">
              <AdminBlogPanel />
            </TabsContent>

            <TabsContent value="rewards" className="mt-6 space-y-6 max-w-4xl">
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Gift className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">E1XP Rewards</CardTitle>
                      <CardDescription>Gift E1XP points to users</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="gift-recipients" className="text-sm font-medium">Recipient Address</Label>
                        <Input
                          id="gift-recipients"
                          placeholder="0x... or comma-separated"
                          className="mt-1.5 h-9"
                          data-testid="input-gift-recipients"
                        />
                      </div>
                      <div>
                        <Label htmlFor="gift-amount" className="text-sm font-medium">Amount</Label>
                        <Input
                          id="gift-amount"
                          placeholder="10"
                          type="number"
                          defaultValue="10"
                          className="mt-1.5 h-9"
                          data-testid="input-gift-amount"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="gift-reason" className="text-sm font-medium">Reason (optional)</Label>
                      <Textarea
                        id="gift-reason"
                        placeholder="Why are you gifting E1XP?"
                        rows={3}
                        className="mt-1.5"
                        data-testid="input-gift-reason"
                      />
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                      <input
                        id="gift-all"
                        type="checkbox"
                        className="rounded h-4 w-4"
                        data-testid="checkbox-gift-all"
                      />
                      <Label htmlFor="gift-all" className="text-sm cursor-pointer font-normal">
                        Send to all registered users
                      </Label>
                    </div>
                    <Button onClick={async () => {
                      const recipientsRaw = (document.getElementById('gift-recipients') as HTMLInputElement).value;
                      const amount = (document.getElementById('gift-amount') as HTMLInputElement).value;
                      const reason = (document.getElementById('gift-reason') as HTMLTextAreaElement).value;
                      const sendAll = (document.getElementById('gift-all') as HTMLInputElement).checked;

                      if (!sendAll && !recipientsRaw) {
                        toast({ title: 'Missing fields', description: 'Recipients or "Send to all" required', variant: 'destructive' });
                        return;
                      }
                      if (!amount) {
                        toast({ title: 'Missing fields', description: 'Amount required', variant: 'destructive' });
                        return;
                      }

                      const payload: any = { amount, reason };
                      if (sendAll) {
                        payload.all = true;
                      } else {
                        payload.recipients = recipientsRaw.split(',').map(s => s.trim()).filter(Boolean);
                      }

                      try {
                        const response = await apiRequest('POST', '/api/admin/gift-e1xp', payload);
                        const result = await response.json();
                        toast({
                          title: 'E1XP Gifts Sent Successfully',
                          description: sendAll
                            ? `Sent ${amount} E1XP to all ${result.recipients || 0} users`
                            : `Sent ${amount} E1XP to ${result.recipients || 0} recipients`
                        });

                        (document.getElementById('gift-recipients') as HTMLInputElement).value = '';
                        (document.getElementById('gift-amount') as HTMLInputElement).value = '10';
                        (document.getElementById('gift-reason') as HTMLTextAreaElement).value = '';
                        (document.getElementById('gift-all') as HTMLInputElement).checked = false;
                      } catch (err: any) {
                        toast({ title: 'Send failed', description: err.message || String(err), variant: 'destructive' });
                      }
                    }} className="w-full gap-2" data-testid="button-send-gift">
                      <Gift className="w-4 h-4" />
                      Send E1XP Gift
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Quick Actions</CardTitle>
                  <CardDescription>Common reward amounts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[10, 50, 100, 500].map(amt => (
                      <Button
                        key={amt}
                        variant="outline"
                        size="sm"
                        className="h-16 flex flex-col gap-1"
                        onClick={() => {
                          (document.getElementById('gift-amount') as HTMLInputElement).value = amt.toString();
                        }}
                        data-testid={`button-quick-${amt}`}
                      >
                        <Gift className="w-4 h-4 text-primary" />
                        <span className="font-semibold">{amt} E1XP</span>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="missions" className="mt-6 space-y-6 max-w-7xl">
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Missions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{missionSummary.totalMissions}</div>
                    <p className="text-xs text-muted-foreground mt-1">All creators</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Active Missions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{missionSummary.activeMissions}</div>
                    <p className="text-xs text-muted-foreground mt-1">Currently running</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Completions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{missionSummary.totalCompletions}</div>
                    <p className="text-xs text-muted-foreground mt-1">Completed by fans</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">E1XP Paid</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{missionSummary.totalPayouts}</div>
                    <p className="text-xs text-muted-foreground mt-1">Rewards delivered</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Mission Moderation</CardTitle>
                  <CardDescription>Approve, close, and monitor creator missions</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingMissions ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : missions.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Gift className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p>No missions created yet.</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[520px] pr-3">
                      <div className="space-y-3">
                        {missions.map((mission) => {
                          const status = mission.status || mission.missionStatus || "active";
                          const creatorName =
                            mission.creator?.name || mission.creator?.address || mission.creatorId || "Unknown";
                          return (
                            <div
                              key={mission.id}
                              className="border border-border/60 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold">{mission.title}</h4>
                                  <Badge variant="outline" className="text-[10px] uppercase">
                                    {status}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Creator: {creatorName}
                                </p>
                                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                                  <span>Type: {mission.type}</span>
                                  <span>Reward: {mission.rewardType}</span>
                                  <span>Completions: {mission.completions || 0}</span>
                                  <span>Claims: {mission.claims || 0}</span>
                                  {mission.rewardPayouts ? (
                                    <span>E1XP Paid: {mission.rewardPayouts}</span>
                                  ) : null}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {status !== "active" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => approveMissionMutation.mutate(mission.id)}
                                    disabled={approveMissionMutation.isLoading}
                                  >
                                    Approve
                                  </Button>
                                )}
                                {status !== "closed" && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => closeMissionMutation.mutate(mission.id)}
                                    disabled={closeMissionMutation.isLoading}
                                  >
                                    Close
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tracking" className="mt-6 space-y-6 max-w-7xl">
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Users Tracked</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{userRewards?.users?.length || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">Registered users</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Platform Fees</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{feesTracking?.summary?.totalPlatformFees || '0.0000'}</div>
                    <p className="text-xs text-muted-foreground mt-1">{feesTracking?.summary?.platformFeeCount || 0} transactions</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Trade Fees</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{feesTracking?.summary?.totalTradeFees || '0.0000'}</div>
                    <p className="text-xs text-muted-foreground mt-1">{feesTracking?.summary?.tradeFeeCount || 0} transactions</p>
                  </CardContent>
                </Card>
              </div>

              {/* User Rewards Table */}
              <Card>
                <CardHeader>
                  <CardTitle>User Rewards Breakdown</CardTitle>
                  <CardDescription>E1XP and Zora rewards per user</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingRewards ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : !userRewards?.users || userRewards.users.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>No user rewards data available</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-3">
                        {userRewards.users.map((user: any) => (
                          <div key={user.userId} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{user.username}</p>
                              <p className="text-xs text-muted-foreground font-mono">{user.address.slice(0, 10)}...{user.address.slice(-8)}</p>
                            </div>
                            <div className="flex gap-6 text-right">
                              <div>
                                <p className="text-xs text-muted-foreground">E1XP</p>
                                <p className="font-semibold">{user.e1xpRewards?.total || 0}</p>
                                <p className="text-xs text-muted-foreground">({user.e1xpRewards?.count || 0} rewards)</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Zora</p>
                                <p className="font-semibold">{user.zoraRewards?.total || '0.0000'}</p>
                                <p className="text-xs text-muted-foreground">({user.zoraRewards?.count || 0} rewards)</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Total Points</p>
                                <p className="font-semibold">{user.totalPoints || 0}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Fees by Coin */}
              <Card>
                <CardHeader>
                  <CardTitle>Fees by Coin</CardTitle>
                  <CardDescription>Platform and trade fees breakdown per coin</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingFees ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : !feesTracking?.feesByCoin || feesTracking.feesByCoin.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Coins className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>No fee tracking data available</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3">
                        {feesTracking.feesByCoin.map((coin: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{coin.coinSymbol}</p>
                              <p className="text-xs text-muted-foreground font-mono">{coin.coinAddress?.slice(0, 10)}...{coin.coinAddress?.slice(-8)}</p>
                            </div>
                            <div className="flex gap-6 text-right">
                              <div>
                                <p className="text-xs text-muted-foreground">Platform Fees</p>
                                <p className="font-semibold">{coin.platformFees?.toFixed(4) || '0.0000'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Trade Fees</p>
                                <p className="font-semibold">{coin.tradeFees?.toFixed(4) || '0.0000'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Transactions</p>
                                <p className="font-semibold">{coin.transactionCount || 0}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="mt-6 space-y-6 max-w-4xl">
              <AdminMessageComposer />

              <Card className="border-none shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Test Notifications</CardTitle>
                  <CardDescription>Send test notifications to users</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="notif-type" className="text-sm font-medium">Notification Type</Label>
                    <Select value={notifType} onValueChange={setNotifType}>
                      <SelectTrigger id="notif-type" data-testid="select-notif-type" className="mt-1.5 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="points_earned">Points Earned</SelectItem>
                        <SelectItem value="trade_completed">Trade Completed</SelectItem>
                        <SelectItem value="milestone_reached">Milestone Reached</SelectItem>
                        <SelectItem value="new_follower">New Follower</SelectItem>
                        <SelectItem value="system_alert">System Alert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="notif-title" className="text-sm font-medium">Title</Label>
                    <Input
                      id="notif-title"
                      value={notifTitle}
                      onChange={(e) => setNotifTitle(e.target.value)}
                      placeholder="Enter notification title"
                      data-testid="input-notif-title"
                      className="mt-1.5 h-9"
                    />
                  </div>

                  <div>
                    <Label htmlFor="notif-message" className="text-sm font-medium">Message</Label>
                    <Textarea
                      id="notif-message"
                      value={notifMessage}
                      onChange={(e) => setNotifMessage(e.target.value)}
                      placeholder="Enter notification message"
                      rows={3}
                      data-testid="input-notif-message"
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label htmlFor="target-address" className="text-sm font-medium">Target Address</Label>
                    <Input
                      id="target-address"
                      value={targetAddress}
                      onChange={(e) => setTargetAddress(e.target.value)}
                      placeholder="0x... or leave empty for all"
                      data-testid="input-target-address"
                      className="mt-1.5 h-9"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">Leave empty to send to all users</p>
                  </div>

                  <Button
                    onClick={handleSendNotification}
                    disabled={sendNotificationMutation.isPending}
                    className="w-full gap-2"
                    data-testid="button-send-notification"
                  >
                    {sendNotificationMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <BellRing className="w-4 h-4" />
                        Send Test Notification
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="mt-6 space-y-6 max-w-4xl">
              <Card>
                <CardHeader>
                  <CardTitle>Platform Settings</CardTitle>
                  <CardDescription>Configure platform-wide settings and notifications</CardDescription>
                </CardHeader>
                <CardContent>
                  <NotificationTestingPanel />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Maintenance</CardTitle>
                  <CardDescription>One-time sync tools for data consistency</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-3">
                    <Button
                      onClick={() => syncPointsMutation.mutate()}
                      disabled={syncPointsMutation.isPending}
                      className="w-full sm:w-auto gap-2"
                    >
                      {syncPointsMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <Gift className="w-4 h-4" />
                          Sync E1XP Points
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Updates <code>creators.points</code> from <code>users.e1xp_points</code>.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="messaging" className="mt-6 space-y-6 max-w-4xl">
              <Card>
                <CardHeader>
                  <CardTitle>User Messaging</CardTitle>
                  <CardDescription>Send real-time messages to users via Socket.io</CardDescription>
                </CardHeader>
                <CardContent>
                  <AdminMessagingPanel />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="network" className="mt-6">
              <AdminNetwork />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
