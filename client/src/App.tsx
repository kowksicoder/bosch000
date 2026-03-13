import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { AppLayout } from "@/components/app-layout";
import { ProductTour } from "@/components/product-tour";

// Pages
import Home from "@/pages/home";
import Search from "@/pages/search";
import Profile from "@/pages/profile";
import PublicProfile from "@/pages/public-profile";
import UsernameRedirect from "@/pages/username-redirect";
import Create from "@/pages/create";
import Inbox from "@/pages/inbox";
import Connections from "@/pages/connections";
import Groups from "@/pages/groups";
import Streaks from "@/pages/streaks";
import Points from "./pages/points";
import Admin from "@/pages/admin";
import AdminLogin from "@/pages/admin-login";
import Creators from "@/pages/creators";
import Leaderboard from "@/pages/leaderboard";
import Swap from "@/pages/swap";
import CoinsPage from "@/pages/coins";
import CoinDetailPage from "@/pages/coin-detail";
import Docs from "@/pages/docs";
import About from "@/pages/about";
import FAQ from "@/pages/faq";
import Referrals from "@/pages/referrals";
import Showcase from "@/pages/showcase";
import ShowcaseDetail from "@/pages/showcase-detail";
import FansMissions from "@/pages/fans-missions";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import Notifications from "@/pages/notifications";
import WalletPage from "@/pages/wallet";
import TransactionsPage from "@/pages/transactions";

function Router() {
  return (
    <AppLayout>
      <ProductTour />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/search" component={Search} />
        <Route path="/profile/:identifier" component={PublicProfile} />
        <Route path="/profile" component={Profile} />
        <Route path="/create" component={Create} />
        <Route path="/inbox" component={Inbox} />
        <Route path="/connections" component={Connections} />
        <Route path="/groups" component={Groups} />
        <Route path="/streaks" component={Streaks} />
        <Route path="/points" component={Points} />
        <Route path="/settings" component={Settings} />
        <Route path="/admin-login" component={AdminLogin} />
        <Route path="/admin" component={Admin} />
        <Route path="/creators" component={Creators} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/swap" component={Swap} />
        <Route path="/coins" component={CoinsPage} />
        <Route path="/coin/:address" component={CoinDetailPage} />
        <Route path="/docs" component={Docs} />
        <Route path="/about" component={About} />
        <Route path="/faq" component={FAQ} />
        <Route path="/referrals" component={Referrals} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/wallet" component={WalletPage} />
        <Route path="/transactions" component={TransactionsPage} />
        <Route path="/showcase" component={Showcase} />
        <Route path="/showcase/:slug" component={ShowcaseDetail} />
        <Route path="/fans-missions" component={FansMissions} />
        <Route path="/FansMissions" component={FansMissions} />
        <Route path="/:handle" component={UsernameRedirect} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

import { AppPrivyProvider } from "@/lib/privy-provider";
import { WagmiProvider } from "wagmi";
import { config as wagmiConfig } from "@/lib/wagmi";
import { E1XPClaimModal } from "@/components/e1xp-claim-modal";
import { SplashScreen } from "@/components/splash-screen";
import { useState, useEffect } from "react";

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [splashComplete, setSplashComplete] = useState(false);

  useEffect(() => {
    // Check if splash has been shown in this session
    const hasShown = sessionStorage.getItem("splash-shown-v2");
    if (hasShown) {
      setShowSplash(false);
      setSplashComplete(true);
    } else {
      // Show splash for 2.5 seconds
      const timer = setTimeout(() => {
        setShowSplash(false);
        sessionStorage.setItem("splash-shown-v2", "true");
        // Wait for fade out animation
        setTimeout(() => setSplashComplete(true), 500);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <AppPrivyProvider>
          <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <TooltipProvider>
              {showSplash && <SplashScreen />}
              {splashComplete && (
                <>
                  <Toaster />
                  <E1XPClaimModal />
                  <Router />
                </>
              )}
            </TooltipProvider>
          </ThemeProvider>
        </AppPrivyProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}

export default App;
