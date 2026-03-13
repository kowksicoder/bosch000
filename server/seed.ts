import { db } from "./db";
import { users, projects, coins, groups, loginStreaks } from "@shared/schema";

async function seed() {
  console.log("🌱 Seeding database...");

  try {
    // Create sample users/creators
    const creators = await db.insert(users).values([
      {
        username: "maria_bator",
        displayName: "Maria Bator",
        email: "maria@example.com",
        bio: "Creative director and choreographer who teaches dance internationally. I craft unique brand experiences through fashion.",
        location: "Los Angeles, CA",
        avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=maria",
        creatorType: "content_creator",
        categories: ["Dance", "Fashion", "Creative"],
        totalConnections: 18356,
        totalProfileViews: 23400,
        totalEarnings: "2500.50",
        socialAccounts: {
          instagram: "mariabator",
          tiktok: "mariabator",
        },
      },
      {
        username: "hanna_baptista",
        displayName: "Hanna Baptista",
        email: "hanna@example.com",
        bio: "Hi! I'm an artistic creative director and choreographer who launches dance internationally.",
        location: "Los Angeles, CA",
        avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=hanna",
        creatorType: "content_creator",
        categories: ["Art", "Dance"],
        totalConnections: 18346,
        totalProfileViews: 15200,
        totalEarnings: "1800.00",
      },
      {
        username: "desiree_baptiste",
        displayName: "Desiree Baptiste",
        email: "desiree@example.com",
        bio: "21-25 years old crypto enthusiast and content creator",
        location: "New York, NY",
        avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=desiree",
        creatorType: "public_goods_builder",
        categories: ["Tech", "Crypto"],
        totalConnections: 12450,
        totalProfileViews: 18900,
        totalEarnings: "3200.75",
      },
      {
        username: "chris_smolinski",
        displayName: "Chris Smolinski",
        email: "chris@example.com",
        bio: "Tech creator building Web3 tools",
        location: "San Francisco, CA",
        avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=chris",
        creatorType: "public_goods_builder",
        categories: ["Tech", "Web3"],
        totalConnections: 8920,
        totalProfileViews: 12300,
        totalEarnings: "1500.00",
      },
      {
        username: "anne_burgess",
        displayName: "Anne Burgess",
        email: "anne@example.com",
        bio: "Indie musician and producer",
        location: "Nashville, TN",
        avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=anne",
        creatorType: "content_creator",
        categories: ["Music", "Art"],
        totalConnections: 15600,
        totalProfileViews: 28700,
        totalEarnings: "4100.25",
      },
      {
        username: "kaleb_oyola",
        displayName: "Kaleb Oyola",
        email: "kaleb@example.com",
        bio: "Gaming content creator and streamer",
        location: "Austin, TX",
        avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=kaleb",
        creatorType: "content_creator",
        categories: ["Gaming", "Entertainment"],
        totalConnections: 25400,
        totalProfileViews: 45600,
        totalEarnings: "6800.50",
      },
      {
        username: "aidan_quinn",
        displayName: "Aidan Quinn",
        email: "aidan@example.com",
        bio: "Fitness coach and wellness advocate",
        location: "Miami, FL",
        avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=aidan",
        creatorType: "content_creator",
        categories: ["Fitness", "Wellness"],
        totalConnections: 19800,
        totalProfileViews: 32100,
        totalEarnings: "3900.00",
      },
      {
        username: "brandon_wesley",
        displayName: "Brandon Wesley",
        email: "brandon@example.com",
        bio: "Open source developer",
        location: "Seattle, WA",
        avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=brandon",
        creatorType: "public_goods_builder",
        categories: ["Tech", "Open Source"],
        totalConnections: 7200,
        totalProfileViews: 9800,
        totalEarnings: "1200.00",
      },
    ]).returning();

    console.log(`✅ Created ${creators.length} creators`);

    // Create sample projects
    const sampleProjects = await db.insert(projects).values([
      {
        userId: creators[0].id,
        title: "Tommy Hilfiger Campaign",
        description: "Inspired by Andy Warhol's Factory, the fall 2025 campaign from Tommy Hilfiger takes on a creative spirit. The meeting of music, fashion, and art unites with coed stars and exclusive icons alike.",
        category: "Fashion",
        thumbnailUrl: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&h=600&fit=crop",
        totalViews: 1200,
        totalInteractions: 320,
        isMinted: true,
      },
      {
        userId: creators[1].id,
        title: "Modern Dance Choreography",
        description: "A unique contemporary dance piece exploring themes of identity and movement",
        category: "Dance",
        thumbnailUrl: "https://images.unsplash.com/photo-1518834107812-67b0b7c58434?w=800&h=600&fit=crop",
        totalViews: 890,
        totalInteractions: 210,
        isMinted: false,
      },
      {
        userId: creators[4].id,
        title: "Midnight Sessions EP",
        description: "An indie electronic album recorded late at night in Nashville",
        category: "Music",
        thumbnailUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&h=600&fit=crop",
        totalViews: 2400,
        totalInteractions: 680,
        isMinted: true,
      },
      {
        userId: creators[5].id,
        title: "Epic Gaming Moments 2024",
        description: "Compilation of the best gaming moments from my stream",
        category: "Gaming",
        thumbnailUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&h=600&fit=crop",
        totalViews: 5600,
        totalInteractions: 1200,
        isMinted: true,
      },
    ]).returning();

    console.log(`✅ Created ${sampleProjects.length} projects`);

    // Create sample groups
    const sampleGroups = await db.insert(groups).values([
      {
        name: "East Side Creators",
        description: "A community of creators from the East Coast collaborating on projects",
        category: "Creative",
        memberCount: 234,
        isPrivate: false,
        createdBy: creators[0].id,
      },
      {
        name: "Web3 Builders",
        description: "Building the future of decentralized applications",
        category: "Tech",
        memberCount: 567,
        isPrivate: false,
        createdBy: creators[2].id,
      },
      {
        name: "Indie Musicians",
        description: "Independent musicians supporting each other",
        category: "Music",
        memberCount: 890,
        isPrivate: false,
        createdBy: creators[4].id,
      },
    ]).returning();

    console.log(`✅ Created ${sampleGroups.length} groups`);

    // Create sample coins for minted projects
    const mintedProjects = sampleProjects.filter(p => p.isMinted);
    if (mintedProjects.length > 0) {
      const sampleCoins = await db.insert(coins).values(
        mintedProjects.map((project, index) => ({
          userId: project.userId,
          projectId: project.id,
          contractAddress: `0x${Math.random().toString(16).substring(2, 42)}`,
          name: project.title,
          symbol: `COIN${index + 1}`,
          totalSupply: "1000000",
          currentPrice: (Math.random() * 10 + 1).toFixed(2),
          marketCap: (Math.random() * 100000 + 10000).toFixed(2),
          volume24h: (Math.random() * 50000 + 5000).toFixed(2),
          priceChange24h: (Math.random() * 20 - 10).toFixed(2),
        }))
      ).returning();

      console.log(`✅ Created ${sampleCoins.length} coins`);
    }

    console.log("✨ Database seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
