import { Router } from 'express';
import { Storage } from '../storage';
import { ModerationAction, NotificationType } from '../../shared/schema';

export function createAdminRouter(storage: Storage) {
  const router = Router();

  // Middleware to check admin status
  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.session?.user?.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized: Admin access required' });
    }
    next();
  };

  // Moderate user
  router.post('/moderate', requireAdmin, async (req, res) => {
    try {
      const { address, type, duration, reason } = req.body;
      
      // Get creator by address
      const creator = await storage.getCreatorByAddress(address);
      if (!creator) {
        return res.status(404).json({ error: 'User not found' });
      }

      const action: ModerationAction = {
        type,
        duration,
        reason
      };

      await storage.moderateUser(creator.id, action);
      res.json({ success: true });
    } catch (error) {
      console.error('Moderation failed:', error);
      res.status(500).json({ error: 'Failed to moderate user' });
    }
  });

  // Test notifications
  router.post('/test-notification', requireAdmin, async (req, res) => {
    try {
      const { type, title, message, address } = req.body;

      if (address === 'all') {
        // Send to all users
        const creators = await storage.getAllCreators();
        const promises = creators.map(creator => 
          storage.createNotification({
            creator_id: creator.id,
            type: type as NotificationType,
            title,
            message,
            metadata: {
              isTest: true
            },
            read: false
          })
        );
        await Promise.all(promises);
      } else {
        // Send to specific user
        const creator = await storage.getCreatorByAddress(address);
        if (!creator) {
          return res.status(404).json({ error: 'User not found' });
        }

        await storage.createNotification({
          creator_id: creator.id,
          type: type as NotificationType,
          title,
          message,
          metadata: {
            isTest: true
          },
          read: false
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Notification test failed:', error);
      res.status(500).json({ error: 'Failed to send test notification' });
    }
  });

  // Get moderation history
  router.get('/moderation-history/:address', requireAdmin, async (req, res) => {
    try {
      const creator = await storage.getCreatorByAddress(req.params.address);
      if (!creator) {
        return res.status(404).json({ error: 'User not found' });
      }

      const history = await storage.getModerationHistory(creator.id);
      res.json(history);
    } catch (error) {
      console.error('Failed to get moderation history:', error);
      res.status(500).json({ error: 'Failed to get moderation history' });
    }
  });

  return router;
}