import { createPublicClient, createWalletClient, http, Hash, keccak256, toBytes } from "viem";
import { base, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import type { Coin } from "@shared/schema";

const REGISTRY_CONTRACT_ADDRESS = process.env.REGISTRY_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000";

const REGISTRY_ABI = [
  {
    inputs: [
      { name: "coinAddresses", type: "address[]" },
      { name: "creators", type: "address[]" },
      { name: "metadataHashes", type: "bytes32[]" }
    ],
    name: "registerBatch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "coinAddress", type: "address" }],
    name: "isPlatformCoin",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "totalCoinsRegistered",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ name: "creator", type: "address" }],
    name: "getCreatorCoinCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

export class RegistryService {
  private publicClient: any;
  private walletClient: any;
  private chainId: number;

  constructor(chainId: number = base.id) {
    this.chainId = chainId;
    const chain = chainId === baseSepolia.id ? baseSepolia : base;
    
    const alchemyApiKey = process.env.VITE_ALCHEMY_API_KEY || "o3VW3WRXrsXXMRX3l7jZxLUqhWyZzXBy";
    const rpcUrl = process.env.VITE_ZORA_RPC_URL || 
                   `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;

    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    const privateKey = process.env.PLATFORM_PRIVATE_KEY;
    if (privateKey) {
      const account = privateKeyToAccount(privateKey as `0x${string}`);
      this.walletClient = createWalletClient({
        account,
        chain,
        transport: http(rpcUrl),
      });
    }
  }

  generateMetadataHash(coin: Coin): `0x${string}` {
    const metadata = `${coin.name}|${coin.symbol}|${coin.ipfsUri || ''}`;
    return keccak256(toBytes(metadata));
  }

  async registerCoinsBatch(coins: Coin[]): Promise<Hash | null> {
    if (!this.walletClient) {
      console.error("Wallet client not configured. Set PLATFORM_PRIVATE_KEY environment variable.");
      return null;
    }

    if (coins.length === 0) {
      console.log("No coins to register");
      return null;
    }

    try {
      const coinAddresses = coins
        .filter(c => c.address)
        .map(c => c.address as `0x${string}`);
      
      const creators = coins
        .filter(c => c.address)
        .map(c => c.creator_wallet as `0x${string}`);
      
      const metadataHashes = coins
        .filter(c => c.address)
        .map(c => this.generateMetadataHash(c));

      console.log(`Registering ${coinAddresses.length} coins to registry...`);

      const { request } = await this.publicClient.simulateContract({
        address: REGISTRY_CONTRACT_ADDRESS as `0x${string}`,
        abi: REGISTRY_ABI,
        functionName: 'registerBatch',
        args: [coinAddresses, creators, metadataHashes],
        account: this.walletClient.account,
      });

      const hash = await this.walletClient.writeContract(request);
      
      console.log(`Registry batch transaction sent: ${hash}`);
      
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      
      if (receipt.status === 'success') {
        console.log(`Successfully registered ${coinAddresses.length} coins`);
        return hash;
      } else {
        console.error("Registry transaction failed");
        return null;
      }
    } catch (error) {
      console.error("Error registering coins batch:", error);
      return null;
    }
  }

  async isPlatformCoin(coinAddress: string): Promise<boolean> {
    try {
      const result = await this.publicClient.readContract({
        address: REGISTRY_CONTRACT_ADDRESS as `0x${string}`,
        abi: REGISTRY_ABI,
        functionName: 'isPlatformCoin',
        args: [coinAddress as `0x${string}`],
      });
      
      return result as boolean;
    } catch (error) {
      console.error("Error checking platform coin:", error);
      return false;
    }
  }

  async getTotalCoinsRegistered(): Promise<number> {
    try {
      const result = await this.publicClient.readContract({
        address: REGISTRY_CONTRACT_ADDRESS as `0x${string}`,
        abi: REGISTRY_ABI,
        functionName: 'totalCoinsRegistered',
      });
      
      return Number(result);
    } catch (error) {
      console.error("Error getting total coins:", error);
      return 0;
    }
  }

  async getCreatorCoinCount(creatorAddress: string): Promise<number> {
    try {
      const result = await this.publicClient.readContract({
        address: REGISTRY_CONTRACT_ADDRESS as `0x${string}`,
        abi: REGISTRY_ABI,
        functionName: 'getCreatorCoinCount',
        args: [creatorAddress as `0x${string}`],
      });
      
      return Number(result);
    } catch (error) {
      console.error("Error getting creator coin count:", error);
      return 0;
    }
  }
}
