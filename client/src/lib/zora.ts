import {
  createCoin,
  createCoinCall,
  setApiKey,
  getCoinCreateFromLogs,
  CreateConstants,
  tradeCoin,
  TradeParameters,
  createMetadataBuilder,
  createZoraUploaderForCreator
} from "@zoralabs/coins-sdk";
import { createPublicClient, createWalletClient, http, parseEther, type Address, type Hash } from "viem";
import { base, baseSepolia } from "viem/chains";
import { uploadToIPFS, uploadToPinata } from "./pinata";

// Set up Zora API key
const ZORA_API_KEY = import.meta.env.VITE_NEXT_PUBLIC_ZORA_API_KEY || "";

if (ZORA_API_KEY) {
  setApiKey(ZORA_API_KEY);
  console.log("✓ Zora API key configured successfully");
} else {
  console.error("❌ VITE_NEXT_PUBLIC_ZORA_API_KEY not configured - coin stats will not load");
  console.log("Available env vars:", Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')));
}

export interface CoinMetadata {
  name: string;
  symbol: string;
  description?: string;
  image?: string | File;
  externalUrl?: string;
}

export interface CoinCreationResult {
  hash: Hash;
  address: Address;
  deployment: any;
}

// Helper function to upload metadata using Pinata
async function uploadMetadataViaPinata(metadata: CoinMetadata): Promise<string> {
  const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;

  if (!PINATA_JWT) {
    throw new Error("PINATA_JWT not configured");
  }

  try {
    // Upload image first if it exists
    let imageUri = '';
    if (metadata.image) {
      if (typeof metadata.image === 'string') {
        // Image is already a URL
        imageUri = metadata.image;
      } else {
        // Upload the file to Pinata
        const ipfsHash = await uploadToPinata(metadata.image);

        // Use ipfs:// protocol for Zora contract compatibility
        imageUri = `ipfs://${ipfsHash}`;
      }
    }

    // Create metadata object
    const metadataJson = {
      name: metadata.name,
      description: metadata.description || `A coin representing ${metadata.name}`,
      image: imageUri,
      ...(metadata.externalUrl && { external_url: metadata.externalUrl })
    };

    // Upload metadata JSON to IPFS
    const metadataUri = await uploadToIPFS(metadataJson);

    console.log("✓ Metadata uploaded via Pinata:", metadataUri);
    return metadataUri;
  } catch (error) {
    console.error("Pinata metadata upload error:", error);
    throw new Error(`Failed to upload metadata via Pinata: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Try to upload via Zora first, fallback to Pinata if it fails
async function createMetadataForZora(metadata: CoinMetadata, creatorAddress: Address) {
  if (!ZORA_API_KEY) {
    throw new Error("Zora API key is required for metadata creation");
  }

  try {
    // Convert image URL to File if it's a URL
    let imageFile: File | undefined;
    if (metadata.image) {
      if (typeof metadata.image === 'string') {
        // Fetch the image and convert to File
        const response = await fetch(metadata.image);
        const blob = await response.blob();
        const filename = metadata.image.split('/').pop() || 'image.jpg';
        imageFile = new File([blob], filename, { type: blob.type });
      } else {
        imageFile = metadata.image;
      }
    }

    // Use Zora's metadata builder and uploader
    const builder = createMetadataBuilder()
      .withName(metadata.name)
      .withSymbol(metadata.symbol)
      .withDescription(metadata.description || `A coin representing ${metadata.name}`);

    if (imageFile) {
      builder.withImage(imageFile);
    }

    const { createMetadataParameters } = await builder.upload(
      createZoraUploaderForCreator(creatorAddress)
    );

    console.log("✓ Metadata uploaded via Zora:", createMetadataParameters);

    return createMetadataParameters;
  } catch (error) {
    console.error("Zora metadata upload error:", error);
    console.log("Falling back to Pinata upload...");

    // Fallback to Pinata
    try {
      const metadataUri = await uploadMetadataViaPinata(metadata);
      return {
        name: metadata.name,
        symbol: metadata.symbol,
        metadata: { type: "RAW_URI" as const, uri: metadataUri }
      };
    } catch (pinataError) {
      console.error("Pinata fallback failed:", pinataError);
      throw new Error(`Failed to upload metadata via Zora and Pinata: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}


export async function createZoraCoin(
  metadata: CoinMetadata,
  creatorAddress: Address,
  chainId: number = base.id
): Promise<CoinCreationResult> {
  if (!ZORA_API_KEY) {
    throw new Error("Zora API key not configured");
  }

  try {
    // Set up clients for the specified chain
    const chain = chainId === baseSepolia.id ? baseSepolia : base;
    const alchemyApiKey = import.meta.env.VITE_ALCHEMY_API_KEY || "o3VW3WRXrsXXMRX3l7jZxLUqhWyZzXBy";
    const rpcUrl = import.meta.env.VITE_ZORA_RPC_URL || 
                   `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;

    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    // Upload metadata to IPFS via Pinata
    const metadataUri = await uploadMetadataViaPinata(metadata);

    console.log('Created metadata URI:', metadataUri);

    // Admin platform referral address for earning 20% of all future trading fees
    const ADMIN_PLATFORM_REFERRAL = "0xf25af781c4F1Df40Ac1D06e6B80c17815AD311F7"; // Default admin wallet

    // Create coin arguments matching SDK v0.3.2 API with platform referral
    const createCoinArgs = {
      creator: creatorAddress,
      name: metadata.name,
      symbol: metadata.symbol,
      metadata: { type: "RAW_URI" as const, uri: metadataUri || "" },
      currency: CreateConstants.ContentCoinCurrencies.ETH,
      chainId,
      skipMetadataValidation: !metadataUri, // Only skip if no URI (validation will fail on empty)
      platformReferrer: ADMIN_PLATFORM_REFERRAL, // Earn 20% of all trading fees for this coin
      startingMarketCap: CreateConstants.StartingMarketCaps.LOW, // Set initial market cap
    };

    // For client-side, we'll return the call data instead of executing
    // The actual transaction will be handled by the wallet client
    const txCalls = await createCoinCall(createCoinArgs);

    // This is a placeholder - actual implementation requires wallet integration
    throw new Error("Wallet integration required for actual coin creation. This is a development environment limitation.");

  } catch (error) {
    console.error("Zora coin creation error:", error);
    throw new Error(`Failed to create Zora coin: ${error}`);
  }
}

export async function createZoraCoinWithWallet(
  metadata: CoinMetadata,
  walletClient: any,
  address: Address,
  chainId: number = base.id,
  manualPoolConfig?: `0x${string}`
): Promise<CoinCreationResult> {
  try {
    // Set up clients
    const chain = chainId === baseSepolia.id ? baseSepolia : base;
    const alchemyApiKey = import.meta.env.VITE_ALCHEMY_API_KEY || "o3VW3WRXrsXXMRX3l7jZxLUqhWyZzXBy";
    const rpcUrl = import.meta.env.VITE_ZORA_RPC_URL || 
                   `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;

    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    // Upload metadata directly to Pinata (bypassing Zora's validation issues)
    console.log('📤 Uploading metadata via Pinata...');
    const metadataUri = await uploadMetadataViaPinata(metadata);
    console.log('✅ Metadata uploaded:', metadataUri);

    // Admin platform referral address for earning 20% of all future trading fees
    const ADMIN_PLATFORM_REFERRAL = "0xf25af781c4F1Df40Ac1D06e6B80c17815AD311F7"; // Default admin wallet

    // Use direct factory contract deployment (primary method)
    const { deployCreatorCoinDirect } = await import('@/lib/zora-factory');

    console.log("🚀 Using direct factory deployment with official Zora poolConfig");

    const directResult = await deployCreatorCoinDirect(
      {
        name: metadata.name,
        symbol: metadata.symbol,
        metadataUri: metadataUri,
        creatorAddress: address,
        platformReferrer: ADMIN_PLATFORM_REFERRAL as Address,
        manualPoolConfig: manualPoolConfig,
        contentUrl: metadata.externalUrl || metadataUri,
        useActivityTracker: true, // Enable on-chain activity tracking for grants
      },
      walletClient,
      chainId
    );

    console.log("✅ Coin deployed successfully:", directResult.address);

    return {
      hash: directResult.hash,
      address: directResult.address,
      deployment: null
    };

  } catch (error) {
    console.error("❌ Zora coin creation with wallet error:", error);
    throw new Error(`Failed to create Zora coin: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function getCoinStats(coinAddress: string) {
  // This would integrate with Zora's coin querying APIs
  // For now, return null as placeholder
  return null;
}

export async function tradeZoraCoin({
  coinAddress,
  ethAmount,
  walletClient,
  publicClient,
  userAddress,
  isBuying = true
}: {
  coinAddress: Address;
  ethAmount: string;
  walletClient: any;
  publicClient: any;
  userAddress: Address;
  isBuying?: boolean;
}) {
  if (!ZORA_API_KEY) {
    throw new Error("Zora API key not configured");
  }

  try {
    const { tradeCoin } = await import("@zoralabs/coins-sdk");

    // Convert ETH amount to wei for the transaction
    const amountInWei = parseEther(ethAmount);

    // Admin trade referral address for earning 4% of this specific trade
    const ADMIN_TRADE_REFERRAL = "0xf25af781c4F1Df40Ac1D06e6B80c17815AD311F7";

    // Create trade parameters according to Zora SDK documentation
    const tradeParameters = isBuying ? {
      // Buying coin with ETH
      sell: { type: "eth" as const },
      buy: { 
        type: "erc20" as const, 
        address: coinAddress 
      },
      amountIn: amountInWei,
      slippage: 0.05, // 5% slippage tolerance
      sender: userAddress,
      tradeReferrer: ADMIN_TRADE_REFERRAL, // Earn 4% of this trade
    } : {
      // Selling coin for ETH
      sell: { 
        type: "erc20" as const, 
        address: coinAddress 
      },
      buy: { type: "eth" as const },
      amountIn: amountInWei,
      slippage: 0.15, // 15% slippage tolerance for selling
      sender: userAddress,
      tradeReferrer: ADMIN_TRADE_REFERRAL, // Earn 4% of this trade
    };

    console.log("Trading with parameters:", tradeParameters);

    // Get account from wallet client
    const account = walletClient.account;
    if (!account) {
      throw new Error("No account found in wallet client");
    }

    const receipt = await tradeCoin({
      tradeParameters,
      walletClient,
      account,
      publicClient,
    });

    console.log("Trade receipt:", receipt);

    if (!receipt || !receipt.transactionHash) {
      throw new Error("Trade transaction failed - no transaction hash returned");
    }

    return {
      hash: receipt.transactionHash,
      success: true,
      receipt
    };
  } catch (error) {
    console.error("Trade error:", error);

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes("insufficient funds")) {
        throw new Error("Insufficient ETH balance for this trade");
      } else if (error.message.includes("user rejected")) {
        throw new Error("Transaction was cancelled by user");
      } else if (error.message.includes("slippage")) {
        throw new Error("Trade failed due to high slippage - try again with higher slippage tolerance");
      } else if (error.message.includes("Slippage must be less than 1")) {
        throw new Error("Invalid slippage configuration");
      } else if (error.message.includes("Amount in must be greater than 0")) {
        throw new Error("Trade amount must be greater than 0");
      } else {
        throw new Error(`Trading failed: ${error.message}`);
      }
    }

    throw new Error("Trading failed - unknown error occurred");
  }
}

// Export for compatibility
export const createBaseCoin = createZoraCoin;