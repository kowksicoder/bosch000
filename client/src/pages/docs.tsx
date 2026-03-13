
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BookOpen, Coins, Users, TrendingUp, Shield, Zap, MessageSquare, Trophy } from "lucide-react";

export default function Docs() {
  return (
    <div className="container max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-3">
        <BookOpen className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">Documentation</h1>
      </div>

      <p className="text-lg text-muted-foreground">
        Complete guide to using Every1.fun - create coins, trade, earn rewards, and build your creator community on Base blockchain.
      </p>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle>Getting Started</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              <strong>Step 1: Sign Up</strong> - Click "Login" and either sign up with your email (we'll create a smart wallet for you) or connect your existing crypto wallet (MetaMask, Coinbase Wallet, etc.).
            </p>
            <p>
              <strong>Step 2: Explore</strong> - Browse trending creator coins on the home page, discover new creators in the Creators section, or search for specific content.
            </p>
            <p>
              <strong>Step 3: Claim Your First Reward</strong> - Click the E1XP icon to claim your daily login reward and start building your streak!
            </p>
            <p>
              <strong>Step 4: Get Some ETH</strong> - To trade coins, you'll need ETH on Base network. If signing up with email, your smart wallet address can receive ETH from exchanges or other wallets.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              <CardTitle>Creating Your Coin</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              Navigate to the <strong>Create</strong> page to launch your own creator coin. You have two options:
            </p>
            <p>
              <strong>Upload Content:</strong> Upload an image or video directly. We'll store it on IPFS for permanent, decentralized hosting via Pinata.
            </p>
            <p>
              <strong>Import from URL:</strong> Paste a link to your content from platforms like YouTube, Instagram, Twitter, or any website. We'll automatically fetch metadata and create a beautiful preview.
            </p>
            <p>
              <strong>Fill in Details:</strong> Add your coin name (e.g., "MySong"), symbol (e.g., "SONG"), and description. These appear on your coin's trading page.
            </p>
            <p>
              <strong>Deploy:</strong> Click create and approve the transaction. Your coin will be deployed on Base blockchain using Zora's creator coin protocol. You can start sharing it immediately!
            </p>
            <p className="text-sm italic">
              Note: Coin creation requires a small amount of ETH for gas fees. As the creator, you'll earn a percentage of all trading fees for your coin.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle>Trading Coins</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              <strong>Finding Coins:</strong> Browse the home page for trending coins, explore all coins in the Coins section, or visit creator profiles to see their coins.
            </p>
            <p>
              <strong>Buying Coins:</strong> Click any coin card to open the trading modal. Select "Buy", enter the amount of ETH you want to spend, and confirm. The price updates in real-time based on the bonding curve.
            </p>
            <p>
              <strong>Selling Coins:</strong> Visit your profile to see coins you own. Click on a coin, select "Sell", enter the amount to sell, and confirm. You'll receive ETH based on the current market price.
            </p>
            <p>
              <strong>Understanding Prices:</strong> Coins use a bonding curve - each purchase increases the price slightly, each sale decreases it. Early buyers can benefit from price appreciation as the coin gains popularity.
            </p>
            <p>
              <strong>Portfolio Tracking:</strong> Your profile shows all coins you own, their current value, and your profit/loss. Track your holdings and see how your investments perform over time.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <CardTitle>E1XP Points & Rewards</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              <strong>Daily Login Rewards:</strong> Claim E1XP points every day by clicking the E1XP icon in the navigation. The more consecutive days you log in, the higher your streak multiplier!
            </p>
            <p>
              <strong>Streak System:</strong> Build your streak by logging in daily. Your streak multiplier increases your E1XP earnings. Miss a day and your streak resets, so stay consistent!
            </p>
            <p>
              <strong>Earning Points:</strong> You earn E1XP through daily logins, maintaining streaks, trading activity, and community engagement. Points track your platform participation.
            </p>
            <p>
              <strong>Leaderboards:</strong> Check the Points page to see top earners and compare your progress with other community members. Compete for the highest streak and most points!
            </p>
            <p className="text-sm italic">
              Pro tip: Enable notifications to get reminders for your daily reward and never break your streak!
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <CardTitle>Messaging & Community</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              <strong>Direct Messaging:</strong> Click the message icon on any user's profile to start a private conversation. We use XMTP protocol for decentralized, encrypted messaging.
            </p>
            <p>
              <strong>Inbox:</strong> Access all your messages from the Inbox page. See unread count in the navigation and never miss important messages from other creators or collectors.
            </p>
            <p>
              <strong>Notifications:</strong> Enable push notifications to get alerted about new messages, coin launches, trading activity, and daily reward reminders. Stay connected even when away.
            </p>
            <p>
              <strong>Following Creators:</strong> Connect with your favorite creators, follow their profiles, and get notified when they launch new coins or content.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>Profile & Identity</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              <strong>Your Profile:</strong> Customize your profile with a username, bio, and profile picture. Share your wallet address or profile link with others.
            </p>
            <p>
              <strong>Portfolio View:</strong> See all coins you've created and coins you own. Track your earnings as a creator and monitor your investment performance.
            </p>
            <p>
              <strong>Wallet Management:</strong> View your connected wallet address. If you signed up with email, you have a smart wallet that can receive ETH and tokens just like any other wallet.
            </p>
            <p>
              <strong>Earnings Withdrawal:</strong> As a creator, withdraw your accumulated trading fees anytime. Your earnings are always available and belong to you.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>Security & Best Practices</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              <strong>Smart Wallets:</strong> If you signed up with email, we created a smart wallet for you using Privy. This wallet is secured by your email - only you can access it. Consider exporting the private key and backing it up securely.
            </p>
            <p>
              <strong>External Wallets:</strong> If using MetaMask or other wallets, we never have access to your private keys. Always verify transaction details before approving.
            </p>
            <p>
              <strong>Content Rights:</strong> Only upload content you own or have rights to use. Respect copyright and intellectual property laws.
            </p>
            <p>
              <strong>Trading Safely:</strong> Do your research before buying coins. Check the creator's profile, content quality, and community engagement. Never invest more than you can afford to lose.
            </p>
            <p>
              <strong>Scam Awareness:</strong> Be cautious of too-good-to-be-true offers. We'll never ask for your private keys or recovery phrase. Always verify URLs and official channels.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle>Technical Details</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              <strong>Blockchain:</strong> Every1.fun is built on Base, an Ethereum Layer 2 network offering fast transactions with low fees while maintaining Ethereum's security.
            </p>
            <p>
              <strong>Smart Contracts:</strong> All creator coins are deployed using Zora's audited and battle-tested creator coin protocol. This ensures security and standardization.
            </p>
            <p>
              <strong>Storage:</strong> Content is stored on IPFS via Pinata for decentralized, permanent hosting. Your content remains accessible independently of our platform.
            </p>
            <p>
              <strong>Authentication:</strong> We use Privy for wallet abstraction, allowing email login while maintaining full self-custody. Your keys, your coins.
            </p>
            <p>
              <strong>Messaging:</strong> XMTP protocol powers our messaging system, providing decentralized, encrypted communication between users.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
