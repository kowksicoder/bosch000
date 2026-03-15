import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, decimal, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table - integrates with Privy authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  privyId: text("privy_id").unique(),
  walletAddress: text("wallet_address"),
  email: text("email"),
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  bio: text("bio"),
  location: text("location"),
  avatarUrl: text("avatar_url"),
  coverImageUrl: text("cover_image_url"),
  socialAccounts: jsonb("social_accounts").$type<{
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    twitter?: string;
  }>(),
  creatorType: text("creator_type"), // 'content_creator' | 'public_goods_builder'
  audienceAge: text("audience_age"), // '18-24' | '25-34' etc
  categories: text("categories").array(), // ['Music', 'Art', 'Tech', etc]
  totalConnections: integer("total_connections").default(0),
  totalProfileViews: integer("total_profile_views").default(0),
  totalEarnings: decimal("total_earnings", { precision: 18, scale: 8 }).default("0"),
  e1xpPoints: integer("e1xp_points").default(0),
  pointsBadges: jsonb("points_badges").$type<string[]>().default([]),
  referralCode: text("referral_code").unique(),
  referredBy: varchar("referred_by").references(() => users.id),
  isAdmin: integer("is_admin").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Projects table - content/campaigns that can be minted as coins
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  sourceUrl: text("source_url"), // URL of original content
  thumbnailUrl: text("thumbnail_url"),
  ipfsHash: text("ipfs_hash"), // IPFS storage hash
  category: text("category"),
  totalViews: integer("total_views").default(0),
  totalInteractions: integer("total_interactions").default(0),
  isMinted: boolean("is_minted").default(false),
  coinId: varchar("coin_id"), // Reference to minted coin if exists
  createdAt: timestamp("created_at").defaultNow(),
});

// Coins table - from Supabase schema (tokenized assets)
export const coins = pgTable("coins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  address: text("address"),
  userId: varchar("user_id").references(() => users.id),
  creatorWallet: text("creator_wallet").notNull(),
  status: text("status").notNull().default("pending"),
  scrapedContentId: varchar("scraped_content_id").references(() => scrapedContent.id),
  ipfsUri: text("ipfs_uri"),
  chainId: text("chain_id"),
  registryTxHash: text("registry_tx_hash"),
  metadataHash: text("metadata_hash"),
  registeredAt: timestamp("registered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  image: text("image"),
  description: text("description"),
  pinOrder: integer("pin_order"),
  hidden: boolean("hidden").default(false),
});

// Collabs table - collaboration coins with multiple creators
export const collabs = pgTable("collabs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  coinId: varchar("coin_id").references(() => coins.id),
  coinAddress: text("coin_address"),
  title: text("title"),
  createdBy: text("created_by").notNull(),
  status: text("status").default("active"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Collab members table - participants and split tracking
export const collabMembers = pgTable("collab_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  collabId: varchar("collab_id").references(() => collabs.id).notNull(),
  memberId: text("member_id").notNull(),
  role: text("role").default("creator"),
  splitBps: integer("split_bps").default(0),
  status: text("status").default("active"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Collab invites table - pending requests
export const collabInvites = pgTable("collab_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  collabId: varchar("collab_id").references(() => collabs.id).notNull(),
  inviterId: text("inviter_id").notNull(),
  inviteeId: text("invitee_id").notNull(),
  status: text("status").default("pending"),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
});

// Transactions table - trading history
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  coinId: varchar("coin_id").references(() => coins.id).notNull(),
  buyerId: varchar("buyer_id").references(() => users.id),
  sellerId: varchar("seller_id").references(() => users.id),
  transactionType: text("transaction_type").notNull(), // 'buy' | 'sell' | 'mint'
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  price: decimal("price", { precision: 18, scale: 8 }).notNull(),
  totalValue: decimal("total_value", { precision: 18, scale: 8 }).notNull(),
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Fiat transactions (Naira on-ramp)
export const fiatTransactions = pgTable("fiat_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  creatorTokenAddress: text("creator_token_address").notNull(),
  amountNgn: decimal("amount_ngn", { precision: 18, scale: 2 }).notNull(),
  amountEth: decimal("amount_eth", { precision: 18, scale: 8 }),
  ethUsdRate: decimal("eth_usd_rate", { precision: 18, scale: 6 }),
  usdNgnRate: decimal("usd_ngn_rate", { precision: 18, scale: 6 }),
  ethNgnRate: decimal("eth_ngn_rate", { precision: 18, scale: 6 }),
  provider: text("provider").notNull(), // 'paystack' | 'flutterwave'
  providerReference: text("provider_reference").notNull(),
  providerStatus: text("provider_status"),
  status: text("status").notNull().default("pending"), // 'pending' | 'paid' | 'processing' | 'completed' | 'failed'
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Withdrawal requests (Naira off-ramp)
export const withdrawalRequests = pgTable("withdrawal_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  tokenAddress: text("token_address").notNull(),
  tokenAmount: decimal("token_amount", { precision: 36, scale: 18 }).notNull(),
  tokenDecimals: integer("token_decimals").default(18),
  amountNgn: decimal("amount_ngn", { precision: 18, scale: 2 }).notNull(),
  usdNgnRate: decimal("usd_ngn_rate", { precision: 18, scale: 6 }),
  provider: text("provider").notNull().default("paystack"),
  providerReference: text("provider_reference"),
  status: text("status").notNull().default("pending"), // 'pending' | 'processing' | 'completed' | 'failed'
  bankCode: text("bank_code").notNull(),
  bankAccount: text("bank_account").notNull(),
  bankName: text("bank_name").notNull(),
  payoutRecipientCode: text("payout_recipient_code"),
  onchainTxHash: text("onchain_tx_hash"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Messages table
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").references(() => users.id).notNull(),
  recipientId: varchar("recipient_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  messageType: text("message_type").default("text"), // 'text' | 'invitation' | 'request'
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Connections table - creator relationships
export const connections = pgTable("connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  connectedUserId: varchar("connected_user_id").references(() => users.id).notNull(),
  status: text("status").default("pending"), // 'pending' | 'connected' | 'rejected'
  engagementRate: decimal("engagement_rate", { precision: 5, scale: 2 }),
  totalInteractions: integer("total_interactions").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Groups table - creator communities
export const groups = pgTable("groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  category: text("category"),
  memberCount: integer("member_count").default(0),
  isPrivate: boolean("is_private").default(false),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Group memberships
export const groupMemberships = pgTable("group_memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").references(() => groups.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  role: text("role").default("member"), // 'admin' | 'member'
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Login streaks for gamification
export const loginStreaks = pgTable("login_streaks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_address").notNull().unique(),
  currentStreak: integer("current_streak").default(0),
  longestStreak: integer("longest_streak").default(0),
  totalPoints: integer("total_points").default(0),
  lastLoginDate: timestamp("last_login_date"),
  loginDates: jsonb("login_dates").$type<string[]>().default([]),
  weeklyCalendar: jsonb("weekly_calendar").$type<boolean[]>().default([false, false, false, false, false, false, false]),
});

// Bookmarks
export const bookmarks = pgTable("bookmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  projectId: varchar("project_id").references(() => projects.id),
  coinId: varchar("coin_id").references(() => coins.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// E1XP Points Transactions
export const pointsTransactions = pgTable("points_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  amount: integer("amount").notNull(),
  type: text("type").notNull(), // 'daily_streak' | 'trade' | 'create_coin' | 'referral' | 'badge_unlock'
  description: text("description").notNull(),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Referral Tracking
export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: varchar("referrer_id").references(() => users.id).notNull(),
  referredUserId: varchar("referred_user_id").references(() => users.id).notNull(),
  status: text("status").default("pending"), // 'pending' | 'active' | 'rewarded'
  totalPointsEarned: integer("total_points_earned").default(0),
  hasTradedOrCreated: boolean("has_traded_or_created").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// OG Meta Share Tracking
export const shareTracking = pgTable("share_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  shareType: text("share_type").notNull(), // 'profile' | 'coin' | 'project' | 'referral' | 'badge'
  resourceId: text("resource_id"),
  platform: text("platform"), // 'twitter' | 'telegram' | 'facebook' | 'copy_link'
  views: integer("views").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  projects: many(projects),
  coins: many(coins),
  sentMessages: many(messages, { relationName: "sentMessages" }),
  receivedMessages: many(messages, { relationName: "receivedMessages" }),
  connections: many(connections),
  groupMemberships: many(groupMemberships),
  loginStreak: many(loginStreaks),
  pointsTransactions: many(pointsTransactions),
  shareTracking: many(shareTracking),
  referredUsers: many(referrals, { relationName: "referrer" }),
  referredBy: one(users, {
    fields: [users.referredBy],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  coin: one(coins, {
    fields: [projects.coinId],
    references: [coins.id],
  }),
}));

export const coinsRelations = relations(coins, ({ one, many }) => ({
  user: one(users, {
    fields: [coins.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
  scrapedContent: one(scrapedContent, {
    fields: [coins.scrapedContentId],
    references: [scrapedContent.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: "sentMessages",
  }),
  recipient: one(users, {
    fields: [messages.recipientId],
    references: [users.id],
    relationName: "receivedMessages",
  }),
}));

export const connectionsRelations = relations(connections, ({ one }) => ({
  user: one(users, {
    fields: [connections.userId],
    references: [users.id],
  }),
  connectedUser: one(users, {
    fields: [connections.connectedUserId],
    references: [users.id],
  }),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  creator: one(users, {
    fields: [groups.createdBy],
    references: [users.id],
  }),
  memberships: many(groupMemberships),
}));

export const groupMembershipsRelations = relations(groupMemberships, ({ one }) => ({
  group: one(groups, {
    fields: [groupMemberships.groupId],
    references: [groups.id],
  }),
  user: one(users, {
    fields: [groupMemberships.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  totalConnections: true,
  totalProfileViews: true,
  totalEarnings: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  totalViews: true,
  totalInteractions: true,
  isMinted: true,
});

export const insertFiatTransactionSchema = createInsertSchema(fiatTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWithdrawalRequestSchema = createInsertSchema(withdrawalRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCoinSchema = createInsertSchema(coins, {
  name: z.string().min(1, "Coin name is required"),
  symbol: z.string().min(1, "Symbol is required"),
  status: z.enum(["pending", "active", "minted"]).default("pending"),
}).omit({
  id: true,
  createdAt: true,
});

export const updateCoinSchema = insertCoinSchema.partial();

export type Coin = typeof coins.$inferSelect;
export type InsertCoin = z.infer<typeof insertCoinSchema>;
export type UpdateCoin = z.infer<typeof updateCoinSchema>;

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  isRead: true,
});

export const insertConnectionSchema = createInsertSchema(connections).omit({
  id: true,
  createdAt: true,
  totalInteractions: true,
});

export const insertGroupSchema = createInsertSchema(groups).omit({
  id: true,
  createdAt: true,
  memberCount: true,
});

export const insertGroupMembershipSchema = createInsertSchema(groupMemberships).omit({
  id: true,
  joinedAt: true,
});

export const insertLoginStreakSchema = createInsertSchema(loginStreaks).omit({
  id: true,
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type FiatTransaction = typeof fiatTransactions.$inferSelect;
export type InsertFiatTransaction = z.infer<typeof insertFiatTransactionSchema>;
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type InsertWithdrawalRequest = z.infer<typeof insertWithdrawalRequestSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Connection = typeof connections.$inferSelect;
export type InsertConnection = z.infer<typeof insertConnectionSchema>;

export type Group = typeof groups.$inferSelect;
export type InsertGroup = z.infer<typeof insertGroupSchema>;

export type GroupMembership = typeof groupMemberships.$inferSelect;
export type InsertGroupMembership = z.infer<typeof insertGroupMembershipSchema>;

export type LoginStreak = typeof loginStreaks.$inferSelect;
export type InsertLoginStreak = z.infer<typeof insertLoginStreakSchema>;

export type Bookmark = typeof bookmarks.$inferSelect;

export type PointsTransaction = typeof pointsTransactions.$inferSelect;
export type InsertPointsTransaction = typeof pointsTransactions.$inferInsert;

export type ShareTracking = typeof shareTracking.$inferSelect;
export type InsertShareTracking = typeof shareTracking.$inferInsert;

export const referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(users, {
    fields: [referrals.referrerId],
    references: [users.id],
    relationName: "referrer",
  }),
  referredUser: one(users, {
    fields: [referrals.referredUserId],
    references: [users.id],
  }),
}));

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;

export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true,
  totalPointsEarned: true,
  hasTradedOrCreated: true,
});

// Follows table
export const follows = pgTable("follows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  followerAddress: text("follower_address").notNull(),
  followingAddress: text("creator_address").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Follow = typeof follows.$inferSelect;
export type InsertFollow = typeof follows.$inferInsert;

export const insertFollowSchema = createInsertSchema(follows).omit({
  id: true,
  createdAt: true,
});

// Scraped Content table - imported content from URLs
export const scrapedContent = pgTable("scraped_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull(),
  platform: text("platform").notNull().default("blog"),
  title: text("title").notNull(),
  description: text("description"),
  author: text("author"),
  publishDate: text("publish_date"),
  image: text("image"),
  animationUrl: text("animation_url"),
  type: text("type"),
  content: text("content"),
  tags: jsonb("tags").$type<string[]>(),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  scrapedAt: timestamp("scraped_at").defaultNow().notNull(),
});

// Rewards table for tracking creator earnings
export const rewards = pgTable("rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  coinAddress: text("coin_address").notNull(),
  coinSymbol: text("coin_symbol").notNull(),
  transactionHash: text("transaction_hash").notNull(),
  rewardAmount: text("reward_amount").notNull(),
  rewardAmountUsd: decimal("reward_amount_usd", { precision: 18, scale: 8 }),
  rewardAmountNgn: decimal("reward_amount_ngn", { precision: 18, scale: 2 }),
  rewardCurrency: text("reward_currency").notNull().default("ZORA"),
  recipientAddress: text("recipient_address").notNull(),
  settled: boolean("settled").default(false),
  settledAt: timestamp("settled_at"),
  settlementReference: text("settlement_reference"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Naira ledger (offchain wallet)
export const nairaLedger = pgTable("naira_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recipientAddress: text("recipient_address").notNull().unique(),
  availableNgn: decimal("available_ngn", { precision: 18, scale: 2 }).default("0"),
  pendingNgn: decimal("pending_ngn", { precision: 18, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Naira ledger entries (audit trail)
export const nairaLedgerEntries = pgTable("naira_ledger_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recipientAddress: text("recipient_address").notNull(),
  entryType: text("entry_type").notNull(), // 'credit' | 'debit'
  amountNgn: decimal("amount_ngn", { precision: 18, scale: 2 }).notNull(),
  source: text("source").notNull(), // 'creator_reward' | 'withdrawal' | etc
  reference: text("reference"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Missions table - fan missions created by creators
export const missions = pgTable("missions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  creatorId: text("creator_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(), // 'hold' | 'activity' | 'loyalty' | 'event' | 'community'
  coinAddress: text("coin_address"),
  requiredAmount: decimal("required_amount", { precision: 36, scale: 18 }),
  requiredDays: integer("required_days"),
  requiredActions: jsonb("required_actions").$type<Record<string, any>>(),
  rewardType: text("reward_type").notNull(), // 'e1xp' | 'nft' | 'content' | 'coupon' | 'event_access'
  rewardValue: text("reward_value"), // url/code/tokenId/etc
  status: text("status").default("active"), // 'upcoming' | 'active' | 'closed' | 'expired'
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
});

// User missions (participation tracking)
export const userMissions = pgTable("user_missions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  missionId: varchar("mission_id").references(() => missions.id).notNull(),
  userId: text("user_id").notNull(),
  status: text("status").default("in_progress"), // 'in_progress' | 'completed' | 'claimed'
  progress: integer("progress").default(0),
  rewardStatus: text("reward_status"), // 'pending' | 'delivered' | 'failed'
  rewardDeliveredAt: timestamp("reward_delivered_at"),
  rewardDeliveryNotes: text("reward_delivery_notes"),
  rewardDeliveryValue: text("reward_delivery_value"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  claimedAt: timestamp("claimed_at"),
});

// Notifications table
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  coinAddress: text("coin_address"),
  coinSymbol: text("coin_symbol"),
  amount: text("amount"),
  transactionHash: text("transaction_hash"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Creators table
export const creators = pgTable("creators", {
  id: uuid("id").primaryKey().defaultRandom(),
  privyId: text("privy_id").unique(), // Primary identifier from Privy (nullable for legacy migration)
  address: varchar("address", { length: 42 }).unique(), // Wallet address - nullable for email-only users
  email: text("email"), // Email address for email-only users
  name: varchar("name", { length: 100 }),
  bio: text("bio"),
  avatar: text("avatar"),
  walletAddress: varchar("wallet_address", { length: 42 }), // For payouts only
  bankAccount: varchar("bank_account", { length: 20 }),
  bankCode: varchar("bank_code", { length: 10 }),
  bankName: varchar("bank_name", { length: 80 }),
  payoutRecipientCode: text("payout_recipient_code"),
  autoSettlementEnabled: boolean("auto_settlement_enabled").default(false),
  autoSettlementAddress: varchar("auto_settlement_address", { length: 42 }),
  autoSettlementUpdatedAt: timestamp("auto_settlement_updated_at"),
  verified: varchar("verified", { length: 10 }).default("false"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Comments table
export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  coinAddress: text("coin_address").notNull(),
  userAddress: text("user_address").notNull(),
  comment: text("comment").notNull(),
  transactionHash: text("transaction_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// E1XP Rewards table - track claimable rewards for coin creation, referrals, etc.
export const e1xpRewards = pgTable("e1xp_rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  amount: integer("amount").notNull(),
  type: text("type").notNull(), // 'coin_creation' | 'referral' | 'daily_streak' | 'first_trade'
  title: text("title").notNull(),
  message: text("message").notNull(),
  claimed: boolean("claimed").notNull().default(false),
  claimedAt: timestamp("claimed_at"),
  coinId: varchar("coin_id").references(() => coins.id),
  referralId: varchar("referral_id").references(() => referrals.id),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  reminderSentAt: timestamp("reminder_sent_at"),
});

// Push notification subscriptions
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dhKey: text("p256dh_key").notNull(),
  authKey: text("auth_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Type exports for new tables
export type ScrapedContent = typeof scrapedContent.$inferSelect;
export type Reward = typeof rewards.$inferSelect;
export type NairaLedger = typeof nairaLedger.$inferSelect;
export type NairaLedgerEntry = typeof nairaLedgerEntries.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Collab = typeof collabs.$inferSelect;
export type CollabMember = typeof collabMembers.$inferSelect;
export type CollabInvite = typeof collabInvites.$inferSelect;
export type Mission = typeof missions.$inferSelect;
export type UserMission = typeof userMissions.$inferSelect;
export type Creator = typeof creators.$inferSelect & {
  followerCount?: number;
  followingCount?: number;
  walletAddress?: string | null;
};
export type Comment = typeof comments.$inferSelect;
export type E1xpReward = typeof e1xpRewards.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

export const insertScrapedContentSchema = createInsertSchema(scrapedContent).omit({
  id: true,
  scrapedAt: true,
});

export const insertCollabSchema = createInsertSchema(collabs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCollabMemberSchema = createInsertSchema(collabMembers).omit({
  id: true,
  joinedAt: true,
});

export const insertCollabInviteSchema = createInsertSchema(collabInvites).omit({
  id: true,
  createdAt: true,
  respondedAt: true,
});

export const insertMissionSchema = createInsertSchema(missions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserMissionSchema = createInsertSchema(userMissions).omit({
  id: true,
  joinedAt: true,
  completedAt: true,
  claimedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  read: true,
});

export const insertCreatorSchema = createInsertSchema(creators).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  privyId: z.string().min(1, "Privy ID is required").optional(), // Optional for legacy support
  walletAddress: z.string().nullable().optional(), // Optional payout address
  bankAccount: z.string().nullable().optional(),
  bankCode: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  payoutRecipientCode: z.string().nullable().optional(),
  autoSettlementEnabled: z.boolean().optional(),
  autoSettlementAddress: z.string().nullable().optional(),
});

export const updateCreatorSchema = insertCreatorSchema.partial().extend({
  walletAddress: z.string().nullable().optional(), // allow walletAddress to be updated for payouts
});

export type InsertCreator = z.infer<typeof insertCreatorSchema>;
export type UpdateCreator = z.infer<typeof updateCreatorSchema>;
export type UpdateCreatorSchemaType = z.infer<typeof updateCreatorSchema>;

export const insertE1xpRewardSchema = createInsertSchema(e1xpRewards).omit({
  id: true,
  createdAt: true,
  claimed: true,
  claimedAt: true,
  reminderSentAt: true,
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
});

export type InsertScrapedContent = z.infer<typeof insertScrapedContentSchema>;
export type InsertCollab = z.infer<typeof insertCollabSchema>;
export type InsertCollabMember = z.infer<typeof insertCollabMemberSchema>;
export type InsertCollabInvite = z.infer<typeof insertCollabInviteSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type InsertE1xpReward = z.infer<typeof insertE1xpRewardSchema>;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type InsertMission = z.infer<typeof insertMissionSchema>;
export type InsertUserMission = z.infer<typeof insertUserMissionSchema>;

// Comment Reactions table
export const commentReactions = pgTable("comment_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  commentId: varchar("comment_id").notNull(),
  userAddress: varchar("user_address").notNull(),
  emoji: varchar("emoji", { length: 10 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User Badges table
export const userBadges = pgTable("user_badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  badgeType: text("badge_type").notNull(),
  badgeName: text("badge_name").notNull(),
  badgeIcon: text("badge_icon"),
  description: text("description"),
  earnedAt: timestamp("earned_at").defaultNow().notNull(),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
});

// Trade History table (detailed)
export const tradeHistory = pgTable("trade_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userAddress: varchar("user_address").notNull(),
  coinAddress: varchar("coin_address").notNull(),
  coinSymbol: varchar("coin_symbol"),
  tradeType: text("trade_type").notNull(),
  amountEth: text("amount_eth").notNull(),
  amountTokens: text("amount_tokens"),
  pricePerToken: text("price_per_token"),
  totalValueUsd: text("total_value_usd"),
  transactionHash: text("transaction_hash"),
  blockNumber: integer("block_number"),
  gasUsed: text("gas_used"),
  gasPrice: text("gas_price"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
});

// FOMO notification state per coin
export const coinFomoState = pgTable("coin_fomo_state", {
  coinAddress: text("coin_address").primaryKey(),
  lastMarketCap: decimal("last_market_cap", { precision: 36, scale: 6 }),
  lastVolume24h: decimal("last_volume_24h", { precision: 36, scale: 6 }),
  lastHolders: integer("last_holders"),
  lastMarketCapTier: integer("last_market_cap_tier").default(0),
  lastHolderTier: integer("last_holder_tier").default(0),
  lastVolumeAlertAt: timestamp("last_volume_alert_at"),
  lastSwapTxHash: text("last_swap_tx_hash"),
  lastSwapTimestamp: timestamp("last_swap_timestamp"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Creator Stories table
export const creatorStories = pgTable("creator_stories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  creatorAddress: varchar("creator_address").notNull(),
  contentType: text("content_type").default("image"),
  contentUrl: text("content_url"),
  textContent: text("text_content"),
  thumbnailUrl: text("thumbnail_url"),
  duration: integer("duration").default(86400),
  viewsCount: integer("views_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
});

// Story Views table
export const storyViews = pgTable("story_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storyId: varchar("story_id").notNull(),
  viewerAddress: varchar("viewer_address").notNull(),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
});

// Search History table
export const searchHistory = pgTable("search_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userAddress: varchar("user_address"),
  searchQuery: text("search_query").notNull(),
  searchType: text("search_type").default("general"),
  resultCount: integer("result_count").default(0),
  clickedResult: text("clicked_result"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Type exports for new tables
export type CommentReaction = typeof commentReactions.$inferSelect;
export type InsertCommentReaction = typeof commentReactions.$inferInsert;

export type UserBadge = typeof userBadges.$inferSelect;
export type InsertUserBadge = typeof userBadges.$inferInsert;

export type TradeHistory = typeof tradeHistory.$inferSelect;
export type InsertTradeHistory = typeof tradeHistory.$inferInsert;
export type CoinFomoState = typeof coinFomoState.$inferSelect;
export type InsertCoinFomoState = typeof coinFomoState.$inferInsert;

export type CreatorStory = typeof creatorStories.$inferSelect;
export type InsertCreatorStory = typeof creatorStories.$inferInsert;

export type StoryView = typeof storyViews.$inferSelect;
export type InsertStoryView = typeof storyViews.$inferInsert;

export type SearchHistory = typeof searchHistory.$inferSelect;
export type InsertSearchHistory = typeof searchHistory.$inferInsert;

// Additional type exports
export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
});
export type InsertComment = z.infer<typeof insertCommentSchema>;

export const insertRewardSchema = createInsertSchema(rewards).omit({
  id: true,
  createdAt: true,
});
export type InsertReward = z.infer<typeof insertRewardSchema>;

export const insertNairaLedgerSchema = createInsertSchema(nairaLedger).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertNairaLedger = z.infer<typeof insertNairaLedgerSchema>;

export const insertNairaLedgerEntrySchema = createInsertSchema(nairaLedgerEntries).omit({
  id: true,
  createdAt: true,
});
export type InsertNairaLedgerEntry = z.infer<typeof insertNairaLedgerEntrySchema>;

export const updateLoginStreakSchema = insertLoginStreakSchema.partial();
export type UpdateLoginStreak = z.infer<typeof updateLoginStreakSchema>;

export const insertCommentReactionSchema = createInsertSchema(commentReactions).omit({
  id: true,
  createdAt: true,
});

export const insertUserBadgeSchema = createInsertSchema(userBadges).omit({
  id: true,
  earnedAt: true,
});

export const insertTradeHistorySchema = createInsertSchema(tradeHistory).omit({
  id: true,
  timestamp: true,
});

export const insertCreatorStorySchema = createInsertSchema(creatorStories).omit({
  id: true,
  createdAt: true,
  viewsCount: true,
});

export const insertSearchHistorySchema = createInsertSchema(searchHistory).omit({
  id: true,
  createdAt: true,
});
