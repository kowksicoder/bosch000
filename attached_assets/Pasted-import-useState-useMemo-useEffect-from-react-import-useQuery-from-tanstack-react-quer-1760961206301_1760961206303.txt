import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useLocation } from "wouter";
import { safeNavigate } from "@/lib/navigation";
import type { Coin } from "@shared/schema";
import Layout from "@/components/layout";
import CoinCard from "@/components/coin-card";
import {
  User as UserIcon,
  Share2,
  Grid3x3,
  List,
  Copy,
  Check,
  DollarSign,
  TrendingUp,
  Edit2,
  Users,
  Coins as CoinsIcon,
  ChevronRight,
  Settings as SettingsIcon,
  Star
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getCoin } from "@zoralabs/coins-sdk";
import { base } from "viem/chains";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createAvatar } from '@dicebear/core';
import { avataaars } from '@dicebear/collection';
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { formatSmartCurrency } from "@/lib/utils";

// Helper function to update OG meta tags
const updateOGMeta = ({ title, description, image, url }: { title: string; description: string; image: string; url: string }) => {
  const head = document.head;
  const oldMeta = head.querySelectorAll('meta[property^="og:"]');
  oldMeta.forEach(meta => meta.remove());

  const newMetaTags = [
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: image },
    { property: 'og:url', content: url },
    { property: 'og:type', content: 'website' },
  ];

  newMetaTags.forEach(({ property, content }) => {
    const meta = document.createElement('meta');
    meta.setAttribute('property', property);
    meta.setAttribute('content', content);
    head.appendChild(meta);
  });

  // Also update the Twitter card meta tags
  const twitterMetaTags = [
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
    { name: 'twitter:card', content: 'summary_large_image' },
  ];

  twitterMetaTags.forEach(({ name, content }) => {
    let meta = head.querySelector(`meta[name="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', name);
      head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  });
};


export default function Profile() {
  const { address, isConnected } = useAccount();
  const [selectedTab, setSelectedTab] = useState<"created" | "owned">("created");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [copied, setCopied] = useState(false);
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const [totalMarketCap, setTotalMarketCap] = useState<number>(0);
  const [totalHolders, setTotalHolders] = useState<number>(0);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string>("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [shareUrl, setShareUrl] = useState<string>(""); // State for the shareable URL

  const avatarSvg = createAvatar(avataaars, {
    seed: address || 'anonymous',
    size: 128,
  }).toDataUri();

  // Fetch creator data to populate username and bio
  const { data: creatorData, isLoading: isLoadingCreatorData } = useQuery({
    queryKey: ['/api/creators/address', address],
    enabled: !!address,
  });

  // Fetch creator stats
  const { data: creatorStats, isLoading: isLoadingCreatorStats } = useQuery({
    queryKey: ['/api/creators/stats', address],
    enabled: !!address,
  });

  // Fetch following count
  const { data: followingList = [] } = useQuery({
    queryKey: ['/api/follows/following', address],
    enabled: !!address,
  });

  const followingCount = followingList.length;

  const { data: coins = [], isLoading: isLoadingCoins } = useQuery<Coin[]>({
    queryKey: ["/api/coins"],
  });

  const createdCoins = useMemo(() => {
    if (!address) return [];
    return coins.filter(coin =>
      coin.creator_wallet && coin.creator_wallet.toLowerCase() === address.toLowerCase()
    );
  }, [coins, address]);

  const ownedCoins = useMemo(() => {
    return [];
  }, []);

  const displayedCoins = selectedTab === "created"
    ? createdCoins.filter(coin => coin.address !== null) as Array<typeof createdCoins[0] & { address: string }>
    : ownedCoins;

  useEffect(() => {
    if (!address || !isConnected || !createdCoins.length) {
      setTotalEarnings(0);
      setTotalMarketCap(0);
      setTotalHolders(0);
      setIsLoadingStats(false);
      return;
    }

    let isMounted = true;
    setIsLoadingStats(true);

    async function fetchAllStats() {
      try {
        let earnings = 0;
        let marketCap = 0;
        let holders = 0;

        for (const coin of createdCoins) {
          if (coin.address && coin.status === 'active') {
            try {
              const coinData = await getCoin({
                collectionAddress: coin.address as `0x${string}`,
                chainId: base.id,
              });

              const tokenData = coinData.data?.zora20Token;

              if (tokenData?.creatorEarnings && tokenData.creatorEarnings.length > 0) {
                const earningAmount = parseFloat(String(tokenData.creatorEarnings[0].amountUsd || tokenData.creatorEarnings[0].amount?.amountDecimal || "0"));
                earnings += earningAmount;
              }

              if (tokenData?.marketCap) {
                marketCap += parseFloat(tokenData.marketCap);
              }

              if (tokenData?.uniqueHolders) {
                holders += tokenData.uniqueHolders;
              }
            } catch (err) {
              console.error(`Error fetching coin stats for ${coin.address}:`, err);
            }
          }
        }

        if (isMounted) {
          setTotalEarnings(earnings);
          setTotalMarketCap(marketCap);
          setTotalHolders(holders);
          setIsLoadingStats(false);
        }
      } catch (error) {
        console.error("Error fetching creator stats:", error);
        if (isMounted) {
          setTotalEarnings(0);
          setTotalMarketCap(0);
          setTotalHolders(0);
          setIsLoadingStats(false);
        }
      }
    }

    fetchAllStats();

    return () => {
      isMounted = false;
    };
  }, [address, isConnected, createdCoins]);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleCopyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast({
        title: "Address copied",
        description: "Wallet address copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy address to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    if (!address) return;
    const url = shareUrl || `${window.location.origin}/profile?creator=${address}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${creatorData?.name || formatAddress(address)} - CoinIT Profile`,
          text: `Check out my profile on CoinIT!`,
          url: url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast({
          title: "Link copied",
          description: "Profile link copied to clipboard",
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setProfileImage(file);

      // Upload to Pinata immediately
      setIsUploadingImage(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Failed to upload image');
        }

        const data = await response.json();
        setProfileImageUrl(data.url);

        toast({
          title: "Image uploaded",
          description: "Profile image uploaded successfully",
        });
      } catch (error) {
        console.error('Image upload error:', error);
        toast({
          title: "Upload failed",
          description: "Failed to upload profile image",
          variant: "destructive",
        });
      } finally {
        setIsUploadingImage(false);
      }
    }
  };

  // Update state when creator data loads
  useEffect(() => {
    if (creatorData) {
      setUsername(creatorData.name || '');
      setBio(creatorData.bio || '');
      setProfileImageUrl(creatorData.avatar || '');
    }
  }, [creatorData]);

  // Update OG meta when profile loads
  useEffect(() => {
    if (address) {
      // Use @username if available, otherwise use address
      const profilePath = creatorData?.name 
        ? `/@${creatorData.name}` 
        : `/${address}`;
      const profileUrl = `${window.location.origin}${profilePath}`;
      setShareUrl(profileUrl);

      // Update OG meta for sharing
      const displayName = creatorData?.name || formatAddress(address);
      const stats = creatorStats 
        ? `${creatorStats.totalCoins || 0} coins created • ${creatorStats.totalVolume || '0'} ETH volume • ${creatorStats.totalHolders || 0} holders`
        : 'Creator profile on CoinIT';
      
      updateOGMeta({
        title: `${displayName} - CoinIT Profile`,
        description: stats,
        image: profileImageUrl || creatorData?.avatar || avatarSvg,
        url: profileUrl
      });
    }
  }, [address, creatorData, creatorStats, profileImageUrl, avatarSvg]);


  const handleSaveProfile = async () => {
    if (!address) return;

    try {
      // Get or create creator
      const getResponse = await apiRequest('GET', `/api/creators/address/${address}`).catch(() => null);
      let creator = getResponse ? await getResponse.json() : null;

      if (!creator) {
        // Create new creator
        const createResponse = await apiRequest('POST', '/api/creators', {
          address,
          name: username || null,
          bio: bio || null,
          avatar: profileImageUrl || null,
        });
        creator = await createResponse.json();
      } else {
        // Update existing creator
        const updateResponse = await apiRequest('PATCH', `/api/creators/${creator.id}`, {
          name: username || null,
          bio: bio || null,
          avatar: profileImageUrl || null,
        });
        creator = await updateResponse.json();
      }

      // Invalidate all creator-related queries to refresh data everywhere
      await queryClient.invalidateQueries({ queryKey: ['/api/creators/address'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/creators/stats', address] });
      await queryClient.invalidateQueries({ queryKey: ['/api/creators'] });
      await queryClient.invalidateQueries({ queryKey: ["/api/coins"] });

      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully",
      });

      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Profile update error:', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  if (!isConnected) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh] p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserIcon className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Connect Your Wallet</h2>
            <p className="text-muted-foreground">
              Please connect your wallet to view your profile
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        {/* Header Section */}
        <div className="relative mb-6">
          {/* Top Actions */}
          <div className="flex items-center justify-between mb-6">
            <button className="text-muted-foreground hover:text-white transition-colors">
              <ChevronRight className="w-6 h-6 rotate-180" />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => safeNavigate(setLocation, '/settings?tab=referral')}
                className="px-3 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 rounded-full text-sm font-semibold text-yellow-500 transition-colors flex items-center gap-1.5"
                title="View E1XP Points"
              >
                <Star className="w-3.5 h-3.5" />
                {isLoadingCreatorStats ? '...' : creatorStats?.e1xpPoints || 0} E1XP
              </button>
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="px-4 py-2 bg-muted/30 hover:bg-muted/40 rounded-full text-sm font-semibold text-foreground transition-colors flex items-center gap-2"
                data-testid="button-edit-profile"
              >
                <Edit2 className="w-4 h-4" />
                EDIT
              </button>
              <button
                onClick={() => safeNavigate(setLocation, '/settings')}
                className="p-2 bg-muted/30 hover:bg-muted/40 rounded-full text-foreground transition-colors"
                data-testid="button-settings"
              >
                <SettingsIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Avatar and Info */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-4">
              <img
                src={profileImageUrl || (profileImage ? URL.createObjectURL(profileImage) : avatarSvg)}
                alt="Profile Avatar"
                className="w-28 h-28 rounded-3xl border-4 border-border shadow-xl"
              />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {creatorData?.name || username || (address ? formatAddress(address) : 'Anonymous')}
            </h1>

            <button
              onClick={handleCopyAddress}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-4"
              data-testid="button-copy-address"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <span>@{address ? `${address.slice(2, 8)}` : ''}</span>
                  <Copy className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            {(creatorData?.bio || bio) && (
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 max-w-md px-4">
                {creatorData?.bio || bio}
              </p>
            )}
          </div>

          {/* Stats Grid - Compact */}
          <div className="grid grid-cols-3 gap-x-8 gap-y-3 mb-6 px-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <CoinsIcon className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-muted-foreground">Coins</div>
                <div className="text-base font-bold text-foreground">
                  {isLoadingStats || isLoadingCoins ? '-' : createdCoins.length}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-500" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-muted-foreground">Followers</div>
                <div className="text-base font-bold text-foreground">
                  {isLoadingCreatorData ? '-' : parseInt(creatorData?.followers || '0')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-purple-500" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-muted-foreground">Following</div>
                <div className="text-base font-bold text-foreground">
                  {followingCount}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-muted-foreground">Market Cap</div>
                <div className="text-base font-bold text-foreground">
                  {isLoadingStats ? '-' : totalMarketCap >= 1000000
                    ? `$${(totalMarketCap / 1000000).toFixed(1)}M`
                    : totalMarketCap >= 1000
                      ? `$${(totalMarketCap / 1000).toFixed(1)}k`
                      : `$${totalMarketCap.toFixed(0)}`}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-orange-500" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-muted-foreground">Holders</div>
                <div className="text-base font-bold text-foreground">
                  {isLoadingStats ? '-' : totalHolders.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-green-500" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-muted-foreground">Earnings</div>
                <div className="text-base font-bold text-green-500">
                  {isLoadingStats ? '-' : totalEarnings >= 1000
                    ? `$${(totalEarnings / 1000).toFixed(1)}k`
                    : `$${totalEarnings.toFixed(0)}`}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={handleShare}
              className="flex-1 py-2.5 bg-primary text-primary-foreground font-semibold rounded-full hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              data-testid="button-share"
            >
              <Share2 className="w-4 h-4" />
              Share Profile
            </button>
          </div>

          {/* Social Share Options */}
          <div className="flex gap-2 justify-center mb-6">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              asChild
            >
              <a 
                href={`https://twitter.com/intent/tweet?text=Check%20out%20my%20CoinIT%20profile!%20I've%20created%20${createdCoins.length}%20coins%20with%20${totalHolders}%20holders.%0A%0A${encodeURIComponent(shareUrl)}`}
                target="_blank" 
                rel="noopener noreferrer"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={async () => {
                await navigator.clipboard.writeText(shareUrl);
                toast({ title: "Profile link copied!" });
              }}
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Earnings Card - Compact */}
          {createdCoins.length > 0 && totalEarnings > 0 && (
            <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-2xl p-4 mb-6 border border-green-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Total Earnings</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      ${isLoadingStats ? '0.00' : totalEarnings.toFixed(2)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    const text = `💰 Just earned $${totalEarnings.toFixed(2)} from my ${createdCoins.length} coins on CoinIT! Join me and start creating!\n\n${shareUrl}\n\n#CoinIT #Web3 #CreatorEconomy`;
                    if (navigator.share) {
                      await navigator.share({ text });
                    } else {
                      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
                    }
                  }}
                  className="p-2 bg-green-500/20 hover:bg-green-500/30 rounded-full transition-colors"
                  title="Share earnings"
                >
                  <Share2 className="w-4 h-4 text-green-500" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Edit Profile Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="sm:max-w-[400px] bg-card border-border rounded-3xl p-6">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-foreground text-xl font-bold">Edit Profile</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Profile Image Upload */}
              <div className="flex flex-col items-center">
                <label htmlFor="profile-image-upload" className="cursor-pointer group relative">
                  <img
                    src={profileImageUrl || (profileImage ? URL.createObjectURL(profileImage) : avatarSvg)}
                    alt="Profile Preview"
                    className="w-24 h-24 rounded-full border-4 border-primary shadow-lg transition-opacity group-hover:opacity-80"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-black/50 rounded-full px-3 py-1 text-xs text-white">
                      {isUploadingImage ? 'Uploading...' : 'Change'}
                    </div>
                  </div>
                </label>
                <Input
                  id="profile-image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={isUploadingImage}
                  className="hidden"
                />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Username</label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="bg-muted/20 border-border text-foreground rounded-xl h-11"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Bio</label>
                  <Textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    rows={3}
                    className="bg-muted/20 border-border text-foreground resize-none rounded-xl"
                  />
                </div>
              </div>

              <Button
                onClick={handleSaveProfile}
                className="w-full bg-primary hover:bg-primary/90 text-black font-bold rounded-xl h-11"
              >
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Tabs & View Toggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1 bg-muted/20 rounded-full p-1">
            <button
              onClick={() => setSelectedTab("created")}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                selectedTab === "created"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="button-tab-created"
            >
              Created {createdCoins.length > 0 && <span className="ml-1">({createdCoins.length})</span>}
            </button>
            <button
              onClick={() => setSelectedTab("owned")}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                selectedTab === "owned"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="button-tab-owned"
            >
              Owned {ownedCoins.length > 0 && <span className="ml-1">({ownedCoins.length})</span>}
            </button>
          </div>

          <div className="flex gap-1 bg-muted/20 rounded-full p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-full transition-colors ${
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="button-view-grid"
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-full transition-colors ${
                viewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="button-view-list"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Coins Display */}
        {isLoadingCoins ? (
          <div className="grid grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="spotify-card rounded-xl overflow-hidden p-3 space-y-3">
                <div className="aspect-square w-full bg-muted/20 rounded-lg animate-pulse"></div>
                <div className="space-y-2">
                  <div className="h-5 bg-muted/20 rounded w-3/4 animate-pulse"></div>
                  <div className="h-4 bg-muted/20 rounded w-1/2 animate-pulse"></div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-muted/20 rounded w-16 animate-pulse"></div>
                  <div className="h-4 bg-muted/20 rounded w-16 animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        ) : displayedCoins.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CoinsIcon className="w-8 h-8 text-gray-600 dark:text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {selectedTab === "created" ? "No coins created yet" : "No coins owned yet"}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {selectedTab === "created"
                ? "Create your first coin to get started"
                : "Start collecting coins to build your portfolio"}
            </p>
            {selectedTab === "created" && (
              <Button
                onClick={() => safeNavigate(setLocation, '/create-coin')}
                className="bg-primary hover:bg-primary/90 text-black font-bold rounded-xl h-11 px-6"
              >
                Create Your Coin
              </Button>
            )}
          </div>
        ) : (
          <div className={viewMode === "grid" ? "grid grid-cols-2 gap-4" : "space-y-4"}>
            {displayedCoins.map((coin) => (
              <CoinCard
                key={coin.id}
                coin={{
                  ...coin,
                  createdAt: typeof coin.createdAt === 'string'
                    ? coin.createdAt
                    : coin.createdAt
                      ? coin.createdAt.toISOString()
                      : new Date().toISOString(),
                  ipfsUri: coin.ipfsUri ?? undefined
                }}
                isOwnCoin={selectedTab === "created"}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}