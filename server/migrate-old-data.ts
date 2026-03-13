import { storage } from "./supabase-storage";

// Old coins data structure
interface OldCoin {
  id: string;
  coin_address: string;
  creator_wallet: string;
  transaction_hash: string;
  created_at: string;
  ipfs_uri: string;
  metadata: {
    tags?: string[];
    image?: string;
    title?: string;
    author?: string;
    content?: string;
    description?: string;
    originalUrl?: string;
    publishDate?: string;
  };
  name: string;
  symbol: string;
}

const oldCoinsData: OldCoin[] = [
  {
    id: '085bbf2d-ea9a-4311-a93c-81efe81c4e03',
    coin_address: '0xd4eC4b5D04EB1cc6344f25611542E540Da3AcBF7',
    creator_wallet: '0xf25af781c4F1Df40Ac1D06e6B80c17815AD311F7',
    transaction_hash: '0xf32a87327eb785d7c62bccc72e04099c36f6d9ac6795671edd44694f155b3be1',
    created_at: '2025-09-25 00:03:55.594818',
    ipfs_uri: 'ipfs://bafkreihrnjn4hj6wozky2ss357ma7ewasghxjovzpyykagy5c5qqkt5x3i',
    metadata: {
      tags: [],
      image: 'https://zora.co/api/og-image/coin/base:0xde7c9a53edd5ef151210aa7c1da9dc80068547ab',
      title: 'Test this test that',
      author: '',
      content: '',
      description: 'A coin representing the blog post: Why Every Senior Developer I Know Is Planning Their Exit | by Harishsingh | Sep, 2025 | Medium',
      originalUrl: 'https://zora.co/coin/base:0xde7c9a53edd5ef151210aa7c1da9dc80068547ab',
      publishDate: ''
    },
    name: 'Test this test that',
    symbol: 'TESTTHIS'
  },
  {
    id: '5802d950-d913-4fc2-b4ef-5d4c2f1db213',
    coin_address: '0x509059DBB581927C8641673126eBACD46AC359Ca',
    creator_wallet: '0xf25af781c4F1Df40Ac1D06e6B80c17815AD311F7',
    transaction_hash: '0xa0a1215e52ede64b456c92987c4ce6547ba53e309ae80ec064b1e06865f9f6ca',
    created_at: '2025-09-25 16:07:43.724032',
    ipfs_uri: 'ipfs://bafkreiel7sh6daodoktdm3pmaeblaknyp2otbilkz3xthvozvksu6gxnge',
    metadata: {
      tags: [],
      image: 'https://yellow-patient-cheetah-559.mypinata.cloud/ipfs/bafkreiel7sh6daodoktdm3pmaeblaknyp2otbilkz3xthvozvksu6gxnge',
      title: 'VICTORIA',
      author: '',
      content: '',
      description: '',
      originalUrl: '',
      publishDate: ''
    },
    name: 'VICTORIA',
    symbol: 'VICTO'
  },
  {
    id: 'f3f15db4-b357-47f1-bff3-7537933845a0',
    coin_address: '0x123...',
    creator_wallet: '0xabc...',
    transaction_hash: '0xhash...',
    created_at: '2025-09-13 12:21:24.872099',
    ipfs_uri: 'ipfs://uri',
    metadata: {
      tags: [],
      image: '',
      title: 'Recovered Blog Coin',
      author: '',
      content: '',
      description: 'A recovered blog coin from the old system',
      originalUrl: '',
      publishDate: ''
    },
    name: 'Recovered Blog Coin',
    symbol: 'BLOGFIX'
  },
  {
    id: 'f4248ea3-59b2-4448-92ae-bfc7f59e9d12',
    coin_address: '0xDE7C9a53eDd5Ef151210Aa7C1Da9dC80068547Ab',
    creator_wallet: '0xb843A2D0D4B9E628500d2E0f6f0382e063C14a95',
    transaction_hash: '0xf2469e00c6688fa9b193bc7b4c1f0ebacf64f87ae552dec948c53d83a0c4b370',
    created_at: '2025-09-13 13:27:57.883838',
    ipfs_uri: 'ipfs://bafkreihtfa57szgjp6qu7xzytj7otuyoyl67qmnzlu3p4bmesuumpsa3ki',
    metadata: {
      tags: [],
      image: 'https://miro.medium.com/v2/da:true/resize:fit:1200/0*jCeSNt_UZku7uzGM',
      title: 'Why Every Senior Developer I Know Is Planning Their Exit | by Harishsingh | Sep, 2025 | Medium',
      author: 'Harishsingh',
      content: 'Member-only storyWhy Every Senior Developer I Know Is Planning Their ExitHarishsingh4 min read·Sep 4, 2025--62ShareAfter 10 years in software development, with the last three in high-frequency trading, I\'m witnessing something unprecedented: every senior developer in my network is planning their exit from traditional employment. Not just job-hopping , complete career pivots.Press enter or click to view image in full sizeAI-generated digital illustrationThe reasons go deeper than burnout or better pay. The fundamental relationship between developers and the industry has shifted, and the smart money is already moving.The Invisible Productivity TaxModern development has become an exercise in navigating bureaucracy rather than solving problems. Here\'s what my day looked like this week:Time Breakdown (40-hour week):Actual coding: 12 hours (30%)Meetings about meetings: 8 hours (20%)Process compliance: 8 hours (20%)Documentation for audit trails: 6 hours (15%)Context switching overhead: 6 hours (15%)In HFT, microseconds matter. Yet I spend more time in Jira than optimizing algorithms. The irony is suffocating.// What I want to writefunc optimizeOrderExecution(order *Order) (*Execution, error) { return executeWithMinimalLatency(order)}// What compliance…',
      description: 'Why Every Senior Developer I Know Is Planning Their Exit After 10 years in software development, with the last three in high-frequency trading, I\'m witnessing something unprecedented: every senior …',
      originalUrl: 'https://medium.com/@harishsingh8529/why-every-senior-developer-i-know-is-planning-their-exit-8294cc17b7c7',
      publishDate: '2025-09-10T04:50:40.894Z'
    },
    name: 'Test this test that',
    symbol: 'TESTEST'
  },
  {
    id: 'fc0604ca-6e8a-4fed-b7e0-078ca63b6a09',
    coin_address: '0x285f10f443aA139C1d0982815BF1B039aE438a3a',
    creator_wallet: '0xf25af781c4F1Df40Ac1D06e6B80c17815AD311F7',
    transaction_hash: '',
    created_at: '2025-09-28 16:26:39.379569',
    ipfs_uri: 'ipfs://bafkreicvvt4qxbyqjle5lkn472eyucggenrflzlkflozv2dpo5aj6jnvxm',
    metadata: {
      tags: [],
      image: 'ipfs://bafybeifknagau4jdfz2bym4y7nurtjtop53wnamy5lzx573pzjpmxrg7mu',
      title: 'CreatorEarning',
      author: '',
      content: '',
      description: 'A coin representing the image: CreatorEarning',
      originalUrl: '',
      publishDate: ''
    },
    name: 'CreatorEarning',
    symbol: 'CREATEANDEARN'
  },
  {
    id: 'fd630af5-fad3-426b-920a-22aa86fee84e',
    coin_address: '0xe8aFE7B4687abad8603495deC3b9Fd37D697b663',
    creator_wallet: '0xf25af781c4F1Df40Ac1D06e6B80c17815AD311F7',
    transaction_hash: '0x0a679ca18599d1401806dc9f1ce6211d9d8eeae35cc728bd0863624b8ea085a4',
    created_at: '2025-09-25 14:47:07.161196',
    ipfs_uri: 'ipfs://bafkreifzddskxxtsmqpjzutdg3hpf4qagowixd7bjem4y6jifzy3vi7oey',
    metadata: {
      tags: [],
      image: 'ipfs://bafkreifzddskxxtsmqpjzutdg3hpf4qagowixd7bjem4y6jifzy3vi7oey',
      title: 'YELLOW',
      author: '',
      content: '',
      description: '',
      originalUrl: '',
      publishDate: ''
    },
    name: 'YELLOW',
    symbol: 'YELLOW'
  }
];

let migrationCompleted = false;

export async function migrateOldData() {
  const startTime = Date.now();
  const errors: string[] = [];
  let migratedCount = 0;

  for (const oldCoin of oldCoinsData) {
    try {
      // Check if coin already exists by address
      const existingCoin = await storage.getCoinByAddress(oldCoin.coin_address);
      if (existingCoin) {
        console.log(`Coin ${oldCoin.coin_address} already exists, skipping`);
        continue;
      }

      // Create scraped content from metadata
      const scrapedContent = await storage.createScrapedContent({
        url: oldCoin.metadata.originalUrl || `https://etherscan.io/tx/${oldCoin.transaction_hash}`,
        platform: 'blog',
        title: oldCoin.metadata.title || oldCoin.name,
        description: oldCoin.metadata.description || '',
        author: oldCoin.metadata.author || '',
        publishDate: oldCoin.metadata.publishDate || '',
        image: oldCoin.metadata.image || '',
        content: oldCoin.metadata.content || '',
        tags: oldCoin.metadata.tags || [],
      });

      // Skip coins without creator_wallet
      if (!oldCoin.creator_wallet) {
        const errorMsg = `Skipped coin ${oldCoin.id}: missing creator_wallet`;
        errors.push(errorMsg);
        console.log(errorMsg);
        continue;
      }

      // Create coin and creator, linked to scraped content
      const coin = await storage.createCoin({
        name: oldCoin.name,
        symbol: oldCoin.symbol,
        creator_wallet: oldCoin.creator_wallet,
        address: oldCoin.coin_address,
        status: 'active',
        scrapedContentId: scrapedContent?.id || null,
        ipfsUri: oldCoin.ipfs_uri || null,
      });

      // Create or update creator
      let creator = await storage.getCreatorByAddress(oldCoin.creator_wallet);
      if (!creator) {
        creator = await storage.createCreator({
          address: oldCoin.creator_wallet,
          totalCoins: '1',
          totalVolume: '0',
          followers: '0',
        });
      } else {
        const newTotalCoins = (parseInt(creator.totalCoins) + 1).toString();
        await storage.updateCreator(creator.id, {
          totalCoins: newTotalCoins,
        });
      }

      migratedCount++;
    } catch (error) {
      const errorMsg = `Failed to migrate coin ${oldCoin.id}: ${error}`;
      errors.push(errorMsg);
    }
  }

  const duration = Date.now() - startTime;
  return {
    success: true,
    count: migratedCount,
    total: oldCoinsData.length,
    errors,
    duration: `${duration}ms`
  };
}

export async function autoMigrateOnStartup() {
  if (migrationCompleted) {
    return { message: "Migration already completed" };
  }

  try {
    // Check if any coins exist already
    const existingCoins = await storage.getAllCoins();
    if (existingCoins.length === 0) {
      console.log("No coins found, running automatic migration...");
      const result = await migrateOldData();
      migrationCompleted = true;
      console.log(`Migration completed: ${result.count}/${result.total} coins imported`);
      return result;
    } else {
      console.log(`Found ${existingCoins.length} existing coins, skipping migration`);
      migrationCompleted = true;
      return { message: `Skipped migration, found ${existingCoins.length} existing coins` };
    }
  } catch (error) {
    console.error("Auto migration failed:", error);
    return { error: "Auto migration failed" };
  }
}

// Old rewards/fee data from previous database
interface OldReward {
  type: 'platform' | 'trade';
  coinAddress: string;
  coinSymbol: string;
  transactionHash: string;
  rewardAmount: string;
  recipientAddress: string;
  createdAt: string;
}

const oldRewardsData: OldReward[] = [
  // Add your historical rewards data here
  // Example format:
  // {
  //   type: 'platform',
  //   coinAddress: '0xd4eC4b5D04EB1cc6344f25611542E540Da3AcBF7',
  //   coinSymbol: 'TESTTHIS',
  //   transactionHash: '0x...',
  //   rewardAmount: '1000000000000000000', // 1 ZORA in wei
  //   recipientAddress: '0xYourPlatformAddress',
  //   createdAt: '2025-09-25 00:03:55'
  // }
];

export async function migrateOldRewards() {
  const startTime = Date.now();
  const errors: string[] = [];
  let migratedCount = 0;

  for (const oldReward of oldRewardsData) {
    try {
      // Check if reward already exists by transaction hash
      const existingRewards = await storage.getAllRewards();
      const exists = existingRewards.some(r => r.transactionHash === oldReward.transactionHash);
      
      if (exists) {
        console.log(`Reward ${oldReward.transactionHash} already exists, skipping`);
        continue;
      }

      await storage.createReward({
        type: oldReward.type,
        coinAddress: oldReward.coinAddress,
        coinSymbol: oldReward.coinSymbol,
        transactionHash: oldReward.transactionHash,
        rewardAmount: oldReward.rewardAmount,
        rewardCurrency: 'ZORA',
        recipientAddress: oldReward.recipientAddress,
      });

      migratedCount++;
    } catch (error) {
      const errorMsg = `Failed to migrate reward ${oldReward.transactionHash}: ${error}`;
      errors.push(errorMsg);
    }
  }

  const duration = Date.now() - startTime;
  return {
    success: true,
    count: migratedCount,
    total: oldRewardsData.length,
    errors,
    duration: `${duration}ms`
  };
}

// Export for use in routes
export { oldCoinsData, oldRewardsData };