import { createPublicClient, createWalletClient, http, type Address, type Hash, zeroAddress, parseUnits, encodeAbiParameters, parseAbiParameters, decodeEventLog } from "viem";
import { base, baseSepolia } from "viem/chains";

// Zora Factory contract address (same on Base and Base Sepolia)
const ZORA_FACTORY_ADDRESS = "0x777777751622c0d3258f214F9DF38E35BF45baF3" as const;

// Factory ABI - only the functions we need
const FACTORY_ABI = [
  {
    name: "deploy",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "payoutRecipient", type: "address" },
      { name: "owners", type: "address[]" },
      { name: "uri", type: "string" },
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "poolConfig", type: "bytes" },
      { name: "platformReferrer", type: "address" },
      { name: "postDeployHook", type: "address" },
      { name: "postDeployHookData", type: "bytes" },
      { name: "coinSalt", type: "bytes32" }
    ],
    outputs: [
      { name: "coin", type: "address" },
      { name: "postDeployHookDataOut", type: "bytes" }
    ]
  },
  {
    name: "deployCreatorCoin",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "payoutRecipient", type: "address" },
      { name: "owners", type: "address[]" },
      { name: "uri", type: "string" },
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "poolConfig", type: "bytes" },
      { name: "platformReferrer", type: "address" },
      { name: "coinSalt", type: "bytes32" }
    ],
    outputs: [
      { name: "coin", type: "address" }
    ]
  },
] as const;

// PoolConfiguration Struct (from Zora's contract):
// struct PoolConfiguration {
//   uint8 version;
//   uint16 numPositions;
//   uint24 fee;
//   int24 tickSpacing;
//   uint16[] numDiscoveryPositions;
//   int24[] tickLower;
//   int24[] tickUpper;
//   uint256[] maxDiscoverySupplyShare;
// }

// ZORA Token Address
const ZORA_ADDRESS = "0x1111111111166b7fe7bd91427724b487980afc69" as const;

// Activity Tracker Contract ABI - for recording on-chain platform activities
const ACTIVITY_TRACKER_ABI = [
  {
    name: "recordCoinCreation",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "coin", type: "address" },
      { name: "creator", type: "address" },
      { name: "contentUrl", type: "string" },
      { name: "coinName", type: "string" },
      { name: "coinSymbol", type: "string" }
    ],
    outputs: [
      { name: "activityId", type: "bytes32" }
    ]
  }
] as const;

// Default pool configuration from Zora SDK (ZORA-paired coins)
// Source: @zoralabs/coins-sdk/src/utils/poolConfigUtils.ts
// These are the official default configs used by Zora for Creator Coins
// This same configuration is used by successful coins like:
// - balajis (0xcaf75598b8b9a6e645b60d882845d361f549f5ec)
// - and thousands of other Creator Coins on Base
const COIN_ZORA_PAIR_LOWER_TICK = -138_000;
const COIN_ZORA_PAIR_UPPER_TICK = -81_000;
const COIN_ZORA_PAIR_NUM_DISCOVERY_POSITIONS = 11;
const COIN_ZORA_PAIR_MAX_DISCOVERY_SUPPLY_SHARE = parseUnits("0.05", 18);

// Encode the pool configuration for ZORA-paired Creator Coins
// Based on successful transaction: 0x348d9a91b03a3a8e26e087b431b942dd36e989eb4e00ab8ae220f3346bc2a209
function encodePoolConfig(): `0x${string}` {
  const version = 4; // Version 4 is the current valid version (from working transactions)

  return encodeAbiParameters(
    parseAbiParameters('uint8, address, int24[], int24[], uint16[], uint256[]'),
    [
      version,                                         // version (uint8)
      ZORA_ADDRESS,                                    // currency (address)
      [COIN_ZORA_PAIR_LOWER_TICK],                    // tickLower (int24[])
      [COIN_ZORA_PAIR_UPPER_TICK],                    // tickUpper (int24[])
      [COIN_ZORA_PAIR_NUM_DISCOVERY_POSITIONS],       // numDiscoveryPositions (uint16[])
      [COIN_ZORA_PAIR_MAX_DISCOVERY_SUPPLY_SHARE]     // maxDiscoverySupplyShare (uint256[])
    ]
  );
}

// Default pool config for ZORA-paired Creator Coins (most common type)
const DEFAULT_POOL_CONFIG = encodePoolConfig();

export interface DirectCoinParams {
  name: string;
  symbol: string;
  metadataUri: string;
  creatorAddress: Address;
  platformReferrer?: Address;
  manualPoolConfig?: `0x${string}`; // Optional: provide your own poolConfig
  contentUrl?: string; // Optional: content URL for tracking
  useActivityTracker?: boolean; // Optional: enable on-chain activity tracking
}

export async function getWorkingPoolConfig(chainId: number = base.id): Promise<`0x${string}`> {
  console.log("🔍 Using ZORA-paired Creator Coin poolConfig");
  console.log("📋 Config parameters:", {
    version: 4,
    currency: "ZORA Token",
    lowerTick: COIN_ZORA_PAIR_LOWER_TICK,
    upperTick: COIN_ZORA_PAIR_UPPER_TICK,
    numPositions: COIN_ZORA_PAIR_NUM_DISCOVERY_POSITIONS,
    maxSupplyShare: "5%"
  });

  return DEFAULT_POOL_CONFIG;
}

// Helper function to encode activity tracker hook data
// Note: Zora factory passes coin and creator addresses separately to postDeploy
// Hook data only needs contentUrl, coinName, coinSymbol
function encodeActivityTrackerData(
  contentUrl: string,
  coinName: string,
  coinSymbol: string
): `0x${string}` {
  return encodeAbiParameters(
    parseAbiParameters('string, string, string'),
    [contentUrl, coinName, coinSymbol]
  );
}

export async function deployCreatorCoinDirect(
  params: DirectCoinParams,
  walletClient: any,
  chainId: number = base.id
): Promise<{ hash: Hash; address: Address; createdAt: string }> {

  const chain = chainId === baseSepolia.id ? baseSepolia : base;
  const alchemyApiKey = import.meta.env.VITE_ALCHEMY_API_KEY || "o3VW3WRXrsXXMRX3l7jZxLUqhWyZzXBy";
  const rpcUrl = `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  // Get working poolConfig (use manual if provided, otherwise use empty to trigger factory defaults)
  let poolConfig: `0x${string}`;

  if (params.manualPoolConfig) {
    console.log("✓ Using manually provided poolConfig:", params.manualPoolConfig);
    poolConfig = params.manualPoolConfig;
  } else {
    console.log("🔄 Using default poolConfig (version 4, ZORA-paired)...");
    poolConfig = await getWorkingPoolConfig(chainId);
  }

  console.log("📋 Final poolConfig to use:", {
    hex: poolConfig,
    length: poolConfig.length,
    isValid: poolConfig.startsWith('0x') && poolConfig.length > 2,
    source: params.manualPoolConfig ? 'manual' : 'default'
  });

  // Admin platform referral (20% of fees)
  const platformReferrer = params.platformReferrer || 
    import.meta.env.VITE_ADMIN_REFERRAL_ADDRESS || 
    "0xf25af781c4F1Df40Ac1D06e6B80c17815AD311F7";

  console.log("💰 Platform referrer address:", platformReferrer);

  // Generate unique salt for deterministic deployment
  const salt = `0x${Date.now().toString(16).padStart(64, '0')}` as `0x${string}`;
  console.log("🧂 Generated salt:", salt);

  // Check if activity tracker is enabled and get its address
  // The activityTrackerAddress is determined based on chainId for Sepolia and a placeholder for mainnet.
  // If useActivityTracker is false, it defaults to the zero address.
  const activityTrackerAddress = params.useActivityTracker 
    ? (chainId === baseSepolia.id 
        ? "0x71875350bD4fC5ACF47c4d3d19AEAa1023A63057" as Address 
        : "0x000000000000000000000000000000000000dEaD" as Address) // Placeholder for mainnet
    : "0x0000000000000000000000000000000000000000" as Address;

  // Encode hook data if activity tracker is enabled and not using the zero address placeholder
  const hookData = params.useActivityTracker && activityTrackerAddress !== "0x0000000000000000000000000000000000000000"
    ? encodeActivityTrackerData(
        params.contentUrl || params.metadataUri, // Use contentUrl if provided, otherwise metadataUri
        params.name,
        params.symbol
      )
    : "0x" as `0x${string}`; // Default to empty bytes if no tracker or placeholder

  if (params.useActivityTracker) {
    console.log("📊 On-chain activity tracking:", activityTrackerAddress !== "0x0000000000000000000000000000000000000000" ? "ENABLED" : "DISABLED (using placeholder/zero address)");
    console.log("📍 Post-deploy hook address:", activityTrackerAddress);
  }

  try {
    let hash: Hash;

    // Always use deploy() function for consistency (supports hooks)
    console.log("🔧 Simulating deployment with deploy() function");

    const { request } = await publicClient.simulateContract({
      address: ZORA_FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: "deploy",
      args: [
        params.creatorAddress, // payoutRecipient
        [params.creatorAddress], // owners
        params.metadataUri, // uri
        params.name, // name
        params.symbol, // symbol
        poolConfig, // poolConfig
        platformReferrer as Address, // platformReferrer
        activityTrackerAddress, // postDeployHook
        hookData, // postDeployHookData
        salt // coinSalt
      ],
      account: params.creatorAddress,
    });

    console.log("✅ Contract simulation successful");
    hash = await walletClient.writeContract(request);
    console.log("✅ Transaction sent! Hash:", hash);

    // Wait for transaction
    console.log("⏳ Waiting for transaction confirmation...");
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log("✅ Transaction confirmed! Receipt:", receipt);

    // Decode the coin creation event to extract the deployed coin address
    // The deploy() function supports both CreatorCoinCreated and CoinCreatedV4 events
    let coinAddress: Address | undefined;

    for (const log of receipt.logs) {
      try {
        const decodedLog = decodeEventLog({
          abi: FACTORY_ABI,
          data: log.data,
          topics: log.topics,
        });

        // Check for both event types (CreatorCoinCreated and CoinCreatedV4)
        if (decodedLog.eventName === "CreatorCoinCreated" || decodedLog.eventName === "CoinCreatedV4") {
          coinAddress = (decodedLog.args as any).coin;
          console.log(`✅ Decoded ${decodedLog.eventName} event`);
          console.log("📍 Deployed coin address:", coinAddress);
          break;
        }
      } catch (error) {
        continue;
      }
    }

    if (!coinAddress) {
      throw new Error("Could not find coin address in transaction logs.");
    }

    console.log("✅ Coin deployed successfully:", coinAddress);

    // Get the blockchain timestamp from the transaction receipt
    const block = await publicClient.getBlock({ 
      blockNumber: receipt.blockNumber 
    });
    const createdAt = new Date(Number(block.timestamp) * 1000).toISOString();

    return {
      hash,
      address: coinAddress,
      createdAt // Include the blockchain timestamp
    };
  } catch (error) {
    console.error("❌ Contract call failed:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    throw error;
  }
}