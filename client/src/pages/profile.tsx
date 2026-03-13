import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { useLocation } from "wouter";
import type { Coin } from "@shared/schema";
import { CoinCard } from "@/components/coin-card";
import {
  User as UserIcon,
  Share2,
  Copy,
  Check,
  Edit2,
  Settings,
  Bell,
  Grid3x3,
  Heart,
  Bookmark,
  Wallet,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getCoin } from "@zoralabs/coins-sdk";
import { base } from "viem/chains";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatSmartCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { getAccessToken } from "@privy-io/react-auth";
import { ShareModal } from "@/components/share-modal";
import WithdrawEarningsModal from "@/components/withdraw-earnings-modal";
import { useSmartAccount } from "@/contexts/SmartAccountContext";
import { useFxRates, convertUsdToNgn } from "@/lib/fx";
import { Card } from "@/components/ui/card";

type EarningsSummary = {
  last24hNgn: number;
  previous24hNgn: number;
  changePct: number;
  rewardCount: number;
  updatedAt: string;
};

type CollabSummary = {
  totalCollabs: number;
  totalEarningsNgn: number;
  totalVolumeNgn: number;
  updatedAt: string;
};

type Mission = {
  id: string;
  creatorId: string;
  title: string;
  description?: string | null;
  type: "hold" | "activity" | "loyalty" | "event" | "community";
  coinAddress?: string | null;
  requiredAmount?: string | number | null;
  requiredDays?: number | null;
  rewardType: "e1xp" | "nft" | "content" | "coupon" | "event_access";
  rewardValue?: string | null;
  status?: string;
  missionStatus?: "upcoming" | "active" | "closed" | "expired";
};

type MissionAnalytics = {
  totalMissions: number;
  activeMissions: number;
  totalCompletions: number;
  totalClaims: number;
  totalRewardPayouts: number;
  perMission: Array<{
    id: string;
    title: string;
    status: string;
    rewardType: string;
    rewardValue?: string | null;
    completions: number;
    claims: number;
  }>;
};

type MissionFulfillment = {
  userMissionId: string;
  missionId: string;
  missionTitle: string;
  userId: string;
  rewardType: string;
  rewardValue?: string | null;
  rewardStatus?: string | null;
  completedAt?: string | null;
  coinAddress?: string | null;
};

const getRewardFieldConfig = (rewardType: string) => {
  switch (rewardType) {
    case "e1xp":
      return {
        label: "E1XP amount",
        placeholder: "e.g. 25",
        type: "number",
        helper: "Points added instantly on completion.",
      };
    case "content":
      return {
        label: "Content link or access",
        placeholder: "Paste a private link or access instructions",
        type: "textarea",
        helper: "Share a private link, Dropbox, or gated content info.",
      };
    case "coupon":
      return {
        label: "Coupon code",
        placeholder: "e.g. AFRO20",
        type: "text",
        helper: "Fans will receive this code on delivery.",
      };
    case "event_access":
      return {
        label: "Event access details",
        placeholder: "Ticket link or event access instructions",
        type: "textarea",
        helper: "Add the access link or RSVP instructions.",
      };
    case "nft":
      return {
        label: "NFT drop link or contract",
        placeholder: "https://... or 0x...",
        type: "text",
        helper: "Delivery is manual unless you add an NFT hook later.",
      };
    default:
      return {
        label: "Reward details",
        placeholder: "Reward details",
        type: "text",
        helper: "",
      };
  }
};

type WeeklyChallenges = {
  multiplier: number;
  tradeDays: {
    count: number;
    target: number;
    completed: boolean;
    rewarded: boolean;
    reward: { base: number; total: number };
  };
  supportCreators: {
    count: number;
    target: number;
    completed: boolean;
    rewarded: boolean;
    reward: { base: number; total: number };
  };
};

export default function Profile() {
  const { user: privyUser, authenticated } = usePrivy();
  const [selectedTab, setSelectedTab] = useState<"coins" | "liked" | "saved">(
    "coins",
  );
  const [copied, setCopied] = useState(false);
  const [totalEarningsUsd, setTotalEarningsUsd] = useState<number>(0);
  const [totalEarningsOnchain, setTotalEarningsOnchain] = useState<number>(0);
  const [earningsCurrencyLabel, setEarningsCurrencyLabel] = useState<string>("Token");
  const [totalMarketCap, setTotalMarketCap] = useState<number>(0);
  const [totalHolders, setTotalHolders] = useState<number>(0);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string>("");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [longestStreak, setLongestStreak] = useState<number>(0);
  const [totalE1XPPoints, setTotalE1XPPoints] = useState<number>(0);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false); // State for share modal
  const [showWithdrawModal, setShowWithdrawModal] = useState(false); // State for withdraw modal
  const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
  const [missionForm, setMissionForm] = useState({
    title: "",
    description: "",
    type: "hold",
    coinAddress: "",
    requiredAmount: "",
    requiredDays: "",
    rewardType: "e1xp",
    rewardValue: "",
    startsAt: "",
    endsAt: "",
  });
  const [fulfillmentDialog, setFulfillmentDialog] = useState<{
    open: boolean;
    missionId?: string;
    userId?: string;
    rewardValue?: string | null;
  }>({ open: false });
  const [deliveryValue, setDeliveryValue] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const { data: fxRates } = useFxRates();
  const rewardField = getRewardFieldConfig(missionForm.rewardType);
  const requiresRewardValue = missionForm.rewardType !== "e1xp";

  const privyId = privyUser?.id;
  const address = privyUser?.wallet?.address;
  const email = privyUser?.email?.address;
  const { smartAccountAddress } = useSmartAccount();
  const totalEarningsNgn = convertUsdToNgn(totalEarningsUsd, fxRates);
  const changePct = earningsSummary?.changePct ?? 0;
  const changeLabel = `${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}%`;
  const changeColor = changePct >= 0 ? "text-green-500" : "text-red-500";
  const tradeProgress = weeklyChallenges
    ? Math.min(
        100,
        (weeklyChallenges.tradeDays.count / weeklyChallenges.tradeDays.target) * 100,
      )
    : 0;
  const supportProgress = weeklyChallenges
    ? Math.min(
        100,
        (weeklyChallenges.supportCreators.count /
          weeklyChallenges.supportCreators.target) *
          100,
      )
    : 0;

  // Ensure creator exists on mount
  useEffect(() => {
    if (!authenticated || !privyId) return;

    const ensureCreator = async () => {
      try {
        const response = await apiRequest("POST", "/api/creators/sync", {
          privyId,
          address: address || null,
          email: email || null,
        });

        if (response.ok) {
          queryClient.invalidateQueries({
            queryKey: ["/api/creators/privy", privyId],
          });
        }
      } catch (error) {
        console.error("Failed to ensure creator exists:", error);
        // Don't show error to user, will retry on next action
      }
    };

    ensureCreator();
  }, [authenticated, privyId, address, email]);

  // Fetch creator by Privy ID (works for both email and wallet users)
  const { data: creatorData, isLoading: isLoadingCreatorData } = useQuery({
    queryKey: ["/api/creators/privy", privyId],
    enabled: !!privyId && authenticated,
    retry: 3,
    retryDelay: 1000,
  });

  const avatarUrl = creatorData?.avatar || "https://i.ibb.co/JRQCPsZK/ev122logo-1-1.png";

  // Fetch E1XP status for streak info
  const { data: e1xpStatus } = useQuery({
    queryKey: ["/api/e1xp/status", authenticated],
    enabled: authenticated,
    refetchInterval: 5000, // Refetch every 5 seconds to catch updates
    queryFn: async () => {
      const headers: Record<string, string> = {};
      try {
        const accessToken = await getAccessToken();
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }
      } catch (error) {
        console.error("Failed to get access token:", error);
      }
      const response = await fetch("/api/e1xp/status", {
        credentials: "include",
        headers,
      });
      if (!response.ok) throw new Error("Failed to fetch E1XP status");
      return response.json();
    },
  });

  const { data: earningsSummary } = useQuery<EarningsSummary>({
    queryKey: ["/api/earnings/summary"],
    enabled: authenticated,
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const accessToken = await getAccessToken();
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const response = await fetch("/api/earnings/summary", {
        credentials: "include",
        headers,
      });
      if (!response.ok) {
        throw new Error("Failed to fetch earnings summary");
      }
      return response.json();
    },
  });

  const { data: collabSummary } = useQuery<CollabSummary>({
    queryKey: ["/api/collabs/summary"],
    enabled: authenticated,
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const accessToken = await getAccessToken();
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const response = await fetch("/api/collabs/summary", {
        credentials: "include",
        headers,
      });
      if (!response.ok) {
        throw new Error("Failed to fetch collab summary");
      }
      return response.json();
    },
  });

  const { data: weeklyChallenges } = useQuery<WeeklyChallenges>({
    queryKey: ["/api/challenges/weekly"],
    enabled: authenticated,
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const accessToken = await getAccessToken();
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const response = await fetch("/api/challenges/weekly", {
        credentials: "include",
        headers,
      });
      if (!response.ok) {
        throw new Error("Failed to fetch weekly challenges");
      }
      return response.json();
    },
  });

  const creatorIdentifier =
    creatorData?.privyId ||
    (creatorData as any)?.privy_id ||
    creatorData?.address ||
    privyId ||
    "";

  const { data: missions = [] } = useQuery<Mission[]>({
    queryKey: ["/api/missions"],
    enabled: authenticated,
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const accessToken = await getAccessToken();
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const response = await fetch("/api/missions", {
        credentials: "include",
        headers,
      });
      if (!response.ok) throw new Error("Failed to fetch missions");
      return response.json();
    },
  });

  const { data: missionAnalytics } = useQuery<MissionAnalytics>({
    queryKey: ["/api/missions/analytics"],
    enabled: authenticated,
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const accessToken = await getAccessToken();
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const response = await fetch("/api/missions/analytics", {
        credentials: "include",
        headers,
      });
      if (!response.ok) throw new Error("Failed to fetch mission analytics");
      return response.json();
    },
  });

  const { data: pendingFulfillments = [], refetch: refetchPendingFulfillments } = useQuery<MissionFulfillment[]>({
    queryKey: ["/api/missions/pending-fulfillment"],
    enabled: authenticated,
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const accessToken = await getAccessToken();
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const response = await fetch("/api/missions/pending-fulfillment", {
        credentials: "include",
        headers,
      });
      if (!response.ok) throw new Error("Failed to fetch pending fulfillments");
      return response.json();
    },
  });

  const createdMissions = useMemo(() => {
    const identifiers = new Set(
      [creatorIdentifier, creatorData?.address, privyId].filter(Boolean) as string[],
    );
    return missions.filter((mission) => identifiers.has(mission.creatorId));
  }, [missions, creatorIdentifier, creatorData?.address, privyId]);

  const activeMissionsCount = missionAnalytics?.activeMissions ?? createdMissions.filter(
    (mission) => (mission.missionStatus || mission.status) === "active",
  ).length;

  const createMissionMutation = useMutation({
    mutationFn: async () => {
      const accessToken = await getAccessToken();
      const payload = {
        title: missionForm.title,
        description: missionForm.description || undefined,
        type: missionForm.type as Mission["type"],
        coinAddress: missionForm.coinAddress || undefined,
        requiredAmount: missionForm.requiredAmount
          ? Number(missionForm.requiredAmount)
          : undefined,
        requiredDays: missionForm.requiredDays
          ? Number(missionForm.requiredDays)
          : undefined,
        rewardType: missionForm.rewardType as Mission["rewardType"],
        rewardValue: missionForm.rewardValue || undefined,
        startsAt: missionForm.startsAt || undefined,
        endsAt: missionForm.endsAt || undefined,
      };

      const response = await apiRequest(
        "POST",
        "/api/missions",
        payload,
        accessToken,
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/missions"] });
      setIsMissionModalOpen(false);
      setMissionForm({
        title: "",
        description: "",
        type: "hold",
        coinAddress: "",
        requiredAmount: "",
        requiredDays: "",
        rewardType: "e1xp",
        rewardValue: "",
        startsAt: "",
        endsAt: "",
      });
      toast({
        title: "Mission created",
        description: "Your mission is now live.",
      });
    },
    onError: () => {
      toast({
        title: "Mission creation failed",
        description: "Please check the form and try again.",
        variant: "destructive",
      });
    },
  });

  const closeMissionMutation = useMutation({
    mutationFn: async (missionId: string) => {
      const accessToken = await getAccessToken();
      const response = await apiRequest(
        "POST",
        `/api/missions/${missionId}/close`,
        {},
        accessToken,
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/missions"] });
      toast({
        title: "Mission closed",
        description: "This mission is no longer active.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to close mission",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const fulfillMissionMutation = useMutation({
    mutationFn: async (payload: { missionId: string; userId: string; deliveryValue?: string; deliveryNotes?: string }) => {
      const accessToken = await getAccessToken();
      const response = await apiRequest(
        "POST",
        `/api/missions/${payload.missionId}/fulfill`,
        {
          userId: payload.userId,
          deliveryValue: payload.deliveryValue,
          deliveryNotes: payload.deliveryNotes,
        },
        accessToken,
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/missions"] });
      refetchPendingFulfillments();
      setFulfillmentDialog({ open: false });
      setDeliveryValue("");
      setDeliveryNotes("");
      toast({
        title: "Reward delivered",
        description: "The fan has been notified.",
      });
    },
    onError: () => {
      toast({
        title: "Delivery failed",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Use creator address if available, otherwise these queries will be disabled
  const creatorAddress = creatorData?.address || address || creatorData?.privyId || privyId;

  const { data: followers = [] } = useQuery({
    queryKey: ["/api/follows/followers", creatorAddress],
    enabled: !!creatorAddress && authenticated && !!creatorData,
    retry: false,
  });

  const { data: following = [] } = useQuery({
    queryKey: ["/api/follows/following", creatorAddress],
    enabled: !!creatorAddress && authenticated && !!creatorData,
    retry: false,
  });

  useEffect(() => {
    setFollowersCount(followers.length || 0);
    setFollowingCount(following.length || 0);
  }, [followers, following]);

  // Update local stats when e1xpStatus changes
  useEffect(() => {
    if (e1xpStatus) {
      setCurrentStreak(e1xpStatus.streak || 0);
      setLongestStreak(e1xpStatus.longestStreak || 0);
      setTotalE1XPPoints(e1xpStatus.points || 0);
    }
  }, [e1xpStatus]);

  const { data: coins = [], isLoading: isLoadingCoins } = useQuery<Coin[]>({
    queryKey: ["/api/coins"],
  });

  const createdCoins = useMemo(() => {
    const creatorAddress = creatorData?.address || address;
    if (!creatorAddress) return [];
    return coins.filter(
      (coin) =>
        coin.creatorWallet &&
        coin.creatorWallet.toLowerCase() === creatorAddress.toLowerCase(),
    );
  }, [coins, creatorData, address]);

  const displayedCoins = createdCoins.filter(
    (coin) => coin.address !== null,
  ) as Array<(typeof createdCoins)[0] & { address: string }>;

  useEffect(() => {
    if (!address || !authenticated || !createdCoins.length) {
      setTotalEarningsUsd(0);
      setTotalEarningsOnchain(0);
      setEarningsCurrencyLabel("Token");
      setTotalMarketCap(0);
      setTotalHolders(0);
      setIsLoadingStats(false);
      return;
    }

    let isMounted = true;
    setIsLoadingStats(true);

    async function fetchAllStats() {
      try {
        let earningsUsd = 0;
        let earningsOnchain = 0;
        const currencyLabels = new Set<string>();
        let marketCap = 0;
        let holders = 0;

        for (const coin of createdCoins) {
          if (coin.address && coin.status === "active") {
            try {
              const coinData = await getCoin({
                address: coin.address as `0x${string}`,
                chain: base,
              });

              const tokenData = coinData.data?.zora20Token;

              if (tokenData?.creatorEarnings && tokenData.creatorEarnings.length > 0) {
                const earningEntry = tokenData.creatorEarnings[0];
                const amountUsd = earningEntry.amountUsd
                  ? parseFloat(String(earningEntry.amountUsd))
                  : 0;
                const amountDecimal = earningEntry.amount?.amountDecimal
                  ? Number(earningEntry.amount.amountDecimal)
                  : 0;

                if (Number.isFinite(amountUsd) && amountUsd > 0) {
                  earningsUsd += amountUsd;
                }

                if (Number.isFinite(amountDecimal) && amountDecimal > 0) {
                  earningsOnchain += amountDecimal;
                }

                const currencyLabel =
                  tokenData.poolCurrencyToken?.name ||
                  tokenData.poolCurrencyToken?.address ||
                  earningEntry.amount?.currencyAddress ||
                  "Token";
                currencyLabels.add(currencyLabel);
              }

              if (tokenData?.marketCap) {
                marketCap += parseFloat(tokenData.marketCap);
              }

              if (tokenData?.uniqueHolders) {
                holders += tokenData.uniqueHolders;
              }
            } catch (err) {
              console.error(
                `Error fetching coin stats for ${coin.address}:`,
                err,
              );
            }
          }
        }

        if (isMounted) {
          setTotalEarningsUsd(earningsUsd);
          setTotalEarningsOnchain(earningsOnchain);
          setEarningsCurrencyLabel(
            currencyLabels.size === 1
              ? Array.from(currencyLabels)[0]
              : currencyLabels.size > 1
                ? "Multiple"
                : "Token",
          );
          setTotalMarketCap(marketCap);
          setTotalHolders(holders);
          setIsLoadingStats(false);
        }
      } catch (error) {
        console.error("Error fetching creator stats:", error);
        if (isMounted) {
          setTotalEarningsUsd(0);
          setTotalEarningsOnchain(0);
          setEarningsCurrencyLabel("Token");
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
  }, [address, authenticated, createdCoins]);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getDisplayName = () => {
    // First check if creator has a custom name set
    if (creatorData?.name) {
      return creatorData.name;
    }

    // For wallet users, show formatted address
    if (address) {
      return formatAddress(address);
    }

    // For email-only users, use email prefix
    if (email) {
      return email.split("@")[0];
    }

    return "Creator";
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
    if (!creatorData?.id) {
      toast({
        title: "Profile not ready",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
      return;
    }
    setIsShareModalOpen(true);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setProfileImage(file);

      setIsUploadingImage(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Failed to upload image");
        }

        const data = await response.json();
        setProfileImageUrl(data.url);

        toast({
          title: "Image uploaded",
          description: "Profile image uploaded successfully",
        });
      } catch (error) {
        console.error("Image upload error:", error);
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

  useEffect(() => {
    if (creatorData) {
      setUsername(creatorData.name || "");
      setBio(creatorData.bio || "");
      setProfileImageUrl(creatorData.avatar || "");
      setWalletAddress(creatorData.walletAddress || address || "");
    } else if (email && !creatorData) {
      // For new email users without a creator profile yet, set a default username
      setUsername(email.split("@")[0]);
    }
  }, [creatorData, address, email]);

  const handleSaveProfile = async () => {
    if (!privyId) {
      toast({
        title: "Error",
        description: "Not authenticated",
        variant: "destructive",
      });
      return;
    }

    // Validate payout wallet address format if provided
    if (
      walletAddress &&
      walletAddress.trim() &&
      !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)
    ) {
      toast({
        title: "Error",
        description:
          "Invalid payout wallet address format. Must be a valid Ethereum address (0x...)",
        variant: "destructive",
      });
      return;
    }

    setIsSavingProfile(true);
    try {
      let creator: any = creatorData;

      // For email users, ensure creator exists by syncing first
      if (!creator) {
        console.log("Creator not found, syncing profile...");
        const syncResponse = await apiRequest("POST", "/api/creators/sync", {
          privyId,
          address: address || null,
          email: email || null,
        });

        if (!syncResponse.ok) {
          throw new Error("Failed to sync creator profile");
        }

        creator = await syncResponse.json();
        console.log("Creator synced:", creator);
      }

      if (!creator || !creator.id) {
        toast({
          title: "Error",
          description:
            "Unable to create profile. Please try logging out and back in.",
          variant: "destructive",
        });
        return;
      }

      // Update the creator profile
      const updateResponse = await apiRequest(
        "PATCH",
        `/api/creators/${creator.id}`,
        {
          name: username.trim() || null,
          bio: bio.trim() || null,
          avatar: profileImageUrl || null,
          walletAddress: walletAddress.trim() || null, // Payout address
        },
      );

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.message || "Failed to update profile");
      }

      creator = await updateResponse.json();

      // Invalidate all relevant queries to refresh the UI
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["/api/creators/privy", privyId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["/api/creators/address", address],
        }),
        queryClient.invalidateQueries({ queryKey: ["/api/creators"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/coins"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/e1xp/status"] }),
      ]);

      // Force a refetch of creator data
      await queryClient.refetchQueries({
        queryKey: ["/api/creators/privy", privyId],
      });

      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully",
      });

      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Profile update error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserIcon className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2
            className="text-2xl font-bold text-foreground mb-2"
            data-testid="text-connect-wallet"
          >
            Connect Your Wallet
          </h2>
          <p className="text-muted-foreground">
            Please connect your wallet to view your profile
          </p>
        </div>
      </div>
    );
  }

  if (isLoadingCreatorData) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
        <div className="flex flex-col items-center text-center mb-6">
          <Skeleton className="w-24 h-24 rounded-full mb-4" />
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-4 w-24 mb-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-20 px-4">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button
          onClick={() => window.history.back()}
          className="p-2 hover:bg-muted rounded-lg"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex-1"></div>
      </div>

      {/* Profile Section */}
      <div className="flex flex-col items-center text-center py-6 px-4">
        {/* Avatar */}
        <img
          src={avatarUrl}
          alt="Profile"
          className="w-24 h-24 rounded-full border-2 border-border object-cover mb-4"
          data-testid="img-profile-avatar"
        />

        {/* Username with verification */}
        <div className="flex items-center gap-1 mb-1">
          <h2 className="text-base font-semibold">
            @{getDisplayName()}
          </h2>
          {creatorData?.verified === "true" && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="8" fill="#20D5EC" />
              <path
                d="M6.5 8.5L7.5 9.5L10 7"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 mb-4">
          <div>
            <div className="text-lg font-bold" data-testid="text-posts">
              {isLoadingCoins ? "-" : createdCoins.length}
            </div>
            <div className="text-xs text-muted-foreground">Posts</div>
          </div>
          <div>
            <div className="text-lg font-bold" data-testid="text-followers">
              {followersCount}
            </div>
            <div className="text-xs text-muted-foreground">Followers</div>
          </div>
          <div>
            <div className="text-lg font-bold" data-testid="text-following">
              {followingCount}
            </div>
            <div className="text-xs text-muted-foreground">Following</div>
          </div>
          <div
            className="cursor-pointer"
            onClick={() => setShowWithdrawModal(true)}
          >
            <div
              className="text-lg font-bold text-green-500"
              data-testid="text-earnings"
            >
              {isLoadingStats
                ? "-"
                : totalEarningsNgn && totalEarningsNgn > 1000
                  ? `₦${(totalEarningsNgn / 1000).toFixed(1)}k`
                  : formatSmartCurrency(totalEarningsNgn)}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              Cash out
              {totalEarningsOnchain > 0 && (
                <Wallet className="w-3 h-3 text-green-500" />
              )}
            </div>
            {totalEarningsOnchain > 0 && (
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Onchain: {totalEarningsOnchain.toFixed(4)} {earningsCurrencyLabel}
              </div>
            )}
          </div>
        </div>

        <div className="w-full max-w-sm mx-auto grid gap-3 mb-4">
          <Card className="rounded-2xl border-border/60 bg-muted/20">
            <div className="p-3 space-y-1">
              <p className="text-[11px] text-muted-foreground">Today&apos;s earnings</p>
              <p className="text-lg font-semibold">
                {formatSmartCurrency(earningsSummary?.last24hNgn || 0)}
              </p>
              <div className="flex items-center gap-2 text-[11px]">
                <span className={changeColor}>{changeLabel}</span>
                <span className="text-muted-foreground">last 24h</span>
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl border-border/60 bg-muted/20">
            <div className="p-3 space-y-1">
              <p className="text-[11px] text-muted-foreground">Collab earnings</p>
              <p className="text-lg font-semibold">
                {formatSmartCurrency(collabSummary?.totalEarningsNgn || 0)}
              </p>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">
                  {collabSummary?.totalCollabs || 0} collabs
                </span>
                <span className="text-muted-foreground">
                  Volume {formatSmartCurrency(collabSummary?.totalVolumeNgn || 0)}
                </span>
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl border-border/60 bg-muted/20">
            <div className="p-3 space-y-1">
              <p className="text-[11px] text-muted-foreground">Active missions</p>
              <p className="text-lg font-semibold">{activeMissionsCount}</p>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{missionAnalytics?.totalCompletions ?? 0} completions</span>
                <span>
                  {missionAnalytics?.totalRewardPayouts ?? 0} E1XP paid
                </span>
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl border-border/60 bg-muted/20">
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">Weekly challenges</p>
                {weeklyChallenges?.multiplier && weeklyChallenges.multiplier > 1 && (
                  <span className="text-[10px] text-muted-foreground">
                    {weeklyChallenges.multiplier}x referral boost
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span>Trade {weeklyChallenges?.tradeDays.target || 3} days</span>
                  <span className="text-muted-foreground">
                    {weeklyChallenges?.tradeDays.count || 0}/
                    {weeklyChallenges?.tradeDays.target || 3}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted/40">
                  <div
                    className="h-2 rounded-full bg-green-500 transition-all"
                    style={{ width: `${tradeProgress}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span>Support {weeklyChallenges?.supportCreators.target || 2} creators</span>
                  <span className="text-muted-foreground">
                    {weeklyChallenges?.supportCreators.count || 0}/
                    {weeklyChallenges?.supportCreators.target || 2}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted/40">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: `${supportProgress}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="w-full max-w-2xl mx-auto mb-6">
          {pendingFulfillments.length > 0 && (
            <Card className="rounded-2xl border-border/60 bg-card p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Pending mission rewards</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Deliver rewards to fans who completed your missions.
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {pendingFulfillments.map((item) => (
                  <div
                    key={item.userMissionId}
                    className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-foreground">
                        {item.missionTitle}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Reward: {item.rewardType}
                        {item.rewardValue ? ` • ${item.rewardValue}` : ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Fan: {formatAddress(item.userId)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="rounded-full text-xs"
                      onClick={() => {
                        setFulfillmentDialog({
                          open: true,
                          missionId: item.missionId,
                          userId: item.userId,
                          rewardValue: item.rewardValue,
                        });
                        setDeliveryValue(item.rewardValue || "");
                        setDeliveryNotes("");
                      }}
                    >
                      Deliver reward
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-semibold">Your Missions</h2>
              <p className="text-xs text-muted-foreground">
                Create missions to reward fans and grow coin demand.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              onClick={() => setIsMissionModalOpen(true)}
            >
              Create Mission
            </Button>
          </div>

          <div className="grid gap-3">
            {createdMissions.length === 0 && (
              <Card className="rounded-2xl border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                No missions yet. Create your first mission to start rewarding fans.
              </Card>
            )}

            {createdMissions.map((mission) => {
              const status = mission.missionStatus || (mission as any).status || "active";
              const statusLabel =
                status === "active"
                  ? "Active"
                  : status === "upcoming"
                    ? "Upcoming"
                    : status === "expired"
                      ? "Expired"
                      : "Closed";
              return (
                <Card key={mission.id} className="rounded-2xl border-border/60 bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">
                          {mission.title}
                        </h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {statusLabel}
                        </span>
                      </div>
                      {mission.description && (
                        <p className="text-xs text-muted-foreground">
                          {mission.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <span>Type: {mission.type}</span>
                        {mission.requiredAmount && (
                          <span>Hold {mission.requiredAmount}</span>
                        )}
                        {mission.requiredDays && (
                          <span>{mission.requiredDays} days</span>
                        )}
                        <span>
                          Reward:{" "}
                          {mission.rewardType === "e1xp"
                            ? `${mission.rewardValue || "10"} E1XP`
                            : mission.rewardValue
                              ? `${mission.rewardType} • ${mission.rewardValue}`
                              : mission.rewardType}
                        </span>
                      </div>
                    </div>
                    {status === "active" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full text-xs"
                        onClick={() => closeMissionMutation.mutate(mission.id)}
                        disabled={closeMissionMutation.isLoading}
                      >
                        Close
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <Dialog open={isMissionModalOpen} onOpenChange={setIsMissionModalOpen}>
          <DialogContent className="max-w-lg w-[92vw] rounded-2xl">
            <DialogHeader>
              <DialogTitle>Create Mission</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Mission title"
                value={missionForm.title}
                onChange={(e) => setMissionForm({ ...missionForm, title: e.target.value })}
              />
              <Textarea
                placeholder="Short description"
                value={missionForm.description}
                onChange={(e) => setMissionForm({ ...missionForm, description: e.target.value })}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Type</label>
                  <select
                    className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                    value={missionForm.type}
                    onChange={(e) => setMissionForm({ ...missionForm, type: e.target.value })}
                  >
                    <option value="hold">Hold</option>
                    <option value="activity">Activity</option>
                    <option value="loyalty">Loyalty</option>
                    <option value="event">Event</option>
                    <option value="community">Community</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Reward Type</label>
                  <select
                    className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                    value={missionForm.rewardType}
                    onChange={(e) => setMissionForm({ ...missionForm, rewardType: e.target.value })}
                  >
                    <option value="e1xp">E1XP</option>
                    <option value="content">Content</option>
                    <option value="coupon">Coupon</option>
                    <option value="event_access">Event Access</option>
                    <option value="nft">NFT</option>
                  </select>
                </div>
              </div>
              <Input
                placeholder="Coin address (optional)"
                value={missionForm.coinAddress}
                onChange={(e) => setMissionForm({ ...missionForm, coinAddress: e.target.value })}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Required amount"
                  value={missionForm.requiredAmount}
                  onChange={(e) => setMissionForm({ ...missionForm, requiredAmount: e.target.value })}
                />
                <Input
                  placeholder="Required days"
                  value={missionForm.requiredDays}
                  onChange={(e) => setMissionForm({ ...missionForm, requiredDays: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{rewardField.label}</label>
                {rewardField.type === "textarea" ? (
                  <Textarea
                    placeholder={rewardField.placeholder}
                    value={missionForm.rewardValue}
                    onChange={(e) => setMissionForm({ ...missionForm, rewardValue: e.target.value })}
                  />
                ) : (
                  <Input
                    type={rewardField.type}
                    placeholder={rewardField.placeholder}
                    value={missionForm.rewardValue}
                    onChange={(e) => setMissionForm({ ...missionForm, rewardValue: e.target.value })}
                  />
                )}
                {rewardField.helper && (
                  <p className="text-[11px] text-muted-foreground">{rewardField.helper}</p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  type="date"
                  value={missionForm.startsAt}
                  onChange={(e) => setMissionForm({ ...missionForm, startsAt: e.target.value })}
                />
                <Input
                  type="date"
                  value={missionForm.endsAt}
                  onChange={(e) => setMissionForm({ ...missionForm, endsAt: e.target.value })}
                />
              </div>
              <Button
                className="w-full rounded-full"
                onClick={() => createMissionMutation.mutate()}
                disabled={
                  !missionForm.title ||
                  (requiresRewardValue && !missionForm.rewardValue) ||
                  createMissionMutation.isLoading
                }
              >
                {createMissionMutation.isLoading ? "Creating..." : "Publish Mission"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={fulfillmentDialog.open}
          onOpenChange={(open) => setFulfillmentDialog((prev) => ({ ...prev, open }))}
        >
          <DialogContent className="max-w-md w-[92vw] rounded-2xl">
            <DialogHeader>
              <DialogTitle>Deliver reward</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Delivery value (link, code, instructions)"
                value={deliveryValue}
                onChange={(e) => setDeliveryValue(e.target.value)}
              />
              <Textarea
                placeholder="Optional delivery notes"
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
              />
              <Button
                className="w-full rounded-full"
                onClick={() =>
                  fulfillmentDialog.missionId &&
                  fulfillmentDialog.userId &&
                  fulfillMissionMutation.mutate({
                    missionId: fulfillmentDialog.missionId,
                    userId: fulfillmentDialog.userId,
                    deliveryValue: deliveryValue || undefined,
                    deliveryNotes: deliveryNotes || undefined,
                  })
                }
                disabled={!fulfillmentDialog.missionId || !fulfillmentDialog.userId || fulfillMissionMutation.isLoading}
              >
                {fulfillMissionMutation.isLoading ? "Delivering..." : "Mark delivered"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-2 mb-4 w-full max-w-sm mx-auto">
          <Button
            onClick={() => setIsEditModalOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg h-9 text-xs px-3"
            data-testid="button-edit-profile"
          >
            Edit Profile
          </Button>
          <div className="flex items-center gap-1 px-2.5 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 2L9.5 6.5L14 8L9.5 9.5L8 14L6.5 9.5L2 8L6.5 6.5L8 2Z"
                fill="#EAB308"
              />
            </svg>
            <span className="text-xs font-bold text-yellow-600 dark:text-yellow-500">
              {totalE1XPPoints.toLocaleString()}
            </span>
          </div>
          <Button
            onClick={handleShare}
            variant="outline"
            size="icon"
            className="rounded-lg h-9 w-9"
            data-testid="button-share-profile"
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Bio */}
        {creatorData?.bio && (
          <p
            className="text-sm text-foreground mb-2 max-w-md"
            data-testid="text-bio"
          >
            {creatorData.bio}
          </p>
        )}

        {/* Smart Account Address (for email users) */}
        {email && smartAccountAddress && (
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg text-xs font-mono max-w-md mx-auto mb-2">
            <Wallet className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground truncate">
              {formatAddress(smartAccountAddress)}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(smartAccountAddress);
                toast({
                  title: "Smart account copied",
                  description: "Your smart account address has been copied",
                });
              }}
              className="p-1 hover:bg-muted rounded"
            >
              {copied ? (
                <Check className="w-3 h-3" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-border">
        <button
          onClick={() => setSelectedTab("coins")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 ${
            selectedTab === "coins"
              ? "text-foreground border-b-2 border-foreground"
              : "text-muted-foreground"
          }`}
        >
          <Grid3x3 className="w-4 h-4" />
        </button>
        <button
          onClick={() => setSelectedTab("liked")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 ${
            selectedTab === "liked"
              ? "text-foreground border-b-2 border-foreground"
              : "text-muted-foreground"
          }`}
        >
          <Heart className="w-4 h-4" />
        </button>
        <button
          onClick={() => setSelectedTab("saved")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 ${
            selectedTab === "saved"
              ? "text-foreground border-b-2 border-foreground"
              : "text-muted-foreground"
          }`}
        >
          <Bookmark className="w-4 h-4" />
        </button>
      </div>

      {/* Content Grid */}
      {isLoadingCoins ? (
        <div className="grid grid-cols-3 gap-1 p-1">
          {[...Array(9)].map((_, i) => (
            <div
              key={i}
              className="aspect-square bg-muted/20 animate-pulse"
            ></div>
          ))}
        </div>
      ) : displayedCoins.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Grid3x3 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3
            className="text-xl font-bold text-foreground mb-2"
            data-testid="text-no-coins"
          >
            No coins created yet
          </h3>
          <p className="text-muted-foreground">
            Start creating your first coin!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 p-1">
          {displayedCoins.map((coin) => (
            <div
              key={coin.id}
              className="aspect-square relative cursor-pointer group overflow-hidden"
              onClick={() => setLocation(`/coins/${coin.id}`)}
            >
              {coin.imageUrl ? (
                <img
                  src={coin.imageUrl}
                  alt={coin.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary/40">
                    {coin.symbol.slice(0, 2)}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="text-white text-xs font-semibold flex items-center gap-1">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
                    <path d="M8 2L9.5 6.5L14 8L9.5 9.5L8 14L6.5 9.5L2 8L6.5 6.5L8 2Z" />
                  </svg>
                  {coin.name}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Profile Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[380px] rounded-2xl p-5">
          <DialogHeader className="pb-1">
            <DialogTitle className="text-base font-semibold">
              Edit Profile
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2.5">
            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground">
                Profile Image
              </label>
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                disabled={isUploadingImage || isSavingProfile}
                data-testid="input-profile-image"
                className="h-8 text-xs"
              />
              {isUploadingImage && (
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-muted-foreground">
                    Uploading image...
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground">
                Username
              </label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your username"
                data-testid="input-username"
                disabled={isSavingProfile}
                className="h-8 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground">
                Bio
              </label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                rows={2}
                data-testid="input-bio"
                disabled={isSavingProfile}
                className="text-sm resize-none min-h-[60px]"
              />
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground">
                Payout Wallet Address
              </label>
              <Input
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="0x... (where you want to receive Zora rewards)"
                data-testid="input-wallet-address"
                disabled={isSavingProfile}
                className="h-8 text-sm font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Your Zora coin earnings and rewards will be sent to this wallet
                address
              </p>
            </div>

            <Button
              onClick={handleSaveProfile}
              className="w-full h-9 relative rounded-full"
              data-testid="button-save-profile"
              disabled={isUploadingImage || isSavingProfile}
            >
              {isSavingProfile && (
                <div className="absolute left-3 w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              )}
              <span className={isSavingProfile ? "ml-5" : ""}>
                {isSavingProfile ? "Saving profile..." : "Save Changes"}
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Modal */}
      <ShareModal
        open={isShareModalOpen}
        onOpenChange={setIsShareModalOpen}
        type="profile"
        resourceId={creatorData?.id || ""}
        title={`${creatorData?.name || formatAddress(address || "")} - CoinIT Profile`}
      />

      <WithdrawEarningsModal
        open={showWithdrawModal}
        onOpenChange={setShowWithdrawModal}
        userCoins={
          createdCoins.filter((coin) => coin.address !== null) as Array<
            (typeof createdCoins)[0] & { address: string }
          >
        }
      />
    </div>
  );
}
