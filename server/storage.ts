import { db } from "./db";
import { eq, desc, and, lt, sql } from "drizzle-orm";
import {
  coins,
  scrapedContent,
  rewards,
  creators,
  users,
  comments,
  follows,
  referrals,
  loginStreaks,
  notifications,
  e1xpRewards,
  pushSubscriptions,
  messages,
  type Coin,
  type InsertCoin,
  type UpdateCoin,
  type ScrapedContent,
  type InsertScrapedContent,
  type Reward,
  type InsertReward,
  type Creator,
  type InsertCreator,
  type UpdateCreator,
  type User,
  type Comment,
  type InsertComment,
  type Follow,
  type InsertFollow,
  type Referral,
  type InsertReferral,
  type LoginStreak,
  type InsertLoginStreak,
  type UpdateLoginStreak,
  type Notification,
  type InsertNotification,
  type E1xpReward,
  type InsertE1xpReward,
  type PushSubscription,
  type InsertPushSubscription,
  type Message,
  type InsertMessage,
} from "@shared/schema";

// Type for user notifications with creator info
export interface UserNotification {
  id: string;
  creator_id: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
  read: boolean;
  created_at: string;
  updated_at: string;
  creator?: {
    address: string;
    name: string | null;
    avatar: string | null;
  };
}

export type ModerationType = 'warn' | 'ban' | 'unban';

export class Storage {
  // ===== COINS =====
  async getAllCoins(): Promise<Coin[]> {
    return await db.select().from(coins).orderBy(desc(coins.createdAt));
  }

  async getCoin(id: string): Promise<Coin | undefined> {
    const result = await db.select().from(coins).where(eq(coins.id, id)).limit(1);
    return result[0];
  }

  async getCoinByAddress(address: string): Promise<Coin | undefined> {
    const result = await db.select().from(coins).where(eq(coins.address, address)).limit(1);
    return result[0];
  }

  async getCoinsByCreator(creator: string): Promise<Coin[]> {
    return await db
      .select()
      .from(coins)
      .where(eq(coins.creatorWallet, creator))
      .orderBy(desc(coins.createdAt));
  }

  async createCoin(insertCoin: InsertCoin): Promise<Coin> {
    const result = await db.insert(coins).values(insertCoin).returning();
    return result[0];
  }

  async updateCoin(id: string, update: UpdateCoin): Promise<Coin | undefined> {
    const result = await db
      .update(coins)
      .set(update)
      .where(eq(coins.id, id))
      .returning();
    return result[0];
  }

  async updateCoinByAddress(address: string, update: UpdateCoin): Promise<Coin | undefined> {
    const result = await db
      .update(coins)
      .set(update)
      .where(eq(coins.address, address))
      .returning();
    return result[0];
  }

  async getPinnedCoins(): Promise<Coin[]> {
    const result = await db
      .select()
      .from(coins)
      .where(and(
        eq(coins.status, 'active'),
        sql`${coins.pinOrder} IS NOT NULL`
      ))
      .orderBy(coins.pinOrder);
    return result;
  }

  async pinCoin(address: string): Promise<Coin | undefined> {
    // Check current pinned count
    const pinnedCoins = await this.getPinnedCoins();
    if (pinnedCoins.length >= 6) {
      throw new Error('Maximum of 6 coins can be pinned');
    }

    // Get the next pin order number
    const nextPinOrder = pinnedCoins.length > 0
      ? Math.max(...pinnedCoins.map(c => c.pinOrder || 0)) + 1
      : 1;

    // Update the coin
    const result = await db
      .update(coins)
      .set({ pinOrder: nextPinOrder })
      .where(eq(coins.address, address))
      .returning();
    return result[0];
  }

  async unpinCoin(address: string): Promise<Coin | undefined> {
    const result = await db
      .update(coins)
      .set({ pinOrder: null })
      .where(eq(coins.address, address))
      .returning();
    return result[0];
  }

  // ===== SCRAPED CONTENT =====
  async getScrapedContent(id: string): Promise<ScrapedContent | undefined> {
    const result = await db
      .select()
      .from(scrapedContent)
      .where(eq(scrapedContent.id, id))
      .limit(1);
    return result[0];
  }

  async createScrapedContent(content: InsertScrapedContent): Promise<ScrapedContent> {
    const result = await db.insert(scrapedContent).values(content).returning();
    return result[0];
  }

  async getAllScrapedContent(): Promise<ScrapedContent[]> {
    return await db.select().from(scrapedContent).orderBy(desc(scrapedContent.scrapedAt));
  }

  // ===== REWARDS =====
  async getReward(id: string): Promise<Reward | undefined> {
    const result = await db.select().from(rewards).where(eq(rewards.id, id)).limit(1);
    return result[0];
  }

  async createReward(reward: InsertReward): Promise<Reward> {
    const result = await db.insert(rewards).values(reward).returning();
    return result[0];
  }

  async getAllRewards(): Promise<Reward[]> {
    return await db.select().from(rewards).orderBy(desc(rewards.createdAt));
  }

  async getRewardsByCoin(coinAddress: string): Promise<Reward[]> {
    return await db
      .select()
      .from(rewards)
      .where(eq(rewards.coinAddress, coinAddress))
      .orderBy(desc(rewards.createdAt));
  }

  async getRewardsByRecipient(recipientAddress: string): Promise<Reward[]> {
    return await db
      .select()
      .from(rewards)
      .where(eq(rewards.recipientAddress, recipientAddress))
      .orderBy(desc(rewards.createdAt));
  }

  async getRewardsByCreator(creatorAddress: string): Promise<Reward[]> {
    return await db
      .select()
      .from(rewards)
      .where(eq(rewards.recipientAddress, creatorAddress))
      .orderBy(desc(rewards.createdAt));
  }

  // ===== CREATORS =====
  async getCreator(id: string): Promise<Creator | undefined> {
    const result = await db.select().from(creators).where(eq(creators.id, id)).limit(1);
    return result[0];
  }

  async getCreatorByPrivyId(privyId: string): Promise<Creator | undefined> {
    const result = await db
      .select()
      .from(creators)
      .where(eq(creators.privyId, privyId))
      .limit(1);
    return result[0];
  }

  async getCreatorByAddress(address: string): Promise<Creator | undefined> {
    // Keep for backwards compatibility
    const result = await db
      .select()
      .from(creators)
      .where(eq(creators.address, address))
      .limit(1);
    return result[0];
  }

  async getCreatorByReferralCode(referralCode: string): Promise<Creator | undefined> {
    const result = await db
      .select()
      .from(creators)
      .where(eq(creators.referralCode, referralCode))
      .limit(1);
    return result[0];
  }

  async createCreator(creator: InsertCreator): Promise<Creator> {
    const result = await db.insert(creators).values(creator).returning();
    return result[0];
  }

  // ===== USERS (for E1XP and referrals) =====
  async getUserByPrivyId(privyId: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.privyId, privyId))
      .limit(1);
    return result[0];
  }

  async getUserByAddress(address: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.walletAddress, address))
      .limit(1);
    return result[0];
  }

  async getUserById(id: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return result[0];
  }

  async getUserByReferralCode(referralCode: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.referralCode, referralCode))
      .limit(1);
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async createUser(insertUser: any): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUser(id: string, update: any): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set(update)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async updateCreator(id: string, update: UpdateCreator): Promise<Creator | undefined> {
    const result = await db
      .update(creators)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(creators.id, id))
      .returning();
    return result[0];
  }

  async addPoints(creatorId: string, amount: number, reason: string): Promise<void> {
    const creator = await this.getCreator(creatorId);
    if (!creator) return;

    const currentPoints = parseInt(creator.points) || 0;
    const newPoints = currentPoints + amount;

    await db
      .update(creators)
      .set({ points: newPoints.toString(), updatedAt: new Date() })
      .where(eq(creators.id, creatorId));
  }

  async getAllCreators(): Promise<Creator[]> {
    return await db.select().from(creators).orderBy(desc(creators.createdAt));
  }

  async getTopCreators(): Promise<Creator[]> {
    return await db.select().from(creators).orderBy(desc(creators.totalVolume)).limit(10);
  }

  async awardPoints(
    creatorId: string,
    amount: number,
    reason: string,
    type: string
  ): Promise<void> {
    await this.addPoints(creatorId, amount, reason);
  }

  // Stub methods for daily points (not implemented yet - would need additional table)
  async getDailyPoints(creatorId: string): Promise<{ claimed: boolean; streak: number }> {
    return { claimed: false, streak: 0 };
  }

  async claimDailyPoints(creatorId: string): Promise<number> {
    return 0;
  }

  async getDailyPointsStatus(
    creatorId: string
  ): Promise<{ claimed: boolean; streak: number; nextClaimAmount: number }> {
    return { claimed: false, streak: 0, nextClaimAmount: 0 };
  }

  // ===== NOTIFICATIONS =====
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(notification).returning();
    return result[0];
  }

  async getUserNotifications(userId: string): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotificationsByUser(userId: string): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationAsRead(notificationId: string): Promise<Notification | undefined> {
    const result = await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, notificationId))
      .returning();
    return result[0];
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, userId));
  }

  async deleteNotification(id: string): Promise<boolean> {
    const result = await db.delete(notifications).where(eq(notifications.id, id)).returning();
    return result.length > 0;
  }

  // ===== E1XP REWARDS =====
  async createE1xpReward(reward: InsertE1xpReward): Promise<E1xpReward> {
    const result = await db.insert(e1xpRewards).values(reward).returning();
    return result[0];
  }

  async getE1xpRewardsByUser(userId: string): Promise<E1xpReward[]> {
    return await db
      .select()
      .from(e1xpRewards)
      .where(eq(e1xpRewards.userId, userId))
      .orderBy(desc(e1xpRewards.createdAt));
  }

  async getUnclaimedE1xpRewardsByUser(userId: string): Promise<E1xpReward[]> {
    return await db
      .select()
      .from(e1xpRewards)
      .where(and(eq(e1xpRewards.userId, userId), eq(e1xpRewards.claimed, false)))
      .orderBy(desc(e1xpRewards.createdAt));
  }

  async claimE1xpReward(rewardId: string): Promise<E1xpReward | undefined> {
    const result = await db
      .update(e1xpRewards)
      .set({ claimed: true, claimedAt: new Date() })
      .where(eq(e1xpRewards.id, rewardId))
      .returning();
    return result[0];
  }

  async getUnclaimedRewardsOlderThan(days: number): Promise<E1xpReward[]> {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - days);

    return await db
      .select()
      .from(e1xpRewards)
      .where(and(eq(e1xpRewards.claimed, false), lt(e1xpRewards.createdAt, threshold)))
      .orderBy(desc(e1xpRewards.createdAt));
  }

  async markReminderSent(rewardId: string): Promise<void> {
    await db
      .update(e1xpRewards)
      .set({ reminderSentAt: new Date() })
      .where(eq(e1xpRewards.id, rewardId));
  }

  // ===== PUSH SUBSCRIPTIONS =====
  async createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription> {
    const result = await db.insert(pushSubscriptions).values(subscription).returning();
    return result[0];
  }

  async getPushSubscriptionsByUser(userId: string): Promise<PushSubscription[]> {
    return await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
  }

  async deletePushSubscription(endpoint: string): Promise<boolean> {
    const result = await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .returning();
    return result.length > 0;
  }

  // ===== MODERATION (Stub - would need moderation table) =====
  async moderateUser(creatorId: string, action: ModerationType): Promise<void> {
    // Stub - would need moderation history table
  }

  async getModerationHistory(creatorId: string): Promise<ModerationType[]> {
    return [];
  }

  // ===== COMMENTS =====
  async createComment(comment: InsertComment): Promise<Comment> {
    const result = await db.insert(comments).values(comment).returning();
    return result[0];
  }

  async getCommentsByCoin(coinAddress: string): Promise<Comment[]> {
    return await db
      .select()
      .from(comments)
      .where(eq(comments.coinAddress, coinAddress))
      .orderBy(desc(comments.createdAt));
  }

  async getAllComments(): Promise<Comment[]> {
    return await db.select().from(comments).orderBy(desc(comments.createdAt));
  }

  // ===== FOLLOWS =====
  async createFollow(insertFollow: InsertFollow): Promise<Follow> {
    const result = await db.insert(follows).values(insertFollow).returning();
    return result[0];
  }

  async deleteFollow(followerAddress: string, followingAddress: string): Promise<boolean> {
    const result = await db
      .delete(follows)
      .where(
        and(
          eq(follows.followerAddress, followerAddress),
          eq(follows.followingAddress, followingAddress)
        )
      )
      .returning();
    return result.length > 0;
  }

  async getFollowers(userAddress: string): Promise<Follow[]> {
    return await db
      .select()
      .from(follows)
      .where(eq(follows.followingAddress, userAddress))
      .orderBy(desc(follows.createdAt));
  }

  async getFollowing(userAddress: string): Promise<Follow[]> {
    return await db
      .select()
      .from(follows)
      .where(eq(follows.followerAddress, userAddress))
      .orderBy(desc(follows.createdAt));
  }

  async getFollowersByAddress(userAddress: string): Promise<Follow[]> {
    return this.getFollowers(userAddress);
  }

  async getFollowingByAddress(userAddress: string): Promise<Follow[]> {
    return this.getFollowing(userAddress);
  }

  async isFollowing(followerAddress: string, followingAddress: string): Promise<boolean> {
    const result = await db
      .select()
      .from(follows)
      .where(
        and(
          eq(follows.followerAddress, followerAddress),
          eq(follows.followingAddress, followingAddress)
        )
      )
      .limit(1);
    return result.length > 0;
  }

  // ===== REFERRALS =====
  async createReferral(insertReferral: InsertReferral): Promise<Referral> {
    const result = await db.insert(referrals).values(insertReferral).returning();
    return result[0];
  }

  async getReferralsByReferrer(referrerId: string): Promise<Referral[]> {
    return await db
      .select()
      .from(referrals)
      .where(eq(referrals.referrerId, referrerId))
      .orderBy(desc(referrals.createdAt));
  }

  async getReferralByAddresses(
    referrerId: string,
    referredUserId: string
  ): Promise<Referral | undefined> {
    const result = await db
      .select()
      .from(referrals)
      .where(
        and(
          eq(referrals.referrerId, referrerId),
          eq(referrals.referredUserId, referredUserId)
        )
      )
      .limit(1);
    return result[0];
  }

  // ===== LOGIN STREAKS =====
  async getLoginStreak(userId: string): Promise<LoginStreak | undefined> {
    const result = await db
      .select()
      .from(loginStreaks)
      .where(eq(loginStreaks.userId, userId))
      .limit(1);
    return result[0];
  }

  async createLoginStreak(insertLoginStreak: InsertLoginStreak): Promise<LoginStreak> {
    const result = await db.insert(loginStreaks).values(insertLoginStreak).returning();
    return result[0];
  }

  async updateLoginStreak(
    userId: string,
    update: UpdateLoginStreak
  ): Promise<LoginStreak | undefined> {
    const result = await db
      .update(loginStreaks)
      .set(update)
      .where(eq(loginStreaks.userId, userId))
      .returning();
    return result[0];
  }

  // ===== MESSAGES =====
  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const result = await db.insert(messages).values(insertMessage).returning();
    return result[0];
  }

  async getMessagesBetweenUsers(userId1: string, userId2: string): Promise<Message[]> {
    const result = await db
      .select()
      .from(messages)
      .where(
        and(
          sql`(${messages.senderId} = ${userId1} AND ${messages.recipientId} = ${userId2}) OR (${messages.senderId} = ${userId2} AND ${messages.recipientId} = ${userId1})`
        )
      )
      .orderBy(messages.createdAt);
    return result;
  }

  async markMessagesAsRead(userId: string, otherUserId: string): Promise<void> {
    await db
      .update(messages)
      .set({ isRead: true })
      .where(
        and(
          eq(messages.recipientId, userId),
          eq(messages.senderId, otherUserId),
          eq(messages.isRead, false)
        )
      );
  }

  async getConversationsForUser(userId: string): Promise<Array<{ otherUserId: string, lastMessage: Message }>> {
    // Get all unique users this user has conversations with
    const sentMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.senderId, userId))
      .orderBy(desc(messages.createdAt));
    
    const receivedMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.recipientId, userId))
      .orderBy(desc(messages.createdAt));

    // Combine and get unique users
    const allMessages = [...sentMessages, ...receivedMessages];
    const conversationMap = new Map<string, Message>();

    for (const msg of allMessages) {
      const otherUserId = msg.senderId === userId ? msg.recipientId : msg.senderId;
      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, msg);
      }
    }

    return Array.from(conversationMap.entries()).map(([otherUserId, lastMessage]) => ({
      otherUserId,
      lastMessage
    }));
  }

  async getUnreadMessageCount(userId: string, otherUserId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(
        and(
          eq(messages.recipientId, userId),
          eq(messages.senderId, otherUserId),
          eq(messages.isRead, false)
        )
      );
    return Number(result[0]?.count || 0);
  }
}

export const storage = new Storage();