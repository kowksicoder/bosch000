import { createPublicClient, createWalletClient, http, Hash } from "viem";
import { base, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import type { Coin } from "@shared/schema";

const ACTIVITY_TRACKER_ADDRESS = process.env.VITE_ACTIVITY_TRACKER_ADDRESS || "0x0000000000000000000000000000000000000000";

const ACTIVITY_TRACKER_ABI = [
  {
    inputs: [
      { name: "coin", type: "address" },
      { name: "creator", type: "address" },
      { name: "contentUrl", type: "string" },
      { name: "coinName", type: "string" },
      { name: "coinSymbol", type: "string" },
      { name: "createdAtTimestamp", type: "uint256" }
    ],
    name: "recordCoinCreation",
    outputs: [{ name: "activityId", type: "bytes32" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "coinAddress", type: "address" }],
    name: "isRegisteredCoin",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

export class ActivityTrackerService {
  private publicClient: any;
  private walletClient: any;
  private chainId: number;

  constructor(chainId: number = base.id) {
    this.chainId = chainId;
    const chain = chainId === baseSepolia.id ? baseSepolia : base;

    const alchemyApiKey = process.env.VITE_ALCHEMY_API_KEY || "o3VW3WRXrsXXMRX3l7jZxLUqhWyZzXBy";
    const rpcUrl = `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;

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

  async recordCoinBatch(coins: Coin[]): Promise<Map<number, Hash>> {
    const results = new Map<number, Hash>();

    if (!this.walletClient) {
      console.error("❌ Wallet client not configured. Set PLATFORM_PRIVATE_KEY environment variable.");
      return results;
    }

    if (!ACTIVITY_TRACKER_ADDRESS || ACTIVITY_TRACKER_ADDRESS === "0x0000000000000000000000000000000000000000") {
      console.error("❌ Activity tracker address not configured. Set VITE_ACTIVITY_TRACKER_ADDRESS environment variable.");
      return results;
    }

    if (coins.length === 0) {
      console.log("ℹ️ No coins to record on activity tracker");
      return results;
    }

    try {
      console.log(`📊 Checking ${coins.length} coins for activity tracker recording...`);

      let alreadyRegisteredCount = 0;
      let recordedCount = 0;
      let failedCount = 0;
      const unrecordedCoins: Coin[] = []; // To store coins that are not yet registered

      // Check registration status and filter out already registered coins
      for (const coin of coins) {
        if (!coin.address) {
          console.warn(`⚠️ Skipping coin ${coin.id} - no address`);
          failedCount++;
          continue;
        }

        if (!coin.creator_wallet) {
          console.warn(`⚠️ Skipping coin ${coin.id} - no creator wallet`);
          failedCount++;
          continue;
        }

        try {
          const isRegistered = await this.publicClient.readContract({
            address: ACTIVITY_TRACKER_ADDRESS as `0x${string}`,
            abi: ACTIVITY_TRACKER_ABI,
            functionName: 'isRegisteredCoin',
            args: [coin.address as `0x${string}`],
          });

          if (isRegistered) {
            console.log(`✅ ${coin.symbol} (${coin.address}) is already registered on-chain`);
            alreadyRegisteredCount++;
            // Mark as recorded in our DB by returning the coin address as a pseudo-hash
            results.set(coin.id, coin.address as Hash);
          } else {
            unrecordedCoins.push(coin);
          }
        } catch (error: any) {
          console.error(`❌ Error checking registration status for ${coin.symbol} (${coin.address}):`, error.message || error);
          failedCount++;
        }
      }

      // Record each unrecorded coin individually
      for (const coin of unrecordedCoins) {
        try {
        // Validate required fields
        if (!coin.address || !coin.creator_wallet || !coin.name || !coin.symbol) {
          console.error(`❌ Missing required fields for coin ${coin.symbol || 'unknown'}`);
          console.error(`   Address: ${coin.address}, Creator: ${coin.creator_wallet}`);
          console.error(`   Name: ${coin.name}, Symbol: ${coin.symbol}`);
          failedCount++;
          continue;
        }

        console.log(`🔄 Recording ${coin.symbol} (${coin.address})...`);
        
        // Get the createdAt timestamp or use current time as fallback
        const createdAtTimestamp = coin.createdAt 
          ? BigInt(Math.floor(new Date(coin.createdAt).getTime() / 1000))
          : BigInt(Math.floor(Date.now() / 1000));

        const txHash = await this.publicClient.simulateContract({
          address: ACTIVITY_TRACKER_ADDRESS as `0x${string}`,
          abi: ACTIVITY_TRACKER_ABI,
          functionName: 'recordCoinCreation',
          args: [
            coin.address as `0x${string}`,
            coin.creator_wallet as `0x${string}`,
            coin.ipfsUri || coin.image || '',
            coin.name,
            coin.symbol,
            createdAtTimestamp
          ],
          account: this.walletClient.account,
        });

        const hash = await this.walletClient.writeContract(txHash.request);
        console.log(`📤 Activity tracker transaction sent for ${coin.symbol}: ${hash}`);

        const receipt = await this.publicClient.waitForTransactionReceipt({
          hash,
          confirmations: 1
        });

        if (receipt.status === 'success') {
          results.set(coin.id, hash);
          recordedCount++;
          console.log(`✅ Successfully recorded ${coin.symbol} on activity tracker with tx: ${hash}`);
        } else {
          console.error(`❌ Activity tracker transaction failed for ${coin.symbol}`);
          failedCount++;
        }
        } catch (error: any) {
          console.error(`❌ Error recording individual coin ${coin.symbol}:`, error.message || error);
          failedCount++;
        }
      }

      console.log(`📊 Activity Tracker Sync Summary:`);
      console.log(`  ✅ Already registered: ${alreadyRegisteredCount}`);
      console.log(`  🆕 Newly recorded: ${recordedCount}`);
      console.log(`  ❌ Failed: ${failedCount}`);
      console.log(`  📝 Total processed: ${coins.length}`);

      return results;
    } catch (error: any) {
      console.error(`❌ Error recording coins to activity tracker:`, error.message || error);
      console.error(`   Failed coins: ${failedCount}/${unrecordedCoins.length}`);
      console.error(`   Results collected: ${results.size}`);

      // Don't throw - return partial results instead
      return results;
    }
  }

  async recordSingleCoin(coin: Coin): Promise<Hash | null> {
    const results = await this.recordCoinBatch([coin]);
    return results.get(coin.id) || null;
  }
}