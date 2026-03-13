import { db } from "./db";
import { users, pointsTransactions, referrals } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from './supabase-storage';
import { sendTelegramNotification } from './telegram-bot';
import { notificationService } from './notification-service';
import type { Reward, Creator, Coin } from '@shared/schema';

export const POINTS_REWARDS = {
  DAILY_LOGIN: 10,
  DAILY_STREAK_3: 25,
  DAILY_STREAK_7: 50,
  DAILY_STREAK_30: 200,
  TRADE_BUY: 5,
  TRADE_SELL: 5,
  CREATE_COIN: 100,
  IMPORT_COIN: 50,
  REFERRAL_SIGNUP: 500,
  REFERRAL_FIRST_TRADE: 250,
  REFERRAL_BONUS_MULTIPLIER: 2, // Double points for active referrals
  PROFILE_COMPLETE: 30,
  FIRST_CONNECTION: 20,
  JOIN_GROUP: 15,
};

export const BADGES = {
  NEWCOMER: { name: "Newcomer", threshold: 0, icon: "🌱", description: "Welcome to the platform!" },
  EXPLORER: { name: "Explorer", threshold: 100, icon: "🔍", description: "Earned 100 E1XP points" },
  TRADER: { name: "Trader", threshold: 500, icon: "💎", description: "Made your first trade" },
  CREATOR: { name: "Creator", threshold: 1000, icon: "🎨", description: "Created your first coin" },
  INFLUENCER: { name: "Influencer", threshold: 2500, icon: "⭐", description: "Earned 2500 E1XP points" },
  LEGEND: { name: "Legend", threshold: 5000, icon: "👑", description: "Earned 5000 E1XP points" },
  STREAK_MASTER: { name: "Streak Master", threshold: -1, special: "7_day_streak", icon: "🔥", description: "Maintained a 7-day login streak" },
  FIRST_COIN: { name: "First Coin", threshold: -1, special: "first_coin", icon: "🪙", description: "Created your first coin" },
  TOP_HOLDER: { name: "Top Holder", threshold: -1, special: "top_holder", icon: "💰", description: "Top 10 holder of a coin" },
  EARLY_ADOPTER: { name: "Early Adopter", threshold: -1, special: "early_adopter", icon: "⚡", description: "Among the first 100 users" },
  REFERRAL_KING: { name: "Referral King", threshold: -1, special: "10_referrals", icon: "🤝" },
};

export async function awardPoints(
  userId: string,
  amount: number,
  type: string,
  description: string,
  metadata?: Record<string, any>
) {
  // Add points transaction
  await db.insert(pointsTransactions).values({
    userId,
    amount,
    type,
    description,
    metadata,
  });

  // Update user's total points
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return null;

  const newPoints = (user.e1xpPoints || 0) + amount;
  const currentBadges = user.pointsBadges || [];
  const newBadges = [...currentBadges];

  // Check for new badge unlocks
  for (const [key, badge] of Object.entries(BADGES)) {
    const badgeKey = key.toLowerCase();
    if (!currentBadges.includes(badgeKey) && badge.threshold > 0 && newPoints >= badge.threshold) {
      newBadges.push(badgeKey);

      // Award bonus points for unlocking badge
      await db.insert(pointsTransactions).values({
        userId,
        amount: 50,
        type: "badge_unlock",
        description: `Unlocked ${badge.name} badge!`,
        metadata: { badge: badgeKey },
      });

      // Notify user about badge unlock
      await notificationService.notifyBadgeUnlocked(userId, badge.name);
    }
  }

  const [updatedUser] = await db
    .update(users)
    .set({
      e1xpPoints: newPoints + (newBadges.length > currentBadges.length ? 50 : 0),
      pointsBadges: newBadges,
    })
    .where(eq(users.id, userId))
    .returning();

  return updatedUser;
}

export async function checkAndAwardSpecialBadges(userId: string, type: string, metadata?: any) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return;

  const currentBadges = user.pointsBadges || [];
  const newBadges = [...currentBadges];

  // Streak Master - 7 day streak
  if (type === "7_day_streak" && !currentBadges.includes("streak_master")) {
    newBadges.push("streak_master");
    await awardPoints(userId, 100, "badge_unlock", "Unlocked Streak Master badge!", { badge: "streak_master" });
  }

  // Referral King - 10 referrals
  if (type === "10_referrals" && !currentBadges.includes("referral_king")) {
    newBadges.push("referral_king");
    await awardPoints(userId, 200, "badge_unlock", "Unlocked Referral King badge!", { badge: "referral_king" });
  }

  if (newBadges.length > currentBadges.length) {
    await db
      .update(users)
      .set({ pointsBadges: newBadges })
      .where(eq(users.id, userId));
  }
}

export async function generateReferralCode(userId: string): Promise<string> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user?.username) {
    // Use username as referral code
    await db
      .update(users)
      .set({ referralCode: user.username })
      .where(eq(users.id, userId));
    return user.username;
  }

  // Fallback to random code if no username
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  await db
    .update(users)
    .set({ referralCode: code })
    .where(eq(users.id, userId));
  return code;
}

export async function trackReferralActivity(userId: string, activityType: 'trade' | 'create_coin') {
  // Check if user was referred
  const [referralRecord] = await db
    .select()
    .from(referrals)
    .where(eq(referrals.referredUserId, userId))
    .limit(1);

  if (!referralRecord) return;

  const points = activityType === 'create_coin' ? POINTS_REWARDS.CREATE_COIN : POINTS_REWARDS.TRADE_BUY;
  const referrerBonus = Math.floor(points * POINTS_REWARDS.REFERRAL_BONUS_MULTIPLIER);

  // Award bonus to referrer
  await awardPoints(
    referralRecord.referrerId,
    referrerBonus,
    "referral_bonus",
    `Your referral ${activityType === 'create_coin' ? 'created a coin' : 'made a trade'}! 2x bonus!`,
    { referredUserId: userId, activityType }
  );

  // Update referral tracking
  await db
    .update(referrals)
    .set({
      hasTradedOrCreated: true,
      totalPointsEarned: (referralRecord.totalPointsEarned || 0) + referrerBonus,
      status: 'active',
    })
    .where(eq(referrals.id, referralRecord.id));

  // Notify referrer
  const [referrer] = await db.select().from(users).where(eq(users.id, referralRecord.referrerId)).limit(1);
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1); // Fetch referred user for notification message

  if (referrer && user) {
    try {
      const referrerAddress =
        referrer.walletAddress || referrer.privyId || referrer.id;
      const referredAddress =
        user.walletAddress || user.privyId || user.id;

      if (referrerAddress && referredAddress) {
        const existingReferral = await storage.getReferralByAddresses(
          referrerAddress,
          referredAddress,
        );

        if (existingReferral) {
          const currentPoints = parseFloat((existingReferral as any).points_earned || '0');
          const newPoints = currentPoints + referrerBonus;
          await storage.updateReferralByAddresses(referrerAddress, referredAddress, {
            pointsEarned: newPoints.toFixed(0),
            claimed: true,
          });
        }
      }
    } catch (referralError) {
      console.warn("Failed to sync referral bonus to Supabase:", referralError);
    }

    // Send notification via service
    await notificationService.notifyReferralEarned(
      referrer.id, // Use referrer.id for notification service
      user.id,     // Use user.id for notification service
      referrerBonus
    );

    // Existing notification call (can be removed if notificationService covers all cases)
    await storage.createNotification({
      userId: referrer.id, // Use referrer.id here as well
      type: "referral",
      title: "🎉 Referral Bonus! 🎉",
      message: `Your referral ${user.username || user.id} just ${activityType === 'create_coin' ? 'created a coin' : 'made a trade'}! You earned ${referrerBonus} E1XP (2x bonus)`,
      amount: referrerBonus.toString(), // Ensure amount is a string if required by storage.createNotification
    });
  }
}

// Admin notification testing function
export async function sendAdminNotificationTest(userId: string, message: string) {
  await notificationService.sendTestNotification(userId, message);
}
