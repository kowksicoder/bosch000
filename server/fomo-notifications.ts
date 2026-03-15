import { getCoin, getCoinSwaps, setApiKey } from "@zoralabs/coins-sdk";
import { base, baseSepolia } from "viem/chains";
import { storage } from "./supabase-storage";
import { getFxRates } from "./fx-service";
import { sendTelegramChannelMessage, sendTelegramNotification } from "./telegram-bot";
import { sendPushToUsers } from "./push-service";

const ZORA_API_KEY =
  process.env.ZORA_API_KEY || process.env.VITE_NEXT_PUBLIC_ZORA_API_KEY || "";

if (ZORA_API_KEY) {
  setApiKey(ZORA_API_KEY);
} else {
  console.warn("[FOMO] ZORA_API_KEY not configured. FOMO polling will be limited.");
}

const FOMO_STATS_INTERVAL_MS = Number(
  process.env.FOMO_STATS_INTERVAL_MS || 5 * 60 * 1000,
);
const FOMO_SWAPS_INTERVAL_MS = Number(
  process.env.FOMO_SWAPS_INTERVAL_MS || 90 * 1000,
);
const FOMO_SWAP_PAGE_SIZE = Number(process.env.FOMO_SWAPS_PAGE_SIZE || 25);

const VOLUME_SPIKE_MIN_USD = Number(process.env.FOMO_VOLUME_SPIKE_MIN_USD || 250);
const VOLUME_SPIKE_MIN_PCT = Number(process.env.FOMO_VOLUME_SPIKE_MIN_PCT || 0.5);
const VOLUME_SPIKE_COOLDOWN_MS = Number(
  process.env.FOMO_VOLUME_SPIKE_COOLDOWN_MS || 2 * 60 * 60 * 1000,
);

const BUY_FOLLOWER_MIN_USD = Number(process.env.FOMO_BUY_FOLLOWER_MIN_USD || 25);
const BUY_WHALE_MIN_USD = Number(process.env.FOMO_BUY_WHALE_MIN_USD || 250);

const MARKET_CAP_TIERS = [
  50_000,
  100_000,
  250_000,
  500_000,
  1_000_000,
  2_500_000,
  5_000_000,
  10_000_000,
  25_000_000,
  50_000_000,
  100_000_000,
];

const HOLDER_TIERS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

let statsTimer: NodeJS.Timeout | null = null;
let swapsTimer: NodeJS.Timeout | null = null;
let isStatsPolling = false;
let isSwapsPolling = false;

const formatAddress = (address?: string | null) => {
  if (!address) return "Unknown";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatNgn = (value: number, maximumFractionDigits = 2) => {
  if (!Number.isFinite(value)) return "₦0";
  return `₦${value.toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  })}`;
};

const formatUsd = (value: number, maximumFractionDigits = 2) => {
  if (!Number.isFinite(value)) return "$0";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  })}`;
};

const getTierIndex = (value: number, thresholds: number[]) => {
  if (!Number.isFinite(value)) return 0;
  let tier = 0;
  thresholds.forEach((threshold, index) => {
    if (value >= threshold) tier = index + 1;
  });
  return tier;
};

const getActiveChainId = () =>
  process.env.ONCHAIN_BASE_SEPOLIA_RPC_URL ? baseSepolia.id : base.id;

const dedupeAddresses = (values: Array<string | null | undefined>) => {
  const output: string[] = [];
  const seen = new Set<string>();
  values.forEach((value) => {
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    output.push(value);
  });
  return output;
};

const notifyUsers = async (
  userIds: string[],
  payload: {
    type: string;
    title: string;
    message: string;
    coinAddress?: string | null;
    coinSymbol?: string | null;
  },
) => {
  if (!userIds.length) return;

  await Promise.all(
    userIds.map((userId) =>
      storage.createNotification({
        userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        coinAddress: payload.coinAddress,
        coinSymbol: payload.coinSymbol,
      }),
    ),
  );

  await sendPushToUsers(userIds, {
    title: payload.title,
    body: payload.message,
    url: payload.coinAddress ? `/coin/${payload.coinAddress}` : "/notifications",
    tag: `${payload.type}-${payload.coinAddress || ""}`.trim(),
  });
};

const notifyFollowers = async (
  creatorAddress: string,
  payload: {
    type: string;
    title: string;
    message: string;
    coinAddress?: string | null;
    coinSymbol?: string | null;
  },
  excludeAddresses: string[] = [],
) => {
  const followers = await storage.getFollowers(creatorAddress);
  const followerIds = dedupeAddresses(
    followers.map(
      (follow: any) => follow.followerAddress || follow.follower_address,
    ),
  ).filter((address) => !excludeAddresses.includes(address));

  if (!followerIds.length) return;

  await notifyUsers(followerIds, payload);
};

const ensureFomoState = async (coinAddress: string) => {
  const existing = await storage.getCoinFomoState(coinAddress);
  if (existing) return existing;

  return storage.upsertCoinFomoState({
    coinAddress,
  });
};

const recordFomoState = async (payload: {
  coinAddress: string;
  lastMarketCap?: number | null;
  lastVolume24h?: number | null;
  lastHolders?: number | null;
  lastMarketCapTier?: number | null;
  lastHolderTier?: number | null;
  lastVolumeAlertAt?: Date | null;
  lastSwapTxHash?: string | null;
  lastSwapTimestamp?: Date | null;
}) => {
  await storage.upsertCoinFomoState({
    coinAddress: payload.coinAddress,
    lastMarketCap: payload.lastMarketCap ?? undefined,
    lastVolume24h: payload.lastVolume24h ?? undefined,
    lastHolders: payload.lastHolders ?? undefined,
    lastMarketCapTier: payload.lastMarketCapTier ?? undefined,
    lastHolderTier: payload.lastHolderTier ?? undefined,
    lastVolumeAlertAt: payload.lastVolumeAlertAt ?? undefined,
    lastSwapTxHash: payload.lastSwapTxHash ?? undefined,
    lastSwapTimestamp: payload.lastSwapTimestamp ?? undefined,
  });
};

const buildCoinDisplay = (coin: any) => {
  return {
    name: coin?.name || "Coin",
    symbol: coin?.symbol || "COIN",
    creatorAddress: coin?.creator_wallet || coin?.creatorWallet || "",
    address: coin?.address || "",
  };
};

const sendCreatorNotification = async (
  creatorAddress: string,
  payload: {
    type: string;
    title: string;
    message: string;
    coinAddress?: string | null;
    coinSymbol?: string | null;
  },
) => {
  if (!creatorAddress) return;

  await storage.createNotification({
    userId: creatorAddress,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    coinAddress: payload.coinAddress,
    coinSymbol: payload.coinSymbol,
  });

  await sendPushToUsers([creatorAddress], {
    title: payload.title,
    body: payload.message,
    url: payload.coinAddress ? `/coin/${payload.coinAddress}` : "/notifications",
    tag: `${payload.type}-${payload.coinAddress || ""}`.trim(),
  });

  await sendTelegramNotification(
    creatorAddress,
    payload.title,
    payload.message,
    payload.type,
  );
};

const handleMilestone = async ({
  coin,
  creatorAddress,
  type,
  tierLabel,
}: {
  coin: { name: string; symbol: string; address: string };
  creatorAddress: string;
  type: "fomo_market_cap" | "fomo_holders" | "fomo_volume";
  tierLabel: string;
}) => {
  if (!creatorAddress) return;
  const titleMap = {
    fomo_market_cap: "🚀 Market cap milestone",
    fomo_holders: "👥 Holder milestone",
    fomo_volume: "📈 Volume milestone",
  } as const;

  const title = titleMap[type] || "🚀 Milestone";
  const message = `${coin.name} (${coin.symbol}) just hit ${tierLabel}. Keep the momentum going!`;

  await sendCreatorNotification(creatorAddress, {
    type,
    title,
    message,
    coinAddress: coin.address,
    coinSymbol: coin.symbol,
  });

  await notifyFollowers(creatorAddress, {
    type,
    title,
    message: `${coin.name} (${coin.symbol}) just hit ${tierLabel}.`,
    coinAddress: coin.address,
    coinSymbol: coin.symbol,
  });

  if (type === "fomo_market_cap" && tierLabel.includes("MC")) {
    await sendTelegramChannelMessage(
      `🚀 ${coin.name} (${coin.symbol}) hit ${tierLabel}!`,
      { disable_web_page_preview: true },
    );
  }
};

const handleVolumeSpike = async ({
  coin,
  creatorAddress,
  volumeDeltaNgn,
  volumeTotalNgn,
}: {
  coin: { name: string; symbol: string; address: string };
  creatorAddress: string;
  volumeDeltaNgn: number;
  volumeTotalNgn: number;
}) => {
  if (!creatorAddress) return;
  const title = "📈 Volume surge";
  const message = `${coin.name} (${coin.symbol}) volume jumped ${formatNgn(volumeDeltaNgn)} today (24h total ${formatNgn(volumeTotalNgn)}). FOMO is real.`;

  await sendCreatorNotification(creatorAddress, {
    type: "fomo_volume",
    title,
    message,
    coinAddress: coin.address,
    coinSymbol: coin.symbol,
  });

  await notifyFollowers(creatorAddress, {
    type: "fomo_volume",
    title,
    message: `${coin.name} (${coin.symbol}) is spiking in volume right now.`,
    coinAddress: coin.address,
    coinSymbol: coin.symbol,
  });
};

const handleBuyEvent = async ({
  coin,
  creatorAddress,
  buyerAddress,
  amountUsd,
  amountNgn,
  txHash,
}: {
  coin: { name: string; symbol: string; address: string };
  creatorAddress: string;
  buyerAddress: string;
  amountUsd: number;
  amountNgn: number;
  txHash?: string | null;
}) => {
  if (!creatorAddress) return;

  const amountText = Number.isFinite(amountNgn)
    ? `${formatNgn(amountNgn)} (${formatUsd(amountUsd)})`
    : formatUsd(amountUsd);
  const title = "💸 New supporter";
  const message = `${formatAddress(buyerAddress)} bought ${coin.symbol} · ${amountText}`;

  await sendCreatorNotification(creatorAddress, {
    type: "fomo_buy",
    title,
    message,
    coinAddress: coin.address,
    coinSymbol: coin.symbol,
  });

  if (Number.isFinite(amountUsd) && amountUsd >= BUY_FOLLOWER_MIN_USD) {
    await notifyFollowers(
      creatorAddress,
      {
        type: "fomo_buy",
        title,
        message: `${formatAddress(buyerAddress)} just bought ${coin.symbol}.`,
        coinAddress: coin.address,
        coinSymbol: coin.symbol,
      },
      [creatorAddress],
    );
  }

  if (Number.isFinite(amountUsd) && amountUsd >= BUY_WHALE_MIN_USD) {
    const whaleTitle = "🐋 Whale buy alert";
    const whaleMessage = `${formatAddress(buyerAddress)} just bought ${coin.symbol} · ${amountText}`;
    await notifyFollowers(
      creatorAddress,
      {
        type: "fomo_whale",
        title: whaleTitle,
        message: whaleMessage,
        coinAddress: coin.address,
        coinSymbol: coin.symbol,
      },
      [creatorAddress],
    );

    await sendTelegramChannelMessage(
      `🐋 Whale buy alert\n${coin.name} (${coin.symbol})\n${amountText}`,
      { disable_web_page_preview: true },
    );
  }

  if (txHash) {
    await recordFomoState({
      coinAddress: coin.address,
      lastSwapTxHash: txHash,
      lastSwapTimestamp: new Date(),
    });
  }
};

const processCoinStats = async (coin: any, fxRates: { usd_ngn: number }) => {
  if (!coin.address) return;

  const state = await storage.getCoinFomoState(coin.address);

  const response = await getCoin({
    address: coin.address as `0x${string}`,
    chain: getActiveChainId(),
  });

  const token = response.data?.zora20Token;
  if (!token) return;

  const marketCapUsd = parseFloat(token.marketCap || "0");
  const volume24hUsd = parseFloat(token.volume24h || "0");
  const holders = token.uniqueHolders || 0;

  if (!state) {
    await recordFomoState({
      coinAddress: coin.address,
      lastMarketCap: marketCapUsd,
      lastVolume24h: volume24hUsd,
      lastHolders: holders,
      lastMarketCapTier: getTierIndex(marketCapUsd, MARKET_CAP_TIERS),
      lastHolderTier: getTierIndex(holders, HOLDER_TIERS),
    });
    return;
  }

  const coinInfo = buildCoinDisplay(coin);
  const creatorAddress = coinInfo.creatorAddress || token.creatorAddress || "";

  const currentMarketTier = getTierIndex(marketCapUsd, MARKET_CAP_TIERS);
  if (currentMarketTier > (state.lastMarketCapTier ?? 0)) {
    const tierValue = MARKET_CAP_TIERS[currentMarketTier - 1];
    await handleMilestone({
      coin: coinInfo,
      creatorAddress,
      type: "fomo_market_cap",
      tierLabel: `${formatNgn(tierValue * fxRates.usd_ngn)} MC`,
    });
  }

  const currentHolderTier = getTierIndex(holders, HOLDER_TIERS);
  if (currentHolderTier > (state.lastHolderTier ?? 0)) {
    const tierValue = HOLDER_TIERS[currentHolderTier - 1];
    await handleMilestone({
      coin: coinInfo,
      creatorAddress,
      type: "fomo_holders",
      tierLabel: `${tierValue.toLocaleString("en-US")} holders`,
    });
  }

  const lastVolume = Number(state.lastVolume24h || 0);
  if (Number.isFinite(volume24hUsd) && Number.isFinite(lastVolume)) {
    const delta = volume24hUsd - lastVolume;
    const pct = lastVolume > 0 ? delta / lastVolume : 0;
    const lastAlertAt = state.lastVolumeAlertAt
      ? new Date(state.lastVolumeAlertAt).getTime()
      : 0;

    if (
      delta >= VOLUME_SPIKE_MIN_USD &&
      pct >= VOLUME_SPIKE_MIN_PCT &&
      Date.now() - lastAlertAt > VOLUME_SPIKE_COOLDOWN_MS
    ) {
      await handleVolumeSpike({
        coin: coinInfo,
        creatorAddress,
        volumeDeltaNgn: delta * fxRates.usd_ngn,
        volumeTotalNgn: volume24hUsd * fxRates.usd_ngn,
      });

      await recordFomoState({
        coinAddress: coin.address,
        lastVolumeAlertAt: new Date(),
      });
    }
  }

  await recordFomoState({
    coinAddress: coin.address,
    lastMarketCap: marketCapUsd,
    lastVolume24h: volume24hUsd,
    lastHolders: holders,
    lastMarketCapTier: currentMarketTier,
    lastHolderTier: currentHolderTier,
  });
};

const processCoinSwaps = async (coin: any, fxRates: { usd_ngn: number }) => {
  if (!coin.address) return;

  const response = await getCoinSwaps({
    address: coin.address as `0x${string}`,
    chain: getActiveChainId(),
    first: FOMO_SWAP_PAGE_SIZE,
  });

  const edges = response.data?.zora20Token?.swapActivities?.edges || [];
  if (!edges.length) return;

  const state = await ensureFomoState(coin.address);
  const lastSeenHash = state?.lastSwapTxHash;

  if (!lastSeenHash) {
    const newest = edges[0]?.node?.transactionHash;
    if (newest) {
      await recordFomoState({
        coinAddress: coin.address,
        lastSwapTxHash: newest,
        lastSwapTimestamp: new Date(edges[0]?.node?.blockTimestamp || Date.now()),
      });
    }
    return;
  }

  const newSwaps = [] as any[];
  for (const edge of edges) {
    const txHash = edge?.node?.transactionHash;
    if (!txHash) continue;
    if (txHash === lastSeenHash) break;
    newSwaps.push(edge.node);
  }

  if (!newSwaps.length) return;

  const coinInfo = buildCoinDisplay(coin);
  const creatorAddress = coinInfo.creatorAddress || "";
  const processed = [...newSwaps].reverse();

  for (const swap of processed) {
    if (swap.activityType !== "BUY") continue;

    const amountUsd = Number(swap.currencyAmountWithPrice?.priceUsdc || 0);
    const amountNgn = amountUsd * fxRates.usd_ngn;
    await handleBuyEvent({
      coin: coinInfo,
      creatorAddress,
      buyerAddress: swap.senderAddress || swap.recipientAddress || "",
      amountUsd,
      amountNgn,
      txHash: swap.transactionHash,
    });
  }

  const newest = newSwaps[0]?.transactionHash;
  if (newest) {
    await recordFomoState({
      coinAddress: coin.address,
      lastSwapTxHash: newest,
      lastSwapTimestamp: new Date(newSwaps[0]?.blockTimestamp || Date.now()),
    });
  }
};

export async function pollFomoStats() {
  if (!ZORA_API_KEY || isStatsPolling) return;
  isStatsPolling = true;

  try {
    const coins = await storage.getAllCoins();
    const activeCoins = coins.filter(
      (coin) => coin.address && coin.status === "active",
    );

    const fxRates = await getFxRates();

    for (const coin of activeCoins) {
      try {
        await processCoinStats(coin, fxRates);
        await new Promise((resolve) => setTimeout(resolve, 150));
      } catch (error) {
        console.warn(
          `[FOMO] Failed to process stats for ${coin.symbol}:`,
          error,
        );
      }
    }
  } finally {
    isStatsPolling = false;
  }
}

export async function pollFomoSwaps() {
  if (!ZORA_API_KEY || isSwapsPolling) return;
  isSwapsPolling = true;

  try {
    const coins = await storage.getAllCoins();
    const activeCoins = coins.filter(
      (coin) => coin.address && coin.status === "active",
    );

    const fxRates = await getFxRates();

    for (const coin of activeCoins) {
      try {
        await processCoinSwaps(coin, fxRates);
        await new Promise((resolve) => setTimeout(resolve, 120));
      } catch (error) {
        console.warn(
          `[FOMO] Failed to process swaps for ${coin.symbol}:`,
          error,
        );
      }
    }
  } finally {
    isSwapsPolling = false;
  }
}

export async function handleFomoTradeFromApp(params: {
  coinAddress: string;
  buyerAddress: string;
  txHash?: string | null;
  amountEth?: string | null;
  coinSymbol?: string | null;
  coinName?: string | null;
  creatorAddress?: string | null;
}) {
  const { coinAddress, buyerAddress, txHash, amountEth } = params;
  const coin = {
    address: coinAddress,
    name: params.coinName || "Coin",
    symbol: params.coinSymbol || "COIN",
  };

  if (!params.creatorAddress) return;

  const fxRates = await getFxRates();
  const amountEthValue = parseFloat(amountEth || "0");
  const amountUsd = amountEthValue * fxRates.eth_usd;
  const amountNgn = amountUsd * fxRates.usd_ngn;

  await handleBuyEvent({
    coin,
    creatorAddress: params.creatorAddress,
    buyerAddress,
    amountUsd,
    amountNgn,
    txHash: txHash || undefined,
  });
}

export function startFomoNotifications() {
  if (!ZORA_API_KEY) {
    console.warn("[FOMO] Not starting pollers (missing ZORA_API_KEY)");
    return;
  }

  if (!statsTimer) {
    pollFomoStats();
    statsTimer = setInterval(pollFomoStats, FOMO_STATS_INTERVAL_MS);
    console.log(
      `[FOMO] Stats poller running every ${Math.round(
        FOMO_STATS_INTERVAL_MS / 1000,
      )}s`,
    );
  }

  if (!swapsTimer) {
    pollFomoSwaps();
    swapsTimer = setInterval(pollFomoSwaps, FOMO_SWAPS_INTERVAL_MS);
    console.log(
      `[FOMO] Swaps poller running every ${Math.round(
        FOMO_SWAPS_INTERVAL_MS / 1000,
      )}s`,
    );
  }
}

export function stopFomoNotifications() {
  if (statsTimer) {
    clearInterval(statsTimer);
    statsTimer = null;
  }
  if (swapsTimer) {
    clearInterval(swapsTimer);
    swapsTimer = null;
  }
}
