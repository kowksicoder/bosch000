import cron, { ScheduledTask } from "node-cron";
import { storage } from "./supabase-storage";
import { getFxRates } from "./fx-service";

export class AutoSettlementCron {
  private cronJob: ScheduledTask | null = null;
  private schedule: string;

  constructor() {
    this.schedule = process.env.AUTO_SETTLEMENT_CRON_SCHEDULE || "0 * * * *";
  }

  start(): void {
    if (this.cronJob) {
      console.log("⏳ Auto-settlement cron already running");
      return;
    }

    console.log(
      `⏳ Starting auto-settlement cron with schedule: ${this.schedule}`,
    );

    this.cronJob = cron.schedule(this.schedule, async () => {
      await this.runSettlement();
    });

    console.log("✅ Auto-settlement cron started");
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log("🛑 Auto-settlement cron stopped");
    }
  }

  async runSettlement(): Promise<void> {
    try {
      const rewards = await storage.getUnsettledCreatorRewards();
      if (!rewards.length) {
        return;
      }

      const rates = await getFxRates();

      for (const reward of rewards) {
        const recipient = reward.recipientAddress;
        if (!recipient) continue;

        const creator = await storage.getCreatorByAddress(recipient);
        if (!creator?.autoSettlementEnabled) {
          continue;
        }

        const amountUsd = reward.rewardAmountUsd
          ? Number(reward.rewardAmountUsd)
          : 0;
        const amountNgn = reward.rewardAmountNgn
          ? Number(reward.rewardAmountNgn)
          : amountUsd > 0
            ? amountUsd * rates.usd_ngn
            : 0;

        if (!Number.isFinite(amountNgn) || amountNgn <= 0) {
          continue;
        }

        const existingLedger = await storage.getNairaLedgerByAddress(recipient);
        const available = existingLedger
          ? Number(existingLedger.available_ngn || 0)
          : 0;
        const pending = existingLedger ? Number(existingLedger.pending_ngn || 0) : 0;

        const newAvailable = (available + amountNgn).toFixed(2);
        const newPending = pending.toFixed(2);

        await storage.upsertNairaLedger(recipient, newAvailable, newPending);
        await storage.createNairaLedgerEntry({
          recipientAddress: recipient,
          entryType: "credit",
          amountNgn: amountNgn.toFixed(2),
          source: "creator_reward",
          reference: reward.id,
          metadata: {
            coinAddress: reward.coinAddress,
            coinSymbol: reward.coinSymbol,
            rewardCurrency: reward.rewardCurrency,
          },
        });

        await storage.markRewardSettled(reward.id, `auto:${Date.now()}`);
      }
    } catch (error) {
      console.error("❌ Auto-settlement cron failed:", error);
    }
  }
}
