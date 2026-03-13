import { useQuery, useMutation } from "@tanstack/react-query";
import { usePrivy, getAccessToken } from "@privy-io/react-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";

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

type Mission = {
  id: string;
  title: string;
  description: string;
  type: "hold" | "activity" | "loyalty" | "event" | "community";
  coinAddress?: string | null;
  requiredAmount?: string | number | null;
  requiredDays?: number | null;
  rewardType: "e1xp" | "nft" | "content" | "coupon" | "event_access";
  rewardValue?: string | null;
  missionStatus: "upcoming" | "active" | "closed" | "expired";
  userStatus?: "not_joined" | "in_progress" | "completed" | "claimed";
  userProgress?: number;
  userRewardStatus?: string | null;
  userRewardDeliveredAt?: string | null;
  userRewardDeliveryValue?: string | null;
};

export default function FansMissions() {
  const { authenticated } = usePrivy();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formState, setFormState] = useState({
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

  const { data: missions = [], isLoading } = useQuery<Mission[]>({
    queryKey: ["/api/missions"],
    queryFn: async () => {
      const accessToken = authenticated ? await getAccessToken() : null;
      const headers: Record<string, string> = {};
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const response = await fetch("/api/missions", {
        headers,
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch missions");
      return response.json();
    },
  });

  const joinMissionMutation = useMutation({
    mutationFn: async (missionId: string) => {
      const accessToken = await getAccessToken();
      const response = await apiRequest(
        "POST",
        `/api/missions/${missionId}/join`,
        {},
        accessToken,
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/missions"] });
    },
  });

  const claimMissionMutation = useMutation({
    mutationFn: async (missionId: string) => {
      const accessToken = await getAccessToken();
      const response = await apiRequest(
        "POST",
        `/api/missions/${missionId}/claim`,
        {},
        accessToken,
      );
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/missions"] });
      const rewardStatus = data?.rewardStatus;
      toast({
        title: "Reward processed",
        description:
          data?.rewardType === "e1xp"
            ? "E1XP reward added to your account."
            : rewardStatus === "delivered"
              ? "Your reward has been delivered."
              : "Your reward is pending delivery.",
      });
    },
  });

  const createMissionMutation = useMutation({
    mutationFn: async () => {
      const accessToken = await getAccessToken();
      const payload = {
        title: formState.title,
        description: formState.description || undefined,
        type: formState.type as Mission["type"],
        coinAddress: formState.coinAddress || undefined,
        requiredAmount: formState.requiredAmount ? Number(formState.requiredAmount) : undefined,
        requiredDays: formState.requiredDays ? Number(formState.requiredDays) : undefined,
        rewardType: formState.rewardType as Mission["rewardType"],
        rewardValue: formState.rewardValue || undefined,
        startsAt: formState.startsAt || undefined,
        endsAt: formState.endsAt || undefined,
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
      setIsCreateOpen(false);
      setFormState({
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

  const handleJoin = async (missionId: string) => {
    if (!authenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to join missions.",
        variant: "destructive",
      });
      return;
    }
    try {
      await joinMissionMutation.mutateAsync(missionId);
      toast({
        title: "Mission joined",
        description: "We will track your progress automatically.",
      });
    } catch (error) {
      toast({
        title: "Join failed",
        description: "Unable to join mission. Try again.",
        variant: "destructive",
      });
    }
  };

  const rewardField = getRewardFieldConfig(formState.rewardType);
  const requiresRewardValue = formState.rewardType !== "e1xp";

  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">
            Fan Missions
          </h1>
          <p className="text-sm text-muted-foreground">
            Complete missions to unlock rewards, perks, and creator access.
          </p>
          {authenticated && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                className="rounded-full text-xs h-8 px-4"
                onClick={() => setIsCreateOpen(true)}
              >
                Create Mission
              </Button>
            </div>
          )}
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-lg w-[92vw] rounded-2xl">
            <DialogHeader>
              <DialogTitle>Create a Mission</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Mission title"
                value={formState.title}
                onChange={(e) => setFormState({ ...formState, title: e.target.value })}
              />
              <Textarea
                placeholder="Short description"
                value={formState.description}
                onChange={(e) => setFormState({ ...formState, description: e.target.value })}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Type</label>
                  <select
                    className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                    value={formState.type}
                    onChange={(e) => setFormState({ ...formState, type: e.target.value })}
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
                    value={formState.rewardType}
                    onChange={(e) => setFormState({ ...formState, rewardType: e.target.value })}
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
                value={formState.coinAddress}
                onChange={(e) => setFormState({ ...formState, coinAddress: e.target.value })}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Required amount"
                  value={formState.requiredAmount}
                  onChange={(e) => setFormState({ ...formState, requiredAmount: e.target.value })}
                />
                <Input
                  placeholder="Required days"
                  value={formState.requiredDays}
                  onChange={(e) => setFormState({ ...formState, requiredDays: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{rewardField.label}</label>
                {rewardField.type === "textarea" ? (
                  <Textarea
                    placeholder={rewardField.placeholder}
                    value={formState.rewardValue}
                    onChange={(e) => setFormState({ ...formState, rewardValue: e.target.value })}
                  />
                ) : (
                  <Input
                    type={rewardField.type}
                    placeholder={rewardField.placeholder}
                    value={formState.rewardValue}
                    onChange={(e) => setFormState({ ...formState, rewardValue: e.target.value })}
                  />
                )}
                {rewardField.helper && (
                  <p className="text-[11px] text-muted-foreground">{rewardField.helper}</p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  type="date"
                  value={formState.startsAt}
                  onChange={(e) => setFormState({ ...formState, startsAt: e.target.value })}
                />
                <Input
                  type="date"
                  value={formState.endsAt}
                  onChange={(e) => setFormState({ ...formState, endsAt: e.target.value })}
                />
              </div>
              <Button
                className="w-full rounded-full"
                onClick={() => createMissionMutation.mutate()}
                disabled={
                  !formState.title ||
                  (requiresRewardValue && !formState.rewardValue) ||
                  createMissionMutation.isLoading
                }
              >
                {createMissionMutation.isLoading ? "Creating..." : "Publish Mission"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid gap-4 md:grid-cols-2">
          {isLoading && (
            <Card className="p-6">
              <div className="text-sm text-muted-foreground">
                Loading missions...
              </div>
            </Card>
          )}

          {!isLoading && missions.length === 0 && (
            <Card className="p-6">
              <div className="text-sm text-muted-foreground">
                No missions available yet. Check back soon.
              </div>
            </Card>
          )}

          {missions.map((mission) => {
            const missionStatusLabel =
              mission.missionStatus === "active"
                ? "Active"
                : mission.missionStatus === "upcoming"
                  ? "Upcoming"
                  : mission.missionStatus === "expired"
                    ? "Expired"
                    : "Closed";
            const userStatus = mission.userStatus || "not_joined";
            const canJoin =
              mission.missionStatus === "active" && userStatus === "not_joined";
            const canClaim =
              mission.missionStatus === "active" &&
              (userStatus === "completed" || userStatus === "in_progress");
            const claimLabel =
              userStatus === "claimed"
                ? mission.userRewardStatus === "pending"
                  ? "Pending"
                  : "Claimed"
                : "Claim Reward";

            return (
            <Card key={mission.id} className="p-5 space-y-3">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">
                  {mission.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {mission.description}
                </p>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Requirement</span>
                <span>
                  {mission.type === "hold" && mission.requiredAmount
                    ? `Hold ${mission.requiredAmount} coins`
                    : mission.type === "loyalty" && mission.requiredDays
                      ? `Hold ${mission.requiredDays} days`
                      : "Activity based"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Reward</span>
                <span>
                  {mission.rewardType === "e1xp"
                    ? `${mission.rewardValue || "10"} E1XP`
                    : mission.rewardValue
                      ? `${mission.rewardType} • ${mission.rewardValue}`
                      : mission.rewardType}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Status: {missionStatusLabel}</span>
                <span>Your status: {userStatus.replace("_", " ")}</span>
              </div>
              {mission.userRewardStatus && (
                <div className="text-[11px] text-muted-foreground">
                  Reward: {mission.userRewardStatus === "pending" ? "Pending delivery" : "Delivered"}
                  {mission.userRewardStatus === "delivered" && mission.userRewardDeliveryValue ? (
                    <span className="block text-[11px] text-muted-foreground">
                      {mission.userRewardDeliveryValue}
                    </span>
                  ) : null}
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  className="w-full h-9 rounded-full"
                  onClick={() => handleJoin(mission.id)}
                  disabled={!canJoin || joinMissionMutation.isLoading}
                >
                  {canJoin ? "Join Mission" : "Joined"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-9 rounded-full"
                  onClick={() => claimMissionMutation.mutate(mission.id)}
                  disabled={!canClaim || claimMissionMutation.isLoading}
                >
                  {claimLabel}
                </Button>
              </div>
            </Card>
          );
        })}
        </div>
      </div>
    </div>
  );
}
