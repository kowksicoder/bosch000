import { getCoin, setApiKey } from "@zoralabs/coins-sdk";
import { base, baseSepolia } from "viem/chains";
import { storage } from "./supabase-storage";
import { getFxRates } from "./fx-service";

const POLL_INTERVAL_MS = Number(
  process.env.ZORA_REWARDS_POLL_INTERVAL_MS || 5 * 60 * 1000,
);

const ZORA_API_KEY =
  process.env.ZORA_API_KEY || process.env.VITE_NEXT_PUBLIC_ZORA_API_KEY || "";

if (ZORA_API_KEY) {
  setApiKey(ZORA_API_KEY);
} else {
  console.warn(
    "[ZoraRewardsPoller] ZORA_API_KEY not configured. Poller will be disabled.",
  );
}

let pollerTimer: NodeJS.Timeout | null = null;
let isPolling = false;

const buildRewardKey = (coinAddress: string, currency: string) =>
  `${coinAddress.toLowerCase()}::${currency.toLowerCase()}`;

const toBigIntSafe = (value: string | null | undefined) => {
  try {
    if (!value) return 0n;
    return BigInt(value);
  } catch (error) {
    return 0n;
  }
};

export async function pollZoraCreatorRewards() {
  if (!ZORA_API_KEY) {
    return;
  }

  if (isPolling) {
    return;
  }

  isPolling = true;

  try {
    const useSepolia = Boolean(process.env.ONCHAIN_BASE_SEPOLIA_RPC_URL);
    const chainId = useSepolia ? baseSepolia.id : base.id;

    const coins = await storage.getAllCoins();
    const coinsWithAddress = coins.filter(
      (coin) => coin.address && coin.address.startsWith("0x"),
    );

    const existingRewards = await storage.getAllRewards();
    const totalsByKey = new Map<string, bigint>();
    const totalsUsdByKey = new Map<string, number>();

    for (const reward of existingRewards) {
      if (reward.type !== "creator") continue;
      const key = buildRewardKey(
        reward.coinAddress,
        reward.rewardCurrency || "UNKNOWN",
      );
      const currentTotal = totalsByKey.get(key) || 0n;
      totalsByKey.set(key, currentTotal + toBigIntSafe(reward.rewardAmount));

      const currentUsd = totalsUsdByKey.get(key) || 0;
      const rewardUsd = reward.rewardAmountUsd ? parseFloat(String(reward.rewardAmountUsd)) : 0;
      totalsUsdByKey.set(key, currentUsd + (Number.isFinite(rewardUsd) ? rewardUsd : 0));
    }

    let createdRewards = 0;
    const fxRates = await getFxRates();

    for (const coin of coinsWithAddress) {
      try {
        const response = await getCoin({
          address: coin.address as `0x${string}`,
          chain: chainId,
        });

        const token = response.data?.zora20Token;
        if (!token?.creatorEarnings || token.creatorEarnings.length === 0) {
          continue;
        }

        const creatorRecipient =
          coin.creatorWallet ||
          token.creatorAddress ||
          token.payoutRecipientAddress;

        if (!creatorRecipient) {
          continue;
        }

        const coinSymbol = token.symbol || coin.symbol || "COIN";

        for (const earning of token.creatorEarnings) {
          const amountRaw = earning.amount?.amountRaw;
          if (!amountRaw) continue;

          const currencyAddress =
            earning.amount?.currencyAddress ||
            token.poolCurrencyToken?.address ||
            "ETH";

          const key = buildRewardKey(coin.address!, currencyAddress);

          const currentTotal = toBigIntSafe(amountRaw);
          const previousTotal = totalsByKey.get(key) || 0n;
          const previousUsd = totalsUsdByKey.get(key) || 0;

          if (currentTotal <= previousTotal) {
            if (currentTotal < previousTotal) {
              totalsByKey.set(key, currentTotal);
            }
            continue;
          }

          const delta = currentTotal - previousTotal;
          const currentUsd =
            earning.amountUsd && Number.isFinite(Number(earning.amountUsd))
              ? Number(earning.amountUsd)
              : 0;
          const deltaUsd = currentUsd > previousUsd ? currentUsd - previousUsd : 0;
          const deltaNgn = deltaUsd > 0 ? deltaUsd * fxRates.usd_ngn : 0;
          if (delta <= 0n) continue;

          const transactionHash = `poll:${coin.address}:${currencyAddress}:${currentTotal.toString()}`;

          await storage.createReward({
            type: "creator",
            coinAddress: coin.address!,
            coinSymbol,
            transactionHash,
            rewardAmount: delta.toString(),
            rewardAmountUsd: deltaUsd > 0 ? deltaUsd.toFixed(8) : undefined,
            rewardAmountNgn: deltaNgn > 0 ? deltaNgn.toFixed(2) : undefined,
            rewardCurrency: currencyAddress,
            recipientAddress: creatorRecipient,
          });

          totalsByKey.set(key, currentTotal);
          if (currentUsd > 0) {
            totalsUsdByKey.set(key, currentUsd);
          }
          createdRewards += 1;
        }

        await new Promise((resolve) => setTimeout(resolve, 150));
      } catch (error) {
        console.error(
          `[ZoraRewardsPoller] Failed to sync rewards for ${coin.address}:`,
          error,
        );
      }
    }

    if (createdRewards > 0) {
      console.log(
        `[ZoraRewardsPoller] Added ${createdRewards} creator reward entries.`,
      );
    }
  } catch (error) {
    console.error("[ZoraRewardsPoller] Polling failed:", error);
  } finally {
    isPolling = false;
  }
}

export function startZoraRewardsPoller(intervalMs = POLL_INTERVAL_MS) {
  if (!ZORA_API_KEY) {
    console.warn(
      "[ZoraRewardsPoller] Skipping start (missing ZORA_API_KEY).",
    );
    return;
  }

  if (pollerTimer) return;

  console.log(
    `[ZoraRewardsPoller] Starting with interval ${intervalMs / 1000}s`,
  );

  pollZoraCreatorRewards();
  pollerTimer = setInterval(pollZoraCreatorRewards, intervalMs);
}

export function stopZoraRewardsPoller() {
  if (pollerTimer) {
    clearInterval(pollerTimer);
    pollerTimer = null;
  }
}
