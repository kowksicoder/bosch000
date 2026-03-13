import cron, { ScheduledTask } from 'node-cron';
import { ActivityTrackerService } from './activity-tracker-service';
import type { IStorage } from './storage';

export class ActivityTrackerCron {
  private cronJob: ScheduledTask | null = null;
  private activityTrackerService: ActivityTrackerService;
  private storage: IStorage;
  private schedule: string;

  constructor(storage: IStorage, chainId?: number) {
    this.storage = storage;
    this.activityTrackerService = new ActivityTrackerService(chainId);
    
    // Default: run every hour at minute 0
    // Can be configured via ACTIVITY_TRACKER_CRON_SCHEDULE env var
    // Format: "minute hour day month weekday"
    // Examples:
    // - "0 * * * *" = every hour at minute 0
    // - "0 */2 * * *" = every 2 hours
    // - "0 0 * * *" = daily at midnight
    this.schedule = process.env.ACTIVITY_TRACKER_CRON_SCHEDULE || '0 * * * *';
  }

  start(): void {
    if (this.cronJob) {
      console.log('⏰ Activity tracker cron job is already running');
      return;
    }

    console.log(`⏰ Starting activity tracker cron job with schedule: ${this.schedule}`);
    
    this.cronJob = cron.schedule(this.schedule, async () => {
      await this.runSync();
    });

    console.log('✅ Activity tracker cron job started successfully');
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('🛑 Activity tracker cron job stopped');
    }
  }

  async runSync(): Promise<void> {
    try {
      console.log('🔄 [CRON] Running scheduled activity tracker sync...');
      
      const coins = await this.storage.getAllCoins();
      const unrecordedCoins = coins.filter(
        coin => coin.address && coin.status === 'active' && !coin.activityTrackerTxHash
      );

      if (unrecordedCoins.length === 0) {
        console.log('✅ [CRON] No coins to record on activity tracker');
        return;
      }

      console.log(`📊 [CRON] Found ${unrecordedCoins.length} unrecorded coins to sync`);

      const results = await this.activityTrackerService.recordCoinBatch(unrecordedCoins);

      if (results.size > 0) {
        const now = new Date();
        for (const [coinId, txHash] of results.entries()) {
          await this.storage.updateCoin(coinId, {
            activityTrackerTxHash: txHash,
            activityTrackerRecordedAt: now,
          });
        }

        console.log(`✅ [CRON] Successfully recorded ${results.size} coins on-chain`);
        console.log(`📝 [CRON] Transaction hashes: ${Array.from(results.values()).join(', ')}`);
      } else {
        console.error('❌ [CRON] Failed to record coins on activity tracker');
      }
    } catch (error) {
      console.error('❌ [CRON] Activity tracker sync error:', error);
    }
  }

  getSchedule(): string {
    return this.schedule;
  }

  isRunning(): boolean {
    return this.cronJob !== null;
  }
}
