import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BookOpen, Users, TrendingUp, Shield, Trophy, MessageSquare } from "lucide-react";

export default function About() {
  return (
    <div className="container max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-3">
        <BookOpen className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">About creat8*</h1>
      </div>

      <p className="text-lg text-muted-foreground">
        creat8* is a Naira‑first creator economy where fans can support and trade creator coins,
        and creators earn directly from community activity. Everything feels like a normal local
        experience — no confusing setup, no complicated steps.
      </p>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>For Creators</CardTitle>
            </div>
            <CardDescription>Launch a creator coin in minutes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              Create a coin for your profile, a project, or a collaboration. Share your link and
              let fans buy and sell directly in Naira.
            </p>
            <p>
              Earn from activity, see your earnings dashboard, and withdraw to your bank when you’re ready.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle>For Fans</CardTitle>
            </div>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                Support creators with Naira, trade their coins, and track prices in a clean, simple interface.
              </p>
              <p>
                Your balance updates instantly, and you can sell anytime. It’s designed to feel familiar and fast.
              </p>
            </CardContent>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <CardTitle>Missions & Rewards</CardTitle>
            </div>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                Creators can launch missions that reward fans for holding a coin, participating in events,
                or completing activities.
              </p>
              <p>
                Rewards can be points, content access, coupons, event access, or special drops. Some rewards
                are delivered instantly, and others are marked pending until the creator confirms delivery.
              </p>
            </CardContent>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>How Rewards Are Delivered</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              When you complete a mission, rewards can arrive in two ways:
            </p>
            <p>
              <strong>Delivered:</strong> The reward is available immediately and you can see the details on
              your mission card.
            </p>
            <p>
              <strong>Pending:</strong> The creator needs to confirm delivery (for example, a private link,
              coupon, or event access). You’ll see the status as “Pending” until it’s confirmed.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>Collab Coins</CardTitle>
            </div>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                Creators can co‑launch a shared coin, invite collaborators, and split earnings automatically.
              </p>
              <p>
                Each collaborator gets their own stats, earnings visibility, and community activity tracking.
              </p>
            </CardContent>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <CardTitle>Community & Notifications</CardTitle>
            </div>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                Follow creators, message the community, and stay updated with real‑time alerts for new coins,
                missions, collabs, and trending activity.
              </p>
            </CardContent>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>Simple, Safe, Naira‑First</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              All prices and balances are shown in Naira. You can deposit, trade, and withdraw without needing
              special knowledge. The platform hides complexity so creators and fans can focus on their goals.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
