import cron from 'node-cron';
import { storage } from './supabase-storage';
import { sendTelegramNotification } from './telegram-bot';
import { notificationService } from './notification-service'; // Assuming notificationService is imported from here

// Run every 6 hours to remind users about unclaimed points
export function startStreakReminderCron() {
  // Run at 9 AM, 3 PM, and 9 PM daily
  cron.schedule('0 9,15,21 * * *', async () => {
    try {
      console.log('🔔 Running streak reminder check...');

      const creators = await storage.getAllCreators();
      const today = new Date().toISOString().split('T')[0];
      let remindersCount = 0;

      for (const creator of creators) {
        try {
          // Use address for wallet users, privyId for email-only users
          const userId = creator.address || creator.privyId || creator.id;
          if (!userId) continue; // Skip if no identifier
          
          const loginStreak = await storage.getLoginStreak(userId);

          // New user - hasn't claimed first bonus
          if (!loginStreak) {
            await notificationService.notifyWelcomeBonus(userId);
            remindersCount++;
            continue;
          }

          // User hasn't claimed today's points
          if (loginStreak.lastLoginDate !== today) {
            const lastLogin = new Date(loginStreak.lastLoginDate || today);
            const todayDate = new Date(today);
            const daysDiff = Math.floor((todayDate.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));

            let currentStreak = parseInt(loginStreak.currentStreak || '0');
            let pointsAvailable = 10;
            let streakStatus = '';

            if (daysDiff === 1) {
              const nextStreak = currentStreak + 1;
              pointsAvailable = 10 + Math.min(Math.floor(nextStreak / 7) * 5, 50);
              streakStatus = `Continue your ${currentStreak} day streak`;
            } else {
              pointsAvailable = 10;
              streakStatus = `Your ${currentStreak} day streak will reset`;
            }

            await notificationService.notifyE1XPClaimReminder(
              userId,
              pointsAvailable.toString()
            );

            remindersCount++;
          }
        } catch (error) {
          const userId = creator.address || creator.privyId || creator.id;
          console.error(`Error sending reminder to ${userId}:`, error);
        }
      }

      console.log(`✅ Sent ${remindersCount} streak reminders`);
    } catch (error) {
      console.error('❌ Streak reminder cron error:', error);
    }
  });

  console.log('✅ Streak reminder cron started (runs at 9 AM, 3 PM, and 9 PM daily)');
}