import type { Address, WalletClient, PublicClient, Hash } from "viem";
import { base, baseSepolia } from "viem/chains";
import { encodeAbiParameters, parseAbiParameters, parseUnits, decodeEventLog, keccak256 } from "viem";

/**
 * Creates a coin using DIRECT CONTRACT CALLS on Base Sepolia testnet
 * Uses ETH as backing currency (only supported currency on Base Sepolia)
 * No SDK methods - pure contract interaction
 */

// Zora Factory contract address (same on all chains)
const ZORA_FACTORY_ADDRESS = "0x777777751622c0d3258f214F9DF38E35BF45baF3" as const;

// ETH address (zero address represents native ETH) - only for Base Mainnet
const ETH_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

// ZORA token address - required for Base Sepolia
const ZORA_ADDRESS = "0x1111111111166b7fe7bd91427724b487980afc69" as const;

// Factory ABI - deployCreatorCoin function and CreatorCoinCreated event
const FACTORY_ABI = [
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
  {
    name: "CreatorCoinCreated",
    type: "event",
    anonymous: false,
    inputs: [
      { indexed: true, name: "caller", type: "address" },
      { indexed: true, name: "payoutRecipient", type: "address" },
      { indexed: true, name: "platformReferrer", type: "address" },
      { indexed: false, name: "currency", type: "address" },
      { indexed: false, name: "uri", type: "string" },
      { indexed: false, name: "name", type: "string" },
      { indexed: false, name: "symbol", type: "string" },
      { indexed: false, name: "coin", type: "address" },
      { 
        indexed: false, 
        name: "poolKey", 
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" }
        ]
      },
      { indexed: false, name: "poolKeyHash", type: "bytes32" },
      { indexed: false, name: "version", type: "string" }
    ]
  },
  {
    name: "CoinCreatedV4",
    type: "event",
    anonymous: false,
    inputs: [
      { indexed: true, name: "caller", type: "address" },
      { indexed: true, name: "payoutRecipient", type: "address" },
      { indexed: true, name: "platformReferrer", type: "address" },
      { indexed: false, name: "currency", type: "address" },
      { indexed: false, name: "uri", type: "string" },
      { indexed: false, name: "name", type: "string" },
      { indexed: false, name: "symbol", type: "string" },
      { indexed: false, name: "coin", type: "address" },
      { 
        indexed: false, 
        name: "poolKey", 
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" }
        ]
      },
      { indexed: false, name: "poolKeyHash", type: "bytes32" },
      { indexed: false, name: "version", type: "string" }
    ]
  }
] as const;

// ETH-paired pool configuration (Base Mainnet only)
const ETH_COIN_PAIR_LOWER_TICK = -138_000;
const ETH_COIN_PAIR_UPPER_TICK = -81_000;

// ZORA-paired pool configuration (Base Sepolia and Base Mainnet)
// These tick values match the official Zora SDK defaults
// Both ETH and ZORA pools use the same tick range, only currency differs
const ZORA_COIN_PAIR_LOWER_TICK = -138_000;
const ZORA_COIN_PAIR_UPPER_TICK = -81_000;

// Common pool settings
const COIN_PAIR_NUM_DISCOVERY_POSITIONS = 11;
const COIN_PAIR_MAX_DISCOVERY_SUPPLY_SHARE = parseUnits("0.05", 18); // 5%

/**
 * Encode pool configuration based on network
 * - Base Sepolia: ZORA token pairing (only supported option)
 * - Base Mainnet: ZORA token pairing (recommended, same as production coins)
 */
function encodePoolConfig(chainId: number): `0x${string}` {
  const version = 4; // Version 4 is current
  
  // Use ZORA token pairing for both networks (Base Sepolia requires it, Base Mainnet uses it for consistency)
  const currency = ZORA_ADDRESS;
  const lowerTick = ZORA_COIN_PAIR_LOWER_TICK;
  const upperTick = ZORA_COIN_PAIR_UPPER_TICK;

  console.log(`🔧 Using ZORA as paired currency for chain ${chainId}`);
  console.log(`📊 Tick range: ${lowerTick} to ${upperTick}`);

  return encodeAbiParameters(
    parseAbiParameters('uint8, address, int24[], int24[], uint16[], uint256[]'),
    [
      version,                                       // version (uint8)
      currency,                                      // currency (ZORA token)
      [lowerTick],                                   // tickLower (int24[])
      [upperTick],                                   // tickUpper (int24[])
      [COIN_PAIR_NUM_DISCOVERY_POSITIONS],          // numDiscoveryPositions (uint16[])
      [COIN_PAIR_MAX_DISCOVERY_SUPPLY_SHARE]        // maxDiscoverySupplyShare (uint256[])
    ]
  );
}

export interface CreateCoinParams {
  creator: Address;
  name: string;
  symbol: string;
  metadataUri: string;
  platformReferrer?: Address;
  startingMarketCap?: "LOW" | "MEDIUM" | "HIGH";
}

export interface CreateCoinResult {
  hash: Hash;
  address: Address;
  createdAt: string;
}

/**
 * Creates a coin on Base Sepolia using DIRECT CONTRACT CALL (no SDK)
 * 
 * @param params - Coin creation parameters
 * @param walletClient - Viem wallet client for signing transactions
 * @param publicClient - Viem public client for reading blockchain state
 * @returns Transaction hash, deployed coin address, and creation timestamp
 */
export async function createCoinOnBaseSepolia(
  params: CreateCoinParams,
  walletClient: WalletClient,
  publicClient: PublicClient
): Promise<CreateCoinResult> {
  console.log("🪙 Creating coin with params:", params);

  const { deployCreatorCoinDirect } = await import("./zora-factory");

  // Check network preference from localStorage (set by admin)
  const networkPreference = localStorage.getItem('ADMIN_NETWORK_PREFERENCE') as 'sepolia' | 'mainnet' | null;
  const chainId = networkPreference === 'mainnet' ? base.id : baseSepolia.id;

  console.log(`📡 Using network: ${networkPreference === 'mainnet' ? 'Base Mainnet' : 'Base Sepolia'} (Chain ID: ${chainId})`);

  // Check ZORA token balance for the creator wallet
  const ERC20_ABI = [{
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }]
  }] as const;

  try {
    console.log("💰 Checking ZORA token balance for:", params.creator);
    const zoraBalance = await publicClient.readContract({
      address: ZORA_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [params.creator]
    });

    console.log("💰 ZORA balance:", zoraBalance.toString());

    if (zoraBalance === BigInt(0)) {
      throw new Error(
        `❌ No ZORA tokens available!\n\n` +
        `Your wallet ${params.creator} needs ZORA tokens to create a coin on Base Sepolia.\n\n` +
        `Please get test ZORA tokens from:\n` +
        `🔗 https://bridge.zora.energy/ (Bridge from Ethereum Sepolia)\n` +
        `🔗 Or use a faucet to get Sepolia ETH first, then bridge to ZORA\n\n` +
        `Note: Gasless deployment still requires ZORA tokens as the pool backing currency.`
      );
    }

    // Generate deterministic salt using stable parameters
    // This allows reproducible addresses for the same inputs (name, symbol, creator, metadataUri)
    const coinSalt = keccak256(
      encodeAbiParameters(
        parseAbiParameters('address, string, string, string'),
        [params.creator, params.name, params.symbol, params.metadataUri]
      )
    );
    
    console.log("🔐 Generated deterministic coin salt:", coinSalt);

    // Simulate the contract call first to catch errors
    console.log("🔧 Simulating contract call...");

    const { request } = await publicClient.simulateContract({
      address: ZORA_FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: "deployCreatorCoin",
      args: [
        params.creator,              // payoutRecipient
        [params.creator],            // owners array
        params.metadataUri,          // uri
        params.name,                 // name
        params.symbol,               // symbol
        encodePoolConfig(chainId),   // poolConfig (ZORA on Sepolia, ETH on Mainnet)
        params.platformReferrer as Address || "0xf25af781c4F1Df40Ac1D06e6B80c17815AD311F7", // platformReferrer
        coinSalt                     // coinSalt (for deterministic deployment)
      ],
      account: params.creator,
      chain: chainId === baseSepolia.id ? baseSepolia : base,
    });

    console.log("✅ Contract simulation successful");
    console.log("📤 Sending transaction to factory contract...");

    // Execute the transaction
    const hash = await walletClient.writeContract(request);

    console.log("✅ Transaction sent! Hash:", hash);
    console.log("⏳ Waiting for confirmation...");

    // Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash,
      confirmations: 1 
    });

    console.log("✅ Transaction confirmed!");

    // Decode the coin creation event to extract the deployed coin address
    // Support both CreatorCoinCreated and CoinCreatedV4 events
    let coinAddress: Address | undefined;

    for (const log of receipt.logs) {
      try {
        const decodedLog = decodeEventLog({
          abi: FACTORY_ABI,
          data: log.data,
          topics: log.topics,
        });

        // Check if this is either CreatorCoinCreated or CoinCreatedV4 event
        if (decodedLog.eventName === "CreatorCoinCreated" || decodedLog.eventName === "CoinCreatedV4") {
          coinAddress = (decodedLog.args as any).coin;
          console.log(`✅ Decoded ${decodedLog.eventName} event`);
          console.log("📍 Deployed coin address:", coinAddress);
          break;
        }
      } catch (error) {
        // Skip logs that don't match our ABI - this is expected for other contract events
        continue;
      }
    }

    if (!coinAddress) {
      throw new Error("Failed to extract coin address from transaction logs - neither CreatorCoinCreated nor CoinCreatedV4 event found");
    }

    console.log("🎉 Coin deployed at address:", coinAddress);

    // Get blockchain timestamp
    const block = await publicClient.getBlock({ 
      blockNumber: receipt.blockNumber 
    });
    const createdAt = new Date(Number(block.timestamp) * 1000).toISOString();

    console.log("✅ Coin creation successful!");
    console.log("📍 Address:", coinAddress);
    console.log("⏰ Created at:", createdAt);
    console.log("🔗 View on explorer:", 
      chainId === baseSepolia.id 
        ? `https://sepolia.basescan.org/address/${coinAddress}` 
        : `https://basescan.org/address/${coinAddress}`
    );

    return {
      hash,
      address: coinAddress,
      createdAt,
    };
  } catch (error) {
    console.error("❌ Coin creation failed:", error);

    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }

    throw error;
  }
}

/**
 * Generates an automatic coin symbol based on platform, channel name, or content
 * Users cannot edit this - it's auto-generated from the source
 * 
 * @param data - Scraped content data with platform info
 * @returns Auto-generated symbol (3-10 characters, uppercase, alphanumeric)
 */
export function generateCoinSymbol(data: {
  platform?: string;
  author?: string;
  title?: string;
  url?: string;
}): string {
  // Priority order: author name > channel/account name from URL > title

  // 1. Try to use author/channel name if available
  if (data.author) {
    const symbol = data.author
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
      .trim()
      .split(/\s+/) // Split on whitespace
      .filter(word => word.length > 0)
      .slice(0, 3) // Take first 3 words max
      .map(word => word[0]) // First letter of each word
      .join('')
      .toUpperCase();

    if (symbol.length >= 3) {
      return symbol.slice(0, 10); // Max 10 characters
    }
  }

  // 2. Try to extract username/channel from URL
  if (data.url) {
    const urlPatterns = [
      /youtube\.com\/@([^\/\?]+)/i, // YouTube @username
      /youtube\.com\/c\/([^\/\?]+)/i, // YouTube /c/channel
      /youtube\.com\/channel\/([^\/\?]+)/i, // YouTube /channel/ID
      /twitter\.com\/([^\/\?]+)/i, // Twitter @username
      /x\.com\/([^\/\?]+)/i, // X.com @username  
      /instagram\.com\/([^\/\?]+)/i, // Instagram @username
      /tiktok\.com\/@([^\/\?]+)/i, // TikTok @username
      /medium\.com\/@([^\/\?]+)/i, // Medium @username
      /substack\.com\/([^\/\?]+)/i, // Substack username
    ];

    for (const pattern of urlPatterns) {
      const match = data.url.match(pattern);
      if (match && match[1]) {
        const username = match[1]
          .replace(/[^a-zA-Z0-9]/g, '')
          .toUpperCase()
          .slice(0, 10);

        if (username.length >= 3) {
          return username;
        }
      }
    }
  }

  // 3. Fall back to title-based symbol
  if (data.title) {
    const words = data.title
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0);

    if (words.length >= 2) {
      // Multi-word: take first letter of each word
      const symbol = words
        .slice(0, 5)
        .map(w => w[0])
        .join('')
        .toUpperCase();
      return symbol.slice(0, 10);
    } else if (words.length === 1) {
      // Single word: take first 3-5 characters
      return words[0].slice(0, 5).toUpperCase();
    }
  }

  // 4. Last resort: platform-based symbol
  const platformMap: Record<string, string> = {
    youtube: "YT",
    twitter: "TW",
    instagram: "IG",
    tiktok: "TT",
    medium: "MDM",
    substack: "SUB",
    spotify: "SPT",
  };

  const platformSymbol = data.platform ? platformMap[data.platform.toLowerCase()] : null;

  if (platformSymbol) {
    return platformSymbol + Math.floor(Math.random() * 1000); // e.g., YT123
  }

  // Final fallback
  return "COIN" + Math.floor(Math.random() * 1000);
}