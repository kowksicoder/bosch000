import TelegramBot from 'node-telegram-bot-api';
import { storage } from './storage';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || '';

let bot: TelegramBot | null = null;
let botInstance: any = null; // Added for singleton check
const userWallets = new Map<number, string>();
let isPolling = false;
let initializationPromise: Promise<void> | null = null;

// Helper function to format wallet address for display
function formatAddress(address: string): string {
  if (!address) return 'Unknown';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Helper function to format timestamps
function formatTimestamp(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('en-US', { 
    month: '2-digit',
    day: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC'
  }).replace(',', '') + ' UTC';
}

// Helper function to format numbers with commas
function formatNumber(num: number | string): string {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return '0.00';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Format new coin creation notification
function formatNewCoinMessage(coin: any, stats?: any): string {
  const marketCap = stats?.marketCap ? `$${formatNumber(stats.marketCap)}` : '$0.00';
  const totalSupply = stats?.totalSupply ? formatNumber(stats.totalSupply) : '1.00B';
  const creatorAddress = coin.creator_wallet || 'Unknown';
  const contractAddress = coin.address || 'Pending';

  let message = `🆕🪙 NEW CREATOR COIN CREATED\n\n`;
  message += `📛 ${coin.name} (${coin.symbol})\n`;
  message += `💰 Market Cap: ${marketCap}\n`;
  message += `📊 Total Supply: ${totalSupply}\n`;
  message += `👤 [${formatAddress(creatorAddress)}](https://zora.co/profile/${creatorAddress})\n`;
  message += `📅 Created: ${formatTimestamp(coin.createdAt)}\n`;
  message += `📄 Contract: ${formatAddress(contractAddress)}\n\n`;

  if (coin.address) {
    message += `🔗 [View on Zora](https://zora.co/creator-coins/base:${coin.address}) | `;
    message += `[BaseScan](https://basescan.org/address/${coin.address}) | `;
    message += `[DexScreener](https://dexscreener.com/base/${coin.address})`;
  }

  return message;
}

// Format trading activity notification
function formatTradingActivityMessage(coin: any, stats?: any, activityTime?: Date): string {
  const marketCap = stats?.marketCap ? `$${formatNumber(stats.marketCap)}` : '$0.00';
  const volume24h = stats?.volume24h ? `$${formatNumber(stats.volume24h)}` : '$0.00';
  const totalSupply = stats?.totalSupply ? formatNumber(stats.totalSupply) : '1.00B';
  const holders = stats?.uniqueHolders || stats?.holders || 0;
  const creatorAddress = coin.creator_wallet || 'Unknown';
  const contractAddress = coin.address || 'Unknown';

  let message = `🔄📊 TRADING ACTIVITY\n\n`;
  message += `📛 ${coin.name} (${coin.symbol})\n`;
  message += `💰 Market Cap: ${marketCap}\n`;
  message += `📊 24h Volume: ${volume24h}\n`;
  message += `📊 Total Supply: ${totalSupply}\n`;
  message += `👥 Holders: ${holders}\n`;
  message += `👤 [${formatAddress(creatorAddress)}](https://zora.co/profile/${creatorAddress})\n`;
  message += `📄 Contract: ${formatAddress(contractAddress)}\n`;
  message += `📅 Created: ${formatTimestamp(coin.createdAt)}\n`;
  if (activityTime) {
    message += `⏰ Activity: ${formatTimestamp(activityTime)}\n`;
  }
  message += `\n`;

  if (coin.address) {
    message += `🔗 [View on Zora](https://zora.co/creator-coins/base:${coin.address}) | `;
    message += `[BaseScan](https://basescan.org/address/${coin.address}) | `;
    message += `[DexScreener](https://dexscreener.com/base/${coin.address})`;
  }

  return message;
}

// Format buy activity notification
function formatBuyActivityMessage(coin: any, stats?: any, activityTime?: Date): string {
  const marketCap = stats?.marketCap ? `$${formatNumber(stats.marketCap)}` : '$0.00';
  const totalSupply = stats?.totalSupply ? formatNumber(stats.totalSupply) : '1.00B';
  const holders = stats?.uniqueHolders || stats?.holders || 0;
  const creatorAddress = coin.creator_wallet || 'Unknown';
  const contractAddress = coin.address || 'Unknown';

  let message = `🟢💰 BUY ACTIVITY\n\n`;
  message += `📛 ${coin.name} (${coin.symbol})\n`;
  message += `💰 Market Cap: ${marketCap}\n`;
  message += `📊 Total Supply: ${totalSupply}\n`;
  message += `👥 Holders: ${holders}\n`;
  message += `👤 [${formatAddress(creatorAddress)}](https://zora.co/profile/${creatorAddress})\n`;
  message += `📄 Contract: ${formatAddress(contractAddress)}\n`;
  message += `📅 Created: ${formatTimestamp(coin.createdAt)}\n`;
  if (activityTime) {
    message += `⏰ Activity: ${formatTimestamp(activityTime)}\n`;
  }
  message += `\n`;

  if (coin.address) {
    message += `🔗 [View on Zora](https://zora.co/creator-coins/base:${coin.address}) | `;
    message += `[BaseScan](https://basescan.org/address/${coin.address}) | `;
    message += `[DexScreener](https://dexscreener.com/base/${coin.address})`;
  }

  return message;
}

// Format sell activity notification
function formatSellActivityMessage(coin: any, stats?: any, activityTime?: Date): string {
  const marketCap = stats?.marketCap ? `$${formatNumber(stats.marketCap)}` : '$0.00';
  const totalSupply = stats?.totalSupply ? formatNumber(stats.totalSupply) : '1.00B';
  const holders = stats?.uniqueHolders || stats?.holders || 0;
  const creatorAddress = coin.creator_wallet || 'Unknown';
  const contractAddress = coin.address || 'Unknown';

  let message = `🔴💰 SELL ACTIVITY\n\n`;
  message += `📛 ${coin.name} (${coin.symbol})\n`;
  message += `💰 Market Cap: ${marketCap}\n`;
  message += `📊 Total Supply: ${totalSupply}\n`;
  message += `👥 Holders: ${holders}\n`;
  message += `👤 [${formatAddress(creatorAddress)}](https://zora.co/profile/${creatorAddress})\n`;
  message += `📄 Contract: ${formatAddress(contractAddress)}\n`;
  message += `📅 Created: ${formatTimestamp(coin.createdAt)}\n`;
  if (activityTime) {
    message += `⏰ Activity: ${formatTimestamp(activityTime)}\n`;
  }
  message += `\n`;

  if (coin.address) {
    message += `🔗 [View on Zora](https://zora.co/creator-coins/base:${coin.address}) | `;
    message += `[BaseScan](https://basescan.org/address/${coin.address}) | `;
    message += `[DexScreener](https://dexscreener.com/base/${coin.address})`;
  }

  return message;
}

// Format daily market cap update
function formatDailyMarketCapUpdate(coins: any[]): string {
  let message = `📊💰 DAILY MARKET CAP UPDATE\n\n`;

  const totalMarketCap = coins.reduce((sum, coin) => {
    const mc = coin.stats?.marketCap || 0;
    return sum + (typeof mc === 'string' ? parseFloat(mc) : mc);
  }, 0);

  message += `💵 Total Platform Market Cap: $${formatNumber(totalMarketCap)}\n`;
  message += `🪙 Total Coins: ${coins.length}\n\n`;

  // Top 5 coins by market cap
  const topCoins = coins
    .filter(c => c.stats?.marketCap)
    .sort((a, b) => {
      const mcA = typeof a.stats.marketCap === 'string' ? parseFloat(a.stats.marketCap) : a.stats.marketCap;
      const mcB = typeof b.stats.marketCap === 'string' ? parseFloat(b.stats.marketCap) : b.stats.marketCap;
      return mcB - mcA;
    })
    .slice(0, 5);

  if (topCoins.length > 0) {
    message += `🏆 TOP 5 BY MARKET CAP:\n\n`;
    topCoins.forEach((coin, index) => {
      const mc = typeof coin.stats.marketCap === 'string' ? parseFloat(coin.stats.marketCap) : coin.stats.marketCap;
      message += `${index + 1}. ${coin.name} - $${formatNumber(mc)}\n`;
    });
  }

  return message;
}

// Format daily volume update
function formatDailyVolumeUpdate(coins: any[]): string {
  let message = `📈📊 24H VOLUME UPDATE\n\n`;

  const totalVolume = coins.reduce((sum, coin) => {
    const vol = coin.stats?.volume24h || 0;
    return sum + (typeof vol === 'string' ? parseFloat(vol) : vol);
  }, 0);

  message += `💵 Total 24h Volume: $${formatNumber(totalVolume)}\n`;
  message += `🪙 Active Coins: ${coins.filter(c => c.stats?.volume24h && parseFloat(c.stats.volume24h) > 0).length}\n\n`;

  // Top 5 coins by volume
  const topCoins = coins
    .filter(c => c.stats?.volume24h && parseFloat(c.stats.volume24h) > 0)
    .sort((a, b) => {
      const volA = typeof a.stats.volume24h === 'string' ? parseFloat(a.stats.volume24h) : a.stats.volume24h;
      const volB = typeof b.stats.volume24h === 'string' ? parseFloat(b.stats.volume24h) : b.stats.volume24h;
      return volB - volA;
    })
    .slice(0, 5);

  if (topCoins.length > 0) {
    message += `🏆 TOP 5 BY 24H VOLUME:\n\n`;
    topCoins.forEach((coin, index) => {
      const vol = typeof coin.stats.volume24h === 'string' ? parseFloat(coin.stats.volume24h) : coin.stats.volume24h;
      message += `${index + 1}. ${coin.name} - $${formatNumber(vol)}\n`;
    });
  }

  return message;
}

// Format creator earnings update
function formatCreatorEarningsUpdate(walletAddress: string, totalEarnings: number, coins: any[]): string {
  let message = `💎💰 YOUR CREATOR EARNINGS\n\n`;
  message += `👤 Wallet: [${formatAddress(walletAddress)}](https://zora.co/profile/${walletAddress})\n`;
  message += `💵 Total Earnings: $${formatNumber(totalEarnings)}\n`;
  message += `🪙 Total Coins Created: ${coins.length}\n\n`;

  // Show top earning coins
  const earningCoins = coins
    .filter(c => c.stats?.creatorEarnings && c.stats.creatorEarnings.length > 0)
    .sort((a, b) => {
      const earningsA = parseFloat(a.stats.creatorEarnings[0]?.amountUsd || '0');
      const earningsB = parseFloat(b.stats.creatorEarnings[0]?.amountUsd || '0');
      return earningsB - earningsA;
    })
    .slice(0, 5);

  if (earningCoins.length > 0) {
    message += `🏆 TOP EARNING COINS:\n\n`;
    earningCoins.forEach((coin, index) => {
      const earnings = parseFloat(coin.stats.creatorEarnings[0]?.amountUsd || '0');
      message += `${index + 1}. ${coin.name} - $${formatNumber(earnings)}\n`;
    });
  }

  return message;
}

export async function initTelegramBot() {
  // If initialization is already in progress, wait for it
  if (initializationPromise) {
    console.log('⏳ Telegram bot initialization already in progress, waiting...');
    await initializationPromise;
    return;
  }

  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('TELEGRAM_BOT_TOKEN not set, Telegram bot disabled');
    return;
  }

  // Prevent multiple bot instances
  if (botInstance && isPolling) {
    console.log("⚠️ Telegram bot already initialized and polling, skipping...");
    return;
  }

  // Create initialization promise to prevent concurrent calls
  initializationPromise = (async () => {
    try {
      // If a bot exists, stop it completely before creating a new one
      if (bot) {
        console.log('Existing Telegram bot found, cleaning up...');
        try {
          if (isPolling) {
            await bot.stopPolling({ cancel: true });
            await new Promise(resolve => setTimeout(resolve, 2000)); // Increased wait time
          }
          bot.removeAllListeners();
          bot = null;
          botInstance = null;
          isPolling = false;
          console.log('✅ Cleaned up existing bot instance');
        } catch (error) {
          console.error('Error cleaning up existing bot:', error);
          bot = null;
          botInstance = null;
          isPolling = false;
        }
      }

      bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { 
        polling: {
          interval: 500,
          autoStart: false,
          params: {
            timeout: 10
          }
        }
      });

      // Add polling error handler BEFORE starting polling
      bot.on('polling_error', (error) => {
        // Silently handle 409 conflicts - don't log repeatedly
        if (error.message.includes('409 Conflict')) {
          if (!global.isShuttingDown && isPolling) {
            console.log('⚠️ Detected multiple bot instances, stopping this one...');
            isPolling = false;
            if (bot) {
              bot.stopPolling({ cancel: true }).catch(() => {});
              bot.removeAllListeners();
              bot = null;
              botInstance = null;
            }
          }
        } else {
          console.error('Telegram polling error:', error.message);
        }
      });

      // Start polling manually to track state
      try {
        await bot.startPolling();
        isPolling = true;
        botInstance = bot;
        console.log('Telegram bot polling started successfully');
      } catch (error) {
        console.error('Failed to start Telegram bot polling:', error);
        isPolling = false;
        bot = null;
        botInstance = null;
        throw error; // Re-throw to handle in outer try-catch
      }
    } finally {
      initializationPromise = null;
    }
  })();

  await initializationPromise;

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot?.sendMessage(
      chatId,
      '👋 Welcome to CoinIT Notifications!\n\n' +
      'Connect your wallet to receive notifications about:\n' +
      '• 🆕 New coin creations\n' +
      '• 🟢 Buy activity\n' +
      '• 🔴 Sell activity\n' +
      '• 🔄 Trading activity\n' +
      '• 💎 Creator earnings\n' +
      '• 📊 Market updates\n\n' +
      'Use /connect <wallet_address> to link your wallet.'
    );
  });

  bot.onText(/\/connect (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const walletAddress = match?.[1];

    if (!walletAddress || !walletAddress.startsWith('0x')) {
      bot?.sendMessage(chatId, '❌ Invalid wallet address. Please use format: /connect 0x...');
      return;
    }

    userWallets.set(chatId, walletAddress.toLowerCase());
    await bot?.sendMessage(
      chatId,
      `✅ Wallet connected: ${walletAddress}\n\nYou will now receive notifications for this wallet.`
    );

    try {
      const { storage } = await import('./storage');
      const userCoins = await storage.getCoinsByCreator(walletAddress.toLowerCase());

      if (userCoins.length > 0) {
        let message = `\n🪙 *Your Existing Coins*\n\nYou have ${userCoins.length} coin(s):\n\n`;

        for (const coin of userCoins.slice(0, 10)) {
          message += `• *${coin.name}* (${coin.symbol})\n`;
          if (coin.address) {
            message += `  Contract: \`${coin.address}\`\n`;
          }
          message += `  Status: ${coin.status}\n\n`;
        }

        if (userCoins.length > 10) {
          message += `... and ${userCoins.length - 10} more coins\n`;
        }

        await bot?.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } else {
        await bot?.sendMessage(chatId, '\nℹ️ You have no coins yet. Create your first coin to get started!');
      }
    } catch (error) {
      console.error('Error fetching user coins:', error);
    }
  });

  bot.onText(/\/disconnect/, (msg) => {
    const chatId = msg.chat.id;
    userWallets.delete(chatId);
    bot?.sendMessage(chatId, '✅ Wallet disconnected. You will no longer receive notifications.');
  });

  bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const wallet = userWallets.get(chatId);

    if (!wallet) {
      bot?.sendMessage(chatId, '❌ No wallet connected. Use /connect <wallet_address> to connect.');
      return;
    }

    bot?.sendMessage(chatId, `✅ Connected to wallet: ${wallet}`);
  });

  console.log('Telegram bot initialized successfully');
  botInstance = bot; // Store the initialized bot instance
}

export async function sendTelegramNotification(
  walletAddress: string | null | undefined,
  title: string,
  message: string,
  type: string,
  coinData?: any,
  stats?: any
) {
  if (!bot) {
    console.warn('Bot not initialized, cannot send notification.');
    return;
  }

  // Gracefully handle email-only users without wallet addresses
  if (!walletAddress) {
    console.log('Skipping Telegram notification for user without wallet address');
    return;
  }

  let formattedMessage = message;

  // Use formatted messages based on event type
  if (coinData) {
    switch (type) {
      case 'coin_created':
        formattedMessage = formatNewCoinMessage(coinData, stats);
        break;
      case 'buy':
        formattedMessage = formatBuyActivityMessage(coinData, stats, new Date());
        break;
      case 'sell':
        formattedMessage = formatSellActivityMessage(coinData, stats, new Date());
        break;
      case 'trade':
        formattedMessage = formatTradingActivityMessage(coinData, stats, new Date());
        break;
      default:
        formattedMessage = message;
    }
  }

  // Extract image URL from coinData
  const imageUrl = coinData?.image || coinData?.metadata?.image;
  const isVideo = imageUrl && imageUrl.match(/\.(mp4|webm|mov|avi)$/i);
  const isAudio = imageUrl && imageUrl.match(/\.(mp3|wav|ogg|m4a)$/i);

  // Broadcast to channel if it's a coin creation and channel is configured
  if (TELEGRAM_CHANNEL_ID && type === 'coin_created') {
    try {
      if (imageUrl && !isAudio) {
        if (isVideo) {
          // Send video with caption
          await bot.sendVideo(
            TELEGRAM_CHANNEL_ID,
            imageUrl,
            {
              caption: formattedMessage,
              parse_mode: 'Markdown',
            }
          );
        } else {
          // Send photo with caption
          await bot.sendPhoto(
            TELEGRAM_CHANNEL_ID,
            imageUrl,
            {
              caption: formattedMessage,
              parse_mode: 'Markdown',
            }
          );
        }
      } else {
        // Send text message only
        await bot.sendMessage(
          TELEGRAM_CHANNEL_ID,
          formattedMessage,
          { 
            parse_mode: 'Markdown',
            disable_web_page_preview: false 
          }
        );
      }
      console.log('Broadcasted coin creation to channel with media');
    } catch (error) {
      console.error('Failed to broadcast to channel:', error);
      // Fallback to text-only message
      try {
        await bot.sendMessage(
          TELEGRAM_CHANNEL_ID,
          formattedMessage,
          { parse_mode: 'Markdown', disable_web_page_preview: false }
        );
      } catch (fallbackError) {
        console.error('Fallback message also failed:', fallbackError);
      }
    }
  }

  // Find all chat IDs connected to this wallet
  const chatIds = Array.from(userWallets.entries())
    .filter(([_, wallet]) => wallet.toLowerCase() === walletAddress.toLowerCase())
    .map(([chatId]) => chatId);

  for (const chatId of chatIds) {
    try {
      if (imageUrl && !isAudio) {
        if (isVideo) {
          // Send video with caption
          await bot.sendVideo(
            chatId,
            imageUrl,
            {
              caption: formattedMessage,
              parse_mode: 'Markdown',
            }
          );
        } else {
          // Send photo with caption
          await bot.sendPhoto(
            chatId,
            imageUrl,
            {
              caption: formattedMessage,
              parse_mode: 'Markdown',
            }
          );
        }
      } else {
        // Send text message only
        await bot.sendMessage(
          chatId,
          formattedMessage,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (error) {
      console.error(`Failed to send Telegram notification to ${chatId}:`, error);
      // Fallback to text-only message
      try {
        await bot.sendMessage(
          chatId,
          formattedMessage,
          { parse_mode: 'Markdown' }
        );
      } catch (fallbackError) {
        console.error('Fallback message also failed:', fallbackError);
      }
    }
  }
}

export async function broadcastExistingCoins(coins: any[]) {
  if (!bot || !TELEGRAM_CHANNEL_ID) {
    console.log('Telegram bot not initialized or channel not configured');
    return;
  }

  try {
    console.log(`Broadcasting ${coins.length} coins to channel ${TELEGRAM_CHANNEL_ID}...`);

    let message = `📊🪙 PLATFORM UPDATE\n\n`;
    message += `Total Coins: ${coins.length}\n`;
    message += `Active Creators: ${new Set(coins.map(c => c.creator_wallet)).size}\n\n`;

    const latestCoins = coins.slice(0, 5);
    message += `*Latest Coins:*\n\n`;

    for (const coin of latestCoins) {
      message += `• *${coin.name}* (${coin.symbol})\n`;
      if (coin.address) {
        message += `  [View on Zora](https://zora.co/creator-coins/base:${coin.address})\n`;
      }
    }

    if (coins.length > 5) {
      message += `\n... and ${coins.length - 5} more coins\n`;
    }

    message += `\n🚀 *Join the trading action!*`;

    await bot.sendMessage(TELEGRAM_CHANNEL_ID, message, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });
    console.log('Successfully broadcast to channel');
  } catch (error) {
    console.error('Failed to broadcast to channel:', error);
  }
}

export async function stopTelegramBot() {
  // Wait for any ongoing initialization
  if (initializationPromise) {
    await initializationPromise.catch(() => {});
  }

  if (bot && isPolling) {
    try {
      await bot.stopPolling({ cancel: true });
      await new Promise(resolve => setTimeout(resolve, 1000));
      isPolling = false;
      bot.removeAllListeners();
      bot = null;
      botInstance = null;
      console.log('Telegram bot stopped');
    } catch (error) {
      console.error('Error stopping Telegram bot:', error);
      // Force cleanup even if error
      isPolling = false;
      bot = null;
      botInstance = null;
    }
  } else if (bot) {
    // If bot exists but not polling, just clean up
    bot.removeAllListeners();
    bot = null;
    botInstance = null;
    console.log('Telegram bot instance cleared (was not polling)');
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await stopTelegramBot();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await stopTelegramBot();
  process.exit(0);
});

export { 
  bot, 
  formatNewCoinMessage, 
  formatTradingActivityMessage, 
  formatBuyActivityMessage, 
  formatSellActivityMessage,
  formatDailyMarketCapUpdate,
  formatDailyVolumeUpdate,
  formatCreatorEarningsUpdate
};