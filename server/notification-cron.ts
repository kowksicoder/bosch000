import cron from 'node-cron';
import { notificationService } from './notification-service';
import { storage } from './supabase-storage';

export class NotificationCron {
  private jobs: cron.ScheduledTask[] = [];
  private started: boolean = false;

  start() {
    // Idempotence check - prevent duplicate job scheduling
    if (this.started || this.jobs.length > 0) {
      console.log('⚠️ Notification cron jobs already running, skipping duplicate start');
      return;
    }

    this.started = true;
    console.log('🔔 Starting notification cron jobs...');

    // Send all periodic notifications every 4 hours
    const periodicJob = cron.schedule('0 */4 * * *', async () => {
      console.log('📢 Running periodic notifications...');
      try {
        await notificationService.sendAllPeriodicNotifications();
      } catch (error) {
        console.error('❌ Periodic notifications error:', error);
      }
    });
    this.jobs.push(periodicJob);

    // Send top traders notifications for 24h every 6 hours
    const tradersJob24h = cron.schedule('0 */6 * * *', async () => {
      console.log('🏆 Sending 24h top traders notification...');
      try {
        await notificationService.notifyTopTraders(24);
      } catch (error) {
        console.error('❌ Top traders (24h) notification error:', error);
      }
    });
    this.jobs.push(tradersJob24h);

    // Send top traders notifications for 10h every 3 hours
    const tradersJob10h = cron.schedule('0 */3 * * *', async () => {
      console.log('🔥 Sending 10h top traders notification...');
      try {
        await notificationService.notifyTopTraders(10);
      } catch (error) {
        console.error('❌ Top traders (10h) notification error:', error);
      }
    });
    this.jobs.push(tradersJob10h);

    // Send top traders notifications for 3 days every day
    const tradersJob3d = cron.schedule('0 12 * * *', async () => {
      console.log('💎 Sending 3-day top traders notification...');
      try {
        await notificationService.notifyTopTraders(72); // 3 days = 72 hours
      } catch (error) {
        console.error('❌ Top traders (3d) notification error:', error);
      }
    });
    this.jobs.push(tradersJob3d);

    // Send weekly top earners every Monday at 10 AM
    const weeklyJob = cron.schedule('0 10 * * 1', async () => {
      console.log('📊 Sending weekly top earners notification...');
      try {
        await notificationService.sendWeeklyTopEarnersNotification();
      } catch (error) {
        console.error('❌ Weekly top earners notification error:', error);
      }
    });
    this.jobs.push(weeklyJob);

    // Send top creators every 8 hours
    const creatorsJob = cron.schedule('0 */8 * * *', async () => {
      console.log('👑 Sending top creators notification...');
      try {
        await notificationService.sendTopCreatorsNotification();
      } catch (error) {
        console.error('❌ Top creators notification error:', error);
      }
    });
    this.jobs.push(creatorsJob);

    // Send top coins every 6 hours
    const coinsJob = cron.schedule('0 */6 * * *', async () => {
      console.log('🏆 Sending top coins notification...');
      try {
        await notificationService.sendTopCoinsNotification();
      } catch (error) {
        console.error('❌ Top coins notification error:', error);
      }
    });
    this.jobs.push(coinsJob);

    // Send recent trades every 2 hours
    const tradesJob = cron.schedule('0 */2 * * *', async () => {
      console.log('📊 Sending recent trades notification...');
      try {
        await notificationService.sendRecentTradesNotification();
      } catch (error) {
        console.error('❌ Recent trades notification error:', error);
      }
    });
    this.jobs.push(tradesJob);

    console.log(`✅ Started ${this.jobs.length} notification cron jobs`);
  }

  stop() {
    console.log('🛑 Stopping notification cron jobs...');
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    this.started = false;
    console.log('✅ All notification cron jobs stopped');
  }

  getSchedules(): string[] {
    return [
      'All periodic notifications: every 4 hours',
      'Top traders (24h): every 6 hours',
      'Top traders (10h): every 3 hours',
      'Top traders (3 days): daily at 12 PM',
      'Weekly top earners: Mondays at 10 AM',
      'Top creators: every 8 hours',
      'Top coins: every 6 hours',
      'Recent trades: every 2 hours'
    ];
  }
}

// Schedule notification jobs
export function scheduleNotificationJobs() {
  const cronJobs = new NotificationCron();
  cronJobs.start();
}

export const notificationCron = new NotificationCron();