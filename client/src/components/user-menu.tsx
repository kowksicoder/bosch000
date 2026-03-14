import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useLocation } from "wouter";
import { LogOut, User, Wallet } from "lucide-react";

// Custom SVG icon components
const SettingsIcon = ({ className }: { className?: string }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M10 12.5C11.3807 12.5 12.5 11.3807 12.5 10C12.5 8.61929 11.3807 7.5 10 7.5C8.61929 7.5 7.5 8.61929 7.5 10C7.5 11.3807 8.61929 12.5 10 12.5Z" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M1.66667 10.7333V9.26667C1.66667 8.4 2.36667 7.69167 3.24167 7.69167C4.65833 7.69167 5.25 6.6 4.54167 5.36667C4.13333 4.65833 4.375 3.74167 5.09167 3.33333L6.54167 2.5C7.15833 2.13333 7.95833 2.35 8.325 2.96667L8.41667 3.125C9.11667 4.35833 10.8833 4.35833 11.5917 3.125L11.6833 2.96667C12.05 2.35 12.85 2.13333 13.4667 2.5L14.9167 3.33333C15.6333 3.74167 15.875 4.65833 15.4667 5.36667C14.7583 6.6 15.35 7.69167 16.7667 7.69167C17.6333 7.69167 18.3417 8.39167 18.3417 9.26667V10.7333C18.3417 11.6 17.6417 12.3083 16.7667 12.3083C15.35 12.3083 14.7583 13.4 15.4667 14.6333C15.875 15.35 15.6333 16.2583 14.9167 16.6667L13.4667 17.5C12.85 17.8667 12.05 17.65 11.6833 17.0333L11.5917 16.875C10.8917 15.6417 9.125 15.6417 8.41667 16.875L8.325 17.0333C7.95833 17.65 7.15833 17.8667 6.54167 17.5L5.09167 16.6667C4.375 16.2583 4.13333 15.3417 4.54167 14.6333C5.25 13.4 4.65833 12.3083 3.24167 12.3083C2.36667 12.3083 1.66667 11.6 1.66667 10.7333Z" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const UsersIcon = ({ className }: { className?: string }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M7.5 2C5.32 2 3.54 3.78 3.54 5.96C3.54 8.11 5.21 9.83 7.4 9.91C7.46 9.9 7.52 9.9 7.56 9.91C7.58 9.91 7.59 9.91 7.6 9.91C7.61 9.91 7.61 9.91 7.62 9.91C9.77 9.83 11.45 8.11 11.46 5.96C11.46 3.78 9.68 2 7.5 2Z" fill="currentColor"/>
    <path d="M11.73 11.79C9.41 10.24 5.61 10.24 3.27 11.79C2.21 12.5 1.62 13.46 1.62 14.48C1.62 15.5 2.21 16.45 3.26 17.16C4.42 17.94 5.96 18.33 7.5 18.33C9.04 18.33 10.58 17.94 11.73 17.16C12.78 16.45 13.37 15.5 13.37 14.47C13.36 13.45 12.78 12.49 11.73 11.79Z" fill="currentColor"/>
    <path d="M16.66 6.11C16.79 7.73 15.64 9.15 14.05 9.34C14.04 9.34 14.04 9.34 14.03 9.34H14.01C13.96 9.34 13.91 9.34 13.87 9.35C12.89 9.39 12 9.14 11.34 8.66C12.18 7.9 12.69 6.75 12.58 5.5C12.53 4.9 12.34 4.37 12.07 3.93C12.37 3.79 12.72 3.69 13.08 3.66C14.73 3.5 16.52 4.47 16.66 6.11Z" fill="currentColor"/>
    <path d="M18.33 13.82C18.26 14.63 17.74 15.33 16.88 15.81C16.04 16.27 14.99 16.48 13.95 16.46C14.55 15.92 14.9 15.24 14.97 14.52C15.05 13.49 14.56 12.5 13.58 11.71C12.96 11.23 12.27 10.84 11.5 10.57C13.5 9.96 15.82 10.48 17.24 11.63C18.01 12.25 18.4 13.02 18.33 13.82Z" fill="currentColor"/>
  </svg>
);

const FlameIcon = ({ className }: { className?: string }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M10.52 1.84C10.38 1.73 10.2 1.67 10 1.67C9.8 1.67 9.62 1.73 9.48 1.84C9.28 2.02 5 5.75 5 10.42C5 13.87 7.8 16.67 11.25 16.67C11.72 16.67 12.18 16.62 12.61 16.52C12.02 16.07 11.47 15.53 10.98 14.93C10.66 15.01 10.32 15.05 9.97 15.04C7.67 15.04 5.8 13.18 5.8 10.88C5.8 7.86 8.47 5.19 10 3.66C11.53 5.19 14.2 7.86 14.2 10.88C14.2 11.29 14.14 11.69 14.04 12.08C14.69 12.64 15.42 13.09 16.19 13.42C16.5 12.75 16.67 12.01 16.67 11.25C16.67 5.75 12.38 2.02 10.52 1.84Z" fill="currentColor"/>
    <path d="M14.58 18.33C16.65 18.33 18.33 16.65 18.33 14.58C18.33 12.51 16.65 10.83 14.58 10.83C12.51 10.83 10.83 12.51 10.83 14.58C10.83 16.65 12.51 18.33 14.58 18.33Z" fill="currentColor"/>
  </svg>
);

const ZapIcon = ({ className }: { className?: string }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M11.67 1.67L5.42 10.83C5.08 11.33 5.42 12 6.08 12H9.17V18.33L15.42 9.17C15.75 8.67 15.42 8 14.75 8H11.67V1.67Z" fill="currentColor"/>
  </svg>
);

const HelpCircleIcon = ({ className }: { className?: string }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M10 1.67C5.41 1.67 1.67 5.41 1.67 10C1.67 14.59 5.41 18.33 10 18.33C14.59 18.33 18.33 14.59 18.33 10C18.33 5.41 14.59 1.67 10 1.67ZM9.38 6.67C9.38 6.33 9.66 6.04 10 6.04C10.8 6.04 11.46 6.7 11.46 7.5C11.46 8.03 11.18 8.52 10.74 8.78C10.4 8.99 10.21 9.37 10.21 9.76V10C10.21 10.34 9.93 10.62 9.58 10.62C9.24 10.62 8.96 10.34 8.96 10V9.76C8.96 8.93 9.41 8.16 10.14 7.74C10.34 7.62 10.21 7.57 10.21 7.5C10.21 7.38 10.12 7.29 10 7.29C9.66 7.29 9.38 7.01 9.38 6.67ZM10.77 13.65C10.73 13.76 10.67 13.84 10.59 13.93C10.51 14.01 10.43 14.06 10.32 14.1C10.22 14.14 10.11 14.17 10 14.17C9.89 14.17 9.78 14.14 9.68 14.1C9.58 14.06 9.49 14.01 9.41 13.93C9.33 13.84 9.28 13.76 9.23 13.65C9.19 13.55 9.17 13.44 9.17 13.33C9.17 13.23 9.19 13.12 9.23 13.02C9.28 12.91 9.33 12.83 9.41 12.74C9.49 12.67 9.58 12.61 9.68 12.57C9.88 12.48 10.12 12.48 10.32 12.57C10.43 12.61 10.51 12.67 10.59 12.74C10.67 12.83 10.73 12.91 10.77 13.02C10.81 13.12 10.83 13.23 10.83 13.33C10.83 13.44 10.81 13.55 10.77 13.65Z" fill="currentColor"/>
  </svg>
);
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
export function UserMenu() {
  const { login, logout, authenticated, user } = usePrivy();
  const [, setLocation] = useLocation();

  const handleLogin = () => {
    try {
      login();
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  if (!authenticated) {
    return (
      <Button 
        onClick={handleLogin} 
        variant="default" 
        size="sm" 
        className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-300 text-black font-semibold border-0 hover:opacity-90"
        data-testid="button-login"
      >
        Login
      </Button>
    );
  }

  const address = user?.wallet?.address || "";
  const email = user?.email?.address || "";
  const emailUsername = email ? email.split("@")[0] : null;

  const privyId = user?.id;
  
  const { data: creatorData } = useQuery({
    queryKey: ['/api/creators/privy', privyId],
    enabled: !!privyId && authenticated,
  });

  const avatarUrl = (creatorData as any)?.avatar || "https://i.ibb.co/JRQCPsZK/ev122logo-1-1.png";
  const creatorName = (creatorData as any)?.name || (creatorData as any)?.username;
  const displayName = creatorName || emailUsername || "Creator";
  const displayHandle = creatorName || emailUsername || (address ? address.slice(2, 8) : "");
  const userName = displayName;
  const userEmail = email ? email : displayHandle ? `@${displayHandle}` : "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full ring-2 ring-transparent hover:ring-primary/20 transition-all" data-testid="button-user-menu">
          <Avatar className="h-9 w-9">
            <AvatarImage src={avatarUrl} alt={userName} />
            <AvatarFallback className="bg-gradient-to-br from-purple-400 to-pink-400">
              <User className="h-4 w-4 text-white" />
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 p-0 rounded-2xl" align="end" forceMount>
        {/* User Info Header - Compact */}
        <div className="p-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Avatar className="h-9 w-9">
              <AvatarImage src={avatarUrl} alt={userName} />
              <AvatarFallback className="bg-gradient-to-br from-purple-400 to-pink-400 text-xs">
                <User className="h-4 w-4 text-white" />
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight truncate" data-testid="text-user-menu-name">
                {userName}
              </p>
              <p className="text-[10px] text-muted-foreground truncate" data-testid="text-user-menu-email">
                {userEmail}
              </p>
            </div>
          </div>
        </div>
        
        {/* Menu Items - Compact */}
        <div className="p-1">
          <DropdownMenuItem 
            onClick={() => setLocation("/profile")}
            className="cursor-pointer py-2 px-2 rounded-md"
            data-testid="menu-item-profile"
          >
            <User className="mr-2 h-4 w-4" />
            <span className="text-sm">Profile</span>
          </DropdownMenuItem>

          <DropdownMenuItem 
            onClick={() => setLocation("/wallet")}
            className="cursor-pointer py-2 px-2 rounded-md"
            data-testid="menu-item-wallet"
          >
            <Wallet className="mr-2 h-4 w-4" />
            <span className="text-sm">Wallet</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => setLocation("/streaks")}
            className="cursor-pointer py-2 px-2 rounded-md"
            data-testid="menu-item-streaks"
          >
            <FlameIcon className="mr-2 h-4 w-4" />
            <span className="text-sm">Streaks</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => setLocation("/points")}
            className="cursor-pointer py-2 px-2 rounded-md"
            data-testid="menu-item-points"
          >
            <ZapIcon className="mr-2 h-4 w-4" />
            <span className="text-sm">E1XP Points</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => setLocation("/referrals")}
            className="cursor-pointer py-2 px-2 rounded-md"
            data-testid="menu-item-referrals"
          >
            <UsersIcon className="mr-2 h-4 w-4" />
            <span className="text-sm">Referrals</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => setLocation("/settings")}
            className="cursor-pointer py-2 px-2 rounded-md"
            data-testid="menu-item-settings"
          >
            <SettingsIcon className="mr-2 h-4 w-4" />
            <span className="text-sm">Settings</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator className="my-1" />
          
          <DropdownMenuItem 
            className="cursor-pointer py-2 px-2 rounded-md"
            data-testid="menu-item-help"
          >
            <HelpCircleIcon className="mr-2 h-4 w-4" />
            <span className="text-sm">Help</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={logout}
            className="cursor-pointer py-2 px-2 rounded-md text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
            data-testid="menu-item-signout"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span className="text-sm">Sign out</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
