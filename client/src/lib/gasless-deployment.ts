import type { Address, Hash } from 'viem';
import type { SmartAccountClient } from 'permissionless';
import { encodeFunctionData, encodeAbiParameters, parseAbiParameters } from 'viem';
import { base, baseSepolia } from 'viem/chains';
// No Zora SDK needed - using direct contract calls

import { createPublicClient, http } from 'viem';

// Zora Factory contract address (same on both Base and Base Sepolia)
const ZORA_FACTORY_ADDRESS = "0x777777751622c0d3258f214F9DF38E35BF45baF3" as const;

// Factory ABI - deployCreatorCoin function
const DEPLOY_CREATOR_COIN_ABI = [{
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
}] as const;

// ETH Pool Config Constants
const ETH_COIN_PAIR_LOWER_TICK = -887220;
const ETH_COIN_PAIR_UPPER_TICK = 887220;
const ETH_COIN_PAIR_NUM_DISCOVERY_POSITIONS = 1;
const ETH_COIN_PAIR_MAX_DISCOVERY_SUPPLY_SHARE = BigInt("1000000000000000000"); // 1e18 (100%)
const ETH_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Encodes pool config for ETH-paired coins using proper ABI encoding
 */
function encodeETHPoolConfig(): `0x${string}` {
  // Use viem's encodeAbiParameters for correct ABI encoding
  // Format: (uint8 version, address currency, int24[] tickLower, int24[] tickUpper, uint16[] numDiscoveryPositions, uint256[] maxDiscoverySupplyShare)
  const encoded = encodeAbiParameters(
    parseAbiParameters('uint8, address, int24[], int24[], uint16[], uint256[]'),
    [
      4, // version
      ETH_ADDRESS as Address, // currency (ETH)
      [ETH_COIN_PAIR_LOWER_TICK], // tickLower array
      [ETH_COIN_PAIR_UPPER_TICK], // tickUpper array
      [ETH_COIN_PAIR_NUM_DISCOVERY_POSITIONS], // numDiscoveryPositions array
      [ETH_COIN_PAIR_MAX_DISCOVERY_SUPPLY_SHARE], // maxDiscoverySupplyShare array
    ]
  );

  return encoded;
}

/**
 * Generate deterministic salt for coin deployment
 */
function generateCoinSalt(creator: Address, name: string, symbol: string, metadataUri: string): `0x${string}` {
  const timestamp = Date.now().toString(16).padStart(16, '0');
  const hash = `${creator}${name}${symbol}${metadataUri}`.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  return `0x${timestamp}${Math.abs(hash).toString(16).padStart(48, '0')}` as `0x${string}`;
}

export interface GaslessCoinDeployParams {
  name: string;
  symbol: string;
  metadataUri: string;
  smartAccountAddress: Address;
  platformReferrer?: Address;
}

export interface GaslessCoinDeployResult {
  hash: Hash;
  address?: Address;
  createdAt?: number;
  smartAccountAddress: Address;
  chainId: number;
}

/**
 * Deploy a coin using smart wallet with gasless transaction (Base Paymaster)
 */
export async function deployGaslessCoin(
  params: GaslessCoinDeployParams,
  smartAccountClient: SmartAccountClient
): Promise<GaslessCoinDeployResult> {
  console.log("🪙 [Gasless] Deploying coin with params:", params);

  const {
    name,
    symbol,
    metadataUri,
    smartAccountAddress,
    platformReferrer = "0xf25af781c4F1Df40Ac1D06e6B80c17815AD311F7" as Address,
  } = params;

  try {
    // Get network preference
    const networkPreference = localStorage.getItem('ADMIN_NETWORK_PREFERENCE') as 'sepolia' | 'mainnet' | null;
    const chain = networkPreference === 'mainnet' ? base : baseSepolia;

    console.log(`📡 [Gasless] Using network: ${chain.name} (Chain ID: ${chain.id})`);
    console.log(`📍 [Gasless] Smart account address: ${smartAccountAddress}`);
    console.log(`💰 [Gasless] Payout recipient: ${smartAccountAddress}`);

    // Create public client for reading blockchain state (separate from smart account)
    const publicClient = createPublicClient({
      chain,
      transport: http(),
    });

    console.log("📤 [Gasless] Deploying coin using DIRECT contract call...");
    console.log("⚠️  [Gasless] Gas will be sponsored by Base Paymaster");

    // Use direct contract deployment (same as your zora-factory.ts but with smart account)
    const { createCoinOnBaseSepolia } = await import("./zora-coins");

    const deployResult = await createCoinOnBaseSepolia(
      {
        creator: params.smartAccountAddress,
        name: params.name,
        symbol: params.symbol,
        metadataUri: params.metadataUri,
        platformReferrer: params.platformReferrer,
      },
      smartAccountClient as any, // Smart account acts as wallet client for writing
      publicClient as any  // Regular public client for reading/simulating
    );

    console.log("✅ [Gasless] Transaction sent! Hash:", deployResult.hash);
    console.log("⏳ [Gasless] Waiting for transaction confirmation...");

    // Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: deployResult.hash,
    });

    console.log("✅ [Gasless] Transaction confirmed!");

    // Coin address is already in deployResult from direct contract call
    const coinAddress = deployResult.address;

    console.log("📍 [Gasless] Deployed coin address:", coinAddress || "Not found in logs");
    console.log("🎉 [Gasless] Coin deployed with ZERO gas fees!");

    const createdAt = Math.floor(Date.now() / 1000);

    return {
      hash: deployResult.hash,
      address: coinAddress,
      createdAt,
      smartAccountAddress,
      chainId: chain.id,
    };
  } catch (error) {
    console.error("❌ [Gasless] Coin deployment failed:", error);
    throw error;
  }
}