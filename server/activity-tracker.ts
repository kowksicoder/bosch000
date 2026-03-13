import { createPublicClient, createWalletClient, http, parseEther, type Address } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// Activity Tracker Contract ABI
const ACTIVITY_TRACKER_ABI = [
  {
    name: "recordFees",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "coin", type: "address" },
      { name: "trader", type: "address" },
      { name: "creatorFee", type: "uint256" },
      { name: "platformFee", type: "uint256" }
    ],
    outputs: []
  },
  {
    name: "updateMarketCap",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "coin", type: "address" },
      { name: "marketCap", type: "uint256" }
    ],
    outputs: []
  },
  {
    name: "recordTradingActivity",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "coin", type: "address" },
      { name: "trader", type: "address" },
      { name: "activityType", type: "string" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  },
  {
    name: "getCoinMetrics",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "coin", type: "address" }
    ],
    outputs: [
      { name: "totalCreatorFees", type: "uint256" },
      { name: "totalPlatformFees", type: "uint256" },
      { name: "currentMarketCap", type: "uint256" },
      { name: "totalVolume", type: "uint256" },
      { name: "tradeCount", type: "uint256" },
      { name: "lastUpdated", type: "uint256" }
    ]
  },
  {
    name: "getPlatformStats",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "totalCoins", type: "uint256" },
      { name: "totalPlatformFees", type: "uint256" },
      { name: "totalCreatorFees", type: "uint256" },
      { name: "totalVolume", type: "uint256" },
      { name: "totalCreators", type: "uint256" }
    ]
  },
  {
    name: "getCreatorStats",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "creator", type: "address" }
    ],
    outputs: [
      { name: "coinsCreated", type: "uint256" },
      { name: "totalFeesEarned", type: "uint256" }
    ]
  },
  {
    name: "recordCoinCreation",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "coin", type: "address" },
      { name: "creator", type: "address" },
      { name: "contentUrl", type: "string" },
      { name: "name", type: "string" },
      { name: "symbol", type: "string" }
    ],
    outputs: []
  },
  {
    name: "CoinCreated",
    type: "event",
    inputs: [
      { name: "coin", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "contentUrl", type: "string", indexed: false },
      { name: "name", type: "string", indexed: false },
      { name: "symbol", type: "string", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
      { name: "activityId", type: "uint256", indexed: false }
    ]
  },
  {
    name: "ActivityRecorded",
    type: "event",
    inputs: [
      { name: "coin", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "activityId", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false }
    ]
  },
] as const;

export class ActivityTrackerService {
  private activityTrackerAddress: Address | undefined;
  private publicClient: any;
  private walletClient: any;
  private account: any;

  constructor() {
    this.activityTrackerAddress = process.env.VITE_ACTIVITY_TRACKER_ADDRESS as Address | undefined;

    if (!this.activityTrackerAddress) {
      console.warn("⚠️ Activity tracker not configured - on-chain fee tracking disabled");
      return;
    }

    // Setup clients
    const alchemyApiKey = process.env.VITE_ALCHEMY_API_KEY || "o3VW3WRXrsXXMRX3l7jZxLUqhWyZzXBy";
    const rpcUrl = `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;

    this.publicClient = createPublicClient({
      chain: base,
      transport: http(rpcUrl),
    });

    // Setup wallet client if private key is available
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.PLATFORM_PRIVATE_KEY;
    if (privateKey) {
      this.account = privateKeyToAccount(privateKey as `0x${string}`);
      this.walletClient = createWalletClient({
        account: this.account,
        chain: base,
        transport: http(rpcUrl),
      });
      console.log("✅ Activity Tracker service initialized with wallet:", this.account.address);
    } else {
      console.warn("⚠️ No private key configured - on-chain recording will be disabled");
    }
  }

  async recordFees(
    coinAddress: Address,
    traderAddress: Address,
    creatorFee: bigint,
    platformFee: bigint
  ): Promise<string | null> {
    if (!this.activityTrackerAddress || !this.walletClient) {
      console.warn("Activity tracker not configured, skipping on-chain fee recording");
      return null;
    }

    try {
      console.log("📊 Recording fees on-chain:", {
        coin: coinAddress,
        trader: traderAddress,
        creatorFee: creatorFee.toString(),
        platformFee: platformFee.toString()
      });

      const hash = await this.walletClient.writeContract({
        address: this.activityTrackerAddress,
        abi: ACTIVITY_TRACKER_ABI,
        functionName: "recordFees",
        args: [coinAddress, traderAddress, creatorFee, platformFee],
      });

      console.log("✅ Fees recorded on-chain! TX:", hash);
      return hash;
    } catch (error) {
      console.error("❌ Failed to record fees on-chain:", error);
      return null;
    }
  }

  async updateMarketCap(
    coinAddress: Address,
    marketCap: bigint
  ): Promise<string | null> {
    if (!this.activityTrackerAddress || !this.walletClient) {
      console.warn("Activity tracker not configured, skipping market cap update");
      return null;
    }

    try {
      console.log("💰 Updating market cap on-chain:", {
        coin: coinAddress,
        marketCap: marketCap.toString()
      });

      const hash = await this.walletClient.writeContract({
        address: this.activityTrackerAddress,
        abi: ACTIVITY_TRACKER_ABI,
        functionName: "updateMarketCap",
        args: [coinAddress, marketCap],
      });

      console.log("✅ Market cap updated on-chain! TX:", hash);
      return hash;
    } catch (error) {
      console.error("❌ Failed to update market cap on-chain:", error);
      return null;
    }
  }

  async recordTradingActivity(
    coinAddress: Address,
    traderAddress: Address,
    activityType: string,
    amount: bigint
  ): Promise<string | null> {
    if (!this.activityTrackerAddress || !this.walletClient) {
      console.warn("Activity tracker not configured, skipping trading activity");
      return null;
    }

    try {
      const hash = await this.walletClient.writeContract({
        address: this.activityTrackerAddress,
        abi: ACTIVITY_TRACKER_ABI,
        functionName: "recordTradingActivity",
        args: [coinAddress, traderAddress, activityType, amount],
      });

      console.log("✅ Trading activity recorded on-chain! TX:", hash);
      return hash;
    } catch (error) {
      console.error("❌ Failed to record trading activity on-chain:", error);
      return null;
    }
  }

  async getCoinMetrics(coinAddress: Address) {
    if (!this.activityTrackerAddress || !this.publicClient) {
      return null;
    }

    try {
      const result = await this.publicClient.readContract({
        address: this.activityTrackerAddress,
        abi: ACTIVITY_TRACKER_ABI,
        functionName: "getCoinMetrics",
        args: [coinAddress],
      }) as [bigint, bigint, bigint, bigint, bigint, bigint];

      return {
        totalCreatorFees: result[0],
        totalPlatformFees: result[1],
        currentMarketCap: result[2],
        totalVolume: result[3],
        tradeCount: result[4],
        lastUpdated: result[5]
      };
    } catch (error) {
      console.error("❌ Failed to get coin metrics:", error);
      return null;
    }
  }

  async getPlatformStats() {
    if (!this.activityTrackerAddress || !this.publicClient) {
      return null;
    }

    try {
      const result = await this.publicClient.readContract({
        address: this.activityTrackerAddress,
        abi: ACTIVITY_TRACKER_ABI,
        functionName: "getPlatformStats",
        args: [],
      }) as [bigint, bigint, bigint, bigint, bigint];

      return {
        totalCoins: result[0],
        totalPlatformFees: result[1],
        totalCreatorFees: result[2],
        totalVolume: result[3],
        totalCreators: result[4]
      };
    } catch (error) {
      console.error("❌ Failed to get platform stats:", error);
      return null;
    }
  }

  async getCreatorStats(creatorAddress: Address) {
    if (!this.activityTrackerAddress || !this.publicClient) {
      return null;
    }

    try {
      const result = await this.publicClient.readContract({
        address: this.activityTrackerAddress,
        abi: ACTIVITY_TRACKER_ABI,
        functionName: "getCreatorStats",
        args: [creatorAddress],
      }) as [bigint, bigint];

      return {
        coinsCreated: result[0],
        totalFeesEarned: result[1]
      };
    } catch (error) {
      console.error("❌ Failed to get creator stats:", error);
      return null;
    }
  }

  async recordCoinCreation(
    coinAddress: Address,
    creatorAddress: Address,
    contentUrl: string,
    name: string,
    symbol: string
  ): Promise<string | null> {
    if (!this.activityTrackerAddress || !this.walletClient) {
      console.warn("Activity tracker not configured, skipping on-chain recording");
      return null;
    }

    try {
      console.log("📊 Recording coin creation on-chain:", {
        coin: coinAddress,
        creator: creatorAddress,
        name,
        symbol,
        contentUrl
      });

      const hash = await this.walletClient.writeContract({
        address: this.activityTrackerAddress,
        abi: ACTIVITY_TRACKER_ABI,
        functionName: "recordCoinCreation",
        args: [coinAddress, creatorAddress, contentUrl, name, symbol],
      });

      console.log("✅ Coin creation recorded on-chain! TX:", hash);

      // Wait for transaction receipt to confirm
      const receipt = await this.publicClient.waitForTransactionReceipt({ 
        hash,
        confirmations: 1
      });

      console.log("✅ Transaction confirmed! Block:", receipt.blockNumber);

      // Get the activity ID from the event logs
      if (receipt.logs && receipt.logs.length > 0) {
        console.log("📝 Event logs:", receipt.logs.length, "events emitted");
        receipt.logs.forEach((log, index) => {
          console.log(`Event ${index}:`, {
            address: log.address,
            topics: log.topics,
            data: log.data
          });
        });
      }

      return hash;
    } catch (error) {
      console.error("❌ Failed to record coin creation on-chain:", error);
      return null;
    }
  }

  async getTotalActivities() {
    if (!this.activityTrackerAddress || !this.publicClient) {
      return 0;
    }

    try {
      const result = await this.publicClient.readContract({
        address: this.activityTrackerAddress,
        abi: ACTIVITY_TRACKER_ABI,
        functionName: "getTotalActivities",
        args: [],
      }) as bigint;

      return Number(result);
    } catch (error) {
      console.error("❌ Failed to get total activities:", error);
      return 0;
    }
  }

  async getActivityEvents(fromBlock: bigint = 0n) {
    if (!this.activityTrackerAddress || !this.publicClient) {
      return [];
    }

    try {
      const logs = await this.publicClient.getLogs({
        address: this.activityTrackerAddress,
        event: {
          type: 'event',
          name: 'CoinCreated',
          inputs: [
            { name: "coin", type: "address", indexed: true },
            { name: "creator", type: "address", indexed: true },
            { name: "contentUrl", type: "string", indexed: false },
            { name: "name", type: "string", indexed: false },
            { name: "symbol", type: "string", indexed: false },
            { name: "timestamp", type: "uint256", indexed: false },
            { name: "activityId", type: "uint256", indexed: false }
          ]
        },
        fromBlock,
        toBlock: 'latest'
      });

      console.log(`📊 Found ${logs.length} CoinCreated events from block ${fromBlock}`);
      return logs;
    } catch (error) {
      console.error("❌ Failed to get activity events:", error);
      return [];
    }
  }
}

export const activityTrackerService = new ActivityTrackerService();