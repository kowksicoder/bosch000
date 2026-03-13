import { Router } from 'express';
import { Storage } from '../storage';
import { PrivyClient } from '@privy-io/server-auth';

const privyAppId = process.env.VITE_PRIVY_APP_ID;
const privyAppSecret = process.env.PRIVY_APP_SECRET;

let privyClient: PrivyClient | null = null;
if (privyAppId && privyAppSecret) {
  privyClient = new PrivyClient(privyAppId, privyAppSecret);
}

export function createE1XPRouter(storage: Storage) {
  const router = Router();

  // Middleware to get creator from Privy auth
  const getAuthenticatedCreator = async (req: any, res: any) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('[E1XP Auth] No authorization header found');
        return null;
      }

      if (!privyClient) {
        console.error('[E1XP Auth] Privy client not initialized');
        return null;
      }

      const token = authHeader.substring(7);
      const verifiedClaims = await privyClient.verifyAuthToken(token);
      const privyId = verifiedClaims.userId;

      if (!privyId) {
        console.log('[E1XP Auth] No privyId in claims');
        return null;
      }

      // Try to get creator by Privy ID
      let creator = await storage.getCreatorByPrivyId(privyId);

      // If not found, try to sync/create the creator
      if (!creator) {
        console.log('[E1XP Auth] Creator not found, attempting to sync');
        try {
          // Get user info from Privy to create creator
          const privyUser = await privyClient.getUser(privyId);
          const address = privyUser.wallet?.address || null;
          const email = privyUser.email?.address || null;

          // Import the sync functionality
          const { syncCreatorProfile } = await import('../routes');
          creator = await syncCreatorProfile(privyId, address, email);
        } catch (syncError) {
          console.error('[E1XP Auth] Failed to sync creator:', syncError);
          return null;
        }
      }

      return creator;
    } catch (error) {
      console.error('[E1XP Auth] Failed to authenticate:', error);
      return null;
    }
  };

  // Get E1XP status (points, streak, etc)
  router.get('/status', async (req, res) => {
    try {
      const creator = await getAuthenticatedCreator(req, res);
      if (!creator) {
        // Return default status for unauthenticated users
        return res.json({
          points: 0,
          streak: 0,
          longestStreak: 0,
          nextClaimAmount: 10,
          daysUntilBonus: 7,
          canClaimDaily: false,
          lastClaimDate: null,
          authenticated: false
        });
      }

      console.log('[E1XP Status] Fetching status for creator:', {
        id: creator.id,
        address: creator.address,
        privyId: creator.privyId,
        points: creator.points
      });

      // Use the same user identifier logic as the check-in endpoint
      // For wallet users: use address
      // For email users without address: use privyId or id
      const userId = creator.address && !creator.address.startsWith('email_')
        ? creator.address
        : creator.privyId || creator.id;

      console.log('[E1XP Status] Resolved userId:', userId);

      // Get login streak using the consistent userId
      const loginStreak = await storage.getLoginStreak(userId);

      const points = parseInt(creator.points || '0');
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];

      // User can claim if:
      // 1. No login streak exists (first time)
      // 2. Last login date is NOT today (haven't claimed today yet)
      const canClaimDaily = !loginStreak || loginStreak.lastLoginDate !== today;

      let currentStreak = 0;
      if (loginStreak) {
        currentStreak = parseInt(loginStreak.currentStreak || "0");

        // If last login was not today, check if streak should reset
        if (loginStreak.lastLoginDate && loginStreak.lastLoginDate !== today) {
          const lastLoginDate = new Date(loginStreak.lastLoginDate);
          const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const daysDiff = Math.floor((todayDate.getTime() - lastLoginDate.getTime()) / (1000 * 60 * 60 * 24));

          // If more than 1 day has passed, streak is broken
          if (daysDiff > 1) {
            currentStreak = 0;
          }
        }
      }

      const longestStreak = loginStreak ? parseInt(loginStreak.longestStreak || "0") : 0;

      console.log('[E1XP Status] Returning:', {
        points,
        currentStreak,
        longestStreak,
        canClaimDaily,
        today,
        lastLoginDate: loginStreak?.lastLoginDate
      });

      res.json({
        points,
        streak: currentStreak,
        longestStreak: longestStreak,
        weeklyCalendar: loginStreak?.weeklyCalendar || [false, false, false, false, false, false, false],
        nextClaimAmount: 10,
        daysUntilBonus: 7 - (currentStreak % 7),
        canClaimDaily,
        lastClaimDate: loginStreak?.lastLoginDate,
        authenticated: true
      });
    } catch (error) {
      console.error('[E1XP Status] Failed to get E1XP status:', error);
      // Return default status on error instead of 500
      res.status(200).json({
        points: 0,
        streak: 0,
        longestStreak: 0,
        nextClaimAmount: 10,
        daysUntilBonus: 7,
        canClaimDaily: false,
        lastClaimDate: null,
        authenticated: false,
        error: 'Failed to fetch status'
      });
    }
  });

  // Claim daily points
  router.post('/claim-daily', async (req, res) => {
    try {
      const creator = await getAuthenticatedCreator(req, res);
      if (!creator) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Use creator.address or creator.privyId or creator.id as userId (must match status endpoint)
      const userId = creator.address || creator.privyId || creator.id;

      console.log('[E1XP Claim] Attempting to claim daily points for:', {
        userId,
        creatorId: creator.id,
        address: creator.address,
        privyId: creator.privyId
      });

      // Use the login streak check-in
      const result = await storage.checkInStreak(userId);

      console.log('[E1XP Claim] Check-in successful:', {
        pointsEarned: result.pointsEarned,
        currentStreak: result.currentStreak
      });

      // Refresh creator data to get updated points
      const updatedCreator = await storage.getCreator(creator.id);

      // Send notification
      try {
        const { notificationService } = await import('../notification-service');
        await notificationService.notifyDailyLoginStreak(
          creator.id,
          result.currentStreak,
          result.pointsEarned
        );
        console.log(`[E1XP Claim] Sent notification to ${creator.id} for ${result.pointsEarned} points (streak: ${result.currentStreak})`);
      } catch (notifError) {
        console.error('[E1XP Claim] Failed to send notification:', notifError);
        // Continue even if notification fails
      }

      res.json({ 
        pointsEarned: result.pointsEarned,
        streak: result.currentStreak,
        totalPoints: parseInt(updatedCreator?.points || creator.points || '0'),
        message: 'Daily points claimed successfully!'
      });
    } catch (error: any) {
      console.error('[E1XP Claim] Failed to claim daily points:', error);
      if (error.message && (error.message.includes('already checked in') || error.message.includes('already claimed'))) {
        return res.status(400).json({ error: 'Daily points already claimed today' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Award points for other actions
  router.post('/award', async (req, res) => {
    try {
      const { creatorId, amount, reason, type } = req.body;

      // Only allow this endpoint for admin users or system actions
      if (!req.session?.user?.isAdmin) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await storage.awardPoints(creatorId, amount, reason, type);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to award points:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get notifications
  router.get('/notifications', async (req, res) => {
    try {
      const creator = await getAuthenticatedCreator(req, res);
      if (!creator) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = creator.address || creator.privyId || creator.id;
      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error('Failed to get notifications:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Mark notification as read
  router.patch('/notifications/:id/read', async (req, res) => {
    try {
      const creator = await getAuthenticatedCreator(req, res);
      if (!creator) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      await storage.markNotificationAsRead(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Mark all notifications as read
  router.patch('/notifications/read-all', async (req, res) => {
    try {
      const creator = await getAuthenticatedCreator(req, res);
      if (!creator) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = creator.address || creator.privyId || creator.id;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get unclaimed rewards
  router.get('/rewards/unclaimed', async (req, res) => {
    try {
      const creator = await getAuthenticatedCreator(req, res);
      if (!creator) {
        return res.json([]);
      }

      try {
        const rewardUserId = creator.address || creator.privyId || creator.id;
        const unclaimedRewards = await storage.getUnclaimedE1xpRewardsByUser(rewardUserId);
        res.json(unclaimedRewards);
      } catch (dbError) {
        console.log('Unable to fetch unclaimed rewards from DB:', dbError);
        res.json([]);
      }
    } catch (error) {
      console.error('Failed to get unclaimed rewards:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Claim reward
  router.post('/rewards/:rewardId/claim', async (req, res) => {
    try {
      const creator = await getAuthenticatedCreator(req, res);
      if (!creator) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { rewardId } = req.params;
      const reward = await storage.claimE1xpReward(rewardId);

      if (!reward) {
        return res.status(404).json({ error: 'Reward not found' });
      }

      // Add points to user
      await storage.addPoints(reward.userId, parseInt(reward.amount), `Claimed reward: ${reward.title}`);

      // Get updated creator info
      const updatedCreator =
        (await storage.getCreatorByAddress(reward.userId)) ||
        (await storage.getCreatorByPrivyId(reward.userId));
      const totalPoints = updatedCreator ? parseInt(updatedCreator.points || '0') : 0;

      res.json({
        reward,
        totalPoints,
        message: `Successfully claimed ${reward.amount} E1XP!`
      });
    } catch (error) {
      console.error('Failed to claim reward:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
