import { storage } from "./storage";
import { getCoin } from "@zoralabs/coins-sdk";
import { base } from "viem/chains";
import { sendTelegramNotification } from "./telegram-bot";

// Assuming TRENDING_CHECK_INTERVAL is defined elsewhere, e.g., in a config file or constants.
// For this example, let's define it here.
const TRENDING_CHECK_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours

interface TrendingCoin {
  coinId: string;
  coinAddress: string;
  coinSymbol: string;
  coinName: string;
  creatorAddress: string;
  earnings24h: number;
  volume24h: number;
  holders: number;
}

// Function to check for trending coins and send notifications
export async function checkAndNotifyTrendingCoins() {
  try {
    const coins = await storage.getAllCoins();
    const trendingCoins: TrendingCoin[] = [];

    // Fetch stats for all active coins
    for (const coin of coins) {
      if (!coin.address || coin.status !== 'active') continue;

      try {
        const response = await getCoin({
          collectionAddress: coin.address as `0x${string}`,
          chainId: base.id,
        });

        const coinData = response.data?.zora20Token;
        if (!coinData) continue;

        const volume24h = parseFloat(coinData.volume24h || '0');
        const holders = coinData.uniqueHolders || 0;
        const earnings24h = volume24h * 0.005; // 0.5% of volume

        // Check if coin is trending (high earnings or volume)
        // Lower thresholds for more active notifications
        if (earnings24h >= 1 || volume24h >= 10 || holders >= 5) {
          trendingCoins.push({
            coinId: coin.id,
            coinAddress: coin.address,
            coinSymbol: coin.symbol,
            coinName: coin.name,
            creatorAddress: coin.creator_wallet || '',
            earnings24h,
            volume24h,
            holders,
          });
        }
      } catch (error: any) {
        // Suppress WebSocket/realtime errors
        if (!error?.message?.includes('realtime') && !error?.message?.includes('ENOTFOUND')) {
          console.error(`Error fetching stats for ${coin.symbol}:`, error?.message || error);
        }
      }
    }

    // Sort by earnings
    trendingCoins.sort((a, b) => b.earnings24h - a.earnings24h);

    // Notify about top trending coins (top 3)
    const topTrending = trendingCoins.slice(0, 3);

    for (const trending of topTrending) {
      // Get all users to notify (random selection)
      const creators = await storage.getAllCreators();
      const usersToNotify = creators
        .filter(c => c.address.toLowerCase() !== trending.creatorAddress.toLowerCase())
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(5, creators.length)); // Notify up to 5 random users

      for (const user of usersToNotify) {
        // Create notification
        await storage.createNotification({
          userId: user.address,
          type: 'trending',
          title: '🔥 Trending Coin Alert!',
          message: `${trending.coinName} (${trending.coinSymbol}) is trending! $${trending.earnings24h.toFixed(2)} earned in 24h with ${trending.holders} holders. Check it out!`,
          coinAddress: trending.coinAddress,
          coinSymbol: trending.coinSymbol,
          read: false,
        });

        // Send Telegram notification
        await sendTelegramNotification(
          user.address,
          '🔥 Trending Coin Alert!',
          `${trending.coinName} (${trending.coinSymbol}) is trending! $${trending.earnings24h.toFixed(2)} earned in 24h with ${trending.holders} holders. Check it out!`,
          'trending',
          { address: trending.coinAddress, symbol: trending.coinSymbol, name: trending.coinName },
          { earnings24h: trending.earnings24h, volume24h: trending.volume24h, holders: trending.holders }
        );
      }
    }

    // Notify creators about their own coin performance
    for (const trending of topTrending) {
      if (!trending.creatorAddress) continue;

      await storage.createNotification({
        userId: trending.creatorAddress,
        type: 'performance',
        title: '💎 Your Coin is Performing Great!',
        message: `${trending.coinName} (${trending.coinSymbol}) earned $${trending.earnings24h.toFixed(2)} in the last 24h! Share it to reach more holders.`,
        coinAddress: trending.coinAddress,
        coinSymbol: trending.coinSymbol,
        read: false,
      });

      await sendTelegramNotification(
        trending.creatorAddress,
        '💎 Your Coin is Performing Great!',
        `${trending.coinName} (${trending.coinSymbol}) earned $${trending.earnings24h.toFixed(2)} in the last 24h! Share it to reach more holders.`,
        'performance',
        { address: trending.coinAddress, symbol: trending.coinSymbol, name: trending.coinName },
        { earnings24h: trending.earnings24h, volume24h: trending.volume24h, holders: trending.holders }
      );
    }

    console.log(`✅ Sent trending notifications for ${topTrending.length} coins`);
  } catch (error: any) {
    // Suppress WebSocket/realtime connection errors
    if (!error?.message?.includes('realtime') && !error?.message?.includes('ENOTFOUND') && !error?.message?.includes('WebSocket')) {
      console.error('Error in trending notifications:', error?.message || error);
    }
  }
}

// Run every 2 hours
export function startTrendingNotifications() {
  // Run immediately on startup with delay to allow app to fully initialize
  setTimeout(() => {
    checkAndNotifyTrendingCoins().catch(error => {
      console.error('Error in trending notifications (startup):', error.message || error);
      // Don't crash the app if trending notifications fail
    });
  }, 10000); // Wait 10 seconds before first run

  // Then run every 2 hours
  setInterval(() => {
    checkAndNotifyTrendingCoins().catch(error => {
      console.error('Error in trending notifications (interval):', error.message || error);
      // Don't crash the app if trending notifications fail
    });
  }, TRENDING_CHECK_INTERVAL);

  console.log('✅ Trending notifications service scheduled (runs every 2 hours)');
}