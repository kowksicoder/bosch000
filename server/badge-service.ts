
import { storage } from './supabase-storage';
import { BADGES } from './points';

export async function checkAndAwardBadges(userId: string, context: {
  e1xpPoints?: number;
  streakDays?: number;
  coinsCreated?: number;
  tradesCount?: number;
  isEarlyAdopter?: boolean;
  isTopHolder?: boolean;
}) {
  const existingBadges = await storage.getUserBadges(userId);
  const existingBadgeTypes = new Set(existingBadges.map(b => b.badge_type));
  const newBadges = [];

  // Check E1XP point-based badges
  if (context.e1xpPoints !== undefined) {
    for (const [type, badge] of Object.entries(BADGES)) {
      if (badge.threshold > 0 && context.e1xpPoints >= badge.threshold && !existingBadgeTypes.has(type)) {
        newBadges.push({
          userId,
          badgeType: type,
          badgeName: badge.name,
          badgeIcon: badge.icon,
          description: badge.description,
        });
      }
    }
  }

  // Check streak-based badges
  if (context.streakDays && context.streakDays >= 7 && !existingBadgeTypes.has('STREAK_MASTER')) {
    const badge = BADGES.STREAK_MASTER;
    newBadges.push({
      userId,
      badgeType: 'STREAK_MASTER',
      badgeName: badge.name,
      badgeIcon: badge.icon,
      description: badge.description,
    });
  }

  // Check first coin badge
  if (context.coinsCreated === 1 && !existingBadgeTypes.has('FIRST_COIN')) {
    const badge = BADGES.FIRST_COIN;
    newBadges.push({
      userId,
      badgeType: 'FIRST_COIN',
      badgeName: badge.name,
      badgeIcon: badge.icon,
      description: badge.description,
    });
  }

  // Check early adopter badge
  if (context.isEarlyAdopter && !existingBadgeTypes.has('EARLY_ADOPTER')) {
    const badge = BADGES.EARLY_ADOPTER;
    newBadges.push({
      userId,
      badgeType: 'EARLY_ADOPTER',
      badgeName: badge.name,
      badgeIcon: badge.icon,
      description: badge.description,
    });
  }

  // Check top holder badge
  if (context.isTopHolder && !existingBadgeTypes.has('TOP_HOLDER')) {
    const badge = BADGES.TOP_HOLDER;
    newBadges.push({
      userId,
      badgeType: 'TOP_HOLDER',
      badgeName: badge.name,
      badgeIcon: badge.icon,
      description: badge.description,
    });
  }

  // Award new badges
  for (const badge of newBadges) {
    await storage.awardBadge(badge);
  }

  return newBadges;
}
