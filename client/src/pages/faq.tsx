
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

export default function FAQ() {
  return (
    <div className="container max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-3">
        <HelpCircle className="h-8 w-8 text-primary" />
        <h1 className="text-2xl items-center font-bold">
          Frequently Asked Questions
        </h1>
      </div>

      <p className="text-lg items-center text-muted-foreground">
        Everything you need to know about creat8*
      </p>

      <Card>
        <CardHeader>
          <CardTitle>General Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>What is creat8*?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                creat8* is a Naira‑first creator economy where creators launch coins and fans can buy, sell, and support their work. You can follow creators, join missions, earn rewards, and grow a real community around creative projects.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger>
                Do I need special setup to use this platform?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                No. You can sign up with email or social and start right away. Everything is shown in Naira and the platform handles the background steps for you.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger>Is this platform free to use?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Creating an account and exploring is free. When you buy or sell, a small platform fee may apply. You’ll always see the amount before you confirm.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger>How do I get started?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Click “Login”, create your profile, explore creators, and support someone you love. You can also create your own coin and start earning. Don’t forget to claim your daily E1XP reward.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger>What is E1XP?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                E1XP is our points system. Earn points for daily check‑ins, streaks, missions, and activity on the platform.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Creator Coins & Support</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-6">
              <AccordionTrigger>How do I create my own coin?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Go to the Create page, add your content, choose a name and description, and publish. Your coin is ready to share immediately.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7">
              <AccordionTrigger>How do coin prices work?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Prices move based on activity. When more people buy, the price rises; when people sell, it can drop. It’s simple supply and demand.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-8">
              <AccordionTrigger>Can I sell my coins anytime?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes. You can buy or sell anytime from the coin page or the Swap page. Your balance updates immediately.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-9">
              <AccordionTrigger>What content can I upload?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                You can upload images or videos, or paste a link. We automatically pull a clean preview. Make sure you have the rights to any content you share.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-10">
              <AccordionTrigger>
                Do creators earn from their coins?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes. Creators earn from activity around their coin. You can see earnings in your dashboard and withdraw to your bank.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-19">
              <AccordionTrigger>What are missions?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Missions are challenges creators set to reward fans for holding a coin, showing support, or completing activities. When you finish a mission, you can claim rewards like E1XP, content access, coupons, or event perks.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-20">
              <AccordionTrigger>How are mission rewards delivered?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Some rewards are delivered instantly. Others show as “Pending” until the creator confirms delivery. You’ll see the status directly on your mission card.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-21">
              <AccordionTrigger>What are collab coins?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Collab coins are shared coins launched by multiple creators. Earnings are split automatically, and each collaborator can see their stats and rewards.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Features & Community</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-11">
              <AccordionTrigger>Can I message other users?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes. Click the message icon on a profile to start a private chat.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-12">
              <AccordionTrigger>How do daily streaks work?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Check in daily to build your streak. The longer your streak, the more points you earn. Miss a day and it resets.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-13">
              <AccordionTrigger>What are notifications for?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                You’ll get alerts for new coins, trending creators, missions, collabs, and reward reminders. You can turn notifications on or off anytime.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-14">
              <AccordionTrigger>Is there a mobile app?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                The web app is fully responsive and works well on mobile browsers. Just open it like any normal site.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Safety & Support</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-15">
              <AccordionTrigger>Is my account safe?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes. Your account uses secure sign‑in and we never ask for sensitive codes. Always double‑check links and only use official channels.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-16">
            <AccordionItem value="item-17">
              <AccordionTrigger>
                What if I have a problem or question?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Use in‑app support or reach us through our community channels. We’re here to help.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-18">
              <AccordionTrigger>
                Are there risks to trading creator coins?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Prices can move up or down. Only spend what you’re comfortable with and always review a creator’s profile before buying.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
