import { storage } from './supabase-storage';

import { sendTelegramChannelMessage, sendTelegramNotification } from './telegram-bot';
import type { Reward, Creator, Coin } from '@shared/schema';



// Randomized earnings notification messages

const EARNINGS_MESSAGES = [
  "\u{1F4B0} Ka-ching! You've earned {amount} from {coin}!",
  "\u{1F389} Great news! {amount} just landed in your wallet from {coin}",
  "\u{1F48E} You're making moves! {amount} earned from {coin}",
  "\u{1F525} Hot earnings alert! {amount} from {coin} is yours",
  "\u{26A1} Zap! {amount} just hit your account from {coin}",
  "\u{1F31F} Success! You've earned {amount} from {coin} trades",
  "\u{1F4B8} Money alert! {amount} from {coin} arrived",
  "\u{1F3AF} Bulls-eye! {amount} earned from {coin}",
  "\u{1F680} To the moon! {amount} from {coin} deposited",
  "\u{1F4B5} Cha-ching! {amount} from {coin} is in your wallet",
  "\u{1F3C6} Winner! You earned {amount} from {coin}",
  "\u{2728} Sweet! {amount} from {coin} just dropped",
];



const TOP_TRADER_MESSAGES = [
  "\u{1F525} {trader} is on fire! Earned {amount} in the last {period}",
  "\u{1F48E} Whale alert! {trader} made {amount} in {period}",
  "\u{1F680} {trader} just crushed it with {amount} in {period}!",
  "\u{26A1} Power move! {trader} earned {amount} in {period}",
  "\u{1F451} King of trades! {trader} made {amount} in {period}",
  "\u{1F3AF} Perfect execution! {trader} earned {amount} in {period}",
  "\u{1F4B0} Big money! {trader} raked in {amount} in {period}",
  "\u{1F31F} Star trader {trader} earned {amount} in {period}",
  "\u{1F52E} Magic touch! {trader} made {amount} in {period}",
];



// Format number with commas

function formatNumber(num: number | string): string {

  const n = typeof num === 'string' ? parseFloat(num) : num;

  if (isNaN(n)) return '0.00';

  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

}



// Format address

function formatAddress(address: string): string {

  if (!address) return 'Unknown';

  return `${address.slice(0, 6)}...${address.slice(-4)}`;

}



// Calculate time periods

function getTimePeriod(hours: number): Date {

  const now = new Date();

  return new Date(now.getTime() - hours * 60 * 60 * 1000);

}



export class NotificationService {

  private async getBroadcastRecipients(excludeUserId?: string): Promise<string[]> {

    const creators = await storage.getAllCreators();

    const users = await storage.getAllUsers();



    const recipients = new Map<string, string>();



    creators.forEach((creator: any) => {

      [creator.address, creator.privyId, creator.id, creator.email].forEach((id) => {

        if (!id) return;

        const key = String(id).toLowerCase();

        if (!recipients.has(key)) {

          recipients.set(key, String(id));

        }

      });

    });



    users.forEach((user: any) => {

      [user.walletAddress, user.privyId, user.id, user.email].forEach((id) => {

        if (!id) return;

        const key = String(id).toLowerCase();

        if (!recipients.has(key)) {

          recipients.set(key, String(id));

        }

      });

    });



    if (excludeUserId) {

      recipients.delete(excludeUserId.toLowerCase());

    }



    return Array.from(recipients.values());

  }



  private async broadcastInAppNotification(payload: {

    title: string;

    message: string;

    type: string;

    coinAddress?: string | null;

    coinSymbol?: string | null;

    excludeUserId?: string;

  }) {

    const recipients = await this.getBroadcastRecipients(payload.excludeUserId);

    await Promise.all(

      recipients.map((userId) =>

        storage.createNotification({

          userId,

          type: payload.type,

          title: payload.title,

          message: payload.message,

          coinAddress: payload.coinAddress,

          coinSymbol: payload.coinSymbol,

        }),

      ),

    );

  }



  

  // Send daily login streak notification

  async notifyDailyLoginStreak(userAddress: string, streak: number, pointsEarned: number): Promise<void> {

    const messages = [
      `\u{1F525} ${streak} day streak! You earned ${pointsEarned} E1XP!`,
      `\u{26A1} Amazing! ${streak} days in a row! +${pointsEarned} E1XP`,
      `\u{1F4AA} Keep it up! ${streak} day streak = ${pointsEarned} E1XP`,
      `\u{1F31F} ${streak} days strong! Earned ${pointsEarned} E1XP!`,
    ];

    

    const message = messages[Math.floor(Math.random() * messages.length)];

    const title = `ð¥ ${streak} Day Streak!`;



    await storage.createNotification({

      userId: userAddress,

      type: 'streak',

      title,

      message,

      amount: pointsEarned.toString(),

      createdAt: new Date(),

    });



    await sendTelegramNotification(userAddress, title, message, 'streak');

  }



  // Send E1XP claim reminder

    async notifyE1XPClaimReminder(userAddress: string, availablePoints: number): Promise<void> {
    const title = `\u{23F3} Don't Forget Your E1XP!`;
    const message = `You have ${availablePoints} E1XP waiting to be claimed! Don't break your streak!`;

    await storage.createNotification({
      userId: userAddress,
      type: 'reminder',
      title,
      message,
      amount: availablePoints.toString(),
      createdAt: new Date(),
    });

    await sendTelegramNotification(userAddress, title, message, 'reminder');
  }




  // Send referral notification to referrer

  async notifyReferralEarned(referrerAddress: string, referredUser: string, bonusPoints: number): Promise<void> {

    const title = `ð Referral Bonus!`;

    const message = `${formatAddress(referredUser)} joined using your referral! You earned ${bonusPoints} E1XP (2x bonus)`;



    await storage.createNotification({

      userId: referrerAddress,

      type: 'referral',

      title,

      message,

      amount: bonusPoints.toString(),

      createdAt: new Date(),

    });



    await sendTelegramNotification(referrerAddress, title, message, 'referral');

  }



  // Send new trade notification

      async notifyNewTrade(userAddress: string, coinSymbol: string, tradeType: 'buy' | 'sell', amount: string, earnedPoints?: number): Promise<void> {
    const emoji = tradeType === 'buy' ? '\u{1F4B0}' : '\u{1F4B8}';
    const action = tradeType === 'buy' ? 'Bought' : 'Sold';
    const title = `${emoji} ${action} ${coinSymbol}!`;
    let message = `Successfully ${action.toLowerCase()} ${coinSymbol} for ${amount}`;

    if (earnedPoints) {
      message += ` | +${earnedPoints} E1XP earned!`;
    }

    await storage.createNotification({
      userId: userAddress,
      type: 'trade',
      title,
      message,
      coinSymbol,
      amount: earnedPoints?.toString(),
      createdAt: new Date(),
    });

    await sendTelegramNotification(userAddress, title, message, 'trade');

    const channelMessage = [
      `\u{1F504} New Trade`,
      `${action} ${coinSymbol}`,
      `Amount: ${amount}`,
      earnedPoints ? `Reward: +${earnedPoints} E1XP` : null,
      `Trader: ${formatAddress(userAddress)}`,
    ]
      .filter(Boolean)
      .join('\n');

    await sendTelegramChannelMessage(channelMessage, { disable_web_page_preview: true });
  }





  // Send E1XP points earned notification

    async notifyE1XPEarned(userAddress: string, points: number, reason: string): Promise<void> {
    const title = `\u{26A1} E1XP Earned!`;
    const message = `You earned ${points} E1XP for ${reason}`;

    await storage.createNotification({
      userId: userAddress,
      type: 'points',
      title,
      message,
      amount: points.toString(),
      createdAt: new Date(),
    });

    await sendTelegramNotification(userAddress, title, message, 'points');
  }




  // Send welcome bonus notification for new users

    async notifyWelcomeBonus(userAddress: string): Promise<void> {
    const title = `\u{1F389} Welcome to Every1!`;
    const message = `You earned 10 E1XP as a welcome bonus! Come back daily to earn more points and build your streak!`;

    await storage.createNotification({
      userId: userAddress,
      type: 'reward',
      title,
      message,
      amount: '10',
      createdAt: new Date(),
    });

    await sendTelegramNotification(userAddress, title, message, 'reward');
  }




  // Send new creators to follow notification

    async notifyNewCreatorsToFollow(userAddress: string, creators: Creator[]): Promise<void> {
    const title = `\u{1F465} Discover New Creators!`;
    const creatorNames = creators.slice(0, 3).map(c => c.name || formatAddress(c.address)).join(', ');
    const message = `Check out these trending creators: ${creatorNames}${creators.length > 3 ? ` and ${creators.length - 3} more!` : ''}`;

    await storage.createNotification({
      userId: userAddress,
      type: 'creator_suggestion',
      title,
      message,
    });

    await sendTelegramNotification(userAddress, title, message, 'creator_suggestion');
  }




  // Send new follower notification

    async notifyNewFollower(creatorAddress: string, followerAddress: string): Promise<void> {
    const title = `\u{1F389} New Follower!`;
    const message = `${formatAddress(followerAddress)} started following you!`;

    await storage.createNotification({
      userId: creatorAddress,
      type: 'follower',
      title,
      message,
    });

    await sendTelegramNotification(creatorAddress, title, message, 'follower');
  }




  // Send new coin notification

    async notifyNewCoin(userAddress: string, coin: Coin): Promise<void> {
    const title = `\u{1FA99} New Coin Alert!`;
    const message = `${coin.name} (${coin.symbol}) just launched! Be an early trader and earn rewards!`;

    await storage.createNotification({
      userId: userAddress,
      type: 'coin_created',
      title,
      message,
      coinAddress: coin.address,
      coinSymbol: coin.symbol,
    });

    await sendTelegramNotification(userAddress, title, message, 'coin_created');
  }




    async notifyNewCoinBroadcast(coin: Coin, excludeUserId?: string): Promise<void> {
    const title = `\u{1FA99} New Coin Alert`;
    const message = `${coin.name} (${coin.symbol}) just launched! Trade early and earn rewards.`;

    await this.broadcastInAppNotification({
      title,
      message,
      type: 'coin_created',
      coinAddress: coin.address || undefined,
      coinSymbol: coin.symbol,
      excludeUserId,
    });

    await sendTelegramChannelMessage(
      `\u{1FA99} New Coin
${coin.name} (${coin.symbol})
Be an early supporter.`,
      { disable_web_page_preview: true }
    );
  }




  // Send coin created success notification to creator

    async notifyCoinCreated(creatorAddress: string, coin: Coin): Promise<void> {
    const title = `\u{1F389} Coin Created Successfully!`;
    const message = `Your coin ${coin.name} (${coin.symbol}) is now live! Share it to get more holders and earn rewards!`;

    await storage.createNotification({
      userId: creatorAddress,
      type: 'coin_created',
      title,
      message,
      coinAddress: coin.address,
      coinSymbol: coin.symbol,
    });

    await sendTelegramNotification(creatorAddress, title, message, 'coin_created');
  }




      async notifyNewCreatorJoined(creator: Creator): Promise<void> {
    const title = `\u{2728} New Creator Joined`;
    const name = creator.name || formatAddress(creator.address);
    const message = `${name} just joined the platform. Check out their profile and support their work.`;

    await this.broadcastInAppNotification({
      title,
      message,
      type: 'creator_joined',
      excludeUserId: creator.address || creator.privyId || creator.id,
    });

    await sendTelegramChannelMessage(
      `\u{2728} New Creator Joined\n${name}\nSupport them on Every1 today.`,
      { disable_web_page_preview: true }
    );
  }





      async notifyNewCollabCreated(collabTitle: string, creatorName?: string | null): Promise<void> {
    const title = `\u{1F91D} New Collab Live`;
    const message = `${creatorName || 'A creator'} launched a new collab: ${collabTitle}. Jump in early.`;

    await this.broadcastInAppNotification({
      title,
      message,
      type: 'collab_created',
    });

    await sendTelegramChannelMessage(
      `\u{1F91D} New Collab Live\n${collabTitle}\nBy ${creatorName || 'a creator'}`,
      { disable_web_page_preview: true }
    );
  }





      async notifyCommunityCoinBroadcast(coin: Coin, excludeUserId?: string): Promise<void> {
    const title = `\u{1F3E0} New Community Coin`;
    const message = `${coin.name} (${coin.symbol}) just launched for the community. Join early and support!`;
    await this.broadcastInAppNotification({
      title,
      message,
      type: 'community_coin',
      coinAddress: coin.address || undefined,
      coinSymbol: coin.symbol,
      excludeUserId,
    });

    await sendTelegramChannelMessage(
      `\u{1F3E0} New Community Coin\n${coin.name} (${coin.symbol})\nJoin early and support the community.`,
      { disable_web_page_preview: true }
    );
  }





      async notifyMissionCreatedBroadcast(missionTitle: string, creatorName?: string | null, excludeUserId?: string) {
    const title = `\u{1F3AF} New Mission Added`;
    const message = `${creatorName || 'A creator'} added a new mission: ${missionTitle}. Complete it to earn rewards.`;
    await this.broadcastInAppNotification({
      title,
      message,
      type: 'mission_created',
      excludeUserId,
    });

    await sendTelegramChannelMessage(
      `\u{1F3AF} New Mission Added\n${missionTitle}\nBy ${creatorName || 'a creator'}\nComplete it to earn rewards.`,
      { disable_web_page_preview: true }
    );
  }





  async notifyMissionClosedParticipants(userIds: string[], missionTitle: string) {

    await Promise.all(

      userIds.map((userId) =>

        storage.createNotification({

          userId,

          type: 'mission_closed',

          title: 'Mission closed',

          message: `The mission "${missionTitle}" has been closed.`,

        }),

      ),

    );

  }



  // Send milestone notification

  async notifyMilestone(userAddress: string, milestone: string, reward?: number): Promise<void> {

    const title = `ð Milestone Reached!`;

    let message = `Congratulations! You've ${milestone}`;

    

    if (reward) {

      message += ` | +${reward} E1XP bonus!`;

    }



    await storage.createNotification({

      userId: userAddress,

      type: 'milestone',

      title,

      message,

      amount: reward?.toString(),

    });



    await sendTelegramNotification(userAddress, title, message, 'milestone');

  }



  // Get top creators by total volume

  async getTopCreatorsByVolume(limit: number = 10): Promise<Creator[]> {

    const creators = await storage.getAllCreators();

    return creators

      .sort((a, b) => parseFloat(b.totalVolume || '0') - parseFloat(a.totalVolume || '0'))

      .slice(0, limit);

  }



  // Get top creators by points

  async getTopCreatorsByPoints(limit: number = 10): Promise<Creator[]> {

    const creators = await storage.getAllCreators();

    return creators

      .sort((a, b) => parseFloat(b.points || '0') - parseFloat(a.points || '0'))

      .slice(0, limit);

  }



  // Get top earners from rewards

  async getTopEarners(limit: number = 10, hoursAgo?: number): Promise<Array<{address: string, totalEarnings: number, rewardCount: number}>> {

    const rewards = await storage.getAllRewards();

    

    // Filter by time if specified

    let filteredRewards = rewards;

    if (hoursAgo) {

      const cutoff = getTimePeriod(hoursAgo);

      filteredRewards = rewards.filter(r => new Date(r.createdAt) >= cutoff);

    }



    // Aggregate earnings by recipient

    const earningsMap = new Map<string, { totalEarnings: number, rewardCount: number }>();

    

    for (const reward of filteredRewards) {

      const current = earningsMap.get(reward.recipientAddress) || { totalEarnings: 0, rewardCount: 0 };

      const amount = parseFloat(reward.rewardAmount) / 1e18; // Convert from wei to ETH

      current.totalEarnings += amount;

      current.rewardCount += 1;

      earningsMap.set(reward.recipientAddress, current);

    }



    // Convert to array and sort

    return Array.from(earningsMap.entries())

      .map(([address, data]) => ({ address, ...data }))

      .sort((a, b) => b.totalEarnings - a.totalEarnings)

      .slice(0, limit);

  }



  // Get top coins (you can customize the metric)

  async getTopCoins(limit: number = 10): Promise<Coin[]> {

    const coins = await storage.getAllCoins();

    // For now, sort by creation date (most recent first)

    // You can modify this to sort by volume or other metrics when available

    return coins

      .filter(c => c.status === 'active' && c.address)

      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      .slice(0, limit);

  }



  // Get recent trades (based on recent rewards)

  async getRecentTrades(limit: number = 20): Promise<Reward[]> {

    const rewards = await storage.getAllRewards();

    return rewards

      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      .slice(0, limit);

  }



  // Send earnings notification with randomized message

      async notifyUserEarnings(userAddress: string, reward: Reward): Promise<void> {
    const amount = (parseFloat(reward.rewardAmount) / 1e18).toFixed(4);
    const template = EARNINGS_MESSAGES[Math.floor(Math.random() * EARNINGS_MESSAGES.length)];

    const message = template
      .replace('{amount}', `${amount} ${reward.rewardCurrency}`)
      .replace('{coin}', reward.coinSymbol);

    const title = `\u{1F4B8} Earnings Received!`;

    // Save to database
    await storage.createNotification({
      userId: userAddress,
      type: 'reward',
      title,
      message,
      coinAddress: reward.coinAddress,
      coinSymbol: reward.coinSymbol,
      amount: reward.rewardAmount,
      transactionHash: reward.transactionHash,
      createdAt: new Date(),
    });

    // Send to Telegram
    await sendTelegramNotification(
      userAddress,
      title,
      message,
      'reward'
    );

    const channelMessage = [
      `\u{1F4B8} Reward Earned`,
      `${reward.coinSymbol}`,
      `Amount: ${amount} ${reward.rewardCurrency}`,
      `Creator: ${formatAddress(userAddress)}`,
      reward.transactionHash ? `Tx: https://basescan.org/tx/${reward.transactionHash}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    await sendTelegramChannelMessage(channelMessage, { disable_web_page_preview: true });
  }





  // Notify about top traders

      async notifyTopTraders(hours: number): Promise<void> {
    const topEarners = await this.getTopEarners(5, hours);

    if (topEarners.length === 0) return;

    const periodText = hours <= 10 ? `${hours} hours` :
                       hours === 24 ? '24 hours' :
                       `${Math.floor(hours / 24)} days`;

    for (const earner of topEarners) {
      const template = TOP_TRADER_MESSAGES[Math.floor(Math.random() * TOP_TRADER_MESSAGES.length)];
      const message = template
        .replace('{trader}', formatAddress(earner.address))
        .replace('{amount}', `$${formatNumber(earner.totalEarnings)}`)
        .replace('{period}', periodText);

      const title = `\u{1F3C5} Top Trader Alert - ${periodText}`;

      await sendTelegramChannelMessage(
        `${title}\n\n${message}\n\n\u{1F464} Trader: [${formatAddress(earner.address)}](https://zora.co/profile/${earner.address})\n\u{1F4CA} Total Earnings: $${formatNumber(earner.totalEarnings)}\n\u{1F3AF} Trades: ${earner.rewardCount}`,
        { parse_mode: 'Markdown', disable_web_page_preview: false }
      );
    }
  }





  // Send top creators notification

      async sendTopCreatorsNotification(): Promise<void> {
    const topCreators = await this.getTopCreatorsByVolume(10);

    if (topCreators.length === 0) return;

    const creatorOfWeek = topCreators[0];
    const creatorOfWeekName = creatorOfWeek.name || formatAddress(creatorOfWeek.address);
    const creatorOfWeekVolume = formatNumber(parseFloat(creatorOfWeek.totalVolume || '0'));

    let message = `\u{1F31F} Creator of the Week\n${creatorOfWeekName}\nVolume: $${creatorOfWeekVolume}\n\n`;
    message += `\u{1F3C6} Top Creators by Volume\n\n`;

    topCreators.forEach((creator, index) => {
      const volume = parseFloat(creator.totalVolume || '0');
      message += `${index + 1}. ${creator.name || formatAddress(creator.address)}\n`;
      message += `   \u{1F4B0} Volume: $${formatNumber(volume)}\n`;
      message += `   \u{1FA99} Coins: ${creator.totalCoins}\n`;
      message += `   \u{2B50} Points: ${formatNumber(parseFloat(creator.points || '0'))}\n\n`;
    });

    const title = `\u{1F3C6} Top Creators Leaderboard`;

    // In-app broadcast
    try {
      const topNames = topCreators
        .slice(0, 3)
        .map(c => c.name || formatAddress(c.address))
        .join(", ");
      await this.broadcastInAppNotification({
        title,
        message: `Leaderboard updated. Top creators: ${topNames}.`,
        type: 'leaderboard',
      });
    } catch (error) {
      console.warn('Failed to broadcast top creators notification:', error);
    }

    await sendTelegramChannelMessage(`${title}\n\n${message}`, { disable_web_page_preview: true });
  }





  // Send top earners notification

      async sendTopEarnersNotification(hours?: number): Promise<void> {
    const topEarners = await this.getTopEarners(10, hours);

    if (topEarners.length === 0) return;

    const periodText = hours ?
      (hours <= 10 ? `${hours} hours` :
       hours === 24 ? '24 hours' :
       `${Math.floor(hours / 24)} days`) :
      'All Time';

    let message = `\u{1F48E} Top Earners - ${periodText.toUpperCase()}\n\n`;

    topEarners.forEach((earner, index) => {
      message += `${index + 1}. [${formatAddress(earner.address)}](https://zora.co/profile/${earner.address})\n`;
      message += `   \u{1F4B0} Earnings: $${formatNumber(earner.totalEarnings)}\n`;
      message += `   \u{1F3AF} Trades: ${earner.rewardCount}\n\n`;
    });

    const title = `\u{1F48E} Top Earners - ${periodText}`;

    await sendTelegramChannelMessage(`${title}\n\n${message}`, { disable_web_page_preview: false });
  }





  // Send top coins notification

      async sendTopCoinsNotification(): Promise<void> {
    const topCoins = await this.getTopCoins(10);

    if (topCoins.length === 0) return;

    let message = `\u{1F525} Top Trending Coins\n\n`;

    topCoins.forEach((coin, index) => {
      message += `${index + 1}. *${coin.name}* (${coin.symbol})\n`;
      message += `   \u{1F464} Creator: [${formatAddress(coin.creator_wallet)}](https://zora.co/profile/${coin.creator_wallet})\n`;
      if (coin.address) {
        message += `   \u{1F517} [Trade Now](https://zora.co/creator-coins/base:${coin.address})\n`;
      }
      message += `\n`;
    });

    const title = `\u{1F525} Top Trending Coins`;

    // In-app broadcast
    try {
      const topNames = topCoins
        .slice(0, 3)
        .map(c => `${c.name} (${c.symbol})`)
        .join(", ");
      await this.broadcastInAppNotification({
        title,
        message: `Trending now: ${topNames}.`,
        type: 'trending',
      });
    } catch (error) {
      console.warn('Failed to broadcast top coins notification:', error);
    }

    await sendTelegramChannelMessage(`${title}\n\n${message}`, { disable_web_page_preview: false });
  }





  // Send top points earners notification

      async sendTopPointsNotification(): Promise<void> {
    const topCreators = await this.getTopCreatorsByPoints(10);

    if (topCreators.length === 0) return;

    let message = `\u{2B50} Top Points Earners\n\n`;

    topCreators.forEach((creator, index) => {
      const points = parseFloat(creator.points || '0');
      message += `${index + 1}. ${creator.name || formatAddress(creator.address)}\n`;
      message += `   \u{2B50} Points: ${formatNumber(points)}\n`;
      message += `   \u{1FA99} Coins: ${creator.totalCoins}\n`;
      message += `   \u{1F4CA} Volume: $${formatNumber(parseFloat(creator.totalVolume || '0'))}\n\n`;
    });

    const title = `\u{2B50} Top Points Earners`;

    await sendTelegramChannelMessage(`${title}\n\n${message}`, { disable_web_page_preview: true });
  }





  // Send recent trades notification

      async sendRecentTradesNotification(): Promise<void> {
    const recentTrades = await this.getRecentTrades(10);

    if (recentTrades.length === 0) return;

    let message = `\u{1F9FE} Recent Trading Activity\n\n`;

    recentTrades.forEach((trade, index) => {
      const amount = (parseFloat(trade.rewardAmount) / 1e18).toFixed(4);
      message += `${index + 1}. ${trade.coinSymbol}\n`;
      message += `   \u{1F4B0} ${amount} ${trade.rewardCurrency}\n`;
      message += `   \u{1F464} [${formatAddress(trade.recipientAddress)}](https://zora.co/profile/${trade.recipientAddress})\n`;
      message += `   \u{1F517} [Tx](https://basescan.org/tx/${trade.transactionHash})\n\n`;
    });

    const title = `\u{1F9FE} Recent Trades`;

    await sendTelegramChannelMessage(`${title}\n\n${message}`, { parse_mode: 'Markdown', disable_web_page_preview: false });
  }





  // Weekly top earners (convenience method)

  async sendWeeklyTopEarnersNotification(): Promise<void> {

    await this.sendTopEarnersNotification(24 * 7); // 7 days

  }



  // Send all periodic notifications

    async sendAllPeriodicNotifications(): Promise<void> {
    console.log('Sending periodic notifications...');

    try {
      await this.sendTopCreatorsNotification();
      await this.sendTopEarnersNotification(24); // 24h
      await this.sendTopCoinsNotification();
      await this.sendTopPointsNotification();
      await this.sendRecentTradesNotification();

      console.log('All periodic notifications sent successfully');
    } catch (error) {
      console.error('Error sending periodic notifications:', error);
    }
  }


}



export const notificationService = new NotificationService();

