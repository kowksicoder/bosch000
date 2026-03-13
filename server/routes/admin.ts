import { Router } from 'express';
import { getPaystackBalance } from '../paystack';
import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

export function setSocketIO(ioInstance: SocketIOServer) {
  io = ioInstance;
}

// Note: keep types loose here to avoid coupling to schema type mismatches in runtime

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'bloombetgaming@gmail.com';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80);

export function createAdminRouter(storage: any) {
  const router = Router();

  const resolveCreatorForMission = async (creatorId: string) => {
    if (!creatorId) return null;
    try {
      if (creatorId.startsWith("0x")) {
        const creator = await storage.getCreatorByAddress(creatorId);
        if (creator) return creator;
      }
      const byPrivy = await storage.getCreatorByPrivyId(creatorId);
      if (byPrivy) return byPrivy;
      if (storage.getCreatorByName) {
        const byName = await storage.getCreatorByName(creatorId);
        if (byName) return byName;
      }
    } catch (error) {
      console.warn("[ADMIN] Failed to resolve creator for mission:", error);
    }
    return null;
  };

  // Middleware to check admin status
  const requireAdmin = (req: any, res: any, next: any) => {
    // Check if session exists and user is admin
    console.log('[ADMIN] Checking admin access. Session:', {
      exists: !!req.session,
      user: req.session?.user,
      isAdmin: req.session?.user?.isAdmin
    });

    const isAdmin = req.session?.user?.isAdmin === true || req.session?.user?.isAdmin === 1;

    if (!isAdmin) {
      console.error('[ADMIN] Unauthorized access attempt. Session user:', req.session?.user);
      console.error('[ADMIN] Request path:', req.path);
      console.error('[ADMIN] Session ID:', req.sessionID);
      return res.status(403).json({
        error: 'Unauthorized: Admin access required',
        hint: 'Please log in to the admin panel first at /admin-login'
      });
    }

    console.log('[ADMIN] Admin access granted for user:', req.session.user.email || req.session.user.username);
    next();
  };

  // Admin login endpoint (no password required for admin email)
  router.post('/login', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Check if this is the admin email
      if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({ error: 'Not authorized as admin' });
      }

      // Get or create admin creator (using pseudo-address based on email)
      const adminAddress = `admin_${email.toLowerCase().replace('@', '_at_').replace(/\./g, '_')}`;
      let adminCreator = await storage.getCreatorByAddress(adminAddress);

      if (!adminCreator) {
        // Create admin creator if doesn't exist
        adminCreator = await storage.createCreator({
          address: adminAddress,
          name: 'Platform Admin',
          bio: 'Administrator account',
          totalCoins: '0',
          totalVolume: '0',
          followers: '0',
        } as any);
      }

      // Set session
      if (!req.session) {
        req.session = {} as any;
      }
      req.session.user = {
        id: adminCreator.id,
        email: email,
        username: 'admin',
        address: adminAddress,
        isAdmin: true,
      };

      // Save session explicitly to ensure it persists
      await new Promise<void>((resolve, reject) => {
        req.session.save((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log('[ADMIN] Session saved for admin user:', email);
      console.log('[ADMIN] Session ID:', req.sessionID);

      res.json({
        success: true,
        user: {
          id: adminCreator.id,
          email: email,
          username: 'admin',
          isAdmin: true,
        }
      });
    } catch (error) {
      console.error('[ADMIN] Login failed:', error);
      res.status(500).json({ error: 'Login failed', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Check admin session
  router.get('/session', (req, res) => {
    if (req.session?.user?.isAdmin) {
      res.json({
        authenticated: true,
        user: req.session.user
      });
    } else {
      res.json({ authenticated: false });
    }
  });

  // Admin logout endpoint
  router.post('/logout', (req, res) => {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to logout' });
        }
        res.json({ success: true });
      });
    } else {
      res.json({ success: true });
    }
  });

  // Add new admin
  router.post('/add-admin', requireAdmin, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Create or update user to be admin
      const adminAddress = `admin_${email.toLowerCase().replace('@', '_at_').replace(/\./g, '_')}`;
      let adminUser = await storage.getUserByEmail(email);

      if (!adminUser) {
        // Check if creator exists with this address
        let creator = await storage.getCreatorByAddress(adminAddress);
        if (!creator) {
          creator = await storage.createCreator({
            address: adminAddress,
            name: `Admin (${email})`,
            bio: 'Platform Administrator',
          } as any);
        }

        // Create user entry
        adminUser = await storage.createUser({
          email,
          username: email.split('@')[0],
          displayName: `Admin (${email})`,
          walletAddress: adminAddress,
        } as any);
      }

      // Update user to be admin
      await storage.updateUser(adminUser.id, { isAdmin: 1 } as any);

      res.json({ success: true, user: adminUser });
    } catch (error) {
      console.error('[ADMIN] Add admin failed:', error);
      res.status(500).json({ error: 'Failed to add admin', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Moderate user
  router.post('/moderate', requireAdmin, async (req, res) => {
    try {
      const { address, type, duration, reason } = req.body;

      // Get creator by address
      const creator = await storage.getCreatorByAddress(address);
      if (!creator) {
        return res.status(404).json({ error: 'User not found' });
      }

      const action = { type, duration, reason } as any;

      await storage.moderateUser(creator.id, action as any);
      res.json({ success: true });
    } catch (error) {
      console.error('Moderation failed:', error);
      res.status(500).json({ error: 'Failed to moderate user' });
    }
  });

  // Send custom message/notification to users
  router.post('/send-message', requireAdmin, async (req, res) => {
    try {
      console.log('[ADMIN] Send message request:', req.body);
      const {
        title,
        message,
        type = 'admin',
        recipients,
        sendToAll = false,
        includeTelegram = false
      } = req.body;

      // Validate required fields
      if (!title || !message) {
        return res.status(400).json({ error: 'Title and message are required' });
      }

      if (!sendToAll && (!recipients || recipients.length === 0)) {
        return res.status(400).json({ error: 'Must specify recipients or enable send to all' });
      }

      console.log('[ADMIN] Sending message:', { title, message, type, sendToAll, recipientCount: recipients?.length });

      let successCount = 0;
      let failCount = 0;
      const { sendTelegramNotification } = await import('../telegram-bot');
      const { emitNotificationToUser, broadcastNotificationToAll } = await import('../socket-server');

      if (sendToAll) {
        // Send to all users
        console.log('[ADMIN] Broadcasting message to all creators');
        const creators = await storage.getAllCreators();
        console.log(`[ADMIN] Found ${creators.length} creators`);

        for (const creator of creators) {
          try {
            // Create in-app notification
            const notification = await storage.createNotification({
              userId: creator.address || creator.id,
              type: type,
              title,
              message,
              metadata: { fromAdmin: true },
              read: false,
              createdAt: new Date(),
            } as any);

            // Send real-time notification via Socket.IO
            emitNotificationToUser(creator.address || creator.id, notification);

            // Send Telegram notification if enabled
            if (includeTelegram && creator.address) {
              try {
                await sendTelegramNotification(
                  creator.address,
                  title,
                  message,
                  type
                );
              } catch (telegramError) {
                console.warn(`[ADMIN] Telegram failed for ${creator.address}:`, telegramError);
                // Don't fail the whole operation if Telegram fails
              }
            }

            successCount++;
          } catch (error) {
            console.error(`[ADMIN] Failed to send to ${creator.address}:`, error);
            failCount++;
          }
        }
      } else {
        // Send to specific recipients
        console.log(`[ADMIN] Sending message to ${recipients.length} specific users`);

        for (const recipient of recipients) {
          try {
            // Find user by address or privyId
            let targetUserId = recipient;

            // Try to find creator by address or privyId
            let creator = await storage.getCreatorByAddress(recipient);
            if (!creator && recipient.startsWith('did:')) {
              // Might be a privyId
              creator = await storage.getCreatorByPrivyId(recipient);
            }

            if (creator) {
              targetUserId = creator.address || creator.id;
            }

            // Create in-app notification
            const notification = await storage.createNotification({
              userId: targetUserId,
              type: type,
              title,
              message,
              metadata: { fromAdmin: true },
              read: false,
              createdAt: new Date(),
            } as any);

            // Send real-time notification via Socket.IO
            emitNotificationToUser(targetUserId, notification);

            // Send Telegram notification if enabled
            if (includeTelegram && (creator?.address || targetUserId)) {
              try {
                await sendTelegramNotification(
                  creator?.address || targetUserId,
                  title,
                  message,
                  type
                );
              } catch (telegramError) {
                console.warn(`[ADMIN] Telegram failed for ${targetUserId}:`, telegramError);
              }
            }

            successCount++;
          } catch (error) {
            console.error(`[ADMIN] Failed to send to ${recipient}:`, error);
            failCount++;
          }
        }
      }

      console.log(`[ADMIN] Message send complete: ${successCount} success, ${failCount} failed`);
      res.json({
        success: true,
        sent: successCount,
        failed: failCount,
        message: `Successfully sent message to ${successCount} user(s)${failCount > 0 ? `, ${failCount} failed` : ''}`
      });
    } catch (error) {
      console.error('[ADMIN] Send message failed:', error);
      console.error('[ADMIN] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({
        error: 'Failed to send message',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Missions moderation (admin)
  router.get('/missions', requireAdmin, async (_req, res) => {
    try {
      const missions = await storage.getMissions();
      const missionIds = missions.map((mission: any) => mission.id);
      const userMissions = await storage.getUserMissionsByMissionIds(missionIds);

      const grouped = new Map<string, { completions: number; claims: number }>();
      userMissions.forEach((entry: any) => {
        const stats = grouped.get(entry.missionId || entry.mission_id) || { completions: 0, claims: 0 };
        const status = entry.status || entry.status;
        if (status === 'completed' || status === 'claimed') stats.completions += 1;
        if (status === 'claimed') stats.claims += 1;
        grouped.set(entry.missionId || entry.mission_id, stats);
      });

      const enriched = await Promise.all(
        missions.map(async (mission: any) => {
          const stats = grouped.get(mission.id) || { completions: 0, claims: 0 };
          const creator = await resolveCreatorForMission(mission.creatorId || mission.creator_id);
          const rewardValue = Number(mission.rewardValue || mission.reward_value || 0) || 0;
          const rewardPayouts =
            (mission.rewardType || mission.reward_type) === 'e1xp'
              ? stats.claims * (rewardValue || 10)
              : 0;
          return {
            ...mission,
            completions: stats.completions,
            claims: stats.claims,
            rewardPayouts,
            creator: creator
              ? {
                  id: creator.id,
                  name: creator.name,
                  avatar: creator.avatar,
                  address: creator.address,
                }
              : null,
          };
        }),
      );

      res.json(enriched);
    } catch (error) {
      console.error('[ADMIN] Fetch missions failed:', error);
      res.status(500).json({ error: 'Failed to fetch missions' });
    }
  });

  router.get('/missions/pending-fulfillment', requireAdmin, async (_req, res) => {
    try {
      const pending = await storage.getPendingMissionFulfillments();
      res.json(pending);
    } catch (error) {
      console.error('[ADMIN] Fetch pending fulfillments failed:', error);
      res.status(500).json({ error: 'Failed to fetch pending fulfillments' });
    }
  });

  router.post('/missions/:missionId/fulfill', requireAdmin, async (req, res) => {
    try {
      const { missionId } = req.params;
      const { userId, deliveryNotes, deliveryValue } = req.body || {};

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const mission = await storage.getMission(missionId);
      if (!mission) {
        return res.status(404).json({ error: 'Mission not found' });
      }

      const userMission = await storage.getUserMission(missionId, userId);
      if (!userMission) {
        return res.status(404).json({ error: 'User mission not found' });
      }

      const deliveredAt = new Date().toISOString();
      const updated = await storage.updateUserMission(userMission.id, {
        status: 'claimed',
        progress: 100,
        claimedAt: deliveredAt,
        rewardStatus: 'delivered',
        rewardDeliveredAt: deliveredAt,
        rewardDeliveryNotes: deliveryNotes || null,
        rewardDeliveryValue: deliveryValue || mission.rewardValue || null,
      });

      await storage.createNotification({
        userId,
        type: 'mission_reward_delivered',
        title: 'Reward delivered',
        message: deliveryValue
          ? `Your reward for "${mission.title}" is ready: ${deliveryValue}`
          : `Your reward for "${mission.title}" has been delivered.`,
        read: false,
      });

      res.json(updated);
    } catch (error) {
      console.error('[ADMIN] Fulfill mission failed:', error);
      res.status(500).json({ error: 'Failed to fulfill mission' });
    }
  });

  router.post('/missions/:missionId/close', requireAdmin, async (req, res) => {
    try {
      const { missionId } = req.params;
      const updated = await storage.updateMission(missionId, { status: 'closed' });

      try {
        const { notificationService } = await import('../notification-service');
        const participants = await storage.getUserMissionsByMissionIds([missionId]);
        const participantIds = Array.from(
          new Set(participants.map((entry: any) => entry.userId || entry.user_id)),
        );
        if (participantIds.length) {
          await notificationService.notifyMissionClosedParticipants(
            participantIds,
            updated?.title || 'Mission',
          );
        }
      } catch (notifyError) {
        console.warn('[ADMIN] Failed to notify mission participants:', notifyError);
      }
      res.json(updated);
    } catch (error) {
      console.error('[ADMIN] Close mission failed:', error);
      res.status(500).json({ error: 'Failed to close mission' });
    }
  });

  router.post('/missions/:missionId/approve', requireAdmin, async (req, res) => {
    try {
      const { missionId } = req.params;
      const updated = await storage.updateMission(missionId, { status: 'active' });
      res.json(updated);
    } catch (error) {
      console.error('[ADMIN] Approve mission failed:', error);
      res.status(500).json({ error: 'Failed to approve mission' });
    }
  });

  // Test notifications (legacy support)
  router.post('/test-notification', requireAdmin, async (req, res) => {
    try {
      console.log('[ADMIN] Test notification request:', req.body);
      const { type, title: rawTitle, message: rawMessage, address, userId } = req.body;

      // Provide safe defaults so admin testing UI can send minimal payloads
      const title = rawTitle || `Test: ${type || 'notification'}`;
      const message = rawMessage || `This is a test ${type || 'notification'} from admin`;

      console.log('[ADMIN] Sending notification:', { type, title, message, target: userId || address });

      // Determine target - support 'all', address, or userId (client sends userId)
      if (address === 'all' || userId === 'all') {
        // Send to all users
        console.log('[ADMIN] Sending to all creators');
        const creators = await storage.getAllCreators();
        console.log(`[ADMIN] Found ${creators.length} creators`);

        const promises = creators.map(creator => {
          console.log(`[ADMIN] Creating notification for creator: ${creator.address}`);
          return storage.createNotification({
            userId: creator.address,
            type: type,
            title,
            message,
            metadata: { isTest: true },
            read: false,
            createdAt: new Date(),
          } as any);
        });
        await Promise.all(promises);
        console.log(`[ADMIN] Successfully sent ${promises.length} notifications`);
      } else {
        // If userId provided, send to that user; otherwise try address
        const target = userId || address;
        if (!target) {
          console.error('[ADMIN] Missing target address or userId');
          return res.status(400).json({ error: 'Missing target address or userId' });
        }

        console.log(`[ADMIN] Sending notification to: ${target}`);
        await storage.createNotification({
          userId: target,
          type: type,
          title,
          message,
          metadata: { isTest: true },
          read: false,
          createdAt: new Date(),
        } as any);
        console.log('[ADMIN] Notification sent successfully');
      }

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Notification test failed with error:', error);
      console.error('[ADMIN] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({
        error: 'Failed to send test notification',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Alias for client compatibility
  router.post('/trigger-notification', requireAdmin, async (req, res) => {
    // Reuse the test-notification handler logic by calling the same route handler
    // Simpler: forward the request body to storage.createNotification(s) similar to /test-notification
    try {
      const { type, title: rawTitle, message: rawMessage, address, userId } = req.body;
      const title = rawTitle || `Trigger: ${type || 'notification'}`;
      const message = rawMessage || `Triggered ${type || 'notification'} from admin`;

      if (address === 'all' || userId === 'all') {
        const creators = await storage.getAllCreators();
        await Promise.all(
          creators.map((creator) =>
            storage.createNotification({ userId: creator.address, type, title, message, metadata: { isTest: true }, read: false, createdAt: new Date() } as any)
          )
        );
      } else {
        const target = userId || address;
        if (!target) return res.status(400).json({ error: 'Missing target address or userId' });

        await storage.createNotification({ userId: target, type, title, message, metadata: { isTest: true }, read: false, createdAt: new Date() } as any);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Trigger notification failed:', error);
      res.status(500).json({ error: 'Failed to trigger notification' });
    }
  });

  // Hide a coin (mark as hidden)
  router.post('/hide-coin/:address', requireAdmin, async (req, res) => {
    try {
      const { address } = req.params;
      const coin = await storage.updateCoinByAddress(address, { hidden: true } as any);
      if (!coin) return res.status(404).json({ error: 'Coin not found' });
      res.json(coin);
    } catch (error) {
      console.error('Hide coin failed:', error);
      res.status(500).json({ error: 'Failed to hide coin', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Admin create coin (does not add admin to creator list if admin lists a coin)
  router.post('/create-coin', requireAdmin, async (req, res) => {
    try {
      const coinData = req.body;

      // Allow admin to specify a creatorAddress; if omitted, do not auto-create a creator
      const creatorAddress = coinData.creatorAddress || coinData.creator_wallet || null;

      const insert = {
        name: coinData.name,
        symbol: coinData.symbol,
        address: coinData.address || null,
        creator_wallet: creatorAddress,
        status: coinData.status || 'active',
        ipfs_uri: coinData.ipfsUri || coinData.ipfs_uri || null,
        chain_id: coinData.chainId || coinData.chain_id || null,
        image: coinData.image || null,
        description: coinData.description || null,
        hidden: false,
        created_at: new Date().toISOString(),
      };

      const coin = await storage.createCoin(insert as any);

      // If a creatorAddress was provided, create or update the creator's stats but do not mark admin as creator
      if (creatorAddress) {
        let creator = await storage.getCreatorByAddress(creatorAddress);
        if (!creator) {
          await storage.createCreator({ address: creatorAddress } as any);
        } else {
          const newTotal = (parseInt(creator.totalCoins || '0') + 1).toString();
          await storage.updateCreator(creator.id, { totalCoins: newTotal } as any);
        }
      }

      res.json(coin);
    } catch (error) {
      console.error('Admin create coin failed:', error);
      res.status(500).json({ error: 'Failed to create coin' });
    }
  });

  // ===== BLOG POSTS =====
  router.get('/blog-posts', requireAdmin, async (_req, res) => {
    try {
      const posts = await storage.listBlogPosts({ includeDrafts: true });
      res.json({ posts });
    } catch (error) {
      console.error('[ADMIN] Fetch blog posts failed:', error);
      res.status(500).json({ error: 'Failed to fetch blog posts' });
    }
  });

  router.post('/blog-posts', requireAdmin, async (req, res) => {
    try {
      const {
        title,
        subtitle,
        excerpt,
        content,
        coverUrl,
        category,
        status = 'draft',
        authorName,
      } = req.body || {};

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const baseSlug = slugify(title) || 'post';
      let slug = baseSlug;
      let suffix = 1;
      while (await storage.getBlogPostBySlug(slug, true)) {
        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
      }

      const publishedAt =
        status === 'published' ? new Date().toISOString() : null;

      const post = await storage.createBlogPost({
        title,
        slug,
        subtitle: subtitle || null,
        excerpt: excerpt || null,
        content: content || null,
        coverUrl: coverUrl || null,
        category: category || null,
        authorName: authorName || null,
        status,
        publishedAt,
      });

      res.json(post);
    } catch (error) {
      console.error('[ADMIN] Create blog post failed:', error);
      res.status(500).json({ error: 'Failed to create blog post' });
    }
  });

  router.put('/blog-posts/:id', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const {
        title,
        subtitle,
        excerpt,
        content,
        coverUrl,
        category,
        status,
      } = req.body || {};

      const updates: any = {
        title,
        subtitle,
        excerpt,
        content,
        coverUrl,
        category,
        status,
      };

      if (status === 'published') {
        updates.publishedAt = new Date().toISOString();
      }

      if (status && status !== 'published') {
        updates.publishedAt = null;
      }

      const post = await storage.updateBlogPost(id, updates);
      res.json(post);
    } catch (error) {
      console.error('[ADMIN] Update blog post failed:', error);
      res.status(500).json({ error: 'Failed to update blog post' });
    }
  });

  // Show a coin (unhide)
  router.post('/show-coin/:address', requireAdmin, async (req, res) => {
    try {
      const { address } = req.params;
      const coin = await storage.updateCoinByAddress(address, { hidden: false } as any);
      if (!coin) return res.status(404).json({ error: 'Coin not found' });
      res.json(coin);
    } catch (error) {
      console.error('Show coin failed:', error);
      res.status(500).json({ error: 'Failed to show coin', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Remove a coin (soft-delete by setting status)
  router.post('/remove-coin/:id', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const coin = await storage.updateCoin(id, { status: 'removed' } as any);
      if (!coin) return res.status(404).json({ error: 'Coin not found' });
      res.json({ success: true });
    } catch (error) {
      console.error('Remove coin failed:', error);
      res.status(500).json({ error: 'Failed to remove coin' });
    }
  });

  // Pin a coin to explore page (max 6)
  router.post('/pin-coin/:address', requireAdmin, async (req, res) => {
    try {
      console.log('[ADMIN] Pin coin request for address:', req.params.address);
      console.log('[ADMIN] Session user:', req.session?.user);
      const { address } = req.params;
      const coin = await storage.pinCoin(address);
      if (!coin) return res.status(404).json({ error: 'Coin not found' });
      console.log('[ADMIN] Coin pinned successfully:', coin);
      res.json(coin);
    } catch (error) {
      console.error('[ADMIN] Pin coin failed:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to pin coin' });
    }
  });

  // Unpin a coin from explore page
  router.post('/unpin-coin/:address', requireAdmin, async (req, res) => {
    try {
      console.log('[ADMIN] Unpin coin request for address:', req.params.address);
      console.log('[ADMIN] Session user:', req.session?.user);
      const { address } = req.params;
      const coin = await storage.unpinCoin(address);
      if (!coin) return res.status(404).json({ error: 'Coin not found' });
      console.log('[ADMIN] Coin unpinned successfully:', coin);
      res.json(coin);
    } catch (error) {
      console.error('[ADMIN] Unpin coin failed:', error);
      res.status(500).json({ error: 'Failed to unpin coin' });
    }
  });

  // Get pinned coins
  router.get('/pinned-coins', requireAdmin, async (req, res) => {
    try {
      const pinnedCoins = await storage.getPinnedCoins();
      res.json(pinnedCoins);
    } catch (error) {
      console.error('Get pinned coins failed:', error);
      res.status(500).json({ error: 'Failed to get pinned coins' });
    }
  });

  // List pinned coins with details (for admin console)
  router.get('/list-pinned-coins', requireAdmin, async (req, res) => {
    try {
      const pinnedCoins = await storage.getPinnedCoins();
      const formatted = pinnedCoins.map((coin: any, index: number) => ({
        position: index + 1,
        name: coin.name,
        symbol: coin.symbol,
        address: coin.address,
        pinOrder: coin.pin_order || coin.pinOrder,
        status: coin.status,
        createdAt: coin.created_at || coin.createdAt,
      }));
      console.log('\n📌 CURRENTLY PINNED COINS (max 6):');
      console.log('=====================================');
      formatted.forEach(coin => {
        console.log(`${coin.position}. ${coin.name} (${coin.symbol})`);
        console.log(`   Address: ${coin.address}`);
        console.log(`   Pin Order: ${coin.pinOrder}`);
        console.log(`   Status: ${coin.status}`);
        console.log('');
      });
      console.log(`Total pinned: ${formatted.length}/6`);
      console.log('=====================================\n');
      res.json(formatted);
    } catch (error) {
      console.error('List pinned coins failed:', error);
      res.status(500).json({ error: 'Failed to list pinned coins' });
    }
  });

  // Hide a creator (soft-restrict using moderation)
  router.post('/hide-creator/:address', requireAdmin, async (req, res) => {
    try {
      const { address } = req.params;
      if (!address) return res.status(400).json({ error: 'Missing creator address' });

      const creator = await storage.getCreatorByAddress(address);
      if (!creator) return res.status(404).json({ error: 'Creator not found' });

      // Use moderation to restrict the creator account
      await storage.moderateUser(creator.id, { type: 'restrict', reason: 'Hidden by admin', duration: 0 } as any);
      res.json({ success: true });
    } catch (error) {
      console.error('Hide creator failed:', error);
      res.status(500).json({ error: 'Failed to hide creator' });
    }
  });

  // Remove a creator (ban)
  router.post('/remove-creator/:address', requireAdmin, async (req, res) => {
    try {
      const { address } = req.params;
      if (!address) return res.status(400).json({ error: 'Missing creator address' });

      const creator = await storage.getCreatorByAddress(address);
      if (!creator) return res.status(404).json({ error: 'Creator not found' });

      await storage.moderateUser(creator.id, { type: 'ban', reason: 'Removed by admin' } as any);
      res.json({ success: true });
    } catch (error) {
      console.error('Remove creator failed:', error);
      res.status(500).json({ error: 'Failed to remove creator' });
    }
  });

  // Gift E1XP points to users
  router.post('/gift-e1xp', requireAdmin, async (req, res) => {
    try {
      const { recipients, amount, reason, all } = req.body;

      if (!amount || isNaN(parseInt(amount))) {
        return res.status(400).json({ error: 'Valid amount is required' });
      }

      const pointsAmount = parseInt(amount);
      let successCount = 0;
      let failCount = 0;

      if (all) {
        console.log('[ADMIN] Gifting E1XP to all users...');
        // Get all users (both wallet and email)
        const users = await storage.getAllUsers();
        const creators = await storage.getAllCreators();

        // Combine both lists and deduplicate by privyId
        const allUsers = new Map();

        // Add users table entries first (preferred)
        for (const user of users) {
          allUsers.set(user.privyId || user.id, {
            id: user.id,
            privyId: user.privyId,
            address: user.walletAddress,
            email: user.email,
            name: user.displayName || user.username,
          });
        }

        // Add creators table entries (legacy) if not already in users
        for (const creator of creators) {
          const key = creator.privyId || creator.address || creator.id;
          if (!allUsers.has(key)) {
            allUsers.set(key, {
              id: creator.id,
              privyId: creator.privyId,
              address: creator.address,
              email: creator.email,
              name: creator.name,
            });
          }
        }

        console.log(`[ADMIN] Found ${allUsers.size} unique users to gift`);

        for (const [_, user] of allUsers) {
          try {
            const address = user.address || user.email || user.privyId || user.id;
            await storage.addPoints(address, pointsAmount, reason || 'Admin gift');

            // Create notification for the gift
            await storage.createNotification({
              userId: address,
              type: 'reward',
              title: '🎁 Admin Gift Received!',
              message: `You received ${pointsAmount} E1XP! ${reason ? reason : 'Thank you for being part of the community!'}`,
              amount: pointsAmount.toString(),
              read: false,
              createdAt: new Date(),
            } as any);

            successCount++;
          } catch (error) {
            console.error(`[ADMIN] Failed to gift to ${user.name || address}:`, error);
            failCount++;
          }
        }
      } else if (recipients && Array.isArray(recipients)) {
        // Gift to specific recipients
        console.log(`[ADMIN] Gifting ${pointsAmount} E1XP to ${recipients.length} specific users`);

        for (const address of recipients) {
          try {
            await storage.addPoints(address, pointsAmount, reason || 'Admin gift');

            // Create notification for the gift
            await storage.createNotification({
              userId: address,
              type: 'reward',
              title: '🎁 Admin Gift Received!',
              message: `You received ${pointsAmount} E1XP! ${reason ? reason : 'Thank you for being part of the community!'}`,
              amount: pointsAmount.toString(),
              read: false,
              createdAt: new Date(),
            });

            successCount++;
          } catch (error) {
            console.error(`[ADMIN] Failed to gift to ${address}:`, error);
            failCount++;
          }
        }
      } else {
        return res.status(400).json({ error: 'Must specify recipients or set all to true' });
      }

      console.log(`[ADMIN] E1XP gift complete: ${successCount} success, ${failCount} failed`);
      res.json({ success: true, recipients: successCount, failed: failCount });
    } catch (error) {
      console.error('[ADMIN] Gift E1XP failed with error:', error);
      console.error('[ADMIN] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({
        error: 'Failed to gift E1XP',
        details: error instanceof Error ? error.message : String(error)
      });
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

  // Get user rewards tracking (Zora + E1XP)
  router.get('/user-rewards', requireAdmin, async (req, res) => {
    try {
      // Get all creators
      const creators = await storage.getAllCreators();

      // Get rewards data for each creator
      const userRewards = await Promise.all(
        creators.map(async (creator) => {
          // Get Zora rewards (from rewards table)
          const zoraRewards = await storage.getRewardsByCreator(creator.address);

          // Get E1XP rewards
          const e1xpRewards = await storage.getE1xpRewardsByUser(creator.id);

          // Calculate totals
          const totalZoraRewards = zoraRewards.reduce((sum, reward) =>
            sum + parseFloat(reward.rewardAmount || '0'), 0
          );

          const totalE1XPRewards = e1xpRewards.reduce((sum, reward) =>
            sum + parseFloat(reward.amount || '0'), 0
          );

          return {
            userId: creator.id,
            username: creator.name || creator.address,
            address: creator.address,
            zoraRewards: {
              total: totalZoraRewards.toFixed(4),
              count: zoraRewards.length,
              rewards: zoraRewards,
            },
            e1xpRewards: {
              total: totalE1XPRewards,
              count: e1xpRewards.length,
              rewards: e1xpRewards,
            },
            totalPoints: parseInt(creator.points || '0'),
          };
        })
      );

      res.json({ users: userRewards });
    } catch (error) {
      console.error('[ADMIN] Get user rewards failed:', error);
      res.status(500).json({ error: 'Failed to fetch user rewards', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Get platform fees and trade fees tracking
  router.get('/fees-tracking', requireAdmin, async (req, res) => {
    try {
      // Get all rewards to calculate fees
      const allRewards = await storage.getAllRewards();

      // Separate platform fees and trade fees
      const platformFees = allRewards.filter(r => r.type === 'platform');
      const tradeFees = allRewards.filter(r => r.type === 'trade');

      // Calculate totals
      const totalPlatformFees = platformFees.reduce((sum, reward) =>
        sum + parseFloat(reward.rewardAmount || '0'), 0
      );

      const totalTradeFees = tradeFees.reduce((sum, reward) =>
        sum + parseFloat(reward.rewardAmount || '0'), 0
      );

      // Group by coin for detailed breakdown
      const feesByCoin = allRewards.reduce((acc: any, reward) => {
        const coinSymbol = reward.coinSymbol || 'Unknown';
        if (!acc[coinSymbol]) {
          acc[coinSymbol] = {
            coinAddress: reward.coinAddress,
            coinSymbol,
            platformFees: 0,
            tradeFees: 0,
            totalFees: 0,
            transactionCount: 0,
          };
        }

        const amount = parseFloat(reward.rewardAmount || '0');
        if (reward.type === 'platform') {
          acc[coinSymbol].platformFees += amount;
        } else if (reward.type === 'trade') {
          acc[coinSymbol].tradeFees += amount;
        }
        acc[coinSymbol].totalFees += amount;
        acc[coinSymbol].transactionCount += 1;

        return acc;
      }, {});

      res.json({
        summary: {
          totalPlatformFees: totalPlatformFees.toFixed(4),
          totalTradeFees: totalTradeFees.toFixed(4),
          totalFees: (totalPlatformFees + totalTradeFees).toFixed(4),
          platformFeeCount: platformFees.length,
          tradeFeeCount: tradeFees.length,
          totalTransactions: allRewards.length,
        },
        feesByCoin: Object.values(feesByCoin),
        recentTransactions: allRewards.slice(-20).reverse(), // Last 20 transactions
      });
    } catch (error) {
      console.error('[ADMIN] Get fees tracking failed:', error);
      res.status(500).json({ error: 'Failed to fetch fees tracking', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Treasury reconciliation overview
  router.get('/reconciliation', requireAdmin, async (_req, res) => {
    try {
      const [ledgerSummary, ledgerEntries, unsettledRewards, paystackBalance] = await Promise.all([
        storage.getNairaLedgerSummary(),
        storage.listNairaLedgerEntries(25),
        storage.getUnsettledCreatorRewards(),
        getPaystackBalance(),
      ]);

      const balanceEntries = Array.isArray(paystackBalance?.data)
        ? paystackBalance.data
        : paystackBalance?.data?.balances || [];

      const ngnBalanceEntry = balanceEntries.find((entry: any) => entry.currency === 'NGN') || balanceEntries[0];
      const paystackBalanceKobo = ngnBalanceEntry?.balance ?? 0;
      const paystackBalanceNgn = Number(paystackBalanceKobo) / 100;

      const unsettledTotal = unsettledRewards.reduce((sum, reward) => {
        const amount = reward.rewardAmountNgn ? parseFloat(String(reward.rewardAmountNgn)) : 0;
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);

      res.json({
        paystack: {
          balanceKobo: Number(paystackBalanceKobo) || 0,
          balanceNgn: paystackBalanceNgn,
          currency: ngnBalanceEntry?.currency || 'NGN',
        },
        ledger: {
          availableNgn: ledgerSummary.availableNgn,
          pendingNgn: ledgerSummary.pendingNgn,
          totalNgn: ledgerSummary.totalNgn,
          accounts: ledgerSummary.accounts,
        },
        liabilities: {
          unsettledRewardsNgn: unsettledTotal,
        },
        gaps: {
          coverageNgn: paystackBalanceNgn - ledgerSummary.availableNgn,
        },
        recentEntries: ledgerEntries,
      });
    } catch (error) {
      console.error('[ADMIN] Reconciliation failed:', error);
      res.status(500).json({
        error: 'Failed to fetch reconciliation data',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Send direct message to user (supports email or wallet address)
  router.post('/send-direct-message', requireAdmin, async (req, res) => {
    try {
      const { recipientAddress, message } = req.body;

      console.log('[ADMIN] Send direct message:', { recipientAddress, message });

      if (!recipientAddress || !message) {
        return res.status(400).json({ error: 'Recipient address or email and message required' });
      }

      // Get admin user info
      const adminEmail = req.session?.user?.email || 'bloombetgaming@gmail.com';
      const adminAddress = `admin_${adminEmail.toLowerCase().replace('@', '_at_').replace(/\./g, '_')}`;

      // Determine if input is email, wallet address, or username
      const isEmail = recipientAddress.includes('@');
      let targetUserId: string;
      let recipientInfo: any = null;

      if (isEmail) {
        // Look up user by email - check both users and creators tables
        console.log('[ADMIN] Looking up user by email:', recipientAddress);

        // First try to find in users table
        const user = await storage.getUserByEmail(recipientAddress);

        if (user) {
          // Use user's privyId if available, otherwise wallet address or ID
          targetUserId = user.privyId || user.walletAddress || user.id;
          recipientInfo = user;
          console.log('[ADMIN] Found user by email:', { id: user.id, email: recipientAddress, privyId: user.privyId });
        } else {
          // Fallback: search creators by privyId
          const allCreators = await storage.getAllCreators();
          recipientInfo = allCreators.find(c =>
            c.privyId?.toLowerCase().includes(recipientAddress.toLowerCase())
          );

          if (!recipientInfo) {
            return res.status(404).json({ error: 'User with this email not found' });
          }

          // Use creator privyId or address or ID
          targetUserId = recipientInfo.privyId || recipientInfo.address || recipientInfo.id;
          console.log('[ADMIN] Found creator by email:', { id: recipientInfo.id, privyId: recipientInfo.privyId });
        }
      } else {
        // Try wallet address first
        recipientInfo = await storage.getCreatorByAddress(recipientAddress);

        if (!recipientInfo) {
          // Try to find by username/name
          const allCreators = await storage.getAllCreators();
          recipientInfo = allCreators.find(c =>
            c.name?.toLowerCase() === recipientAddress.toLowerCase() ||
            c.address?.toLowerCase() === recipientAddress.toLowerCase()
          );

          if (!recipientInfo) {
            // Try users table by username
            const allUsers = await storage.getAllUsers();
            const user = allUsers.find(u =>
              u.username?.toLowerCase() === recipientAddress.toLowerCase() ||
              u.walletAddress?.toLowerCase() === recipientAddress.toLowerCase()
            );

            if (!user) {
              return res.status(404).json({ error: 'User not found. Please use a valid wallet address or username.' });
            }

            targetUserId = user.privyId || user.walletAddress || user.id;
            recipientInfo = user;
            console.log('[ADMIN] Found user by username:', { id: user.id, username: user.username });
          } else {
            targetUserId = recipientInfo.privyId || recipientInfo.address || recipientInfo.id;
            console.log('[ADMIN] Found creator by name:', { id: recipientInfo.id, name: recipientInfo.name });
          }
        } else {
          targetUserId = recipientInfo.privyId || recipientInfo.address || recipientInfo.id;
          console.log('[ADMIN] Found creator by address:', { id: recipientInfo.id, address: recipientAddress });
        }
      }

      // Create actual message in messages table
      const dbMessage = await storage.createMessage({
        senderId: adminAddress,
        recipientId: targetUserId,
        content: message,
        messageType: 'text'
      });

      console.log('[ADMIN] Created message in database:', { messageId: dbMessage.id, recipientId: targetUserId });

      // Emit Socket.IO event for real-time message delivery
      const { emitNotificationToUser } = await import('../socket-server');
      if (io) {
        console.log('[ADMIN] Emitting Socket.IO new_message event to user:', targetUserId);

        // Emit new_message event (what inbox listens for)
        const socketMessage = {
          id: dbMessage.id,
          conversationId: `conv_${[adminAddress, targetUserId].sort().join('_')}`,
          senderId: adminAddress,
          recipientId: targetUserId,
          content: message,
          createdAt: dbMessage.createdAt?.toISOString() || new Date().toISOString(),
          read: false
        };

        const conversationUpdate = {
          id: socketMessage.conversationId,
          participants: [adminAddress, targetUserId].sort(),
          lastMessage: socketMessage,
          updatedAt: socketMessage.createdAt,
          unreadCount: 1
        };

        // Emit to all possible user identifier rooms to ensure delivery
        const roomsToEmit = [targetUserId.toLowerCase()];

        // Add wallet address and Privy ID if available from recipientInfo
        if (recipientInfo) {
          if (recipientInfo.address && !roomsToEmit.includes(recipientInfo.address.toLowerCase())) {
            roomsToEmit.push(recipientInfo.address.toLowerCase());
          }
          if (recipientInfo.privyId && !roomsToEmit.includes(recipientInfo.privyId.toLowerCase())) {
            roomsToEmit.push(recipientInfo.privyId.toLowerCase());
          }
          if (recipientInfo.walletAddress && !roomsToEmit.includes(recipientInfo.walletAddress.toLowerCase())) {
            roomsToEmit.push(recipientInfo.walletAddress.toLowerCase());
          }
        }

        // Emit to all rooms
        roomsToEmit.forEach(room => {
          io.to(room).emit('new_message', socketMessage);
          io.to(room).emit('conversation_updated', conversationUpdate);
        });

        console.log(`[ADMIN] Socket.IO message events emitted to rooms: ${roomsToEmit.join(', ')}`);
      } else {
        console.warn('[ADMIN] Socket.IO not available');
      }

      console.log('[ADMIN] Direct message sent successfully to:', isEmail ? `email user ${recipientAddress}` : `wallet ${recipientAddress}`);
      res.json({
        success: true,
        recipientType: isEmail ? 'email' : 'wallet',
        recipientId: targetUserId,
        messageId: dbMessage.id
      });
    } catch (error) {
      console.error('[ADMIN] Send message error:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // Broadcast message to all users
  router.post('/broadcast-message', requireAdmin, async (req, res) => {
    try {
      const { message } = req.body;

      console.log('[ADMIN] Broadcasting message to all users:', message);

      if (!message) {
        return res.status(400).json({ error: 'Message required' });
      }

      // Get all users from both tables
      const allCreators = await storage.getAllCreators();
      const allUsers = await storage.getAllUsers();

      // Combine and deduplicate by address
      const addressSet = new Set<string>();
      const allRecipients: string[] = [];

      allCreators.forEach(c => {
        if (c.address && !addressSet.has(c.address.toLowerCase())) {
          addressSet.add(c.address.toLowerCase());
          allRecipients.push(c.address.toLowerCase());
        }
      });

      allUsers.forEach(u => {
        if (u.walletAddress && !addressSet.has(u.walletAddress.toLowerCase())) {
          addressSet.add(u.walletAddress.toLowerCase());
          allRecipients.push(u.walletAddress.toLowerCase());
        }
      });

      console.log(`[ADMIN] Sending to ${allRecipients.length} unique users`);

      let successCount = 0;
      for (const recipientAddress of allRecipients) {
        try {
          await storage.createNotification({
            userId: recipientAddress,
            type: 'admin',
            title: '📢 Announcement from Creatorland',
            message: message,
            metadata: { isBroadcast: true },
            read: false,
            createdAt: new Date(),
          });
          successCount++;
        } catch (error) {
          console.error(`[ADMIN] Failed to send to ${recipientAddress}:`, error);
        }
      }

      // Emit Socket.IO event for real-time broadcast to all user rooms
      if (io) {
        console.log('[ADMIN] Emitting broadcast via Socket.IO to all user rooms');
        const broadcastData = {
          message: message,
          timestamp: new Date().toISOString(),
        };

        // Send to each user's room individually for better delivery
        allRecipients.forEach(recipientAddress => {
          // Normalize to lowercase to match room join convention
          io.to(recipientAddress.toLowerCase()).emit('admin_broadcast', broadcastData);
        });

        // Also send globally for any connected clients
        io.emit('admin_broadcast', broadcastData);
        console.log(`[ADMIN] Broadcast emitted to ${allRecipients.length} user rooms`);
      } else {
        console.warn('[ADMIN] Socket.IO not available');
      }

      console.log(`[ADMIN] Broadcast complete: ${successCount}/${allRecipients.length} notifications created`);
      res.json({ success: true, successCount, total: allRecipients.length });
    } catch (error) {
      console.error('[ADMIN] Broadcast error:', error);
      res.status(500).json({ error: 'Failed to broadcast message' });
    }
  });

  return router;
}
