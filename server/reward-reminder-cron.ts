import { storage } from './supabase-storage';
import { sendTelegramNotification } from './telegram-bot';

/**
 * Send reminders for unclaimed E1XP rewards
 * Runs daily to remind users about rewards they haven't claimed
 */
export async function sendUnclaimedRewardReminders() {
  console.log('🔔 Starting unclaimed E1XP reward reminder check...');

  try {
    // Get all users with unclaimed rewards
    const { data: unclaimedRewards, error } = await storage.supabase
      .from('e1xp_rewards')
      .select('*, users(*)')
      .eq('claimed', false)
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (error) throw error;

    if (!unclaimedRewards || unclaimedRewards.length === 0) {
      console.log('✅ No unclaimed rewards to remind about');
      return;
    }

    console.log(`📧 Found ${unclaimedRewards.length} unclaimed rewards to remind about`);

    // Group rewards by user
    const rewardsByUser = new Map<string, typeof unclaimedRewards>();
    for (const reward of unclaimedRewards) {
      const userRewards = rewardsByUser.get(reward.userId) || [];
      userRewards.push(reward);
      rewardsByUser.set(reward.userId, userRewards);
    }

    let remindersSent = 0;

    // Send one reminder per user with all their unclaimed rewards
    for (const [userId, userRewards] of rewardsByUser.entries()) {
      try {
        const totalAmount = userRewards.reduce((sum, r) => sum + parseInt(r.amount), 0);
        const rewardCount = userRewards.length;

        // Create reminder notification
        await storage.createNotification({
          userId,
          type: 'reward',
          title: '⏰ Don\'t Forget Your E1XP!',
          message: `You have ${rewardCount} unclaimed reward${rewardCount > 1 ? 's' : ''} worth ${totalAmount} E1XP! Claim them now in the Points page before they expire! 🎁`,
          amount: totalAmount.toString(),
          read: false,
        });

        // Send Telegram reminder
        await sendTelegramNotification(
          userId,
          '⏰ Unclaimed E1XP Rewards!',
          `Don't forget! You have ${rewardCount} unclaimed reward${rewardCount > 1 ? 's' : ''} worth ${totalAmount} E1XP waiting for you! 🎁\n\nClaim them now before they expire!`,
          'reward'
        );

        // Mark reminders as sent
        for (const reward of userRewards) {
          await storage.markReminderSent(reward.id);
        }

        remindersSent++;
      } catch (error) {
        console.error(`Failed to send reminder to ${userId}:`, error);
      }
    }

    console.log(`✅ Sent ${remindersSent} reward reminders to users`);
  } catch (error) {
    console.error('❌ Error sending unclaimed reward reminders:', error);
  }
}

// Run immediately if executed directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (import.meta.url === `file://${process.argv[1]}`) {
  sendUnclaimedRewardReminders()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}