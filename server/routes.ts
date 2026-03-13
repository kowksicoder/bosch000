import type { Express } from "express";
import { createServer, type Server } from "http";
// Use the Supabase-backed storage implementation which includes notifications, push subscriptions, and moderation
import { storage } from "./supabase-storage";
import { createAdminRouter } from "./routes/admin";
import { serveStatic } from "./vite";
import {
  insertScrapedContentSchema,
  insertCoinSchema,
  updateCoinSchema,
  insertCommentSchema,
  insertNotificationSchema,
  insertFollowSchema,
  insertReferralSchema,
  users,
  referrals,
  pointsTransactions,
  shareTracking,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lt } from "drizzle-orm";
import { z } from "zod";
import { awardPoints as rewardPoints, POINTS_REWARDS, trackReferralActivity } from "./points";
import axios from "axios";
import { detectPlatform } from "./platform-detector";
import { scrapeByPlatform } from "./platform-scrapers";
import { migrateOldData } from "./migrate-old-data";
import { sendTelegramNotification } from "./telegram-bot";
import { RegistryService } from "./registry-service";
import { ActivityTrackerService } from "./activity-tracker-service";
import { base, baseSepolia } from "viem/chains";
import { createPublicClient, decodeEventLog, erc20Abi, http, parseUnits, formatUnits } from "viem";
import { handleFileUpload } from "./upload-handler"; // Import the upload handler
import { walletAuthMiddleware, privyAuthMiddleware, type AuthenticatedRequest } from "./privy-middleware";
import { getFxRates } from "./fx-service";
import { initializePaystackPayment, verifyPaystackSignature, createPaystackTransferRecipient, initiatePaystackTransfer, getPaystackBalance } from "./paystack";
import { executeTreasuryBuy, executeTreasurySell, getTreasuryAddress } from "./treasury-trade";
import { authorizeChannel } from "./pusher";
import { getCoin, setApiKey } from "@zoralabs/coins-sdk";

// OG meta generation helpers
const buildProfileIdentifier = (creator: any) => {
  if (creator?.address && typeof creator.address === "string" && creator.address.startsWith("0x")) {
    return creator.address;
  }
  if (creator?.name) {
    return encodeURIComponent(String(creator.name).trim());
  }
  return creator?.id || "";
};

const generateProfileOGMeta = (creator: any, baseUrl: string) => ({
  title: `${creator.name || 'User'} on CoinIT`,
  description: creator.bio || 'Check out this creator on CoinIT!',
  image: creator.avatar || `${baseUrl}/api/og/profile/${creator.id}`,
  url: creator?.name
    ? `${baseUrl}/@${encodeURIComponent(String(creator.name).trim())}`
    : `${baseUrl}/profile/${buildProfileIdentifier(creator)}`,
});

const generateCoinOGMeta = (coin: any, baseUrl: string) => ({
  title: `${coin.name} (${coin.symbol})`,
  description: coin.description || `Discover ${coin.name} (${coin.symbol}) on CoinIT.`,
  image: coin.image || `${baseUrl}/api/og/coin/${coin.address || coin.id}`,
  url: `${baseUrl}/coin/${coin.address || coin.id}`,
});

const generateProjectOGMeta = (project: any, baseUrl: string) => ({
  title: project.name,
  description: project.description || `Learn more about ${project.name}.`,
  image: project.image || `${baseUrl}/default-project-image.png`,
  url: `${baseUrl}/projects/${project.id}`,
});

const generateReferralOGMeta = (creator: any, baseUrl: string) => ({
  title: `${creator.name || 'User'} invited you to CoinIT!`,
  description: `Join CoinIT and start your crypto journey! Use referral code ${creator.referralCode}.`,
  image: creator.avatar || `${baseUrl}/default-referral-banner.png`,
  url: `${baseUrl}/?ref=${creator.referralCode}`,
});

const collabCreateSchema = z.object({
  coinId: z.string().optional(),
  coinAddress: z.string().optional(),
  title: z.string().optional(),
  collaborators: z.array(z.string()).default([]),
  message: z.string().optional(),
});

const missionCreateSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  type: z.enum(["hold", "activity", "loyalty", "event", "community"]),
  coinAddress: z.string().optional(),
  requiredAmount: z.number().optional(),
  requiredDays: z.number().optional(),
  requiredActions: z.record(z.any()).optional(),
  rewardType: z.enum(["e1xp", "nft", "content", "coupon", "event_access"]),
  rewardValue: z.string().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

const isWalletAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);

const getCreatorIdentifier = (creator?: any, fallback?: string) =>
  creator?.privyId || creator?.privy_id || creator?.address || fallback || "";

const resolveCreatorByIdentifier = async (value: string) => {
  const normalized = value.trim().replace(/^@/, "");
  if (!normalized) return null;

  if (isWalletAddress(normalized)) {
    return await storage.getCreatorByAddress(normalized);
  }

  const byPrivy = await storage.getCreatorByPrivyId(normalized);
  if (byPrivy) return byPrivy;

  const byName = await storage.getCreatorByName(normalized);
  if (byName) return byName;

  return null;
};

const isCommunityCoin = (coin: any) => {
  const text = `${coin?.name || ""} ${coin?.symbol || ""} ${coin?.description || ""}`.toLowerCase();
  return (
    text.includes("community") ||
    text.includes("school") ||
    text.includes("university") ||
    text.includes("club") ||
    text.includes("event")
  );
};

const resolveMissionStatus = (mission: any) => {
  if (!mission) return "closed";
  if (mission.status === "closed") return "closed";
  const now = new Date();
  const startsAt = mission.startsAt || mission.starts_at;
  const endsAt = mission.endsAt || mission.ends_at;
  if (startsAt && new Date(startsAt) > now) return "upcoming";
  if (endsAt && new Date(endsAt) < now) return "expired";
  return mission.status || "active";
};

const getMissionRpcConfig = () => {
  const useSepolia = !!process.env.ONCHAIN_BASE_SEPOLIA_RPC_URL;
  const chain = useSepolia ? baseSepolia : base;
  const rpcUrl =
    (useSepolia
      ? process.env.ONCHAIN_BASE_SEPOLIA_RPC_URL
      : process.env.ONCHAIN_BASE_RPC_URL) || chain.rpcUrls.default.http[0];
  return { chain, rpcUrl };
};

const getTokenBalance = async (tokenAddress: string, walletAddress: string) => {
  const { chain, rpcUrl } = getMissionRpcConfig();
  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
  const [balance, decimals] = await Promise.all([
    client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [walletAddress as `0x${string}`],
    }) as Promise<bigint>,
    client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: "decimals",
    }) as Promise<number>,
  ]);

  const normalized = Number(formatUnits(balance, decimals));
  return { raw: balance, decimals, normalized };
};

const zoraApiKey = process.env.ZORA_API_KEY || process.env.VITE_NEXT_PUBLIC_ZORA_API_KEY || "";
if (zoraApiKey) {
  setApiKey(zoraApiKey);
}

// Helper function to award points to a user
async function awardPoints(
  userId: string,
  amount: number,
  type: string,
  title: string,
  metadata?: Record<string, any>,
): Promise<void> {
  const creator = await storage.getCreatorByAddress(userId);
  if (!creator) {
    console.error(`[awardPoints] Creator not found for user: ${userId}`);
    return;
  }

  // Update creator's points
  const currentPoints = parseInt(creator.points || "0");
  const newPoints = (currentPoints + amount).toString();
  await storage.updateCreator(creator.id, { points: newPoints });

  // Create an E1XP reward record
  await storage.createE1xpReward({
    userId: userId,
    amount: amount.toString(),
    type: type,
    title: title,
    message: title, // Using title as message for simplicity here
    metadata: metadata || {},
  });

  // Create an in-app notification
  await storage.createNotification({
    userId: userId,
    type: "reward",
    title: title,
    message: `You earned ${amount} E1XP!`,
    amount: amount.toString(),
    read: false,
  });
}

// Helper function to get referral code from username/name
async function generateReferralCode(address: string): Promise<string> {
  const creator = await storage.getCreatorByAddress(address);

  if (creator?.name) {
    // Use username/name as referral code
    await storage.updateCreator(creator.id, {
      referralCode: creator.name
    });
    return creator.name;
  }

  // Fallback to shortened address if no name
  const code = address.slice(0, 8);
  if (creator) {
    await storage.updateCreator(creator.id, {
      referralCode: code
    });
  }
  return code;
}

const WEEKLY_CHALLENGE_CONFIG = {
  tradeDays: { target: 3, reward: 50 },
  supportCreators: { target: 2, reward: 50 },
};

const getUtcDayKey = (date: Date) => date.toISOString().split("T")[0];

const getWeekStartUtc = (now = new Date()) => {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const day = start.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // Monday as week start
  start.setUTCDate(start.getUTCDate() + diff);
  start.setUTCHours(0, 0, 0, 0);
  return start;
};

async function ensureUserRecord({
  privyId,
  address,
  email,
  fallbackName,
}: {
  privyId: string;
  address: string | null;
  email: string | null;
  fallbackName?: string | null;
}) {
  let user =
    (privyId ? await storage.getUserByPrivyId(privyId) : null) ||
    (address ? await storage.getUserByAddress(address) : null);

  if (user) return user;

  const { getDefaultUsername } = await import("./username-generator");
  const baseUsername =
    fallbackName?.trim() ||
    getDefaultUsername(email || undefined, privyId);
  const uniqueSuffix = privyId ? privyId.slice(-6) : Date.now().toString(36).slice(-6);
  const username = `${baseUsername}-${uniqueSuffix}`.slice(0, 30);

  try {
    user = await storage.createUser({
      privyId,
      walletAddress: address || null,
      email: email || null,
      username,
      displayName: fallbackName?.trim() || baseUsername,
      e1xpPoints: 100,
    } as any);
  } catch (error) {
    console.warn("[ensureUserRecord] Failed to create user record:", error);
  }

  return user;
}

// Helper function to sync or create a creator profile
export async function syncCreatorProfile(privyId: string, address: string | null, email: string | null) {
  console.log('[syncCreatorProfile] Syncing creator:', { privyId, address, email });

  // First, check if creator exists by privyId
  let creator = await storage.getCreatorByPrivyId(privyId);

  if (creator) {
    console.log('[syncCreatorProfile] Found existing creator by privyId:', creator.id);
    // Update existing creator with latest address if changed
    const updates: any = {};
    if (address && address !== creator.address) {
      updates.address = address;
    }
    if (Object.keys(updates).length > 0) {
      creator = await storage.updateCreator(creator.id, updates);
      console.log('[syncCreatorProfile] Updated creator with new address');
    }
    await ensureUserRecord({
      privyId,
      address: creator.address || address,
      email: creator.email || email,
      fallbackName: creator.name,
    });
    return creator;
  }

  // If not found by privyId, check by address (legacy creators)
  if (address) {
    creator = await storage.getCreatorByAddress(address);
    if (creator) {
      console.log('[syncCreatorProfile] Found legacy creator by address, backfilling privyId');
      // Backfill privyId for legacy creator
      creator = await storage.updateCreator(creator.id, { privyId });
      await ensureUserRecord({
        privyId,
        address: creator.address || address,
        email: creator.email || email,
        fallbackName: creator.name,
      });
      return creator;
    }
  }

  // Generate a default username for email users
  const { getDefaultUsername } = await import("./username-generator");
  const defaultUsername = getDefaultUsername(email, privyId);

  console.log('[syncCreatorProfile] Creating new creator with username:', defaultUsername);

  // Create new creator with privyId (address can be null for email users)
  const creatorData = {
    privyId,
    address: address || null,
    email: email || null,
    name: defaultUsername,
    bio: null,
    avatar: null,
    walletAddress: null,
    verified: "false",
    totalCoins: "0",
    totalVolume: "0",
    followers: "0",
    referralCode: defaultUsername, // Use generated username as referral code
    points: "100", // Welcome bonus
  };

  creator = await storage.createCreator(creatorData);
  console.log('[syncCreatorProfile] Successfully created new creator:', creator.id, 'with email:', email);

  await ensureUserRecord({
    privyId,
    address: creator.address || address,
    email: creator.email || email,
    fallbackName: creator.name || defaultUsername,
  });

  // Send welcome notification and E1XP reward
  try {
    const userId = creator.address || creator.id;
    const welcomePoints = 100;

    // Create welcome notification
    await storage.createNotification({
      userId: userId,
      type: 'reward',
      title: '🎁 Welcome to Every1.fun!',
      message: `You earned ${welcomePoints} E1XP as a welcome bonus! Come back daily to earn more points and build your streak! 🔥`,
      amount: welcomePoints.toString(),
      read: false,
    });

    // Create E1XP reward record
    await storage.createE1xpReward({
      userId: userId,
      amount: welcomePoints.toString(),
      type: 'welcome',
      title: '🎉 Welcome Bonus!',
      message: `Welcome to Every1.fun! You've earned ${welcomePoints} E1XP to get started!`,
      metadata: { 
        isWelcomeBonus: true,
        timestamp: new Date().toISOString()
      },
    });

    // Send real-time notification via Socket.IO if user is connected
    const { emitNotificationToUser } = await import('./socket-server');
    emitNotificationToUser(userId, {
      type: 'reward',
      title: '🎁 Welcome to Every1.fun!',
      message: `You earned ${welcomePoints} E1XP as a welcome bonus!`,
      amount: welcomePoints.toString(),
    });

    // Send Telegram notification if address available
    if (address) {
      try {
        await sendTelegramNotification(
          address,
          '🎁 Welcome to Every1.fun!',
          `Welcome! You've earned ${welcomePoints} E1XP points to get started. Come back daily to earn more points and build your streak! 🔥`,
          'reward'
        );
      } catch (telegramError) {
        console.warn('[syncCreatorProfile] Failed to send Telegram welcome notification:', telegramError);
      }
    }

    console.log(`[syncCreatorProfile] Sent welcome notification and ${welcomePoints} E1XP to new user ${userId}`);
  } catch (notificationError) {
    console.error('[syncCreatorProfile] Failed to send welcome notifications:', notificationError);
    // Don't fail the whole request if notifications fail
  }

  return creator;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // GeckoTerminal API endpoints
  app.get(
    "/api/geckoterminal/pools/:network/:tokenAddress",
    async (req, res) => {
      try {
        const { network, tokenAddress } = req.params;
        const page = parseInt((req.query.page as string) || "1");

        const response = await axios.get(
          `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${tokenAddress}/pools`,
          { params: { page } },
        );

        res.json(response.data);
      } catch (error) {
        console.error("GeckoTerminal pool search error:", error);
        res
          .status(500)
          .json({ error: "Failed to fetch pool data from GeckoTerminal" });
      }
    },
  );

  app.get("/api/geckoterminal/pool/:network/:poolAddress", async (req, res) => {
    try {
      const { network, poolAddress } = req.params;
      const include = (req.query.include as string) || "base_token,quote_token";

      const response = await axios.get(
        `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${poolAddress}`,
        { params: { include } },
      );

      res.json(response.data);
    } catch (error) {
      console.error("GeckoTerminal pool data error:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch pool details from GeckoTerminal" });
    }
  });

  app.get(
    "/api/geckoterminal/ohlcv/:network/:poolAddress/:timeframe",
    async (req, res) => {
      try {
        const { network, poolAddress, timeframe } = req.params;
        const {
          aggregate = "1",
          limit = "100",
          currency = "usd",
          token = "base",
        } = req.query;

        const response = await axios.get(
          `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${poolAddress}/ohlcv/${timeframe}`,
          { params: { aggregate, limit, currency, token } },
        );

        res.json(response.data);
      } catch (error) {
        console.error("GeckoTerminal OHLCV data error:", error);
        res
          .status(500)
          .json({ error: "Failed to fetch chart data from GeckoTerminal" });
      }
    },
  );

  app.get("/api/fx/rates", async (_req, res) => {
    try {
      const rates = await getFxRates();
      res.json(rates);
    } catch (error) {
      console.error("FX rates error:", error);
      res.status(500).json({ error: "Failed to fetch FX rates" });
    }
  });

  // ===== PAYMENTS (Naira On-ramp) =====
  app.post("/api/payments/initialize", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authenticated || !req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { amountNgn, creatorTokenAddress, email, recipientAddress } = req.body as {
        amountNgn: number | string;
        creatorTokenAddress: string;
        email?: string;
        recipientAddress?: string;
      };

      const amount = typeof amountNgn === "string" ? parseFloat(amountNgn) : amountNgn;
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      if (!creatorTokenAddress || !creatorTokenAddress.startsWith("0x")) {
        return res.status(400).json({ error: "Invalid creator token address" });
      }

      if (recipientAddress && !recipientAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        return res.status(400).json({ error: "Invalid recipient address" });
      }

      const privyId = req.user.id;
      const userRecord = await storage.getUserByPrivyId(privyId);
      if (!userRecord) {
        return res.status(404).json({ error: "User not found" });
      }

      const customerEmail = userRecord.email || email;
      if (!customerEmail) {
        return res.status(400).json({ error: "Email required for payment" });
      }

      const reference = `e1_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
      const rates = await getFxRates();

      const paystackResponse = await initializePaystackPayment({
        email: customerEmail,
        amount: Math.round(amount * 100), // kobo
        reference,
        callback_url: process.env.PAYSTACK_CALLBACK_URL,
        metadata: {
          creatorTokenAddress,
          userId: userRecord.id,
          privyId,
        },
      });

      await storage.createFiatTransaction({
        userId: userRecord.id,
        creatorTokenAddress,
        amountNgn: amount.toFixed(2),
        ethUsdRate: rates.eth_usd.toFixed(6),
        usdNgnRate: rates.usd_ngn.toFixed(6),
        ethNgnRate: rates.eth_ngn.toFixed(6),
        provider: "paystack",
        providerReference: reference,
        providerStatus: "initialized",
        status: "pending",
        metadata: {
          paystack: paystackResponse?.data || null,
          rates,
          recipientAddress: recipientAddress || userRecord.walletAddress || null,
        },
      });

      return res.json({
        reference,
        authorizationUrl: paystackResponse?.data?.authorization_url,
        accessCode: paystackResponse?.data?.access_code,
      });
    } catch (error) {
      console.error("Payment initialize error:", error);
      return res.status(500).json({ error: "Failed to initialize payment" });
    }
  });

  app.post("/api/payments/webhook/paystack", async (req, res) => {
    try {
      const signature = req.headers["x-paystack-signature"] as string | undefined;
      const rawBody = req.rawBody as Buffer | undefined;

      if (!rawBody || !verifyPaystackSignature(rawBody, signature)) {
        return res.status(401).send("Invalid signature");
      }

      const event = req.body;
      const eventType = event?.event;
      const data = event?.data;

      if (!data?.reference) {
        return res.status(400).send("Missing reference");
      }

      if (eventType === "charge.success") {
        const fiatTx = await storage.getFiatTransactionByReference(data.reference);

        if (!fiatTx) {
          console.warn("Fiat transaction not found for reference:", data.reference);
          return res.status(200).send("ok");
        }

        if (fiatTx.status === "completed") {
          return res.status(200).send("ok");
        }

        let recipientAddress =
          (fiatTx.metadata as any)?.recipientAddress ||
          null;

        if (!recipientAddress && fiatTx.userId) {
          const userRecord = await storage.getUserById(fiatTx.userId);
          if (userRecord?.walletAddress && userRecord.walletAddress.startsWith("0x")) {
            recipientAddress = userRecord.walletAddress;
          }
        }

        if (!recipientAddress || !recipientAddress.startsWith("0x")) {
          await storage.updateFiatTransactionByReference(data.reference, {
            status: "failed",
            providerStatus: data.status || "success",
            metadata: {
              paystackEvent: event,
              error: "Missing recipient address",
            },
          });
          return res.status(200).send("ok");
        }

        const amountNgn = parseFloat(fiatTx.amountNgn || "0");
        const ethNgnRate =
          parseFloat(fiatTx.ethNgnRate || "0") || (await getFxRates()).eth_ngn;

        const amountEth = amountNgn > 0 && ethNgnRate > 0
          ? (amountNgn / ethNgnRate).toFixed(8)
          : "0";

        await storage.updateFiatTransactionByReference(data.reference, {
          status: "processing",
          providerStatus: data.status || "success",
          amountEth,
          metadata: {
            paystackEvent: event,
            recipientAddress,
          },
        });

        try {
          const tradeResult = await executeTreasuryBuy({
            creatorTokenAddress: fiatTx.creatorTokenAddress as `0x${string}`,
            recipientAddress: recipientAddress as `0x${string}`,
            ethAmount: amountEth,
          });

          await storage.updateFiatTransactionByReference(data.reference, {
            status: "completed",
            providerStatus: data.status || "success",
            amountEth,
            metadata: {
              paystackEvent: event,
              recipientAddress,
              txHash: tradeResult.hash,
            },
          });

          try {
            const userRecord = await storage.getUserById(fiatTx.userId);
            if (userRecord) {
              await rewardPoints(
                userRecord.id,
                POINTS_REWARDS.TRADE_BUY,
                "trade",
                "Bought creator coin with Naira",
                {
                  source: "naira",
                  coinAddress: fiatTx.creatorTokenAddress,
                  amountNgn: fiatTx.amountNgn,
                  txHash: tradeResult.hash,
                },
              );
              await trackReferralActivity(userRecord.id, "trade");
            }
          } catch (pointsError) {
            console.warn("Failed to award trade points:", pointsError);
          }
        } catch (tradeError) {
          console.error("Treasury trade failed:", tradeError);
          await storage.updateFiatTransactionByReference(data.reference, {
            status: "failed",
            providerStatus: data.status || "success",
            amountEth,
            metadata: {
              paystackEvent: event,
              recipientAddress,
              error: tradeError instanceof Error ? tradeError.message : String(tradeError),
            },
          });
        }
      } else if (eventType === "charge.failed") {
        await storage.updateFiatTransactionByReference(data.reference, {
          status: "failed",
          providerStatus: data.status || "failed",
          metadata: {
            paystackEvent: event,
          },
        });
      } else if (
        eventType === "transfer.success" ||
        eventType === "transfer.failed" ||
        eventType === "transfer.reversed"
      ) {
        const ledgerEntry = await storage.getNairaLedgerEntryByReference(
          data.reference,
        );

        if (!ledgerEntry) {
          return res.status(200).send("ok");
        }

        const currentStatus = (ledgerEntry.metadata as any)?.status;
        if (currentStatus === "success" || currentStatus === "failed") {
          return res.status(200).send("ok");
        }

        const status =
          eventType === "transfer.success" ? "success" : "failed";

        await storage.updateNairaLedgerEntryById(ledgerEntry.id, {
          metadata: {
            ...(ledgerEntry.metadata || {}),
            status,
            paystackEvent: event,
          },
        });

        if (status === "failed") {
          const recipientAddress = ledgerEntry.recipient_address;
          const amountValue = parseFloat(ledgerEntry.amount_ngn || "0");
          if (recipientAddress && Number.isFinite(amountValue) && amountValue > 0) {
            const ledger = await storage.getNairaLedgerByAddress(recipientAddress);
            const available = ledger ? Number(ledger.available_ngn || 0) : 0;
            const pending = ledger ? Number(ledger.pending_ngn || 0) : 0;

            const newAvailable = (available + amountValue).toFixed(2);
            const newPending = pending.toFixed(2);

            await storage.upsertNairaLedger(recipientAddress, newAvailable, newPending);
            await storage.createNairaLedgerEntry({
              recipientAddress,
              entryType: "credit",
              amountNgn: amountValue.toFixed(2),
              source: "payout_reversal",
              reference: data.reference,
              metadata: {
                paystackEvent: event,
              },
            });
          }
        }
      }

      return res.status(200).send("ok");
    } catch (error) {
      console.error("Payment webhook error:", error);
      return res.status(500).send("error");
    }
  });

  // ===== WALLET TRADE TRACKING =====
  app.post("/api/trades/record", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authenticated || !req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { coinAddress, side, txHash, amountEth } = req.body as {
        coinAddress: string;
        side: "buy" | "sell";
        txHash?: string;
        amountEth?: string;
      };

      if (!coinAddress || !coinAddress.startsWith("0x")) {
        return res.status(400).json({ error: "Invalid coin address" });
      }

      if (side !== "buy" && side !== "sell") {
        return res.status(400).json({ error: "Invalid trade side" });
      }

      const userRecord = await storage.getUserByPrivyId(req.user.id);
      if (!userRecord) {
        return res.status(404).json({ error: "User not found" });
      }

      const points = side === "buy" ? POINTS_REWARDS.TRADE_BUY : POINTS_REWARDS.TRADE_SELL;

      await rewardPoints(
        userRecord.id,
        points,
        "trade",
        side === "buy" ? "Bought creator coin" : "Sold creator coin",
        {
          source: "wallet",
          coinAddress,
          side,
          txHash,
          amountEth,
        },
      );

      await trackReferralActivity(userRecord.id, "trade");

      return res.json({ status: "ok" });
    } catch (error) {
      console.error("Trade record error:", error);
      return res.status(500).json({ error: "Failed to record trade" });
    }
  });

  // ===== WITHDRAWALS (Naira Off-ramp) =====
  app.post("/api/withdrawals/initialize", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authenticated || !req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { tokenAddress, tokenAmount, bankCode, accountNumber, accountName, walletAddress } = req.body as {
        tokenAddress: string;
        tokenAmount: string | number;
        bankCode: string;
        accountNumber: string;
        accountName: string;
        walletAddress?: string;
      };

      if (!tokenAddress || !tokenAddress.startsWith("0x")) {
        return res.status(400).json({ error: "Invalid token address" });
      }

      const amountValue = typeof tokenAmount === "string" ? parseFloat(tokenAmount) : tokenAmount;
      if (!amountValue || amountValue <= 0) {
        return res.status(400).json({ error: "Invalid token amount" });
      }

      if (!bankCode || !accountNumber || !accountName) {
        return res.status(400).json({ error: "Bank details are required" });
      }

      const privyId = req.user.id;
      const userRecord = await storage.getUserByPrivyId(privyId);
      if (!userRecord) {
        return res.status(404).json({ error: "User not found" });
      }

      const rates = await getFxRates();
      const priceChainId = !!process.env.ONCHAIN_BASE_SEPOLIA_RPC_URL ? baseSepolia.id : base.id;
      const coinResponse = await getCoin({
        address: tokenAddress as `0x${string}`,
        chain: priceChainId,
      });
      const coinData = coinResponse.data?.zora20Token;
      const priceUsd = coinData?.price ? parseFloat(coinData.price) : 0;
      if (!priceUsd || !rates.usd_ngn) {
        return res.status(400).json({ error: "Unable to price this coin" });
      }

      const amountNgn = amountValue * priceUsd * rates.usd_ngn;

      const useSepolia = !!process.env.ONCHAIN_BASE_SEPOLIA_RPC_URL;
      const chain = useSepolia ? baseSepolia : base;
      const rpcUrl =
        (useSepolia
          ? process.env.ONCHAIN_BASE_SEPOLIA_RPC_URL
          : process.env.ONCHAIN_BASE_RPC_URL) ||
        process.env.VITE_ZORA_RPC_URL ||
        (useSepolia
          ? "https://sepolia.base.org"
          : "https://base-mainnet.g.alchemy.com/v2/" + (process.env.VITE_ALCHEMY_API_KEY || ""));

      const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
      });

      let tokenDecimals = 18;
      try {
        const onchainDecimals = await publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "decimals",
        });
        tokenDecimals = Number(onchainDecimals);
      } catch (error) {
        console.warn("Unable to read token decimals, defaulting to 18", error);
      }

      const withdrawal = await storage.createWithdrawalRequest({
        userId: userRecord.id,
        tokenAddress,
        tokenAmount: amountValue.toString(),
        tokenDecimals,
        amountNgn: amountNgn.toFixed(2),
        usdNgnRate: rates.usd_ngn.toFixed(6),
        provider: "paystack",
        status: "pending",
        bankCode,
        bankAccount: accountNumber,
        bankName: accountName,
        metadata: {
          walletAddress: walletAddress || userRecord.walletAddress || null,
          priceUsd,
        },
      });

      const treasuryAddress = getTreasuryAddress();

      return res.json({
        withdrawalId: withdrawal.id,
        treasuryAddress,
        amountNgn: withdrawal.amountNgn,
      });
    } catch (error) {
      console.error("Withdrawal initialize error:", error);
      return res.status(500).json({ error: "Failed to initialize withdrawal" });
    }
  });

  app.get("/api/treasury/address", (_req, res) => {
    try {
      const treasuryAddress = getTreasuryAddress();
      res.json({ address: treasuryAddress });
    } catch (error) {
      console.error("Treasury address error:", error);
      res.status(500).json({ error: "Failed to resolve treasury address" });
    }
  });

  app.post("/api/withdrawals/confirm", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authenticated || !req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { withdrawalId, txHash } = req.body as { withdrawalId: string; txHash: string };
      if (!withdrawalId || !txHash) {
        return res.status(400).json({ error: "Missing withdrawal id or tx hash" });
      }

      const withdrawal = await storage.getWithdrawalRequestById(withdrawalId);
      if (!withdrawal) {
        return res.status(404).json({ error: "Withdrawal not found" });
      }

      if (withdrawal.status === "completed") {
        return res.json({ status: "completed" });
      }

      const privyId = req.user.id;
      const userRecord = await storage.getUserByPrivyId(privyId);
      if (!userRecord || withdrawal.userId !== userRecord.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const walletAddress = (withdrawal.metadata as any)?.walletAddress;
      if (!walletAddress || !walletAddress.startsWith("0x")) {
        return res.status(400).json({ error: "Missing wallet address for verification" });
      }

      const useSepolia = !!process.env.ONCHAIN_BASE_SEPOLIA_RPC_URL;
      const chain = useSepolia ? baseSepolia : base;
      const rpcUrl =
        (useSepolia
          ? process.env.ONCHAIN_BASE_SEPOLIA_RPC_URL
          : process.env.ONCHAIN_BASE_RPC_URL) ||
        process.env.VITE_ZORA_RPC_URL ||
        (useSepolia
          ? "https://sepolia.base.org"
          : "https://base-mainnet.g.alchemy.com/v2/" + (process.env.VITE_ALCHEMY_API_KEY || ""));

      const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
      });

      const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
      const treasuryAddress = getTreasuryAddress().toLowerCase();
      const expectedAmount = withdrawal.tokenAmount;
      const tokenDecimals = withdrawal.tokenDecimals ?? 18;

      let validTransfer = false;
      for (const log of receipt.logs) {
        if (log.address?.toLowerCase() !== withdrawal.tokenAddress.toLowerCase()) continue;
        try {
          const decoded = decodeEventLog({
            abi: erc20Abi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName !== "Transfer") continue;
          const from = (decoded.args as any).from?.toLowerCase();
          const to = (decoded.args as any).to?.toLowerCase();
          const value = BigInt((decoded.args as any).value ?? 0);
          if (from === walletAddress.toLowerCase() && to === treasuryAddress) {
            const expectedUnits = parseUnits(expectedAmount, tokenDecimals);
            if (value >= expectedUnits) {
              validTransfer = true;
              break;
            }
          }
        } catch {
          // ignore non-transfer logs
        }
      }

      if (!validTransfer) {
        await storage.updateWithdrawalRequestById(withdrawal.id, {
          status: "failed",
          metadata: { ...(withdrawal.metadata || {}), error: "Transfer verification failed" },
        });
        return res.status(400).json({ error: "Transfer verification failed" });
      }

      await storage.updateWithdrawalRequestById(withdrawal.id, {
        status: "processing",
        onchainTxHash: txHash,
      });

      await executeTreasurySell({
        creatorTokenAddress: withdrawal.tokenAddress as `0x${string}`,
        tokenAmount: withdrawal.tokenAmount,
        tokenDecimals: tokenDecimals,
      });

      const recipientResponse = await createPaystackTransferRecipient({
        type: "nuban",
        name: withdrawal.bankName,
        account_number: withdrawal.bankAccount,
        bank_code: withdrawal.bankCode,
        currency: "NGN",
      });

      const recipientCode = recipientResponse?.data?.recipient_code;
      if (!recipientCode) {
        throw new Error("Failed to create transfer recipient");
      }

      const transferResponse = await initiatePaystackTransfer({
        source: "balance",
        amount: Math.round(parseFloat(withdrawal.amountNgn) * 100),
        recipient: recipientCode,
        reason: "Creator coin withdrawal",
      });

      await storage.updateWithdrawalRequestById(withdrawal.id, {
        status: "completed",
        providerReference: transferResponse?.data?.reference || null,
        payoutRecipientCode: recipientCode,
        metadata: {
          ...(withdrawal.metadata || {}),
          transfer: transferResponse?.data || null,
        },
      });

      try {
        await rewardPoints(
          withdrawal.userId,
          POINTS_REWARDS.TRADE_SELL,
          "trade",
          "Sold creator coin to Naira",
          {
            source: "naira",
            coinAddress: withdrawal.tokenAddress,
            amountNgn: withdrawal.amountNgn,
            txHash,
          },
        );
        await trackReferralActivity(withdrawal.userId, "trade");
      } catch (pointsError) {
        console.warn("Failed to award sell points:", pointsError);
      }

      return res.json({ status: "completed" });
    } catch (error) {
      console.error("Withdrawal confirm error:", error);
      try {
        const { withdrawalId } = req.body as { withdrawalId?: string };
        if (withdrawalId) {
          await storage.updateWithdrawalRequestById(withdrawalId, {
            status: "failed",
            metadata: { error: error instanceof Error ? error.message : String(error) },
          });
        }
      } catch (updateError) {
        console.warn("Failed to update withdrawal status after error:", updateError);
      }
      return res.status(500).json({ error: "Failed to confirm withdrawal" });
    }
  });

  app.post("/api/creators/auto-settlement", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authenticated || !req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { enabled, payoutRecipientAddress } = req.body as {
        enabled: boolean;
        payoutRecipientAddress?: string | null;
      };

      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "Invalid enabled flag" });
      }

      const privyId = req.user.id;
      let creator = await storage.getCreatorByPrivyId(privyId);

      if (!creator && privyId?.startsWith("0x")) {
        creator = await storage.getCreatorByAddress(privyId);
      }

      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }

      const updated = await storage.updateCreator(creator.id, {
        autoSettlementEnabled: enabled,
        autoSettlementAddress: payoutRecipientAddress || null,
        autoSettlementUpdatedAt: new Date(),
      } as any);

      return res.json(updated);
    } catch (error) {
      console.error("Auto-settlement update error:", error);
      return res.status(500).json({ error: "Failed to update auto-settlement" });
    }
  });

  app.get("/api/ledger/naira", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authenticated || !req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const privyId = req.user.id;
      let creator = await storage.getCreatorByPrivyId(privyId);
      if (!creator && privyId?.startsWith("0x")) {
        creator = await storage.getCreatorByAddress(privyId);
      }

      const recipientAddress = creator?.address || privyId;
      const ledger = await storage.getNairaLedgerByAddress(recipientAddress);

      res.json({
        recipientAddress,
        availableNgn: ledger?.available_ngn || "0",
        pendingNgn: ledger?.pending_ngn || "0",
        updatedAt: ledger?.updated_at || null,
      });
    } catch (error) {
      console.error("Naira ledger error:", error);
      res.status(500).json({ error: "Failed to fetch Naira ledger" });
    }
  });

  app.get("/api/earnings/summary", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authenticated || !req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const privyId = req.user.id;
      let creator = await storage.getCreatorByPrivyId(privyId);
      if (!creator && privyId?.startsWith("0x")) {
        creator = await storage.getCreatorByAddress(privyId);
      }

      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }

      const recipientAddresses = new Set<string>();
      if (creator.walletAddress && creator.walletAddress.startsWith("0x")) {
        recipientAddresses.add(creator.walletAddress);
      }
      if (creator.address && creator.address.startsWith("0x")) {
        recipientAddresses.add(creator.address);
      }
      if (creator.autoSettlementAddress && creator.autoSettlementAddress.startsWith("0x")) {
        recipientAddresses.add(creator.autoSettlementAddress);
      }

      if (recipientAddresses.size === 0) {
        return res.json({
          last24hNgn: 0,
          previous24hNgn: 0,
          changePct: 0,
          rewardCount: 0,
          updatedAt: new Date().toISOString(),
        });
      }

      const now = new Date();
      const start24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const start48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      const fxRates = await getFxRates();

      const sumRewards = (rewards: any[]) =>
        rewards.reduce((sum, reward) => {
          const amountNgnRaw =
            (reward as any).rewardAmountNgn ?? (reward as any).reward_amount_ngn;
          const amountUsdRaw =
            (reward as any).rewardAmountUsd ?? (reward as any).reward_amount_usd;
          const ngnValue = amountNgnRaw
            ? parseFloat(String(amountNgnRaw))
            : amountUsdRaw
              ? parseFloat(String(amountUsdRaw)) * fxRates.usd_ngn
              : 0;
          return sum + (Number.isFinite(ngnValue) ? ngnValue : 0);
        }, 0);

      let last24hNgn = 0;
      let previous24hNgn = 0;
      let rewardCount = 0;

      for (const address of recipientAddresses) {
        const recentRewards = await storage.getRewardsByRecipientInRange(
          address,
          start24h.toISOString(),
          now.toISOString(),
        );
        const previousRewards = await storage.getRewardsByRecipientInRange(
          address,
          start48h.toISOString(),
          start24h.toISOString(),
        );

        last24hNgn += sumRewards(recentRewards);
        previous24hNgn += sumRewards(previousRewards);
        rewardCount += recentRewards.length;
      }

      const changePct =
        previous24hNgn > 0
          ? ((last24hNgn - previous24hNgn) / previous24hNgn) * 100
          : last24hNgn > 0
            ? 100
            : 0;

      res.json({
        last24hNgn: Number(last24hNgn.toFixed(2)),
        previous24hNgn: Number(previous24hNgn.toFixed(2)),
        changePct: Number(changePct.toFixed(2)),
        rewardCount,
        updatedAt: now.toISOString(),
      });
    } catch (error) {
      console.error("Earnings summary error:", error);
      res.status(500).json({ error: "Failed to fetch earnings summary" });
    }
  });

  // Collab earnings summary (Phase 1 placeholder)
  app.get("/api/collabs/summary", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authenticated || !req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const privyId = req.user.id;
      let creator = await storage.getCreatorByPrivyId(privyId);
      if (!creator && privyId?.startsWith("0x")) {
        creator = await storage.getCreatorByAddress(privyId);
      }

      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }

      const creatorIdentifier = getCreatorIdentifier(creator, privyId);
      const collabs = await storage.getCollabsForMember(creatorIdentifier);

      return res.json({
        totalCollabs: collabs.length,
        totalEarningsNgn: 0,
        totalVolumeNgn: 0,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Collab summary error:", error);
      return res.status(500).json({ error: "Failed to fetch collab summary" });
    }
  });

  // Create a collab (coin + collaborators)
  app.post("/api/collabs", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authenticated || !req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const payload = collabCreateSchema.parse(req.body || {});
      const privyId = req.user.id;
      let creator = await storage.getCreatorByPrivyId(privyId);
      if (!creator && privyId?.startsWith("0x")) {
        creator = await storage.getCreatorByAddress(privyId);
      }

      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }

      const creatorIdentifier = getCreatorIdentifier(creator, privyId);
      const collaborators = payload.collaborators
        .map((entry) => entry.trim())
        .filter(Boolean);

      const resolvedCollaborators = await Promise.all(
        collaborators.map(async (value) => ({
          input: value,
          creator: await resolveCreatorByIdentifier(value),
        })),
      );

      const unknownCollaborators = resolvedCollaborators
        .filter((entry) => !entry.creator)
        .map((entry) => entry.input);

      if (unknownCollaborators.length > 0) {
        return res.status(400).json({
          error: "Unknown collaborators",
          unknown: unknownCollaborators,
        });
      }

      const collab = await storage.createCollab({
        coinId: payload.coinId,
        coinAddress: payload.coinAddress,
        title: payload.title,
        createdBy: creatorIdentifier,
        status: "active",
        metadata: {
          collaborators: resolvedCollaborators.map((entry) => entry.creator?.name || entry.creator?.address || entry.input),
        },
      });

      const members = [
        { id: creatorIdentifier, status: "active" },
        ...resolvedCollaborators.map((entry) => ({
          id: getCreatorIdentifier(entry.creator, entry.input),
          status: "invited",
        })),
      ];

      const totalMembers = members.length;
      const baseSplit = Math.floor(10000 / totalMembers);
      const lastSplit = 10000 - baseSplit * (totalMembers - 1);

      const createdMembers = [];
      for (let index = 0; index < members.length; index++) {
        const member = members[index];
        const splitBps = index === members.length - 1 ? lastSplit : baseSplit;
        const createdMember = await storage.addCollabMember({
          collabId: collab.id,
          memberId: member.id,
          role: "creator",
          splitBps,
          status: member.status,
        });
        createdMembers.push(createdMember);
      }

      const invites = [];
      for (const entry of resolvedCollaborators) {
        const inviteeIdentifier = getCreatorIdentifier(entry.creator, entry.input);
        const invite = await storage.createCollabInvite({
          collabId: collab.id,
          inviterId: creatorIdentifier,
          inviteeId: inviteeIdentifier,
          status: "pending",
          message: payload.message,
        });
        invites.push(invite);

        try {
          await storage.createNotification({
            userId: inviteeIdentifier,
            type: "collab_invite",
            title: "Collab request",
            message: `${creator?.name || "A creator"} invited you to join ${payload.title || "a collab coin"}.`,
            read: false,
          });
        } catch (notifyError) {
          console.warn("[Collab] Failed to notify invitee:", notifyError);
        }
      }

      // Broadcast new collab to the platform
      try {
        const { notificationService } = await import("./notification-service");
        await notificationService.notifyNewCollabCreated(
          payload.title || collab.title || "Collab",
          creator?.name,
        );
      } catch (notifyError) {
        console.warn("[Collab] Failed to broadcast new collab:", notifyError);
      }

      res.json({
        collab,
        invites,
        members: createdMembers,
      });
    } catch (error) {
      console.error("Create collab error:", error);
      return res.status(400).json({ error: "Failed to create collab" });
    }
  });

  // List collabs for current user
  app.get("/api/collabs", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authenticated || !req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const privyId = req.user.id;
      let creator = await storage.getCreatorByPrivyId(privyId);
      if (!creator && privyId?.startsWith("0x")) {
        creator = await storage.getCreatorByAddress(privyId);
      }

      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }

      const identifiers = new Set<string>();
      identifiers.add(getCreatorIdentifier(creator, privyId));
      if (creator.address) identifiers.add(creator.address);
      if (creator.privyId) identifiers.add(creator.privyId);

      const collabs: any[] = [];
      for (const id of identifiers) {
        const entries = await storage.getCollabsForMember(id);
        collabs.push(...entries);
      }

      const uniqueMap = new Map<string, any>();
      collabs.forEach((entry) => {
        if (!entry?.collab?.id) return;
        uniqueMap.set(entry.collab.id, entry);
      });

      res.json(Array.from(uniqueMap.values()));
    } catch (error) {
      console.error("List collabs error:", error);
      res.status(500).json({ error: "Failed to fetch collabs" });
    }
  });

  // Pending collab invites for current user
  app.get("/api/collabs/invites", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authenticated || !req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const privyId = req.user.id;
      let creator = await storage.getCreatorByPrivyId(privyId);
      if (!creator && privyId?.startsWith("0x")) {
        creator = await storage.getCreatorByAddress(privyId);
      }

      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }

      const identifiers = new Set<string>();
      identifiers.add(getCreatorIdentifier(creator, privyId));
      if (creator.address) identifiers.add(creator.address);
      if (creator.privyId) identifiers.add(creator.privyId);

      const invites: any[] = [];
      for (const id of identifiers) {
        const entries = await storage.getCollabInvitesForMember(id);
        invites.push(...entries);
      }

      const uniqueInvites = Array.from(
        new Map(invites.map((invite) => [invite.id, invite])).values(),
      );

      const enriched = await Promise.all(
        uniqueInvites.map(async (invite) => {
          const collab = await storage.getCollab(invite.collabId);
          const inviter = await resolveCreatorByIdentifier(invite.inviterId);
          return {
            ...invite,
            collab,
            inviter: inviter
              ? {
                  id: inviter.id,
                  name: inviter.name,
                  avatar: inviter.avatar,
                  address: inviter.address,
                }
              : null,
          };
        }),
      );

      res.json(enriched);
    } catch (error) {
      console.error("Collab invites error:", error);
      res.status(500).json({ error: "Failed to fetch collab invites" });
    }
  });

  // Accept collab invite
  app.post("/api/collabs/invites/:inviteId/accept", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authenticated || !req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { inviteId } = req.params;
      const invite = await storage.getCollabInvite(inviteId);
      if (!invite) {
        return res.status(404).json({ error: "Invite not found" });
      }

      const privyId = req.user.id;
      let creator = await storage.getCreatorByPrivyId(privyId);
      if (!creator && privyId?.startsWith("0x")) {
        creator = await storage.getCreatorByAddress(privyId);
      }

      const identifiers = new Set<string>();
      identifiers.add(privyId);
      if (creator?.address) identifiers.add(creator.address);
      if (creator?.privyId) identifiers.add(creator.privyId);

      if (!identifiers.has(invite.inviteeId)) {
        return res.status(403).json({ error: "Invite not authorized" });
      }

      const updated = await storage.updateCollabInviteStatus(inviteId, "accepted");
      await storage.updateCollabMemberStatus(invite.collabId, invite.inviteeId, "active");

      try {
        await storage.createNotification({
          userId: invite.inviterId,
          type: "collab_invite_accepted",
          title: "Collab accepted",
          message: `${creator?.name || "A collaborator"} accepted your collab invite.`,
          read: false,
        });
      } catch (notifyError) {
        console.warn("[Collab] Failed to notify inviter:", notifyError);
      }

      res.json(updated);
    } catch (error) {
      console.error("Accept collab invite error:", error);
      res.status(500).json({ error: "Failed to accept invite" });
    }
  });

  // Decline collab invite
  app.post("/api/collabs/invites/:inviteId/decline", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authenticated || !req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { inviteId } = req.params;
      const invite = await storage.getCollabInvite(inviteId);
      if (!invite) {
        return res.status(404).json({ error: "Invite not found" });
      }

      const privyId = req.user.id;
      let creator = await storage.getCreatorByPrivyId(privyId);
      if (!creator && privyId?.startsWith("0x")) {
        creator = await storage.getCreatorByAddress(privyId);
      }

      const identifiers = new Set<string>();
      identifiers.add(privyId);
      if (creator?.address) identifiers.add(creator.address);
      if (creator?.privyId) identifiers.add(creator.privyId);

      if (!identifiers.has(invite.inviteeId)) {
        return res.status(403).json({ error: "Invite not authorized" });
      }

      const updated = await storage.updateCollabInviteStatus(inviteId, "declined");
      await storage.updateCollabMemberStatus(invite.collabId, invite.inviteeId, "declined");

      try {
        await storage.createNotification({
          userId: invite.inviterId,
          type: "collab_invite_declined",
          title: "Collab declined",
          message: `${creator?.name || "A collaborator"} declined your collab invite.`,
          read: false,
        });
      } catch (notifyError) {
        console.warn("[Collab] Failed to notify inviter:", notifyError);
      }

      res.json(updated);
    } catch (error) {
      console.error("Decline collab invite error:", error);
      res.status(500).json({ error: "Failed to decline invite" });
    }
  });

  // Fan missions
  app.get("/api/missions", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const missions = await storage.getMissions();
      let userMissionMap = new Map<string, any>();
      let userIdentifier: string | null = null;

      if (req.authenticated && req.user?.id) {
        const privyId = req.user.id;
        let creator = await storage.getCreatorByPrivyId(privyId);
        if (!creator && privyId?.startsWith("0x")) {
          creator = await storage.getCreatorByAddress(privyId);
        }

        if (creator) {
          userIdentifier = getCreatorIdentifier(creator, privyId);
          const userMissions = await storage.getUserMissions(userIdentifier);
          userMissionMap = new Map(userMissions.map((entry) => [entry.missionId, entry]));
        }
      }

      const response = missions.map((mission) => {
        const userMission = userMissionMap.get(mission.id);
        return {
          ...mission,
          missionStatus: resolveMissionStatus(mission),
          userStatus: userMission?.status || "not_joined",
          userProgress: userMission?.progress || 0,
          userRewardStatus: userMission?.rewardStatus || null,
          userRewardDeliveredAt: userMission?.rewardDeliveredAt || null,
          userRewardDeliveryValue: userMission?.rewardDeliveryValue || null,
          joinedAt: userMission?.joinedAt || null,
          completedAt: userMission?.completedAt || null,
          claimedAt: userMission?.claimedAt || null,
        };
      });

      return res.json(response);
    } catch (error) {
      console.error("Fetch missions error:", error);
      return res.status(500).json({ error: "Failed to fetch missions" });
    }
  });

  // Create mission (creator)
  app.post("/api/missions", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authenticated || !req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const payload = missionCreateSchema.parse(req.body || {});
      const privyId = req.user.id;
      let creator = await storage.getCreatorByPrivyId(privyId);
      if (!creator && privyId?.startsWith("0x")) {
        creator = await storage.getCreatorByAddress(privyId);
      }

      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }

      const creatorIdentifier = getCreatorIdentifier(creator, privyId);
      const mission = await storage.createMission({
        creatorId: creatorIdentifier,
        title: payload.title,
        description: payload.description,
        type: payload.type,
        coinAddress: payload.coinAddress,
        requiredAmount: payload.requiredAmount?.toString(),
        requiredDays: payload.requiredDays,
        requiredActions: payload.requiredActions,
        rewardType: payload.rewardType,
        rewardValue: payload.rewardValue,
        status: "active",
        startsAt: payload.startsAt ? new Date(payload.startsAt) : null,
        endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
      });

      try {
        const { notificationService } = await import("./notification-service");
        await notificationService.notifyMissionCreatedBroadcast(
          mission.title,
          creator?.name,
          creatorIdentifier,
        );
      } catch (notifyError) {
        console.warn("[Missions] Failed to broadcast mission created:", notifyError);
      }

      return res.json(mission);
    } catch (error) {
      console.error("Create mission error:", error);
      return res.status(400).json({ error: "Failed to create mission" });
    }
  });

  // Join mission
  app.post("/api/missions/:missionId/join", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authenticated || !req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { missionId } = req.params;
      const mission = await storage.getMission(missionId);
      if (!mission) {
        return res.status(404).json({ error: "Mission not found" });
      }

      const privyId = req.user.id;
      let creator = await storage.getCreatorByPrivyId(privyId);
      if (!creator && privyId?.startsWith("0x")) {
        creator = await storage.getCreatorByAddress(privyId);
      }

      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }

      const userIdentifier = getCreatorIdentifier(creator, privyId);
      const existing = await storage.getUserMission(missionId, userIdentifier);
      if (existing) {
        return res.json(existing);
      }

      const record = await storage.createUserMission({
        missionId,
        userId: userIdentifier,
        status: "in_progress",
        progress: 0,
      });

      return res.json(record);
    } catch (error) {
      console.error("Join mission error:", error);
      return res.status(500).json({ error: "Failed to join mission" });
    }
  });

  // Claim mission reward
  app.post("/api/missions/:missionId/claim", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authenticated || !req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { missionId } = req.params;
      const mission = await storage.getMission(missionId);
      if (!mission) {
        return res.status(404).json({ error: "Mission not found" });
      }

      if (resolveMissionStatus(mission) !== "active") {
        return res.status(400).json({ error: "Mission is not active" });
      }

      const privyId = req.user.id;
      let creator = await storage.getCreatorByPrivyId(privyId);
      if (!creator && privyId?.startsWith("0x")) {
        creator = await storage.getCreatorByAddress(privyId);
      }

      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }

      const userIdentifier = getCreatorIdentifier(creator, privyId);
      const userMission = await storage.getUserMission(missionId, userIdentifier);
      if (!userMission) {
        return res.status(400).json({ error: "You need to join this mission first" });
      }

      if (userMission.status === "claimed") {
        return res.json({ status: "claimed" });
      }

      let eligible = true;

      if (mission.type === "hold" || mission.type === "loyalty") {
        const walletAddress =
          creator.address ||
          (isWalletAddress(privyId) ? privyId : null);

        if (!walletAddress) {
          return res.status(400).json({ error: "Wallet not linked for hold mission" });
        }

        if (!mission.coinAddress) {
          return res.status(400).json({ error: "Mission coin is missing" });
        }

        const balance = await getTokenBalance(mission.coinAddress, walletAddress);
        const requiredAmount = Number(mission.requiredAmount || 0);
        if (balance.normalized < requiredAmount) {
          eligible = false;
        }

        if (eligible && mission.type === "loyalty" && mission.requiredDays) {
          const joinedAt = userMission.joinedAt ? new Date(userMission.joinedAt) : new Date();
          const requiredMs = mission.requiredDays * 24 * 60 * 60 * 1000;
          if (Date.now() - joinedAt.getTime() < requiredMs) {
            eligible = false;
          }
        }
      }

      if (mission.type === "activity" || mission.type === "community") {
        const required = mission.requiredActions as any;
        if (required?.actionType && required?.target) {
          const userRecord =
            (await storage.getUserByPrivyId(privyId)) ||
            (creator.address ? await storage.getUserByAddress(creator.address) : undefined);

          if (!userRecord) {
            eligible = false;
          } else {
            const entries = await db
              .select()
              .from(pointsTransactions)
              .where(eq(pointsTransactions.userId, userRecord.id));

            const count = entries.filter((entry) => entry.type === required.actionType).length;
            eligible = count >= Number(required.target);
          }
        }
      }

      if (!eligible) {
        return res.status(400).json({ error: "Mission requirements not met yet" });
      }

      const completedAt = new Date().toISOString();
      let updated = await storage.updateUserMission(userMission.id, {
        status: "completed",
        progress: 100,
        completedAt,
      });

      if (mission.rewardType === "e1xp") {
        const rewardAmount = Number(mission.rewardValue || 0) || 10;
        await storage.createE1xpReward({
          userId: userIdentifier,
          amount: rewardAmount.toString(),
          type: "mission_reward",
          title: "Mission completed!",
          message: `You earned ${rewardAmount} E1XP for completing ${mission.title}.`,
          metadata: {
            missionId: mission.id,
            missionTitle: mission.title,
          },
        });

        await storage.createNotification({
          userId: userIdentifier,
          type: "reward",
          title: "Mission reward unlocked",
          message: `You earned ${rewardAmount} E1XP for completing ${mission.title}.`,
          read: false,
        });

        updated = await storage.updateUserMission(userMission.id, {
          status: "claimed",
          claimedAt: new Date().toISOString(),
          progress: 100,
          rewardStatus: "delivered",
          rewardDeliveredAt: new Date().toISOString(),
        });
      } else {
        const autoDeliverable =
          ["content", "coupon", "event_access"].includes(mission.rewardType) &&
          mission.rewardValue;

        if (autoDeliverable) {
          const deliveredAt = new Date().toISOString();
          updated = await storage.updateUserMission(userMission.id, {
            status: "claimed",
            claimedAt: deliveredAt,
            progress: 100,
            rewardStatus: "delivered",
            rewardDeliveredAt: deliveredAt,
            rewardDeliveryValue: mission.rewardValue || null,
          });

          await storage.createNotification({
            userId: userIdentifier,
            type: "mission_reward",
            title: "Reward delivered",
            message: `Your reward for "${mission.title}" is ready: ${mission.rewardValue || "See details in your mission."}`,
            read: false,
          });
        } else {
          updated = await storage.updateUserMission(userMission.id, {
            status: "claimed",
            progress: 100,
            completedAt,
            claimedAt: new Date().toISOString(),
            rewardStatus: "pending",
          });

          await storage.createNotification({
            userId: userIdentifier,
            type: "mission_reward_pending",
            title: "Reward pending",
            message: `Your reward for "${mission.title}" is pending delivery.`,
            read: false,
          });

          if (mission.creatorId) {
            await storage.createNotification({
              userId: mission.creatorId,
              type: "mission_fulfillment_required",
              title: "Mission reward to deliver",
              message: `A fan completed "${mission.title}". Please deliver the reward.`,
              read: false,
            });
          }
        }
      }

      return res.json({
        status: updated?.status || "completed",
        rewardType: mission.rewardType,
        rewardValue: mission.rewardValue || null,
        rewardStatus: updated?.rewardStatus || null,
      });
    } catch (error) {
      console.error("Claim mission error:", error);
      return res.status(500).json({ error: "Failed to claim mission" });
    }
  });

  // Close mission (creator only)
  app.post("/api/missions/:missionId/close", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authenticated || !req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { missionId } = req.params;
      const mission = await storage.getMission(missionId);
      if (!mission) {
        return res.status(404).json({ error: "Mission not found" });
      }

      const privyId = req.user.id;
      let creator = await storage.getCreatorByPrivyId(privyId);
      if (!creator && privyId?.startsWith("0x")) {
        creator = await storage.getCreatorByAddress(privyId);
      }

      const identifiers = new Set<string>();
      identifiers.add(privyId);
      if (creator?.address) identifiers.add(creator.address);
      if (creator?.privyId) identifiers.add(creator.privyId);

      if (!identifiers.has(mission.creatorId)) {
        return res.status(403).json({ error: "Not allowed to close this mission" });
      }

      const updated = await storage.updateMission(missionId, {
        status: "closed",
      });

      try {
        const { notificationService } = await import("./notification-service");
        const participants = await storage.getUserMissionsByMissionIds([missionId]);
        const participantIds = Array.from(
          new Set(participants.map((entry) => entry.userId)),
        );
        if (participantIds.length) {
          await notificationService.notifyMissionClosedParticipants(
            participantIds,
            mission.title,
          );
        }
      } catch (notifyError) {
        console.warn("[Missions] Failed to notify participants:", notifyError);
      }

      return res.json(updated);
    } catch (error) {
      console.error("Close mission error:", error);
      return res.status(500).json({ error: "Failed to close mission" });
    }
  });

  // Creator: get pending mission rewards to fulfill
  app.get("/api/missions/pending-fulfillment", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authenticated || !req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const privyId = req.user.id;
      let creator = await storage.getCreatorByPrivyId(privyId);
      if (!creator && privyId?.startsWith("0x")) {
        creator = await storage.getCreatorByAddress(privyId);
      }

      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }

      const creatorIdentifier = getCreatorIdentifier(creator, privyId);
      const pending = await storage.getPendingMissionFulfillments(creatorIdentifier);
      return res.json(pending);
    } catch (error) {
      console.error("Fetch pending fulfillments error:", error);
      return res.status(500).json({ error: "Failed to fetch pending fulfillments" });
    }
  });

  // Creator: fulfill a mission reward
  app.post("/api/missions/:missionId/fulfill", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authenticated || !req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { missionId } = req.params;
      const { userId, deliveryNotes, deliveryValue } = req.body || {};

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      const mission = await storage.getMission(missionId);
      if (!mission) {
        return res.status(404).json({ error: "Mission not found" });
      }

      const privyId = req.user.id;
      let creator = await storage.getCreatorByPrivyId(privyId);
      if (!creator && privyId?.startsWith("0x")) {
        creator = await storage.getCreatorByAddress(privyId);
      }

      const identifiers = new Set<string>();
      identifiers.add(privyId);
      if (creator?.address) identifiers.add(creator.address);
      if (creator?.privyId) identifiers.add(creator.privyId);

      if (!identifiers.has(mission.creatorId)) {
        return res.status(403).json({ error: "Not allowed to fulfill this mission" });
      }

      const userMission = await storage.getUserMission(missionId, userId);
      if (!userMission) {
        return res.status(404).json({ error: "User mission not found" });
      }

      const deliveredAt = new Date().toISOString();
      const updated = await storage.updateUserMission(userMission.id, {
        status: "claimed",
        progress: 100,
        claimedAt: deliveredAt,
        rewardStatus: "delivered",
        rewardDeliveredAt: deliveredAt,
        rewardDeliveryNotes: deliveryNotes || null,
        rewardDeliveryValue: deliveryValue || mission.rewardValue || null,
      });

      await storage.createNotification({
        userId,
        type: "mission_reward_delivered",
        title: "Reward delivered",
        message: deliveryValue
          ? `Your reward for "${mission.title}" is ready: ${deliveryValue}`
          : `Your reward for "${mission.title}" has been delivered.`,
        read: false,
      });

      return res.json(updated);
    } catch (error) {
      console.error("Fulfill mission error:", error);
      return res.status(500).json({ error: "Failed to fulfill mission" });
    }
  });

  // Creator missions analytics
  app.get("/api/missions/analytics", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authenticated || !req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const privyId = req.user.id;
      let creator = await storage.getCreatorByPrivyId(privyId);
      if (!creator && privyId?.startsWith("0x")) {
        creator = await storage.getCreatorByAddress(privyId);
      }

      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }

      const identifiers = new Set<string>();
      identifiers.add(privyId);
      if (creator.address) identifiers.add(creator.address);
      if (creator.privyId) identifiers.add(creator.privyId);

      const allMissions = await storage.getMissions();
      const creatorMissions = allMissions.filter((mission) =>
        identifiers.has(mission.creatorId),
      );

      if (!creatorMissions.length) {
        return res.json({
          totalMissions: 0,
          activeMissions: 0,
          totalCompletions: 0,
          totalClaims: 0,
          totalRewardPayouts: 0,
          perMission: [],
        });
      }

      const missionIds = creatorMissions.map((mission) => mission.id);
      const userMissions = await storage.getUserMissionsByMissionIds(missionIds);
      const missionMap = new Map(creatorMissions.map((mission) => [mission.id, mission]));

      let totalCompletions = 0;
      let totalClaims = 0;
      let totalRewardPayouts = 0;
      const perMission: any[] = [];

      const grouped = new Map<string, { completions: number; claims: number }>();
      userMissions.forEach((entry) => {
        const missionStats = grouped.get(entry.missionId) || { completions: 0, claims: 0 };
        if (entry.status === "completed" || entry.status === "claimed") {
          missionStats.completions += 1;
        }
        if (entry.status === "claimed") {
          missionStats.claims += 1;
        }
        grouped.set(entry.missionId, missionStats);
      });

      for (const mission of creatorMissions) {
        const stats = grouped.get(mission.id) || { completions: 0, claims: 0 };
        const rewardValue = Number(mission.rewardValue || 0) || 0;
        if (mission.rewardType === "e1xp") {
          totalRewardPayouts += stats.claims * (rewardValue || 10);
        }
        totalCompletions += stats.completions;
        totalClaims += stats.claims;
        perMission.push({
          id: mission.id,
          title: mission.title,
          type: mission.type,
          status: resolveMissionStatus(mission),
          rewardType: mission.rewardType,
          rewardValue: mission.rewardValue,
          completions: stats.completions,
          claims: stats.claims,
        });
      }

      const activeMissions = creatorMissions.filter(
        (mission) => resolveMissionStatus(mission) === "active",
      ).length;

      return res.json({
        totalMissions: creatorMissions.length,
        activeMissions,
        totalCompletions,
        totalClaims,
        totalRewardPayouts,
        perMission,
      });
    } catch (error) {
      console.error("Mission analytics error:", error);
      return res.status(500).json({ error: "Failed to fetch mission analytics" });
    }
  });

  app.get("/api/challenges/weekly", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authenticated || !req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const privyId = req.user.id;
      const userRecord = await storage.getUserByPrivyId(privyId);
      if (!userRecord) {
        return res.status(404).json({ error: "User not found" });
      }

      let creator = await storage.getCreatorByPrivyId(privyId);
      if (!creator && privyId?.startsWith("0x")) {
        creator = await storage.getCreatorByAddress(privyId);
      }

      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }

      const weekStart = getWeekStartUtc();
      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

      const trades = await db
        .select()
        .from(pointsTransactions)
        .where(
          and(
            eq(pointsTransactions.userId, userRecord.id),
            eq(pointsTransactions.type, "trade"),
            gte(pointsTransactions.createdAt, weekStart),
            lt(pointsTransactions.createdAt, weekEnd),
          ),
        );

      const tradeDays = new Set<string>();
      const coinAddresses = new Set<string>();
      for (const trade of trades) {
        if (trade.createdAt) {
          tradeDays.add(getUtcDayKey(new Date(trade.createdAt)));
        }
        const coinAddress = (trade.metadata as any)?.coinAddress;
        if (coinAddress) {
          coinAddresses.add(String(coinAddress));
        }
      }

      const creatorSet = new Set<string>();
      for (const coinAddress of coinAddresses) {
        try {
          const coin =
            (await storage.getCoinByAddress(coinAddress)) ||
            (coinAddress.toLowerCase() !== coinAddress
              ? await storage.getCoinByAddress(coinAddress.toLowerCase())
              : undefined);
          const creatorWallet = coin?.creatorWallet || coin?.creator_wallet;
          if (creatorWallet) {
            creatorSet.add(String(creatorWallet).toLowerCase());
          } else {
            creatorSet.add(String(coinAddress).toLowerCase());
          }
        } catch (coinError) {
          creatorSet.add(String(coinAddress).toLowerCase());
        }
      }

      const existingRewards = await db
        .select()
        .from(pointsTransactions)
        .where(
          and(
            eq(pointsTransactions.userId, userRecord.id),
            eq(pointsTransactions.type, "weekly_challenge"),
            gte(pointsTransactions.createdAt, weekStart),
          ),
        );

      const weekKey = getUtcDayKey(weekStart);
      const hasTradeReward = existingRewards.some(
        (entry) =>
          (entry.metadata as any)?.challenge === "trade_days" &&
          (entry.metadata as any)?.weekStart === weekKey,
      );
      const hasSupportReward = existingRewards.some(
        (entry) =>
          (entry.metadata as any)?.challenge === "support_creators" &&
          (entry.metadata as any)?.weekStart === weekKey,
      );

      let multiplier = 1;
      const [referral] = await db
        .select()
        .from(referrals)
        .where(eq(referrals.referredUserId, userRecord.id))
        .limit(1);

      if (
        referral &&
        (referral.status === "active" ||
          referral.status === "rewarded" ||
          referral.hasTradedOrCreated)
      ) {
        multiplier = POINTS_REWARDS.REFERRAL_BONUS_MULTIPLIER || 2;
      }

      const tradeCompleted = tradeDays.size >= WEEKLY_CHALLENGE_CONFIG.tradeDays.target;
      const supportCompleted =
        creatorSet.size >= WEEKLY_CHALLENGE_CONFIG.supportCreators.target;

      let tradeRewarded = hasTradeReward;
      let supportRewarded = hasSupportReward;

      if (tradeCompleted && !tradeRewarded) {
        const baseReward = WEEKLY_CHALLENGE_CONFIG.tradeDays.reward;
        const rewardAmount = Math.floor(baseReward * multiplier);

        await db.insert(pointsTransactions).values({
          userId: userRecord.id,
          amount: rewardAmount,
          type: "weekly_challenge",
          description: `Weekly challenge: trade ${WEEKLY_CHALLENGE_CONFIG.tradeDays.target} days`,
          metadata: {
            challenge: "trade_days",
            weekStart: weekKey,
            baseReward,
            multiplier,
            totalReward: rewardAmount,
          },
        });

        await storage.awardPoints(
          creator.id,
          rewardAmount,
          `Weekly challenge: trade ${WEEKLY_CHALLENGE_CONFIG.tradeDays.target} days`,
          "reward",
        );

        tradeRewarded = true;
      }

      if (supportCompleted && !supportRewarded) {
        const baseReward = WEEKLY_CHALLENGE_CONFIG.supportCreators.reward;
        const rewardAmount = Math.floor(baseReward * multiplier);

        await db.insert(pointsTransactions).values({
          userId: userRecord.id,
          amount: rewardAmount,
          type: "weekly_challenge",
          description: `Weekly challenge: support ${WEEKLY_CHALLENGE_CONFIG.supportCreators.target} creators`,
          metadata: {
            challenge: "support_creators",
            weekStart: weekKey,
            baseReward,
            multiplier,
            totalReward: rewardAmount,
          },
        });

        await storage.awardPoints(
          creator.id,
          rewardAmount,
          `Weekly challenge: support ${WEEKLY_CHALLENGE_CONFIG.supportCreators.target} creators`,
          "reward",
        );

        supportRewarded = true;
      }

      res.json({
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        multiplier,
        tradeDays: {
          count: tradeDays.size,
          target: WEEKLY_CHALLENGE_CONFIG.tradeDays.target,
          completed: tradeCompleted,
          rewarded: tradeRewarded,
          reward: {
            base: WEEKLY_CHALLENGE_CONFIG.tradeDays.reward,
            total: Math.floor(WEEKLY_CHALLENGE_CONFIG.tradeDays.reward * multiplier),
          },
        },
        supportCreators: {
          count: creatorSet.size,
          target: WEEKLY_CHALLENGE_CONFIG.supportCreators.target,
          completed: supportCompleted,
          rewarded: supportRewarded,
          reward: {
            base: WEEKLY_CHALLENGE_CONFIG.supportCreators.reward,
            total: Math.floor(WEEKLY_CHALLENGE_CONFIG.supportCreators.reward * multiplier),
          },
        },
      });
    } catch (error) {
      console.error("Weekly challenge error:", error);
      res.status(500).json({ error: "Failed to fetch weekly challenges" });
    }
  });

  app.post("/api/ledger/withdraw", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authenticated || !req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { amountNgn, bankCode, bankAccount, bankName } = req.body as {
        amountNgn?: string | number;
        bankCode?: string;
        bankAccount?: string;
        bankName?: string;
      };

      const amountValue = typeof amountNgn === "string" ? parseFloat(amountNgn) : Number(amountNgn);
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        return res.status(400).json({ error: "Invalid payout amount" });
      }

      const privyId = req.user.id;
      const walletAddress = req.user.wallet?.address || privyId;

      let creator = await storage.getCreatorByPrivyId(privyId);
      if (!creator && walletAddress) {
        creator = await storage.getCreatorByAddress(walletAddress);
      }

      const recipientAddress = creator?.address || walletAddress || privyId;
      const ledger = await storage.getNairaLedgerByAddress(recipientAddress);
      const available = ledger ? parseFloat(ledger.available_ngn || "0") : 0;

      if (!Number.isFinite(available) || available < amountValue) {
        return res.status(400).json({ error: "Insufficient Naira balance" });
      }

      const storedBankCode =
        (creator as any)?.bankCode ?? (creator as any)?.bank_code ?? null;
      const storedBankAccount =
        (creator as any)?.bankAccount ?? (creator as any)?.bank_account ?? null;
      const storedBankName =
        (creator as any)?.bankName ?? (creator as any)?.bank_name ?? null;

      const resolvedBankCode = bankCode || storedBankCode;
      const resolvedBankAccount = bankAccount || storedBankAccount;
      const resolvedBankName = bankName || storedBankName;

      if (!resolvedBankCode || !resolvedBankAccount || !resolvedBankName) {
        return res.status(400).json({ error: "Bank details are required" });
      }

      if (creator && (bankCode || bankAccount || bankName)) {
        await storage.updateCreator(creator.id, {
          bankAccount: resolvedBankAccount,
          bankCode: resolvedBankCode,
          bankName: resolvedBankName,
        });
        creator = {
          ...creator,
          bankAccount: resolvedBankAccount,
          bankCode: resolvedBankCode,
          bankName: resolvedBankName,
        } as typeof creator;
      }

      const creatorRecipientCode =
        (creator as any)?.payoutRecipientCode ?? (creator as any)?.payout_recipient_code;
      let recipientCode = creatorRecipientCode || null;
      if (!recipientCode) {
        const recipientResponse = await createPaystackTransferRecipient({
          type: "nuban",
          name: resolvedBankName,
          account_number: resolvedBankAccount,
          bank_code: resolvedBankCode,
          currency: "NGN",
        });

        recipientCode = recipientResponse?.data?.recipient_code || null;
        if (!recipientCode) {
          throw new Error("Failed to create transfer recipient");
        }

        if (creator) {
          await storage.updateCreator(creator.id, {
            payoutRecipientCode: recipientCode,
          });
        }
      }

      const balanceResponse = await getPaystackBalance();
      const availableBalance = Array.isArray(balanceResponse?.data)
        ? balanceResponse.data.find((item: any) => item.currency === "NGN")?.balance ?? 0
        : balanceResponse?.data?.balance ?? 0;

      const requiredKobo = Math.round(amountValue * 100);
      if (Number(availableBalance) < requiredKobo) {
        return res.status(409).json({
          error: "Treasury balance is low. Please try again shortly.",
        });
      }

      const transferResponse = await initiatePaystackTransfer({
        source: "balance",
        amount: requiredKobo,
        recipient: recipientCode,
        reason: "Creator rewards payout",
      });

      const newAvailable = Math.max(0, available - amountValue).toFixed(2);
      const pending = ledger ? Number(ledger.pending_ngn || 0).toFixed(2) : "0.00";

      await storage.upsertNairaLedger(recipientAddress, newAvailable, pending);
      await storage.createNairaLedgerEntry({
        recipientAddress,
        entryType: "debit",
        amountNgn: amountValue.toFixed(2),
        source: "payout",
        reference: transferResponse?.data?.reference || null,
        metadata: {
          status: "pending",
          bankCode: resolvedBankCode,
          bankAccount: resolvedBankAccount,
          bankName: resolvedBankName,
          recipientCode,
          transfer: transferResponse?.data || null,
        },
      });

      return res.json({
        success: true,
        reference: transferResponse?.data?.reference || null,
      });
    } catch (error) {
      console.error("Ledger withdrawal error:", error);
      res.status(500).json({
        error: "Failed to process withdrawal",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // File upload endpoint
  app.post("/api/upload", handleFileUpload);

  // Create scraped content endpoint (for direct content creation)
  app.post("/api/scraped-content", async (req, res) => {
    try {
      const validatedData = insertScrapedContentSchema.parse(req.body);
      const stored = await storage.createScrapedContent(validatedData);
      res.json(stored);
    } catch (error) {
      console.error("Create scraped content error:", error);
      res.status(400).json({
        error: "Invalid scraped content data",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Scrape URL endpoint
  app.post("/api/scrape", async (req, res) => {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      // Validate URL
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: "Invalid URL format" });
      }

      // Detect platform
      const platformInfo = detectPlatform(url);

      // Scrape content using platform-specific logic
      const scrapedData = await scrapeByPlatform(url, platformInfo.type);

      // Validate and store
      const validatedData = insertScrapedContentSchema.parse(scrapedData);
      const stored = await storage.createScrapedContent(validatedData);

      res.json(stored);
    } catch (error) {
      console.error("Scraping error:", error);

      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNABORTED") {
          return res.status(408).json({
            error: "Request timeout - the page took too long to load",
          });
        }
        if (error.response?.status === 404) {
          return res.status(404).json({
            error: "Page not found - please check the URL is correct",
          });
        }
        if (error.response?.status === 403) {
          return res.status(403).json({
            error: "Access forbidden - this platform blocks automated access",
          });
        }
        if (error.response?.status === 429) {
          return res.status(429).json({
            error:
              "Rate limit exceeded - Instagram and TikTok often block scrapers. Try YouTube, Medium, or blog URLs instead.",
          });
        }
      }

      res.status(500).json({
        error:
          "Failed to scrape content - some platforms block automated access. Try a different URL or platform.",
      });
    }
  });

  // Get all coins
  app.get("/api/coins", async (req, res) => {
    try {
      const coins = await storage.getAllCoins();

      // Add platform detection to each coin based on available fields
      const coinsWithPlatform = coins.map((coin) => {
        let platform = "all";

        // Check multiple sources for URL
        const urls = [coin.image, coin.description, coin.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (urls.includes("youtube.com") || urls.includes("youtu.be")) {
          platform = "youtube";
        } else if (
          urls.includes("warpcast.com") ||
          urls.includes("farcaster")
        ) {
          platform = "farcaster";
        } else if (urls.includes("gitcoin.co")) {
          platform = "gitcoin";
        } else if (
          urls.includes("spotify.com") ||
          urls.includes("open.spotify")
        ) {
          platform = "spotify";
        } else if (urls.includes("tiktok.com")) {
          platform = "tiktok";
        } else if (urls.includes("instagram.com")) {
          platform = "instagram";
        } else if (urls.includes("medium.com")) {
          platform = "medium";
        } else if (urls.includes("giveth.io")) {
          platform = "giveth";
        } else if (urls.includes("twitter.com") || urls.includes("x.com")) {
          platform = "twitter";
        } else if (
          urls.includes("blog") ||
          urls.includes("wordpress") ||
          urls.includes("blogspot")
        ) {
          platform = "blog";
        }

        return {
          ...coin,
          platform,
        };
      });

      res.json(coinsWithPlatform);
    } catch (error: any) {
      console.error("Error fetching coins:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== BLOG POSTS =====
  app.get("/api/blog/posts", async (req, res) => {
    try {
      const category = typeof req.query.category === "string" ? req.query.category : undefined;
      const posts = await storage.listBlogPosts({ category, status: "published" });
      res.json({ posts });
    } catch (error) {
      console.error("Failed to fetch blog posts:", error);
      res.status(500).json({ error: "Failed to fetch blog posts" });
    }
  });

  app.get("/api/blog/posts/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const post = await storage.getBlogPostBySlug(slug);
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }
      res.json(post);
    } catch (error) {
      console.error("Failed to fetch blog post:", error);
      res.status(500).json({ error: "Failed to fetch blog post" });
    }
  });

  // Get pinned coins (ordered by pin_order)
  app.get("/api/coins/pinned", async (req, res) => {
    try {
      const pinnedCoins = await storage.getPinnedCoins();
      res.json(pinnedCoins || []);
    } catch (error: any) {
      console.error("Error fetching pinned coins:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get coins by creator
  app.get("/api/coins/creator/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const coins = await storage.getCoinsByCreator(address);
      res.json(coins);
    } catch (error) {
      console.error("Get creator coins error:", error);
      res.status(500).json({ error: "Failed to fetch creator coins" });
    }
  });

  // Create coin
  app.post("/api/coins", async (req, res) => {
    try {
      console.log("📥 Received coin data:", JSON.stringify(req.body, null, 2));
      const validatedData = insertCoinSchema.parse(req.body);
      console.log("✅ Validation passed:", JSON.stringify(validatedData, null, 2));
      const coin = await storage.createCoin(validatedData);

      // Auto-create or update creator (only if creator address exists)
      const creatorAddress = validatedData.creatorWallet;
      if (!creatorAddress) {
        return res.status(400).json({ error: "Creator address is required" });
      }

      let creator = await storage.getCreatorByAddress(creatorAddress);
      if (!creator) {
        // Create new creator with referral code (will be set when they set username)
        creator = await storage.createCreator({
          address: creatorAddress,
          totalCoins: "1",
          totalVolume: "0",
          followers: "0",
          referralCode: null,
        });
      } else {
        // Update existing creator's coin count
        const newTotalCoins = (parseInt(creator.totalCoins) + 1).toString();
        await storage.updateCreator(creator.id, {
          totalCoins: newTotalCoins,
        });
      }

      // Create in-app notification for coin creation (optional - don't fail if this errors)
      try {
        await storage.createNotification({
          userId: creatorAddress,
          type: "coin_created",
          title: "🪙 Coin Created Successfully!",
          message: `Your coin "${coin.name}" (${coin.symbol}) has been created${coin.address ? " and is now live on the blockchain!" : "!"}`,
          coinAddress: coin.address,
          coinSymbol: coin.symbol,
          read: false,
        });
      } catch (error) {
        console.warn("Failed to create notification:", error);
      }

      // Notify creator about successful coin creation (optional)
      try {
        const { notificationService } = await import("./notification-service");
        await notificationService.notifyCoinCreated(creatorAddress, coin);
      } catch (error) {
        console.warn("Failed to send notification service:", error);
      }

      // Broadcast new coin to the platform once it's live
      if (coin.address && coin.status === "active") {
        try {
          const { notificationService } = await import("./notification-service");
          await notificationService.notifyNewCoinBroadcast(coin, creatorAddress);
          if (isCommunityCoin(coin)) {
            await notificationService.notifyCommunityCoinBroadcast(coin, creatorAddress);
          }
        } catch (error) {
          console.warn("Failed to broadcast new coin:", error);
        }
      }

      // Award E1XP for coin creation (optional - don't fail if table doesn't exist)
      try {
        const e1xpAmount = 100; // Base reward for creating a coin
        await storage.createE1xpReward({
          userId: creatorAddress,
          amount: e1xpAmount.toString(),
          type: "coin_creation",
          title: "🎉 Coin Created!",
          message: `Congratulations! You earned ${e1xpAmount} E1XP for creating ${coin.name} (${coin.symbol})! 🚀`,
          metadata: {
            coinId: coin.id,
            coinAddress: coin.address,
            coinSymbol: coin.symbol,
            coinName: coin.name,
          },
        });

        // Send notification about the claimable reward
        await storage.createNotification({
          userId: creatorAddress,
          type: "reward",
          title: "🎁 E1XP Reward Available!",
          message: `You have ${e1xpAmount} E1XP waiting to be claimed for creating ${coin.symbol}! Claim it now in the Points page.`,
          amount: e1xpAmount.toString(),
          coinAddress: coin.address,
          coinSymbol: coin.symbol,
          read: false,
        });
      } catch (error) {
        console.warn("Failed to create E1XP reward (table may not exist):", error);
      }

      // Record on-chain if coin has been deployed (has address)
      if (coin.address && coin.status === "active") {
        try {
          const { activityTrackerService } = await import(
            "./activity-tracker.js"
          );
          const txHash = await activityTrackerService.recordCoinCreation(
            coin.address as `0x${string}`,
            creatorAddress as `0x${string}`,
            coin.image || "",
            coin.name,
            coin.symbol,
          );

          if (txHash) {
            console.log(`✅ Coin ${coin.symbol} recorded on-chain: ${txHash}`);
          }
        } catch (error) {
          console.error("Failed to record coin creation on-chain:", error);
          // Don't fail the request if on-chain recording fails
        }
      }

      // Send Telegram notification for coin creation (optional)
      try {
        await sendTelegramNotification(
          creatorAddress,
          "New Coin Created! 🪙",
          `Your coin "${coin.name}" (${coin.symbol}) has been created successfully!${coin.address ? "\n\nAddress: " + coin.address : ""}`,
          "coin_created",
          coin,
          undefined, // Stats will be fetched if coin has an address
        );
      } catch (error) {
        console.warn("Failed to send Telegram notification:", error);
      }

      res.json(coin);
    } catch (error) {
      console.error("❌ Create coin error:", error);
      
      // Better error handling for Zod validation errors
      if (error && typeof error === 'object' && 'issues' in error) {
        const zodError = error as any;
        console.error("Validation issues:", JSON.stringify(zodError.issues, null, 2));
        return res.status(400).json({
          error: "Invalid coin data",
          details: zodError.issues,
        });
      }
      
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return res.status(400).json({
        error: "Invalid coin data",
        details: errorMessage,
      });
    }
  });

  // Update coin
  app.patch("/api/coins/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateCoinSchema.parse(req.body);
      const existingCoin = await storage.getCoin(id);
      const coin = await storage.updateCoin(id, validatedData);
      if (!coin) {
        return res.status(404).json({ error: "Coin not found" });
      }

      const wasActive = !!(existingCoin?.status === "active" && existingCoin?.address);
      const isNowActive = !!(coin.status === "active" && coin.address);

      // Create in-app notification when coin becomes active
      if (isNowActive && coin.creatorWallet) {
        await storage.createNotification({
          userId: coin.creatorWallet,
          type: "coin_created",
          title: "🚀 Coin Deployed Successfully!",
          message: `Your coin "${coin.name}" (${coin.symbol}) is now live on the blockchain! Address: ${validatedData.address}`,
          coinAddress: validatedData.address,
          coinSymbol: coin.symbol,
          read: false,
        });

        // Also send Telegram notification
        await sendTelegramNotification(
          coin.creatorWallet,
          "🪙 Coin Deployed Successfully!",
          `Your coin "${coin.name}" (${coin.symbol}) is now live on the blockchain!\n\nAddress: ${validatedData.address}\n\n🚀 Start trading now!`,
          "coin_created",
          coin,
          undefined, // Stats will be fetched if needed
        );

        // Award E1XP for successful deployment
        const deploymentReward = 50; // Bonus for deployment
        await storage.createE1xpReward({
          userId: coin.creatorWallet,
          amount: deploymentReward.toString(),
          type: "coin_creation",
          title: "🚀 Coin Deployed!",
          message: `Amazing! Your coin ${coin.symbol} is now live on the blockchain! You earned ${deploymentReward} E1XP bonus! 💎`,
          metadata: {
            coinId: coin.id,
            coinAddress: validatedData.address,
            coinSymbol: coin.symbol,
            coinName: coin.name,
          },
        });

        // Send notification about deployment reward
        await storage.createNotification({
          userId: coin.creatorWallet,
          type: "reward",
          title: "🎁 Deployment Bonus!",
          message: `You have ${deploymentReward} E1XP waiting for deploying ${coin.symbol} on-chain! Claim it now.`,
          amount: deploymentReward.toString(),
          coinAddress: validatedData.address,
          coinSymbol: coin.symbol,
          read: false,
        });
        // Broadcast new coin to the platform on first activation
        if (!wasActive) {
          try {
            const { notificationService } = await import("./notification-service");
            await notificationService.notifyNewCoinBroadcast(coin, coin.creatorWallet);
            if (isCommunityCoin(coin)) {
              await notificationService.notifyCommunityCoinBroadcast(coin, coin.creatorWallet);
            }
          } catch (error) {
            console.warn("Failed to broadcast new coin activation:", error);
          }
        }
      }

      res.json(coin);
    } catch (error) {
      console.error("Update coin error:", error);
      res.status(400).json({ error: "Invalid update data" });
    }
  });

  // Get coin by address
  app.get("/api/coins/address/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const coin = await storage.getCoinByAddress(address);
      if (!coin) {
        return res.status(404).json({ error: "Coin not found" });
      }
      res.json(coin);
    } catch (error) {
      console.error("Get coin error:", error);
      res.status(500).json({ error: "Failed to fetch coin" });
    }
  });

  // Migrate old data endpoint
  app.post("/api/migrate", async (_req, res) => {
    try {
      const coinsResult = await migrateOldData();
      const { migrateOldRewards } = await import("./migrate-old-data");
      const rewardsResult = await migrateOldRewards();

      res.json({
        coins: coinsResult,
        rewards: rewardsResult,
        summary: {
          totalMigrated: coinsResult.count + rewardsResult.count,
          coinsCount: coinsResult.count,
          rewardsCount: rewardsResult.count,
        },
      });
    } catch (error) {
      console.error("Migration error:", error);
      res.status(500).json({ error: "Migration failed" });
    }
  });

  // Broadcast all existing coins to Telegram
  app.post("/api/telegram/broadcast-coins", async (_req, res) => {
    try {
      const coins = await storage.getAllCoins();

      if (coins.length === 0) {
        return res.json({
          success: true,
          message: "No coins to broadcast",
          broadcasted: 0,
        });
      }

      // Broadcast coins one by one with professional formatting
      let successCount = 0;
      const errors: string[] = [];

      for (const coin of coins) {
        try {
          // Only broadcast coins that have addresses (deployed coins)
          if (coin.address && coin.creatorWallet) {
            await sendTelegramNotification(
              coin.creatorWallet,
              "New Coin Created",
              "",
              "coin_created",
              coin,
              undefined,
            );
            successCount++;

            // Add a small delay between broadcasts to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          errors.push(`${coin.name}: ${errorMsg}`);
          console.error(`Failed to broadcast coin ${coin.name}:`, error);
        }
      }

      res.json({
        success: true,
        message: `Broadcasted ${successCount} out of ${coins.length} coins`,
        broadcasted: successCount,
        total: coins.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error("Broadcast error:", error);
      res.status(500).json({ error: "Broadcast failed" });
    }
  });

  // Create reward endpoint (for tracking platform and trade fees)
  app.post("/api/rewards", async (req, res) => {
    try {
      const validatedData = insertReferralSchema.parse(req.body); // Assuming reward schema is similar to referral for now, adjust if different

      const {
        type,
        coinAddress,
        coinSymbol,
        transactionHash,
        rewardAmount,
        recipientAddress,
        traderAddress,
      } = validatedData;

      if (
        !type ||
        !coinAddress ||
        !coinSymbol ||
        !transactionHash ||
        !rewardAmount ||
        !recipientAddress
      ) {
        return res
          .status(400)
          .json({ error: "Missing required reward fields" });
      }

      const reward = await storage.createReward({
        type,
        coinAddress,
        coinSymbol,
        transactionHash,
        rewardAmount,
        rewardCurrency: "ZORA", // Default currency, adjust if needed
        recipientAddress,
      });

      // Record fees on-chain if activity tracker is configured
      if (traderAddress) {
        const { activityTrackerService } = await import(
          "./activity-tracker.js"
        );

        // Calculate creator and platform fees based on type
        const rewardAmountBigInt = BigInt(rewardAmount);
        let creatorFee = 0n;
        let platformFee = 0n;

        if (type === "platform") {
          platformFee = rewardAmountBigInt;
        } else if (type === "trade") {
          creatorFee = rewardAmountBigInt;
        }

        // Record to blockchain
        await activityTrackerService.recordFees(
          coinAddress as `0x${string}`,
          traderAddress as `0x${string}`,
          creatorFee,
          platformFee,
        );
      }

      // Send earnings notification to creator (for trade fees only, not platform)
      if (type === "trade" && recipientAddress) {
        // Use notification service for randomized earnings messages
        const { notificationService } = await import("./notification-service");
        await notificationService.notifyUserEarnings(recipientAddress, reward);

        // Also send trade notification
        const amount = (parseFloat(reward.rewardAmount) / 1e18).toFixed(4);
        await notificationService.notifyNewTrade(
          recipientAddress,
          reward.coinSymbol,
          'buy',
          `${amount} ${reward.rewardCurrency}`
        );
      }

      res.json(reward);
    } catch (error) {
      console.error("Create reward error:", error);
      res.status(500).json({ error: "Failed to create reward" });
    }
  });

  // Get all rewards
  app.get("/api/rewards", async (_req, res) => {
    try {
      const rewards = await storage.getAllRewards();
      res.json(rewards);
    } catch (error) {
      console.error("Get rewards error:", error);
      res.status(500).json({ error: "Failed to fetch rewards" });
    }
  });

  // Get rewards by coin
  app.get("/api/rewards/coin/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const rewards = await storage.getRewardsByCoin(address);
      res.json(rewards);
    } catch (error) {
      console.error("Get coin rewards error:", error);
      res.status(500).json({ error: "Failed to fetch coin rewards" });
    }
  });

  // Check coin's platform referral status and earnings
  app.get("/api/rewards/coin/:address/status", async (req, res) => {
    try {
      const { address } = req.params;

      // Get coin info
      const coin = await storage.getCoinByAddress(address);
      if (!coin) {
        return res.status(404).json({ error: "Coin not found" });
      }

      // Get all rewards for this coin
      const rewards = await storage.getRewardsByCoin(address);

      // Calculate earnings
      const platformFees = rewards
        .filter((r) => r.type === "platform")
        .reduce((sum, r) => sum + parseFloat(r.rewardAmount) / 1e18, 0);

      const tradeFees = rewards
        .filter((r) => r.type === "trade")
        .reduce((sum, r) => sum + parseFloat(r.rewardAmount) / 1e18, 0);

      const totalEarnings = platformFees + tradeFees;

      // Check if platform referral was likely set (has platform rewards)
      const hasPlatformReferral = rewards.some((r) => r.type === "platform");

      res.json({
        coinAddress: address,
        coinSymbol: coin.symbol,
        coinName: coin.name,
        status: coin.status,
        hasPlatformReferral,
        platformReferralAddress: hasPlatformReferral
          ? rewards.find((r) => r.type === "platform")?.recipientAddress
          : null,
        earnings: {
          total: totalEarnings,
          platform: platformFees,
          trade: tradeFees,
          currency: "ZORA",
        },
        rewardsCount: {
          total: rewards.length,
          platform: rewards.filter((r) => r.type === "platform").length,
          trade: rewards.filter((r) => r.type === "trade").length,
        },
        firstReward: rewards.length > 0 ? rewards.length - 1 : null,
        lastReward: rewards.length > 0 ? rewards[0].createdAt : null,
      });
    } catch (error) {
      console.error("Get coin status error:", error);
      res.status(500).json({ error: "Failed to fetch coin status" });
    }
  });

  // Get rewards by recipient
  app.get("/api/rewards/recipient/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const rewards = await storage.getRewardsByRecipient(address);
      res.json(rewards);
    } catch (error) {
      console.error("Get recipient rewards error:", error);
      res.status(500).json({ error: "Failed to fetch recipient rewards" });
    }
  });

  // Record a new reward (duplicate endpoint - should be consolidated)
  app.post("/api/rewards/record", async (req, res) => {
    try {
      const rewardData = {
        type: req.body.type, // 'platform' or 'trade'
        coinAddress: req.body.coinAddress,
        coinSymbol: req.body.coinSymbol,
        transactionHash: req.body.transactionHash,
        rewardAmount: req.body.rewardAmount, // In wei as string
        rewardCurrency: req.body.rewardCurrency || "ZORA",
        recipientAddress: req.body.recipientAddress,
      };

      const reward = await storage.createReward(rewardData);

      // Send earnings notification if it's a trade reward
      if (rewardData.type === "trade" && rewardData.recipientAddress) {
        const { notificationService } = await import("./notification-service");
        await notificationService.notifyUserEarnings(
          rewardData.recipientAddress,
          reward,
        );

        // Also send trade notification
        const amount = (parseFloat(reward.rewardAmount) / 1e18).toFixed(4);
        await notificationService.notifyNewTrade(
          rewardData.recipientAddress,
          reward.coinSymbol,
          'buy',
          `${amount} ${reward.rewardCurrency}`
        );
      }

      res.json(reward);
    } catch (error) {
      console.error("Create reward error:", error);
      res.status(400).json({ error: "Invalid reward data" });
    }
  });

  // Get all users with earnings stats
  app.get("/api/users", async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      const coins = await storage.getAllCoins();
      const rewards = await storage.getAllRewards();

      // Calculate stats for each user
      const usersWithStats = users.map(user => {
        const userAddress = user.walletAddress?.toLowerCase();

        // Count coins created by this user
        const userCoins = coins.filter(coin => 
          coin.creatorWallet?.toLowerCase() === userAddress
        );

        // Calculate total earnings from rewards
        const userRewards = rewards.filter(reward => 
          reward.recipientAddress?.toLowerCase() === userAddress
        );

        const totalEarnings = userRewards.reduce((sum, reward) => {
          const amount = parseFloat(reward.rewardAmount || '0') / 1e18;
          return sum + amount;
        }, 0);

        return {
          ...user,
          totalCoins: userCoins.length,
          totalEarnings: totalEarnings.toFixed(4),
        };
      });

      res.json(usersWithStats);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Get all creators with earnings stats
  app.get("/api/creators", async (_req, res) => {
    try {
      const creators = await storage.getAllCreators();
      const coins = await storage.getAllCoins();
      const rewards = await storage.getAllRewards();

      // Get follower/following counts and earnings for each creator
      const creatorsWithCounts = await Promise.all(
        creators.map(async (creator) => {
          const followers = await storage.getFollowers(creator.address);
          const following = await storage.getFollowing(creator.address);

          const creatorAddress = creator.address?.toLowerCase();

          // Count coins created by this creator
          const creatorCoins = coins.filter(coin => 
            coin.creatorWallet?.toLowerCase() === creatorAddress
          );

          // Calculate total earnings from rewards
          const creatorRewards = rewards.filter(reward => 
            reward.recipientAddress?.toLowerCase() === creatorAddress
          );

          const totalEarnings = creatorRewards.reduce((sum, reward) => {
            const amount = parseFloat(reward.rewardAmount || '0') / 1e18;
            return sum + amount;
          }, 0);

          return {
            ...creator,
            followerCount: followers.length,
            followingCount: following.length,
            totalCoins: creatorCoins.length,
            totalEarnings: totalEarnings.toFixed(4),
          };
        })
      );

      res.json(creatorsWithCounts);
    } catch (error) {
      console.error("Get creators error:", error);
      res.status(500).json({ error: "Failed to fetch creators" });
    }
  });

  // Get top creators
  app.get("/api/creators/top", async (req, res) => {
    try {
      const creators = await storage.getTopCreators();
      res.json(creators);
    } catch (error) {
      console.error("Get top creators error:", error);
      res.status(500).json({ error: "Failed to fetch top creators" });
    }
  });

  // Get creator by Privy ID
  app.get("/api/creators/privy/:privyId", async (req, res) => {
    try {
      const { privyId } = req.params;

      if (!privyId) {
        return res.status(400).json({ error: "Privy ID is required" });
      }

      const creator = await storage.getCreatorByPrivyId(privyId);

      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }

      res.json(creator);
    } catch (error) {
      console.error("Error fetching creator by privyId:", error);
      res.status(500).json({ error: "Failed to fetch creator" });
    }
  });

  // Get creator by address (kept for backwards compatibility)
  app.get("/api/creators/address/:address", async (req, res) => {
    const { address } = req.params;
    try {
      const creator = await storage.getCreatorByAddress(address);
      if (creator) {
        return res.json(creator);
      }

      const user = await storage.getUserByAddress(address);
      if (user) {
        return res.json({
          id: user.id,
          privyId: user.privyId,
          name: user.displayName || user.username,
          bio: user.bio,
          avatar: user.avatarUrl,
          address: user.walletAddress,
          verified: user.isAdmin ? "true" : "false",
        });
      }

      return res.status(404).json({ error: "Creator not found" });
    } catch (error: any) {
      console.error("Error fetching creator:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get creator by username
  app.get("/api/creators/username/:username", async (req, res) => {
    const { username } = req.params;
    try {
      const creators = await storage.getAllCreators();
      const creator = creators.find(
        (c) => c.name?.toLowerCase() === username.toLowerCase(),
      );
      if (creator) {
        return res.json(creator);
      }

      const user = await storage.getUserByUsername(username);
      if (user) {
        return res.json({
          id: user.id,
          privyId: user.privyId,
          name: user.displayName || user.username,
          bio: user.bio,
          avatar: user.avatarUrl,
          address: user.walletAddress,
          verified: user.isAdmin ? "true" : "false",
        });
      }

      return res.status(404).json({ error: "Creator not found" });
    } catch (error: any) {
      console.error("Error fetching creator:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get admin stats
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const coins = await storage.getAllCoins();
      const creators = await storage.getAllCreators();
      const rewards = await storage.getAllRewards();

      // Calculate total coins
      const totalCoins = coins.length;

      // Calculate total volume from all creator trading activity
      const totalVolume = creators.reduce((sum, creator) => {
        const volume = parseFloat(creator.totalVolume || '0');
        return sum + volume;
      }, 0);

      // Market cap calculation
      // Note: Accurate market cap requires fetching live (price × circulating supply)
      // for each coin from Zora API. For now, using totalVolume as an approximation
      // since volume represents actual value transacted on the platform.
      // Future enhancement: integrate per-coin market cap aggregation from Zora SDK
      const totalMarketCap = totalVolume;

      // Calculate total earnings from rewards
      const totalEarnings = rewards.reduce((sum, reward) => {
        const amount = parseFloat(reward.rewardAmount || '0') / 1e18;
        return sum + amount;
      }, 0);

      // Calculate platform fees and trade fees
      // Platform fees use type 'platform', trade fees use type 'trade'
      const platformFees = rewards
        .filter(r => r.type === 'platform')
        .reduce((sum, reward) => {
          const amount = parseFloat(reward.rewardAmount || '0') / 1e18;
          return sum + amount;
        }, 0);

      const tradeFees = rewards
        .filter(r => r.type === 'trade')
        .reduce((sum, reward) => {
          const amount = parseFloat(reward.rewardAmount || '0') / 1e18;
          return sum + amount;
        }, 0);

      res.json({
        totalCoins,
        totalMarketCap: totalMarketCap.toFixed(2),
        totalVolume: totalVolume.toFixed(2),
        totalEarnings: totalEarnings.toFixed(4),
        platformFees: platformFees.toFixed(4),
        tradeFees: tradeFees.toFixed(4),
      });
    } catch (error) {
      console.error("Get admin stats error:", error);
      res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });

  // Sync creator profile on login (Privy ID-based with legacy support)
  app.post("/api/creators/sync", async (req, res) => {
    try {
      const { privyId, address, email } = req.body;

      if (!privyId) {
        console.error('[Creator Sync] Missing Privy ID');
        return res.status(400).json({ error: "Privy ID is required" });
      }

      console.log('[Creator Sync] Syncing creator:', { privyId, address, email });

      // First, check if creator exists by privyId
      let creator = await storage.getCreatorByPrivyId(privyId);

      if (creator) {
        console.log('[Creator Sync] Found existing creator by privyId:', creator.id);
        // Update existing creator with latest address/email if changed (but preserve walletAddress!)
        const updates: any = {};
        if (address && address !== creator.address) {
          updates.address = address;
        }
        if (email && email !== creator.email) {
          updates.email = email;
        }
        if (Object.keys(updates).length > 0) {
          creator = await storage.updateCreator(creator.id, updates);
          console.log('[Creator Sync] Updated creator with new address/email');
        }
        await ensureUserRecord({
          privyId,
          address: creator.address || address,
          email: creator.email || email,
          fallbackName: creator.name,
        });
        return res.json(creator);
      }

      // If not found by privyId, check by address (legacy creators)
      if (address) {
        creator = await storage.getCreatorByAddress(address);
        if (creator) {
          console.log('[Creator Sync] Found legacy creator by address, backfilling privyId');
          // Backfill privyId for legacy creator (preserve existing walletAddress!)
          creator = await storage.updateCreator(creator.id, { privyId });
          await ensureUserRecord({
            privyId,
            address: creator.address || address,
            email: creator.email || email,
            fallbackName: creator.name,
          });
          return res.json(creator);
        }
      }

      // Generate a default username for email users
      const { getDefaultUsername } = await import("./username-generator");
      const defaultUsername = getDefaultUsername(email, privyId);

      console.log('[Creator Sync] Creating new creator with username:', defaultUsername);

      // Create new creator with privyId (address can be null for email users)
      const creatorData = {
        privyId,
        address: address || null, // Allow null for email-only users
        email: email || null, // Store email for email-only users
        name: defaultUsername, // Auto-generate username for email users
        bio: null,
        avatar: null,
        walletAddress: null, // No payout address for email users initially
        verified: "false",
        totalCoins: "0",
        totalVolume: "0",
        followers: "0",
        referralCode: defaultUsername, // Use generated username as referral code
        points: "100", // Welcome bonus
      };

      creator = await storage.createCreator(creatorData);
      console.log('[Creator Sync] Successfully created new creator:', creator.id, 'with email:', email);

      await ensureUserRecord({
        privyId,
        address: creator.address || address,
        email: creator.email || email,
        fallbackName: creator.name || defaultUsername,
      });

      // Broadcast new creator joined (platform-wide)
      try {
        const { notificationService } = await import("./notification-service");
        await notificationService.notifyNewCreatorJoined(creator);
      } catch (notifyError) {
        console.warn("[Creator Sync] Failed to broadcast new creator:", notifyError);
      }

      // Send welcome notification and E1XP reward
      try {
        const userId = creator.address || creator.id;
        const welcomePoints = 100;

        // Create welcome notification
        await storage.createNotification({
          userId: userId,
          type: 'reward',
          title: '🎁 Welcome to Every1.fun!',
          message: `You earned ${welcomePoints} E1XP as a welcome bonus! Come back daily to earn more points and build your streak! 🔥`,
          amount: welcomePoints.toString(),
          read: false,
        });

        // Create E1XP reward record
        await storage.createE1xpReward({
          userId: userId,
          amount: welcomePoints.toString(),
          type: 'welcome',
          title: '🎉 Welcome Bonus!',
          message: `Welcome to Every1.fun! You've earned ${welcomePoints} E1XP to get started!`,
          metadata: { 
            isWelcomeBonus: true,
            timestamp: new Date().toISOString()
          },
        });

        // Send real-time notification via Socket.IO if user is connected
        const { emitNotificationToUser } = await import('./socket-server');
        emitNotificationToUser(userId, {
          type: 'reward',
          title: '🎁 Welcome to Every1.fun!',
          message: `You earned ${welcomePoints} E1XP as a welcome bonus!`,
          amount: welcomePoints.toString(),
        });

        // Send Telegram notification if address available
        if (address) {
          try {
            await sendTelegramNotification(
              address,
              '🎁 Welcome to Every1.fun!',
              `Welcome! You've earned ${welcomePoints} E1XP points to get started. Come back daily to earn more points and build your streak! 🔥`,
              'reward'
            );
          } catch (telegramError) {
            console.warn('[Creator Sync] Failed to send Telegram welcome notification:', telegramError);
          }
        }

        console.log(`[Creator Sync] Sent welcome notification and ${welcomePoints} E1XP to new user ${userId}`);
      } catch (notificationError) {
        console.error('[Creator Sync] Failed to send welcome notifications:', notificationError);
        // Don't fail the whole request if notifications fail
      }

      res.json(creator);
    } catch (error) {
      console.error("[Creator Sync] Error:", error);
      res.status(500).json({
        error: "Failed to sync creator profile",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Create or update creator (legacy, kept for backwards compatibility)
  app.post("/api/creators", async (req, res) => {
    try {
      const { address } = req.body;

      // Check if creator already exists
      const existingCreator = await storage.getCreatorByAddress(address);
      if (existingCreator) {
        return res.json(existingCreator);
      }

      // Create new creator with username as referral code
      const referralCode = await generateReferralCode(
        req.body.address,
      );
      const creatorData = {
        address: req.body.address,
        name: req.body.name || null,
        bio: req.body.bio || null,
        avatar: req.body.avatar || null,
        verified: req.body.verified || "false",
        totalCoins: req.body.totalCoins || "0",
        totalVolume: req.body.totalVolume || "0",
        followers: req.body.followers || "0",
        referralCode: referralCode,
        points: "0", // Initialize points
      };

      const creator = await storage.createCreator(creatorData);
      res.json(creator);
    } catch (error) {
      console.error("Create creator error:", error);
      res.status(400).json({ error: "Invalid creator data" });
    }
  });

  // Update creator profile
  app.patch("/api/creators/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      console.log('[Update Creator] Updating creator:', { id, updates });

      const creator = await storage.updateCreator(id, updates);

      if (!creator) {
        console.error('[Update Creator] Creator not found:', id);
        return res.status(404).json({ error: "Creator not found" });
      }

      // Update referral code if name was changed - ONLY for wallet users
      // Email-only users keep their auto-generated referral code for uniqueness
      if (updates.name !== undefined && creator && creator.address) {
        const newReferralCode = await generateReferralCode(creator.address);
        await storage.updateCreator(id, {
          referralCode: newReferralCode
        });
        console.log('[Update Creator] Updated referral code for creator:', creator.id, 'to', newReferralCode);
      }

      console.log('[Update Creator] Successfully updated creator:', creator.id);
      res.json(creator);
    } catch (error) {
      console.error("[Update Creator] Error:", error);
      res.status(500).json({ 
        error: "Failed to update creator",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get all comments
  app.get("/api/comments", async (_req, res) => {
    try {
      const comments = await storage.getAllComments();
      res.json(comments);
    } catch (error) {
      console.error("Get comments error:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  // Get comments by coin address
  app.get("/api/comments/coin/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const comments = await storage.getCommentsByCoin(address);
      res.json(comments);
    } catch (error) {
      console.error("Get coin comments error:", error);
      res.status(500).json({ error: "Failed to fetch coin comments" });
    }
  });

  // Create a comment
  app.post("/api/comments", async (req, res) => {
    try {
      const validatedData = insertCommentSchema.parse(req.body);
      const comment = await storage.createComment(validatedData);
      res.json(comment);
    } catch (error) {
      console.error("Create comment error:", error);
      res.status(400).json({ error: "Invalid comment data" });
    }
  });

  // Get notifications for user
  app.get("/api/notifications/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const notifications = await storage.getNotificationsByUser(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // Get unread notifications for user
  app.get("/api/notifications/:userId/unread", async (req, res) => {
    try {
      const { userId } = req.params;
      const notifications = await storage.getUnreadNotificationsByUser(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Get unread notifications error:", error);
      res.status(500).json({ error: "Failed to fetch unread notifications" });
    }
  });

  // Create notification
  app.post("/api/notifications", async (req, res) => {
    try {
      const validatedData = insertNotificationSchema.parse(req.body);
      const notification = await storage.createNotification(validatedData);

      // Send Telegram notification if available
      await sendTelegramNotification(
        notification.userId,
        notification.title,
        notification.message,
        notification.type,
      );

      res.json(notification);
    } catch (error) {
      console.error("Create notification error:", error);
      res.status(400).json({ error: "Invalid notification data" });
    }
  });

  // Mark notification as read
  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      const { id } = req.params;
      const notification = await storage.markNotificationAsRead(id);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      console.error("Mark notification read error:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read
  app.patch("/api/notifications/:userId/read-all", async (req, res) => {
    try {
      const { userId } = req.params;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Mark all notifications read error:", error);
      res
        .status(500)
        .json({ error: "Failed to mark all notifications as read" });
    }
  });

  // Delete notification
  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteNotification(id);
      if (!deleted) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete notification error:", error);
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });

  // Registry endpoints for onchain verification
  const registryService = new RegistryService(base.id);

  // Activity Tracker endpoints for grant verification
  const activityTrackerService = new ActivityTrackerService(base.id);

  // Manually trigger batch registration of unregistered coins
  app.post("/api/registry/sync", async (_req, res) => {
    try {
      const coins = await storage.getAllCoins();
      const unregisteredCoins = coins.filter(
        (coin) =>
          coin.address && coin.status === "active" && !coin.registryTxHash,
      );

      if (unregisteredCoins.length === 0) {
        return res.json({
          message: "No coins to register",
          registered: 0,
        });
      }

      const txHash =
        await registryService.registerCoinsBatch(unregisteredCoins);

      if (txHash) {
        const now = new Date();
        for (const coin of unregisteredCoins) {
          const metadataHash = registryService.generateMetadataHash(coin);
          await storage.updateCoin(coin.id, {
            registryTxHash: txHash,
            metadataHash,
            registeredAt: now,
          });
        }

        return res.json({
          success: true,
          transactionHash: txHash,
          registered: unregisteredCoins.length,
        });
      } else {
        return res.status(500).json({
          error: "Failed to register coins batch",
        });
      }
    } catch (error) {
      console.error("Registry sync error:", error);
      res.status(500).json({ error: "Failed to sync registry" });
    }
  });

  // Get registry statistics
  app.get("/api/registry/stats", async (_req, res) => {
    try {
      const totalRegistered = await registryService.getTotalCoinsRegistered();
      const allCoins = await storage.getAllCoins();
      const registeredInDb = allCoins.filter((c) => c.registryTxHash).length;
      const pendingRegistration = allCoins.filter(
        (c) => c.address && c.status === "active" && !c.registryTxHash,
      ).length;

      res.json({
        totalOnchain: totalRegistered,
        totalInDb: allCoins.length,
        registeredInDb,
        pendingRegistration,
      });
    } catch (error) {
      console.error("Registry stats error:", error);
      res.status(500).json({ error: "Failed to fetch registry stats" });
    }
  });

  // Manually trigger batch recording of unrecorded coins to activity tracker
  app.post("/api/activity-tracker/sync", async (_req, res) => {
    try {
      const coins = await storage.getAllCoins();
      const unrecordedCoins = coins.filter(
        (coin) =>
          coin.address &&
          coin.status === "active" &&
          !coin.activityTrackerTxHash,
      );

      if (unrecordedCoins.length === 0) {
        return res.json({
          success: true,
          message: "No coins to record on activity tracker",
          recorded: 0,
          alreadyRegistered: 0,
        });
      }

      // Ensure all coins have a createdAt timestamp
      for (const coin of unrecordedCoins) {
        if (!coin.createdAt) {
          // Set a reasonable past date for coins without creation dates
          const fallbackDate = new Date("2025-01-01T00:00:00Z");
          await storage.updateCoin(coin.id, {
            createdAt: fallbackDate,
          });
          coin.createdAt = fallbackDate;
          console.log(
            `✅ Set fallback createdAt for ${coin.symbol}: ${fallbackDate.toISOString()}`,
          );
        }
      }

      const results =
        await activityTrackerService.recordCoinBatch(unrecordedCoins);

      const now = new Date();
      let newlyRecorded = 0;
      let alreadyRegistered = 0;
      const failedCoins: string[] = [];

      for (const [coinId, txHash] of results.entries()) {
        await storage.updateCoin(coinId, {
          activityTrackerTxHash: txHash,
          activityTrackerRecordedAt: now,
        });

        // Check if this was already registered (txHash equals coin address)
        const coin = unrecordedCoins.find((c) => c.id === coinId);
        if (coin && txHash === coin.address) {
          alreadyRegistered++;
        } else {
          newlyRecorded++;
        }
      }

      // Track failed coins
      for (const coin of unrecordedCoins) {
        if (!results.has(coin.id)) {
          failedCoins.push(`${coin.symbol} (${coin.address})`);
        }
      }

      const response: any = {
        success: true,
        message: `Processed ${unrecordedCoins.length} coins: ${newlyRecorded} newly recorded, ${alreadyRegistered} already on-chain, ${failedCoins.length} failed`,
        recorded: newlyRecorded,
        alreadyRegistered: alreadyRegistered,
        failed: failedCoins.length,
        total: unrecordedCoins.length,
        transactionHashes: Array.from(results.values()).filter(
          (h) => h.startsWith("0x") && h.length > 42,
        ),
      };

      if (failedCoins.length > 0) {
        response.failedCoins = failedCoins;
        response.troubleshooting = [
          "Check console logs for detailed error messages",
          "Verify PLATFORM_PRIVATE_KEY has sufficient ETH for gas",
          "Ensure VITE_ACTIVITY_TRACKER_ADDRESS is correct",
          "Some coins may already be registered on-chain",
        ];
      }

      return res.json(response);
    } catch (error) {
      console.error("Activity tracker sync error:", error);
      res.status(500).json({ error: "Failed to sync activity tracker" });
    }
  });

  // Get activity tracker statistics
  app.get("/api/activity-tracker/stats", async (_req, res) => {
    try {
      const allCoins = await storage.getAllCoins();
      const recordedInDb = allCoins.filter(
        (c) => c.activityTrackerTxHash,
      ).length;
      const pendingRecording = allCoins.filter(
        (c) => c.address && c.status === "active" && !c.activityTrackerTxHash,
      ).length;

      res.json({
        totalInDb: allCoins.length,
        recordedInDb,
        pendingRecording,
      });
    } catch (error) {
      console.error("Activity tracker stats error:", error);
      res.status(500).json({ error: "Failed to fetch activity tracker stats" });
    }
  });

  // Broadcast all existing coins to Telegram
  app.post("/api/telegram/broadcast-coins", async (_req, res) => {
    try {
      const { broadcastExistingCoins } = await import("./telegram-bot");
      const coins = await storage.getAllCoins();
      await broadcastExistingCoins(coins);

      res.json({
        success: true,
        message: `Broadcasting ${coins.length} coins to connected Telegram users`,
      });
    } catch (error) {
      console.error("Telegram broadcast error:", error);
      res.status(500).json({ error: "Failed to broadcast coins" });
    }
  });

  // Verify if a coin is registered onchain
  app.get("/api/registry/verify/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const isRegistered = await registryService.isPlatformCoin(address);

      const coin = await storage.getCoinByAddress(address);

      res.json({
        address,
        isRegistered,
        registryTxHash: coin?.registryTxHash || null,
        registeredAt: coin?.registeredAt || null,
      });
    } catch (error) {
      console.error("Registry verify error:", error);
      res.status(500).json({ error: "Failed to verify coin" });
    }
  });

  // Get creator coin count from registry
  app.get("/api/registry/creator/:address/count", async (req, res) => {
    try {
      const { address } = req.params;
      const count = await registryService.getCreatorCoinCount(address);

      res.json({
        creator: address,
        onchainCoinCount: count,
      });
    } catch (error) {
      console.error("Registry creator count error:", error);
      res.status(500).json({ error: "Failed to fetch creator coin count" });
    }
  });

  // ===== FOLLOW/UNFOLLOW ENDPOINTS =====

  // Follow a user
  app.post("/api/follows", async (req, res) => {
    try {
      const validatedData = insertFollowSchema.parse(req.body);

      // Check if already following
      const isFollowing = await storage.isFollowing(
        validatedData.followerAddress,
        validatedData.followingAddress,
      );
      if (isFollowing) {
        return res.status(400).json({ error: "Already following this user" });
      }

      const follow = await storage.createFollow(validatedData);

      // Update follower count for the followed user
      let creator = await storage.getCreatorByAddress(
        validatedData.followingAddress,
      );
      if (!creator) {
        creator = await storage.getCreatorByPrivyId(validatedData.followingAddress);
      }
      if (creator) {
        const currentFollowers = parseInt(creator.followers || "0");
        await storage.updateCreator(creator.id, {
          followers: (currentFollowers + 1).toString(),
        });
      }

      try {
        const { notificationService } = await import("./notification-service");
        await notificationService.notifyNewFollower(
          validatedData.followingAddress,
          validatedData.followerAddress,
        );
      } catch (notificationError) {
        console.warn("[Follow] Failed to send follow notification:", notificationError);
      }

      res.json(follow);
    } catch (error) {
      console.error("Create follow error:", error);
      res.status(400).json({ error: "Failed to follow user" });
    }
  });

  // Unfollow a user
  app.delete(
    "/api/follows/:followerAddress/:followingAddress",
    async (req, res) => {
      try {
        const { followerAddress, followingAddress } = req.params;
        const deleted = await storage.deleteFollow(
          followerAddress,
          followingAddress,
        );

        if (deleted) {
          // Update follower count for the unfollowed user
          let creator = await storage.getCreatorByAddress(followingAddress);
          if (!creator) {
            creator = await storage.getCreatorByPrivyId(followingAddress);
          }
          if (creator) {
            const currentFollowers = parseInt(creator.followers || "0");
            await storage.updateCreator(creator.id, {
              followers: Math.max(0, currentFollowers - 1).toString(),
            });
          }
        }

        res.json({ success: deleted });
      } catch (error) {
        console.error("Delete follow error:", error);
        res.status(500).json({ error: "Failed to unfollow user" });
      }
    },
  );

  // Check if following
  app.get(
    "/api/follows/check/:followerAddress/:followingAddress",
    async (req, res) => {
      try {
        const { followerAddress, followingAddress } = req.params;
        const isFollowing = await storage.isFollowing(
          followerAddress,
          followingAddress,
        );
        res.json({ isFollowing });
      } catch (error) {
        console.error("Check follow error:", error);
        res.status(500).json({ error: "Failed to check follow status" });
      }
    },
  );

  // Get followers of a user
  app.get("/api/follows/followers/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const followers = await storage.getFollowers(address);
      res.json(followers || []);
    } catch (error) {
      console.error("Get followers error:", error);
      res.json([]); // Return empty array on error
    }
  });

  // Get users that a user is following
  app.get("/api/follows/following/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const following = await storage.getFollowing(address);
      res.json(following || []);
    } catch (error) {
      console.error("Get following error:", error);
      res.json([]); // Return empty array on error
    }
  });

  // ===== REFERRAL ENDPOINTS =====

  // Generate referral link
  app.post("/api/referrals/generate", async (req, res) => {
    try {
      const { address, privyId } = req.body;

      if (!address && !privyId) {
        return res.status(400).json({ error: "Address or Privy ID is required" });
      }

      // Get or create user - support both email and wallet users
      let user = privyId
        ? await storage.getUserByPrivyId(privyId)
        : address
        ? await storage.getUserByAddress(address)
        : null;

      if (!user) {
        return res.status(404).json({ error: "User not found. Please create an account first." });
      }

      // Generate or get referral code based on user ID
      const referralCode = await generateReferralCode(user.id);

      // Update if referral code changed or is null
      if (!user.referralCode || user.referralCode !== referralCode) {
        const [updated] = await db
          .update(users)
          .set({ referralCode })
          .where(eq(users.id, user.id))
          .returning();
        if (updated) {
          user = updated;
        }
      }

      // Ensure we have a valid referral code
      const finalReferralCode = user.referralCode || referralCode;

      // Use the actual host from the request
      const host = req.get("host") || "localhost:5000";
      const protocol = req.get("x-forwarded-proto") || req.protocol || "http";
      const referralLink = `${protocol}://${host}/?ref=${finalReferralCode}`;

      console.log(`Generated referral link for user ${user.id}: ${referralLink}`);

      res.json({
        referralCode: finalReferralCode,
        referralLink,
      });
    } catch (error) {
      console.error("Generate referral error:", error);
      res.status(500).json({ error: "Failed to generate referral link" });
    }
  });

  // Apply referral (when a new user signs up with a referral code)
  app.post("/api/referrals/apply", async (req, res) => {
    try {
      const { referralCode, referredUserId, referredAddress, referredPrivyId } = req.body;

      if (!referralCode) {
        return res.status(400).json({ error: "Referral code is required" });
      }

      if (!referredUserId && !referredAddress && !referredPrivyId) {
        return res.status(400).json({ error: "Referred user identifier is required" });
      }

      // Find referrer by referral code (from users table)
      const referrer = await storage.getUserByReferralCode(referralCode);
      if (!referrer) {
        return res.status(400).json({ error: "Invalid referral code" });
      }

      // Find referred user
      let referredUser = referredUserId
        ? await storage.getUserById(referredUserId)
        : referredPrivyId
        ? await storage.getUserByPrivyId(referredPrivyId)
        : referredAddress
        ? await storage.getUserByAddress(referredAddress)
        : null;

      if (!referredUser) {
        return res.status(400).json({ error: "Referred user not found" });
      }

      // Check if user is trying to refer themselves
      if (referrer.id === referredUser.id) {
        return res.status(400).json({ error: "Cannot refer yourself" });
      }

      // Check if referral already exists
      const [existingReferral] = await db
        .select()
        .from(referrals)
        .where(
          and(
            eq(referrals.referrerId, referrer.id),
            eq(referrals.referredUserId, referredUser.id)
          )
        )
        .limit(1);

      if (existingReferral) {
        return res.status(400).json({ error: "Referral already exists" });
      }

      // Create referral record
      const [newReferral] = await db
        .insert(referrals)
        .values({
          referrerId: referrer.id,
          referredUserId: referredUser.id,
          status: 'pending',
          totalPointsEarned: 0,
          hasTradedOrCreated: false,
        })
        .returning();

      try {
        const referrerAddress =
          referrer.walletAddress || referrer.privyId || referrer.id;
        const referredAddress =
          referredUser.walletAddress || referredUser.privyId || referredUser.id;

        if (referrerAddress && referredAddress) {
          const existingReferral = await storage.getReferralByAddresses(
            referrerAddress,
            referredAddress,
          );
          if (!existingReferral) {
            await storage.createReferral({
              referrerAddress,
              referredAddress,
              referralCode,
              pointsEarned: POINTS_REWARDS.REFERRAL_SIGNUP.toString(),
            } as any);
          }
        }
      } catch (supabaseError) {
        console.warn("Failed to mirror referral to Supabase:", supabaseError);
      }

      const referrerCreator =
        (referrer.privyId ? await storage.getCreatorByPrivyId(referrer.privyId) : null) ||
        (referrer.walletAddress ? await storage.getCreatorByAddress(referrer.walletAddress) : null);
      const referredCreator =
        (referredUser.privyId ? await storage.getCreatorByPrivyId(referredUser.privyId) : null) ||
        (referredUser.walletAddress ? await storage.getCreatorByAddress(referredUser.walletAddress) : null);

      const referrerNotifyId =
        referrerCreator?.address ||
        referrerCreator?.privyId ||
        referrerCreator?.id ||
        referrer.walletAddress ||
        referrer.privyId ||
        referrer.id;
      const referredNotifyId =
        referredCreator?.address ||
        referredCreator?.privyId ||
        referredCreator?.id ||
        referredUser.walletAddress ||
        referredUser.privyId ||
        referredUser.id;

      // Award signup bonus to referrer
      const pointsToAdd = POINTS_REWARDS.REFERRAL_SIGNUP;
      try {
        await storage.createE1xpReward({
          userId: referrerNotifyId,
          amount: pointsToAdd,
          type: "referral",
          title: "Referral Bonus",
          message: `${referredUser.username || referredUser.email || 'User'} joined using your link. Claim your ${pointsToAdd} E1XP.`,
          metadata: {
            referredUserId: referredUser.id,
            referralCode,
          },
        });
      } catch (rewardError) {
        console.warn("Failed to create referral reward entry:", rewardError);
      }
      const referrerAddressForPoints =
        referrerCreator?.address || referrer.walletAddress || null;
      if (referrerAddressForPoints) {
        await rewardPoints(
          referrerAddressForPoints,
          pointsToAdd,
          "referral",
          `New referral signup! ${referredUser.username || referredUser.email || 'User'} joined using your link!`,
          { referredUserId: referredUser.id }
        );
      }

      const referredName = referredUser.displayName || referredUser.username || referredUser.email?.split('@')[0] || 'New user';
      const referrerName = referrer.displayName || referrer.username || referrer.email?.split('@')[0] || 'Referrer';

      // Send notification to REFERRER (they earned points)
      await storage.createNotification({
        userId: referrerNotifyId,
        type: "reward",
        title: "Referral Successful! 🎉",
        message: `${referredName} joined using your referral link! You earned ${pointsToAdd} E1XP points.`,
        read: false,
      });

      // Send Telegram notification to referrer (if they have a wallet)
      if (referrer.walletAddress) {
        await sendTelegramNotification(
          referrer.walletAddress,
          "Referral Successful! 🎉",
          `${referredName} joined using your referral link! You earned ${pointsToAdd} E1XP points.`,
          "reward",
        );
      }

      // Send notification to REFERRED USER (welcoming them)
      await storage.createNotification({
        userId: referredNotifyId,
        type: "reward",
        title: "Welcome to Every1.fun! 🚀",
        message: `You joined via ${referrerName}'s referral link. Start creating and trading coins now!`,
        read: false,
      });

      // Send Telegram notification to referred user (if they have a wallet)
      if (referredUser.walletAddress) {
        await sendTelegramNotification(
          referredUser.walletAddress,
          "Welcome to Every1.fun! 🚀",
          `You joined via ${referrerName}'s referral link. Start creating and trading coins now!`,
          "reward",
        );
      }

      res.json({
        success: true,
        referral: newReferral,
        pointsEarned: pointsToAdd,
      });
    } catch (error) {
      console.error("Apply referral error:", error);
      res.status(500).json({ error: "Failed to apply referral" });
    }
  });

  // Get referrals by referrer
  app.get("/api/referrals/referrer/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const referrals = await storage.getReferralsByReferrer(address);

      const normalized = (referrals || []).map((referral: any) => {
        const pointsEarned =
          referral.points_earned ??
          referral.pointsEarned ??
          referral.total_points_earned ??
          referral.totalPointsEarned ??
          0;

        return {
          id: referral.id,
          referrerAddress:
            referral.referrer_address ?? referral.referrerAddress ?? referral.referrerId,
          referredAddress:
            referral.referred_address ?? referral.referredAddress ?? referral.referredUserId,
          referralCode: referral.referral_code ?? referral.referralCode ?? null,
          pointsEarned,
          status: referral.status ?? (referral.claimed ? "rewarded" : "pending"),
          hasTradedOrCreated:
            referral.has_traded_or_created ?? referral.hasTradedOrCreated ?? false,
          createdAt: referral.created_at ?? referral.createdAt ?? null,
        };
      });

      res.json(normalized);
    } catch (error) {
      console.error("Get referrals error:", error);
      res.status(500).json({ error: "Failed to get referrals" });
    }
  });

  // Get referrals by code
  app.get("/api/referrals/code/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const referrals = await storage.getReferralsByCode(code);
      res.json(referrals);
    } catch (error) {
      console.error("Get referrals by code error:", error);
      res.status(500).json({ error: "Failed to get referrals" });
    }
  });

  // Get referral stats for a user
  app.get("/api/referrals/stats/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const referrals = await storage.getReferralsByReferrer(address);
      const creator = await storage.getCreatorByAddress(address);

      const totalPoints = parseInt(creator?.points || "0");
      const totalReferrals = referrals.length;
      const referralPoints = referrals.reduce((sum: number, ref: any) => {
        const points =
          ref.points_earned ??
          ref.pointsEarned ??
          ref.total_points_earned ??
          ref.totalPointsEarned ??
          0;
        return sum + parseFloat(points || "0");
      }, 0);

      const activeReferrals = referrals.filter((ref: any) => {
        const status = ref.status ?? (ref.claimed ? "rewarded" : "pending");
        return status === "active" || status === "rewarded" || ref.has_traded_or_created;
      }).length;

      res.json({
        totalPoints,
        totalReferrals,
        activeReferrals,
        referralPoints,
        referrals,
      });
    } catch (error) {
      console.error("Get referral stats error:", error);
      res.status(500).json({ error: "Failed to get referral stats" });
    }
  });

  // Push notification subscription
  app.post("/api/push-subscriptions", async (req, res) => {
    try {
      const { userAddress, subscription } = req.body;

      if (!userAddress || !subscription) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Store subscription in database
      await storage.createPushSubscription({
        userAddress,
        subscription: JSON.stringify(subscription),
        endpoint: subscription.endpoint,
      });

      res.json({ success: true, message: "Push subscription saved" });
    } catch (error) {
      console.error("Push subscription error:", error);
      res.status(500).json({ error: "Failed to save push subscription" });
    }
  });

  // Register admin router (provides /api/admin/* endpoints)
  try {
    const adminRouter = createAdminRouter(storage as any);
    app.use('/api/admin', adminRouter);
  } catch (err) {
    console.warn('Failed to register admin router:', err);
  }

  // ===== E1XP REWARDS ENDPOINTS =====

  // Note: All E1XP endpoints are handled by the E1XP router in routes/e1xp.ts
  // Including: /api/e1xp/status, /api/e1xp/claim-daily, /api/e1xp/rewards/*, etc.

  // ===== PUSH NOTIFICATION ENDPOINTS =====

  app.post("/api/pusher/auth", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authenticated || !req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { socket_id, channel_name } = req.body as {
        socket_id?: string;
        channel_name?: string;
      };

      if (!socket_id || !channel_name) {
        return res.status(400).json({ error: "Missing socket_id or channel_name" });
      }

      const userId = req.user.id;
      const walletAddress = req.user.wallet?.address;

      const allowedChannels = new Set<string>([
        `private-user-${userId}`,
        walletAddress ? `private-user-${walletAddress}` : "",
      ]);

      if (!allowedChannels.has(channel_name)) {
        return res.status(403).json({ error: "Forbidden channel" });
      }

      const auth = authorizeChannel(socket_id, channel_name);
      return res.json(auth);
    } catch (error) {
      console.error("Pusher auth error:", error);
      res.status(500).json({ error: "Failed to authorize Pusher channel" });
    }
  });

  // Subscribe to push notifications
  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const { userId, subscription } = req.body;

      if (!userId || !subscription) {
        return res.status(400).json({ error: "Missing userId or subscription" });
      }

      await storage.createPushSubscription({
        userId,
        endpoint: subscription.endpoint,
        p256dhKey: subscription.keys.p256dh,
        authKey: subscription.keys.auth,
      });

      res.json({ success: true, message: "Push subscription saved" });
    } catch (error) {
      console.error("Push subscribe error:", error);
      res.status(500).json({ error: "Failed to save push subscription" });
    }
  });

  // Pusher auth for private channels
  app.post("/api/pusher/auth", privyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authenticated || !req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { socket_id, channel_name } = req.body as {
        socket_id?: string;
        channel_name?: string;
      };

      if (!socket_id || !channel_name) {
        return res.status(400).json({ error: "Missing socket_id or channel_name" });
      }

      const userId = req.user.id;
      const walletAddress = req.user.wallet?.address;
      const allowedChannels = new Set<string>([
        `private-user-${userId}`,
        ...(walletAddress ? [`private-user-${walletAddress}`] : []),
      ]);

      if (!allowedChannels.has(channel_name)) {
        return res.status(403).json({ error: "Forbidden channel" });
      }

      const authResponse = authorizeChannel(socket_id, channel_name);
      res.json(authResponse);
    } catch (error) {
      console.error("Pusher auth error:", error);
      res.status(500).json({ error: "Failed to authorize channel" });
    }
  });

  // Unsubscribe from push notifications
  app.post("/api/push/unsubscribe", async (req, res) => {
    try {
      const { userId, endpoint } = req.body;

      if (!userId || !endpoint) {
        return res.status(400).json({ error: "Missing userId or endpoint" });
      }

      await storage.deletePushSubscription(userId, endpoint);

      res.json({ success: true, message: "Push subscription removed" });
    } catch (error) {
      console.error("Push unsubscribe error:", error);
      res.status(500).json({ error: "Failed to remove push subscription" });
    }
  });

  // Get login streak for a user
  app.get("/api/login-streak/:identifier", async (req, res) => {
    try {
      const { identifier } = req.params;
      const loginStreak = await storage.getLoginStreak(identifier);
      res.json(loginStreak);
    } catch (error) {
      console.error("Get login streak error:", error);
      res.status(500).json({ error: "Failed to get login streak" });
    }
  });

  // Check for unclaimed daily points and send reminder
  app.post("/api/login-streak/check-unclaimed", async (req, res) => {
    try {
      const { address } = req.body;

      if (!address) {
        return res.status(400).json({ error: "Address is required" });
      }

      const today = new Date().toISOString().split("T")[0];
      const loginStreak = await storage.getLoginStreak(address);

      // If no streak exists, user hasn't claimed their first points
      if (!loginStreak) {
        await storage.createNotification({
          userId: address,
          type: "reward",
          title: "🎁 Claim Your Welcome Bonus!",
          message:
            "You have 10 points waiting for you! Visit the app to claim your first daily login bonus and start your streak.",
          amount: "10",
          read: false,
        });

        await sendTelegramNotification(
          address,
          "🎁 Claim Your Welcome Bonus!",
          "You have 10 points waiting! Visit the app to claim your first daily login bonus and start your streak 🔥",
          "reward",
        );

        return res.json({
          hasUnclaimed: true,
          pointsAvailable: 10,
          isFirstTime: true,
        });
      }

      // If last login was not today, user has unclaimed points
      if (loginStreak.lastLoginDate !== today) {
        const lastLogin = new Date(loginStreak.lastLoginDate || today);
        const todayDate = new Date(today);
        const daysDiff = Math.floor(
          (todayDate.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24),
        );

        let currentStreak = parseInt(loginStreak.currentStreak || "0");
        let pointsAvailable = 10;
        let streakStatus = "";

        if (daysDiff === 1) {
          // Can continue streak
          const nextStreak = currentStreak + 1;
          pointsAvailable = 10 + Math.min(Math.floor(nextStreak / 7) * 5, 50);
          streakStatus = `Continue your ${currentStreak} day streak`;
        } else {
          // Streak will reset
          pointsAvailable = 10;
          streakStatus = `Your ${currentStreak} day streak will reset`;
        }

        await storage.createNotification({
          userId: address,
          type: "reward",
          title: "🔥 Daily Points Available!",
          message: `${streakStatus}! Claim ${pointsAvailable} points now by visiting the app. Don't miss out!`,
          amount: pointsAvailable.toString(),
          read: false,
        });

        await sendTelegramNotification(
          address,
          "🔥 Daily Points Available!",
          `${streakStatus}! Claim ${pointsAvailable} points now 🎁`,
          "reward",
        );

        return res.json({
          hasUnclaimed: true,
          pointsAvailable,
          currentStreak,
          willReset: daysDiff > 1,
        });
      }

      res.json({ hasUnclaimed: false });
    } catch (error) {
      console.error("Check unclaimed error:", error);
      res.status(500).json({ error: "Failed to check unclaimed points" });
    }
  });

  // Check and record daily login
  app.post("/api/login-streak/check-in", async (req, res) => {
    try {
      const { address, privyId } = req.body;

      if (!privyId && !address) {
        return res.status(400).json({ error: "Either privyId or address is required" });
      }

      // Get or create creator
      let creator;
      if (privyId) {
        creator = await storage.getCreatorByPrivyId(privyId);
        if (!creator && address) {
          creator = await storage.getCreatorByAddress(address);
        }

        // If still no creator, create one for email users
        if (!creator) {
          console.log('Creating new creator for privyId:', privyId);
          const { getDefaultUsername } = await import("./username-generator");
          const defaultUsername = getDefaultUsername(req.body.email, privyId);

          creator = await storage.createCreator({
            privyId,
            address: address || null,
            name: defaultUsername,
            points: "0",
          } as any);
        }
      } else if (address) {
        creator = await storage.getCreatorByAddress(address);
        if (!creator) {
          creator = await storage.createCreator({
            address,
            name: `${address.slice(0, 6)}...${address.slice(-4)}`,
            points: "0",
          } as any);
        }
      }

      if (!creator) {
        return res.status(500).json({ error: "Failed to create creator profile" });
      }

      // Use creator's address for wallet users, or use a unique identifier for email users
      // For email users without address, use privyId or id
      const userId = creator.address && !creator.address.startsWith('email_')
        ? creator.address
        : creator.privyId || creator.id;

      const result = await storage.checkInStreak(userId);

      // Create welcome notification for first-time users
      if (result.isFirstLogin) {
        const welcomeNotification = {
          userId,
          type: 'reward',
          title: '🎉 Welcome to creatorland!',
          message: `You've earned ${result.pointsEarned} E1XP as a welcome bonus! Start creating coins, and earning more rewards.`,
          amount: result.pointsEarned.toString(),
          read: false,
        };
        await storage.createNotification(welcomeNotification);

        // Emit real-time notification via Socket.IO
        const { emitNotificationToUser } = await import('./socket-server');
        emitNotificationToUser(userId, welcomeNotification);
      } else if (result.currentStreak > 1) {
        // Create notification for streak achievement
        const streakNotification = {
          userId,
          type: 'streak',
          title: `🔥 ${result.currentStreak} Day Streak!`,
          message: `Amazing! You've earned ${result.pointsEarned} E1XP for your ${result.currentStreak} day streak! Keep it going! 💪`,
          amount: result.pointsEarned.toString(),
          read: false,
        };
        await storage.createNotification(streakNotification);

        // Emit real-time notification via Socket.IO
        const { emitNotificationToUser } = await import('./socket-server');
        emitNotificationToUser(userId, streakNotification);
      }

      res.json({
        ...result,
        isFirstLogin: result.isFirstLogin || false,
        pointsEarned: result.pointsEarned || 0,
        alreadyCheckedIn: false // Explicitly set to false for successful check-ins
      });
    } catch (error: any) {
      console.error("Login streak check-in error:", error);
      if (error.message && error.message.includes("already checked in")) {
        return res.status(200).json({ 
          alreadyCheckedIn: true,
          error: error.message,
          currentStreak: 0, // Return 0 for streak and points if already checked in
          pointsEarned: 0
        });
      }
      res.status(500).json({ error: "Failed to check in" });
    }
  });

  // Get activity events from blockchain
  app.get("/api/blockchain/activity-events", async (req, res) => {
    try {
      const { activityTrackerService } = await import("./activity-tracker.js");
      const fromBlock = req.query.fromBlock
        ? BigInt(req.query.fromBlock as string)
        : 0n;
      const events = await activityTrackerService.getActivityEvents(fromBlock);

      res.json({
        success: true,
        events: events.map((log) => ({
          blockNumber: log.blockNumber?.toString(),
          transactionHash: log.transactionHash,
          args: log.args,
        })),
      });
    } catch (error) {
      console.error("Get activity events error:", error);
      res.status(500).json({ error: "Failed to get activity events" });
    }
  });

  // Blockchain metrics endpoints
  app.get("/api/blockchain/platform-stats", async (_req, res) => {
    try {
      const { activityTrackerService } = await import("./activity-tracker.js");
      const stats = await activityTrackerService.getPlatformStats();

      if (!stats) {
        return res.json({
          totalCoins: 0,
          totalPlatformFees: "0",
          totalCreatorFees: "0",
          totalVolume: "0",
          totalCreators: 0,
        });
      }

      res.json({
        totalCoins: stats.totalCoins.toString(),
        totalPlatformFees: stats.totalPlatformFees.toString(),
        totalCreatorFees: stats.totalCreatorFees.toString(),
        totalVolume: stats.totalVolume.toString(),
        totalCreators: stats.totalCreators.toString(),
      });
    } catch (error) {
      console.error("Get platform stats error:", error);
      res.status(500).json({ error: "Failed to get platform stats" });
    }
  });

  app.get("/api/blockchain/coin-metrics/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const { activityTrackerService } = await import("./activity-tracker.js");
      const metrics = await activityTrackerService.getCoinMetrics(
        address as `0x${string}`,
      );

      if (!metrics) {
        return res.json({
          totalCreatorFees: "0",
          totalPlatformFees: "0",
          currentMarketCap: "0",
          totalVolume: "0",
          tradeCount: "0",
          lastUpdated: "0",
        });
      }

      res.json({
        totalCreatorFees: metrics.totalCreatorFees.toString(),
        totalPlatformFees: metrics.totalPlatformFees.toString(),
        currentMarketCap: metrics.currentMarketCap.toString(),
        totalVolume: metrics.totalVolume.toString(),
        tradeCount: metrics.tradeCount.toString(),
        lastUpdated: metrics.lastUpdated.toString(),
      });
    } catch (error) {
      console.error("Get coin metrics error:", error);
      res.status(500).json({ error: "Failed to get coin metrics" });
    }
  });

  app.get("/api/blockchain/creator-stats/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const { activityTrackerService } = await import("./activity-tracker.js");
      const stats = await activityTrackerService.getCreatorStats(
        address as `0x${string}`,
      );

      if (!stats) {
        return res.json({
          coinsCreated: "0",
          totalFeesEarned: "0",
        });
      }

      res.json({
        coinsCreated: stats.coinsCreated.toString(),
        totalFeesEarned: stats.totalFeesEarned.toString(),
      });
    } catch (error) {
      console.error("Get creator stats error:", error);
      res.status(500).json({ error: "Failed to get creator stats" });
    }
  });

  // === NOTIFICATION SERVICE ENDPOINTS ===

  // Send test notification
  app.post("/api/notifications/send-test", async (req, res) => {
    try {
      const { type, title, message, address } = req.body;

      // Validate required fields
      if (!type || !title || !message) {
        return res.status(400).json({
          error: "Missing required fields: type, title, and message are required"
        });
      }

      let notificationCount = 0;

      if (address === "all") {
        // Send to all users
        try {
          const creators = await storage.getAllCreators();

          for (const creator of creators) {
            try {
              await storage.createNotification({
                userId: creator.address,
                type: type,
                title: title,
                message: message,
                read: false,
              });
              notificationCount++;

              // Try to send Telegram notification, but don't fail if it errors
              try {
                await sendTelegramNotification(creator.address, title, message, type);
              } catch (telegramError) {
                console.error(`Telegram notification failed for ${creator.address}:`, telegramError);
              }
            } catch (notifError) {
              console.error(`Failed to create notification for ${creator.address}:`, notifError);
            }
          }
        } catch (dbError) {
          console.error("Database error fetching creators:", dbError);
          return res.status(500).json({
            error: "Database connection failed. Please check your database configuration.",
            details: dbError instanceof Error ? dbError.message : String(dbError)
          });
        }
      } else if (address) {
        // Send to specific user
        try {
          await storage.createNotification({
            userId: address,
            type: type,
            title: title,
            message: message,
            read: false,
          });
          notificationCount++;

          // Try to send Telegram notification, but don't fail if it errors
          try {
            await sendTelegramNotification(address, title, message, type);
          } catch (telegramError) {
            console.error(`Telegram notification failed for ${address}:`, telegramError);
          }
        } catch (dbError) {
          console.error("Database error creating notification:", dbError);
          return res.status(500).json({
            error: "Database connection failed. Please check your database configuration.",
            details: dbError instanceof Error ? dbError.message : String(dbError)
          });
        }
      } else {
        return res.status(400).json({
          error: "Missing address field. Provide a specific address or 'all' to send to all users."
        });
      }

      res.json({
        success: true,
        message: `Test notification sent successfully to ${notificationCount} user(s)`
      });
    } catch (error) {
      console.error("Send test notification error:", error);
      res.status(500).json({
        error: "Failed to send test notification",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Send all periodic notifications (top creators, earners, coins, points, trades)
  app.post("/api/notifications/send-all", async (_req, res) => {
    try {
      const { notificationService } = await import("./notification-service");
      await notificationService.sendAllPeriodicNotifications();
      res.json({ success: true, message: "All periodic notifications sent" });
    } catch (error) {
      console.error("Send all notifications error:", error);
      res.status(500).json({ error: "Failed to send notifications" });
    }
  });

  // Send top creators notification
  app.post("/api/notifications/top-creators", async (_req, res) => {
    try {
      const { notificationService } = await import("./notification-service");
      await notificationService.sendTopCreatorsNotification();
      res.json({ success: true, message: "Top creators notification sent" });
    } catch (error) {
      console.error("Send top creators notification error:", error);
      res
        .status(500)
        .json({ error: "Failed to send notification" });
    }
  });

  // Send top earners notification (with optional time period)
  app.post("/api/notifications/top-earners", async (req, res) => {
    try {
      const hours = parseInt(req.body.hours) || undefined; // 10, 24, 72, etc.
      const { notificationService } = await import("./notification-service");
      await notificationService.sendTopEarnersNotification(hours);
      res.json({
        success: true,
        message: `Top earners notification sent${hours ? ` for ${hours}h` : ""}`,
      });
    } catch (error) {
      console.error("Send top earners notification error:", error);
      res
        .status(500)
        .json({ error: "Failed to send notification" });
    }
  });

  // Send top coins notification
  app.post("/api/notifications/top-coins", async (_req, res) => {
    try {
      const { notificationService } = await import("./notification-service");
      await notificationService.sendTopCoinsNotification();
      res.json({ success: true, message: "Top coins notification sent" });
    } catch (error) {
      console.error("Send top coins notification error:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // Send trending coins notification
  app.post("/api/notifications/trending-coins", async (_req, res) => {
    try {
      const { checkAndNotifyTrendingCoins } = await import(
        "./trending-notifications"
      );
      await checkAndNotifyTrendingCoins();
      res.json({ success: true, message: "Trending coins notification sent" });
    } catch (error) {
      console.error("Send trending coins notification error:", error);
      res
        .status(500)
        .json({ error: "Failed to send trending coins notification" });
    }
  });

  // Send recent trades notification
  app.post("/api/notifications/recent-trades", async (_req, res) => {
    try {
      const { notificationService } = await import("./notification-service");
      await notificationService.sendRecentTradesNotification();
      res.json({ success: true, message: "Recent trades notification sent" });
    } catch (error) {
      console.error("Send recent trades notification error:", error);
      res
        .status(500)
        .json({ error: "Failed to send recent trades notification" });
    }
  });

  // Remind users about unclaimed daily points
  app.post("/api/notifications/remind-unclaimed-points", async (_req, res) => {
    try {
      const creators = await storage.getAllCreators();
      const today = new Date().toISOString().split("T")[0];
      let reminderCount = 0;

      for (const creator of creators) {
        const loginStreak = await storage.getLoginStreak(creator.address);

        if (!loginStreak || loginStreak.lastLoginDate !== today) {
          const pointsAvailable = loginStreak
            ? 10 +
              Math.min(
                Math.floor(
                  (parseInt(loginStreak.currentStreak || "0") + 1) / 7,
                ) * 5,
                50,
              )
            : 10;

          await storage.createNotification({
            userId: creator.address,
            type: "reward",
            title: "🎁 Don't Forget Your Daily E1XP!",
            message: `You have ${pointsAvailable} E1XP points waiting to be claimed! Visit the app now to keep your streak alive.`,
            amount: pointsAvailable.toString(),
            read: false,
          });
          reminderCount++;
        }
      }

      res.json({
        success: true,
        message: `Sent ${reminderCount} unclaimed points reminders`,
      });
    } catch (error) {
      console.error("Send unclaimed points reminder error:", error);
      res
        .status(500)
        .json({ error: "Failed to send unclaimed points reminders" });
    }
  });

  // Warn users about streak reset
  app.post("/api/notifications/remind-streak-reset", async (_req, res) => {
    try {
      const creators = await storage.getAllCreators();
      const today = new Date().toISOString().split("T")[0];
      let warningCount = 0;

      for (const creator of creators) {
        const loginStreak = await storage.getLoginStreak(creator.address);

        if (loginStreak && loginStreak.lastLoginDate !== today) {
          const lastLogin = new Date(loginStreak.lastLoginDate);
          const todayDate = new Date(today);
          const daysDiff = Math.floor(
            (todayDate.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24),
          );

          if (
            daysDiff === 1 &&
            parseInt(loginStreak.currentStreak || "0") > 3
          ) {
            await storage.createNotification({
              userId: creator.address,
              type: "reward",
              title: "⚠️ Your Streak Is About To Reset!",
              message: `Your ${loginStreak.currentStreak} day streak will reset at midnight! Claim your daily E1XP now to keep it going.`,
              read: false,
            });
            warningCount++;
          }
        }
      }

      res.json({
        success: true,
        message: `Sent ${warningCount} streak reset warnings`,
      });
    } catch (error) {
      console.error("Send streak reset warning error:", error);
      res.status(500).json({ error: "Failed to send streak reset warnings" });
    }
  });

  // Welcome new users
  app.post("/api/notifications/welcome-new-users", async (_req, res) => {
    try {
      const creators = await storage.getAllCreators();
      let welcomeCount = 0;

      for (const creator of creators) {
        const loginStreak = await storage.getLoginStreak(creator.address);

        if (!loginStreak) {
          await storage.createNotification({
            userId: creator.address,
            type: "reward",
            title: "🎉 Welcome to the Platform!",
            message:
              "Claim your 10 E1XP welcome bonus now! Start your daily login streak and earn even more points.",
            amount: "10",
            read: false,
          });
          welcomeCount++;
        }
      }

      res.json({
        success: true,
        message: `Sent ${welcomeCount} welcome notifications`,
      });
    } catch (error) {
      console.error("Send welcome notifications error:", error);
      res.status(500).json({ error: "Failed to send welcome notifications" });
    }
  });

  // Promote new coins
  app.post("/api/notifications/promote-new-coins", async (_req, res) => {
    try {
      const coins = await storage.getAllCoins();
      const recentCoins = coins
        .filter((c) => c.status === "active" && c.address)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 5);

      if (recentCoins.length === 0) {
        return res.json({ success: true, message: "No new coins to promote" });
      }

      const creators = await storage.getAllCreators();
      let notificationCount = 0;

      for (const creator of creators) {
        const coinsList = recentCoins.map((c) => c.symbol).join(", ");

        await storage.createNotification({
          userId: creator.address,
          type: "coin_created",
          title: "🚀 Fresh Coins Just Dropped!",
          message: `Check out these new coins: ${coinsList}. Trade early and earn rewards!`,
          read: false,
        });
        notificationCount++;
      }

      res.json({
        success: true,
        message: `Promoted ${recentCoins.length} coins to ${notificationCount} users`,
      });
    } catch (error) {
      console.error("Promote new coins error:", error);
      res.status(500).json({ error: "Failed to promote new coins" });
    }
  });

  // Get current user session and ensure creator exists
  app.get("/api/auth/session", async (req, res) => {
    if (req.session?.user) {
      res.json({ authenticated: true, user: req.session.user });
    } else {
      res.json({ authenticated: false });
    }
  });

  // Endpoint to ensure user exists in database after Privy auth
  app.post("/api/auth/ensure-user", async (req, res) => {
    try {
      const { address, username } = req.body;

      if (!address) {
        return res.status(400).json({ error: 'Address is required' });
      }

      let creator = await storage.getCreatorByAddress(address);
      const isNewUser = !creator;

      if (!creator) {
        // Auto-create creator for new authenticated user
        creator = await storage.createCreator({
          address: address,
          name: username || null,
          bio: null,
          avatar: null,
          verified: "false",
          totalCoins: "0",
          totalVolume: "0",
          followers: "0",
          points: "100", // Welcome bonus
        } as any);
        console.log(`[AUTH] Created creator record for new user: ${address}`);

        // Send welcome notification with E1XP bonus
        try {
          await storage.createNotification({
            userId: address,
            type: 'reward',
            title: '🎉 Welcome to Every1Fun!',
            message: 'You received 100 E1XP as a welcome bonus! Start creating coins to earn more.',
            amount: '100',
            read: false,
          } as any);
        } catch (notifError) {
          console.error(`[AUTH] Failed to send welcome notification:`, notifError);
        }

        // Create initial login streak
        try {
          const today = new Date().toISOString().split('T')[0];
          await storage.createLoginStreak({
            userId: address,
            currentStreak: "1",
            longestStreak: "1",
            lastLoginDate: today,
            totalPoints: "10",
            loginDates: [today],
          } as any);
        } catch (streakError) {
          console.error(`[AUTH] Failed to create login streak:`, streakError);
        }
      }

      res.json({ success: true, isNewUser, creator });
    } catch (error) {
      console.error('[AUTH] Error ensuring user exists:', error);
      res.status(500).json({ error: 'Failed to ensure user exists' });
    }
  });

  // OG Meta endpoint
  app.get("/api/og-meta/:type/:id", async (req, res) => {
    try {
      const { type, id } = req.params;
      const baseUrl = `${req.protocol}://${req.get("host")}`;

      let meta;
      switch (type) {
        case "profile": {
          let creator = await storage.getCreator(id);
          if (!creator) {
            const user =
              (await storage.getUserById(id)) ||
              (await storage.getUserByUsername(id));
            if (user) {
              creator = {
                id: user.id,
                name: user.displayName || user.username,
                bio: user.bio,
                avatar: user.avatarUrl,
                address: user.walletAddress,
              } as any;
            }
          }

          if (!creator) return res.status(404).json({ error: "Creator not found" });
          meta = generateProfileOGMeta(creator, baseUrl);
          break;
        }
        case "coin": {
          const coin = id.startsWith("0x")
            ? await storage.getCoinByAddress(id)
            : await storage.getCoin(id);
          if (!coin) return res.status(404).json({ error: "Coin not found" });
          meta = generateCoinOGMeta(coin, baseUrl);
          break;
        }
        case "project": {
          const project = await storage.getProjectById(id);
          if (!project) return res.status(404).json({ error: "Project not found" });
          meta = generateProjectOGMeta(project, baseUrl);
          break;
        }
        case "referral": {
          // id is the referral code
          const creator = await storage.getCreatorByReferralCode(id);
          if (!creator) return res.status(404).json({ error: "Referral code not found" });
          meta = generateReferralOGMeta(creator, baseUrl);
          break;
        }
        default:
          return res.status(400).json({ error: "Invalid type" });
      }

      res.json(meta);
    } catch (error) {
      console.error("OG meta error:", error);
      res.status(500).json({ error: "Failed to generate OG meta" });
    }
  });

  // OG Image fallback endpoints (simple redirect to stored image)
  app.get("/api/og/profile/:id", async (req, res) => {
    try {
      const creator = await storage.getCreator(req.params.id);
      const user = creator
        ? null
        : (await storage.getUserById(req.params.id)) ||
          (await storage.getUserByUsername(req.params.id));
      const image =
        creator?.avatar ||
        user?.avatarUrl ||
        "https://i.ibb.co/JRQCPsZK/ev122logo-1-1.png";
      return res.redirect(image);
    } catch (error) {
      return res.redirect("https://i.ibb.co/JRQCPsZK/ev122logo-1-1.png");
    }
  });

  app.get("/api/og/coin/:id", async (req, res) => {
    try {
      const coin = req.params.id.startsWith("0x")
        ? await storage.getCoinByAddress(req.params.id)
        : await storage.getCoin(req.params.id);
      const image =
        coin?.image || "https://i.ibb.co/JRQCPsZK/ev122logo-1-1.png";
      return res.redirect(image);
    } catch (error) {
      return res.redirect("https://i.ibb.co/JRQCPsZK/ev122logo-1-1.png");
    }
  });

  // Share tracking (lightweight placeholder)
  app.post("/api/share/track", privyAuthMiddleware, async (req, res) => {
    try {
      const { shareType, resourceId, platform } = req.body || {};
      const authReq = req as AuthenticatedRequest;

      if (!authReq.authenticated || !authReq.user?.id) {
        return res.json({ success: true, tracked: false });
      }

      const privyId = authReq.user.id;
      const user =
        (await storage.getUserByPrivyId(privyId)) ||
        (authReq.user.wallet?.address
          ? await storage.getUserByAddress(authReq.user.wallet.address)
          : undefined);

      if (!user) {
        return res.json({ success: true, tracked: false });
      }

      await db.insert(shareTracking).values({
        userId: user.id,
        shareType: shareType || "unknown",
        resourceId: resourceId || null,
        platform: platform || null,
        views: 1,
      });

      // Award E1XP points for sharing
      await rewardPoints(
        user.id,
        5,
        "share",
        `Shared ${shareType || "content"}`,
        { shareType, resourceId, platform },
      );

      res.json({ success: true, tracked: true });
    } catch (error) {
      console.error("Share tracking error:", error);
      res.status(500).json({ error: "Failed to track share" });
    }
  });

  // Admin routes - these will be handled by the catch-all route below
  // No need for specific handlers, the React app routing will handle these paths

  // ===== COMMENT REACTIONS =====
  app.post("/api/comments/:commentId/reactions", walletAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { commentId } = req.params;
      const { emoji } = req.body;
      const userAddress = req.userAddress;

      if (!userAddress) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const reaction = await storage.addCommentReaction({
        commentId,
        userAddress,
        emoji,
      });

      res.json(reaction);
    } catch (error: any) {
      console.error("Error adding comment reaction:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/comments/:commentId/reactions/:emoji", walletAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { commentId, emoji } = req.params;
      const userAddress = req.userAddress;

      if (!userAddress) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      await storage.removeCommentReaction(commentId, userAddress, emoji);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error removing comment reaction:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/comments/:commentId/reactions", async (req, res) => {
    try {
      const { commentId } = req.params;
      const reactions = await storage.getCommentReactions(commentId);
      res.json(reactions);
    } catch (error: any) {
      console.error("Error fetching comment reactions:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== USER BADGES =====
  app.get("/api/users/:userId/badges", async (req, res) => {
    try {
      const { userId } = req.params;
      const badges = await storage.getUserBadges(userId);
      res.json(badges);
    } catch (error: any) {
      console.error("Error fetching user badges:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== TRADE HISTORY =====
  app.post("/api/trades", walletAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userAddress = req.userAddress;
      if (!userAddress) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const trade = await storage.recordTrade({
        userAddress,
        ...req.body,
      });

      res.json(trade);
    } catch (error: any) {
      console.error("Error recording trade:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/trades/user/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const trades = await storage.getUserTradeHistory(address, limit);
      res.json(trades);
    } catch (error: any) {
      console.error("Error fetching user trade history:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/trades/coin/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const trades = await storage.getCoinTradeHistory(address, limit);
      res.json(trades);
    } catch (error: any) {
      console.error("Error fetching coin trade history:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== CREATOR STORIES =====
  app.post("/api/stories", walletAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userAddress = req.userAddress;
      if (!userAddress) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const story = await storage.createStory({
        creatorAddress: userAddress,
        ...req.body,
      });

      res.json(story);
    } catch (error: any) {
      console.error("Error creating story:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/stories", async (req, res) => {
    try {
      const { creator } = req.query;
      const stories = await storage.getActiveStories(creator as string | undefined);
      res.json(stories);
    } catch (error: any) {
      console.error("Error fetching stories:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/stories/:storyId/view", walletAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { storyId } = req.params;
      const userAddress = req.userAddress;

      if (!userAddress) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      await storage.recordStoryView(storyId, userAddress);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error recording story view:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/stories/:storyId/views", async (req, res) => {
    try {
      const { storyId } = req.params;
      const views = await storage.getStoryViews(storyId);
      res.json(views);
    } catch (error: any) {
      console.error("Error fetching story views:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== SEARCH HISTORY & AUTOCOMPLETE =====
  app.post("/api/search", async (req, res) => {
    try {
      const search = await storage.recordSearch(req.body);
      res.json(search);
    } catch (error: any) {
      console.error("Error recording search:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/search/popular", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const searches = await storage.getPopularSearches(limit);
      res.json(searches);
    } catch (error: any) {
      console.error("Error fetching popular searches:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/search/history", walletAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userAddress = req.userAddress;
      if (!userAddress) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const history = await storage.getUserSearchHistory(userAddress, limit);
      res.json(history);
    } catch (error: any) {
      console.error("Error fetching search history:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== MESSAGING ENDPOINTS =====
  app.get("/api/messages/unread-count", walletAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userAddress = req.userAddress;
      if (!userAddress) {
        return res.json({ count: 0 });
      }

      // Get all conversations to count total unread messages
      const conversations = await storage.getUserConversations(userAddress.toLowerCase());
      let totalUnread = 0;

      for (const conv of conversations) {
        const unreadCount = await storage.getUnreadMessageCount(userAddress.toLowerCase(), conv.otherUserId);
        totalUnread += unreadCount;
      }

      res.json({ count: totalUnread });
    } catch (error: any) {
      console.error("Error fetching unread message count:", error);
      res.status(500).json({ error: error.message, count: 0 });
    }
  });

  // Register E1XP routes
  const { createE1XPRouter } = await import('./routes/e1xp');
  app.use('/api/e1xp', createE1XPRouter(storage as any));

  // Register Zora explore routes
  const { registerZoraExploreRoutes } = await import('./routes/zora-explore');
  registerZoraExploreRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
