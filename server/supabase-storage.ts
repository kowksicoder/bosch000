import { createClient, SupabaseClientOptions } from '@supabase/supabase-js';
import {
  type Coin, type InsertCoin, type UpdateCoin,
  type ScrapedContent, type InsertScrapedContent,
  type Reward, type InsertReward,
  type Creator, type InsertCreator, type UpdateCreator,
  type Comment, type InsertComment,
  type Notification, type InsertNotification,
  type Follow, type InsertFollow,
  type Referral, type InsertReferral,
  type Collab, type InsertCollab,
  type CollabMember, type InsertCollabMember,
  type CollabInvite, type InsertCollabInvite,
  type Mission, type InsertMission,
  type UserMission, type InsertUserMission,
  type LoginStreak, type InsertLoginStreak, type UpdateLoginStreak,
  type NotificationType,
  type E1xpReward,
  type FiatTransaction, type InsertFiatTransaction, type WithdrawalRequest, type InsertWithdrawalRequest
} from '@shared/schema';
import { type User, users, type InsertUser } from '@shared/schema';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { triggerUserNotification } from './pusher';


// Initialize Supabase client with service role key for full database access
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hgwhbdlejogerdghkxac.supabase.co';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnd2hiZGxlam9nZXJkZ2hreGFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc1MzI4NiwiZXhwIjoyMDc2MzI5Mjg2fQ.pTy3zUBuCUqZJd-tC4VXu-HYCO1SfrObTGh2eXHYY3g';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Environment configuration error:');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'set' : 'missing');
  console.error('VITE_SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'set' : 'missing');
  throw new Error('Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY in .env');
}

console.log('🔌 Connecting to Supabase:', supabaseUrl);

const supabaseOptions: SupabaseClientOptions<'public'> = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    enabled: false,
  },
  global: {
    headers: {
      'x-disable-realtime': 'true',
    },
    fetch: (url, options = {}) => {
      // Block WebSocket connections to realtime
      if (url.toString().includes('/realtime/') || url.toString().includes('/v2')) {
        return Promise.reject(new Error('Realtime connections are disabled'));
      }
      return fetch(url, options);
    },
  },
  db: {
    schema: 'public',
  },
};

const supabase = createClient(supabaseUrl, supabaseServiceKey, supabaseOptions);

// Type definitions for notifications
export interface UserNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
  read: boolean;
  createdAt: string;
  updatedAt?: string;
  creator?: {
    address: string;
    name: string | null;
    avatar: string | null;
  };
}

export interface NotificationMetadata {
  points?: number;
  reason?: string;
  totalPoints?: number;
  shareText?: string;
  streakDays?: number;
  [key: string]: any;
}

export interface ModerationType {
  type: 'warning' | 'restrict' | 'ban';
  reason: string;
  duration?: number;
}

export class SupabaseStorage {
  private supabase: typeof supabase;

  constructor() {
    this.supabase = supabase;
  }

  // ===== COINS =====
  async getAllCoins(): Promise<Coin[]> {
    const { data, error } = await supabase
      .from('coins')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Coin[];
  }

  async getCoin(id: string): Promise<Coin | undefined> {
    const { data, error } = await supabase
      .from('coins')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as Coin | undefined;
  }

  async getCoinByAddress(address: string): Promise<Coin | undefined> {
    const { data, error } = await supabase
      .from('coins')
      .select('*')
      .eq('address', address)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as Coin | undefined;
  }

  async getCoinsByCreator(creator: string): Promise<Coin[]> {
    const { data, error } = await supabase
      .from('coins')
      .select('*')
      .eq('creator_wallet', creator)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Coin[];
  }

  async createCoin(insertCoin: InsertCoin): Promise<Coin> {
    const { data, error } = await supabase
      .from('coins')
      .insert({
        name: insertCoin.name,
        symbol: insertCoin.symbol,
        address: insertCoin.address,
        creator_wallet: insertCoin.creatorWallet,
        status: insertCoin.status || 'pending',
        scraped_content_id: insertCoin.scrapedContentId,
        ipfs_uri: insertCoin.ipfsUri,
        chain_id: insertCoin.chainId,
        registry_tx_hash: insertCoin.registryTxHash,
        metadata_hash: insertCoin.metadataHash,
        registered_at: insertCoin.registeredAt,
        image: insertCoin.image,
        description: insertCoin.description,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data as Coin;
  }

  async updateCoin(id: string, update: UpdateCoin): Promise<Coin | undefined> {
    const updateData: any = {};

    if (update.address !== undefined) updateData.address = update.address;
    if (update.status !== undefined) updateData.status = update.status;
    if (update.registryTxHash !== undefined) updateData.registry_tx_hash = update.registryTxHash;
    if (update.metadataHash !== undefined) updateData.metadata_hash = update.metadataHash;
    if (update.registeredAt !== undefined) updateData.registered_at = update.registeredAt;
    if (update.activityTrackerTxHash !== undefined) updateData.activity_tracker_tx_hash = update.activityTrackerTxHash;
    if (update.activityTrackerRecordedAt !== undefined) updateData.activity_tracker_recorded_at = update.activityTrackerRecordedAt;
    if (update.createdAt !== undefined) updateData.created_at = update.createdAt;
    if ((update as any).hidden !== undefined) updateData.hidden = (update as any).hidden;
    if ((update as any).pinOrder !== undefined) updateData.pin_order = (update as any).pinOrder;

    const { data, error } = await supabase
      .from('coins')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Coin;
  }

  async updateCoinByAddress(address: string, updates: Partial<Coin>): Promise<Coin | null> {
    const { data, error } = await supabase
      .from('coins')
      .update(updates as any)
      .eq('address', address)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getPinnedCoins(): Promise<Coin[]> {
    const { data, error } = await supabase
      .from('coins')
      .select('*')
      .eq('status', 'active')
      .not('pin_order', 'is', null)
      .order('pin_order', { ascending: true });

    if (error) throw error;

    // Map snake_case to camelCase for consistency
    return (data || []).map((coin: any) => ({
      ...coin,
      creatorWallet: coin.creator_wallet,
      scrapedContentId: coin.scraped_content_id,
      ipfsUri: coin.ipfs_uri,
      chainId: coin.chain_id,
      registryTxHash: coin.registry_tx_hash,
      metadataHash: coin.metadata_hash,
      registeredAt: coin.registered_at,
      createdAt: coin.created_at,
      pinOrder: coin.pin_order,
      hidden: coin.hidden,
    })) as Coin[];
  }

  async pinCoin(address: string): Promise<Coin | undefined> {
    // Check current pinned count
    const pinnedCoins = await this.getPinnedCoins();
    if (pinnedCoins.length >= 6) {
      throw new Error('Maximum of 6 coins can be pinned');
    }

    // Get the next pin order number (Supabase returns snake_case)
    const nextPinOrder = pinnedCoins.length > 0
      ? Math.max(...pinnedCoins.map(c => (c as any).pin_order || 0)) + 1
      : 1;

    // Update the coin
    const { data, error } = await supabase
      .from('coins')
      .update({ pin_order: nextPinOrder })
      .eq('address', address)
      .select()
      .single();

    if (error) throw error;
    return data as Coin;
  }

  async unpinCoin(address: string): Promise<Coin | undefined> {
    const { data, error } = await supabase
      .from('coins')
      .update({ pin_order: null })
      .eq('address', address)
      .select()
      .single();

    if (error) throw error;
    return data as Coin;
  }

  // ===== SCRAPED CONTENT =====
  async getScrapedContent(id: string): Promise<ScrapedContent | undefined> {
    const { data, error } = await supabase
      .from('scraped_content')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as ScrapedContent | undefined;
  }

  async createScrapedContent(content: InsertScrapedContent): Promise<ScrapedContent> {
    const { data, error } = await supabase
      .from('scraped_content')
      .insert({
        url: content.url,
        platform: content.platform || 'blog',
        title: content.title,
        description: content.description,
        author: content.author,
        publish_date: content.publishDate,
        image: content.image,
        content: content.content,
        tags: content.tags || [],
        metadata: content.metadata || {},
        scraped_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data as ScrapedContent;
  }

  async getAllScrapedContent(): Promise<ScrapedContent[]> {
    const { data, error } = await supabase
      .from('scraped_content')
      .select('*')
      .order('scraped_at', { ascending: false });

    if (error) throw error;
    return data as ScrapedContent[];
  }

  // ===== REWARDS =====
  async getReward(id: string): Promise<Reward | undefined> {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as Reward | undefined;
  }

  async createReward(reward: InsertReward): Promise<Reward> {
    const { data, error } = await supabase
      .from('rewards')
      .insert({
        type: reward.type,
        coin_address: reward.coinAddress,
        coin_symbol: reward.coinSymbol,
        transaction_hash: reward.transactionHash,
        reward_amount: reward.rewardAmount,
        reward_amount_usd: reward.rewardAmountUsd ?? null,
        reward_amount_ngn: reward.rewardAmountNgn ?? null,
        reward_currency: reward.rewardCurrency || 'ZORA',
        recipient_address: reward.recipientAddress,
        settled: reward.settled ?? false,
        settled_at: reward.settledAt ?? null,
        settlement_reference: reward.settlementReference ?? null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data as Reward;
  }

  async getAllRewards(): Promise<Reward[]> {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Reward[];
  }

  async getUnsettledCreatorRewards(): Promise<Reward[]> {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('type', 'creator')
      .eq('settled', false)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data as Reward[];
  }

  async markRewardSettled(id: string, settlementReference?: string): Promise<Reward | null> {
    const { data, error } = await supabase
      .from('rewards')
      .update({
        settled: true,
        settled_at: new Date().toISOString(),
        settlement_reference: settlementReference ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Reward;
  }

  // ===== NAIRA LEDGER =====
  async getNairaLedgerByAddress(recipientAddress: string) {
    const { data, error } = await supabase
      .from('naira_ledger')
      .select('*')
      .eq('recipient_address', recipientAddress)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async upsertNairaLedger(recipientAddress: string, availableNgn: string, pendingNgn: string) {
    const { data, error } = await supabase
      .from('naira_ledger')
      .upsert({
        recipient_address: recipientAddress,
        available_ngn: availableNgn,
        pending_ngn: pendingNgn,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'recipient_address' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createNairaLedgerEntry(entry: {
    recipientAddress: string;
    entryType: string;
    amountNgn: string;
    source: string;
    reference?: string | null;
    metadata?: Record<string, any>;
  }) {
    const { data, error } = await supabase
      .from('naira_ledger_entries')
      .insert({
        recipient_address: entry.recipientAddress,
        entry_type: entry.entryType,
        amount_ngn: entry.amountNgn,
        source: entry.source,
        reference: entry.reference ?? null,
        metadata: entry.metadata ?? {},
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async listNairaLedgerEntries(limit = 50) {
    const { data, error } = await supabase
      .from('naira_ledger_entries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async getNairaLedgerSummary() {
    const { data, error } = await supabase
      .from('naira_ledger')
      .select('available_ngn, pending_ngn');

    if (error) throw error;

    const totals = (data || []).reduce(
      (acc: { available: number; pending: number }, row: any) => {
        acc.available += parseFloat(row.available_ngn || '0');
        acc.pending += parseFloat(row.pending_ngn || '0');
        return acc;
      },
      { available: 0, pending: 0 },
    );

    return {
      availableNgn: totals.available,
      pendingNgn: totals.pending,
      totalNgn: totals.available + totals.pending,
      accounts: (data || []).length,
    };
  }

  async getNairaLedgerEntryByReference(reference: string) {
    const { data, error } = await supabase
      .from('naira_ledger_entries')
      .select('*')
      .eq('reference', reference)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async updateNairaLedgerEntryById(id: string, updates: {
    metadata?: Record<string, any>;
  }) {
    const { data, error } = await supabase
      .from('naira_ledger_entries')
      .update({
        metadata: updates.metadata ?? undefined,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getRewardsByCoin(coinAddress: string): Promise<Reward[]> {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('coin_address', coinAddress)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Reward[];
  }

  async getRewardsByRecipient(recipientAddress: string): Promise<Reward[]> {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('recipient_address', recipientAddress)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Reward[];
  }

  async getRewardsByRecipientInRange(
    recipientAddress: string,
    startIso: string,
    endIso?: string,
  ): Promise<Reward[]> {
    let query = supabase
      .from('rewards')
      .select('*')
      .eq('recipient_address', recipientAddress)
      .gte('created_at', startIso)
      .order('created_at', { ascending: false });

    if (endIso) {
      query = query.lte('created_at', endIso);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as Reward[];
  }

  // ===== CREATORS =====
  async getCreator(id: string): Promise<Creator | undefined> {
    const { data, error } = await supabase
      .from('creators')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as Creator | undefined;
  }

  async getCreatorByAddress(address: string): Promise<Creator | null> {
    const { data, error } = await supabase
      .from('creators')
      .select('*')
      .eq('address', address)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  async getCreatorByPrivyId(privyId: string): Promise<Creator | null> {
    const { data, error } = await supabase
      .from('creators')
      .select('*')
      .eq('privy_id', privyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  async getCreatorByName(name: string): Promise<Creator | null> {
    const normalized = name.trim();
    if (!normalized) return null;

    const { data, error } = await supabase
      .from('creators')
      .select('*')
      .ilike('name', normalized)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  async getCreatorByReferralCode(referralCode: string): Promise<Creator | undefined> {
    const { data, error } = await supabase
      .from('creators')
      .select('*')
      .eq('referral_code', referralCode)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as Creator | undefined;
  }

  async createCreator(data: InsertCreator): Promise<Creator> {
    // For email-only users, we need to allow null address
    // First check if address column allows null, if not we'll need to add a placeholder
    const creatorData: any = {
      privy_id: data.privyId || null,
      address: data.address || `email_${data.privyId || Date.now()}`, // Placeholder for email users
      name: data.name || null,
      bio: data.bio || null,
      avatar: data.avatar || null,
      verified: data.verified || 'false',
      total_coins: data.totalCoins || '0',
      total_volume: data.totalVolume || '0',
      followers: data.followers || '0',
      referral_code: data.referralCode || null,
      points: data.points || '0',
      bank_account: data.bankAccount ?? null,
      bank_code: data.bankCode ?? null,
      bank_name: data.bankName ?? null,
      payout_recipient_code: data.payoutRecipientCode ?? null,
      auto_settlement_enabled: data.autoSettlementEnabled ?? false,
      auto_settlement_address: data.autoSettlementAddress ?? null,
      auto_settlement_updated_at: data.autoSettlementUpdatedAt ?? null,
      created_at: new Date().toISOString(),
    };

    const { data: creator, error } = await supabase
      .from('creators')
      .insert(creatorData)
      .select()
      .single();

    if (error) {
      console.error('Failed to create creator:', error);
      throw error;
    }
    return creator as Creator;
  }

  async updateCreator(id: string, update: UpdateCreator): Promise<Creator | undefined> {
    const updates: any = {
      updated_at: new Date().toISOString()
    };

    if (update.name !== undefined) updates.name = update.name;
    if (update.bio !== undefined) updates.bio = update.bio;
    if (update.avatar !== undefined) updates.avatar = update.avatar;
    if (update.verified !== undefined) updates.verified = update.verified;
    if (update.totalCoins !== undefined) updates.total_coins = update.totalCoins;
    if (update.totalVolume !== undefined) updates.total_volume = update.totalVolume;
    if (update.followers !== undefined) updates.followers = update.followers;
    if (update.referralCode !== undefined) updates.referral_code = update.referralCode;
    if (update.points !== undefined) updates.points = update.points;
    const bankDetailsUpdated =
      update.bankAccount !== undefined ||
      update.bankCode !== undefined ||
      update.bankName !== undefined;

    if (update.bankAccount !== undefined) updates.bank_account = update.bankAccount;
    if (update.bankCode !== undefined) updates.bank_code = update.bankCode;
    if (update.bankName !== undefined) updates.bank_name = update.bankName;
    if (update.payoutRecipientCode !== undefined) {
      updates.payout_recipient_code = update.payoutRecipientCode;
    } else if (bankDetailsUpdated) {
      // Force refresh of Paystack recipient if bank details changed.
      updates.payout_recipient_code = null;
    }
    if (update.autoSettlementEnabled !== undefined) {
      updates.auto_settlement_enabled = update.autoSettlementEnabled;
    }
    if (update.autoSettlementAddress !== undefined) {
      updates.auto_settlement_address = update.autoSettlementAddress;
    }
    if (update.autoSettlementUpdatedAt !== undefined) {
      updates.auto_settlement_updated_at = update.autoSettlementUpdatedAt;
    }

    const { data, error } = await supabase
      .from('creators')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Creator;
  }

  async getAllCreators(): Promise<Creator[]> {
    const { data, error } = await supabase
      .from('creators')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Creator[];
  }

  async getTopCreators(): Promise<Creator[]> {
    const { data, error } = await supabase
      .from('creators')
      .select('*')
      .order('total_coins', { ascending: false })
      .limit(10);

    if (error) throw error;
    return data as Creator[];
  }

  // ===== COLLABS =====
  async createCollab(data: InsertCollab): Promise<Collab> {
    const { data: collab, error } = await supabase
      .from('collabs')
      .insert({
        coin_id: data.coinId || null,
        coin_address: data.coinAddress || null,
        title: data.title || null,
        created_by: data.createdBy,
        status: data.status || 'active',
        metadata: data.metadata || {},
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return {
      ...collab,
      coinId: collab.coin_id,
      coinAddress: collab.coin_address,
      createdBy: collab.created_by,
      createdAt: collab.created_at,
      updatedAt: collab.updated_at,
    } as Collab;
  }

  async getCollab(collabId: string): Promise<Collab | null> {
    const { data, error } = await supabase
      .from('collabs')
      .select('*')
      .eq('id', collabId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return {
      ...data,
      coinId: data.coin_id,
      coinAddress: data.coin_address,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    } as Collab;
  }

  async addCollabMember(data: InsertCollabMember): Promise<CollabMember> {
    const { data: member, error } = await supabase
      .from('collab_members')
      .insert({
        collab_id: data.collabId,
        member_id: data.memberId,
        role: data.role || 'creator',
        split_bps: data.splitBps ?? 0,
        status: data.status || 'active',
        joined_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return {
      ...member,
      collabId: member.collab_id,
      memberId: member.member_id,
      splitBps: member.split_bps,
      joinedAt: member.joined_at,
    } as CollabMember;
  }

  async updateCollabMemberStatus(collabId: string, memberId: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('collab_members')
      .update({ status })
      .eq('collab_id', collabId)
      .eq('member_id', memberId);

    if (error) throw error;
  }

  async getCollabMembers(collabId: string): Promise<CollabMember[]> {
    const { data, error } = await supabase
      .from('collab_members')
      .select('*')
      .eq('collab_id', collabId)
      .order('joined_at', { ascending: true });

    if (error) throw error;
    return (data || []).map((member) => ({
      ...member,
      collabId: member.collab_id,
      memberId: member.member_id,
      splitBps: member.split_bps,
      joinedAt: member.joined_at,
    })) as CollabMember[];
  }

  async getCollabsForMember(memberId: string): Promise<Array<{ collab: Collab; member: CollabMember }>> {
    const { data: members, error } = await supabase
      .from('collab_members')
      .select('*')
      .eq('member_id', memberId)
      .eq('status', 'active')
      .order('joined_at', { ascending: false });

    if (error) throw error;
    if (!members || members.length === 0) return [];

    const collabIds = [...new Set(members.map((member: any) => member.collab_id))];
    const { data: collabs, error: collabError } = await supabase
      .from('collabs')
      .select('*')
      .in('id', collabIds);

    if (collabError) throw collabError;
    const collabMap = new Map((collabs || []).map((collab: any) => [collab.id, collab]));

    return members.map((member: any) => ({
      collab: {
        ...collabMap.get(member.collab_id),
        coinId: collabMap.get(member.collab_id)?.coin_id,
        coinAddress: collabMap.get(member.collab_id)?.coin_address,
        createdBy: collabMap.get(member.collab_id)?.created_by,
        createdAt: collabMap.get(member.collab_id)?.created_at,
        updatedAt: collabMap.get(member.collab_id)?.updated_at,
      } as Collab,
      member: {
        ...member,
        collabId: member.collab_id,
        memberId: member.member_id,
        splitBps: member.split_bps,
        joinedAt: member.joined_at,
      } as CollabMember,
    }));
  }

  async createCollabInvite(data: InsertCollabInvite): Promise<CollabInvite> {
    const { data: invite, error } = await supabase
      .from('collab_invites')
      .insert({
        collab_id: data.collabId,
        inviter_id: data.inviterId,
        invitee_id: data.inviteeId,
        status: data.status || 'pending',
        message: data.message || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return {
      ...invite,
      collabId: invite.collab_id,
      inviterId: invite.inviter_id,
      inviteeId: invite.invitee_id,
      createdAt: invite.created_at,
      respondedAt: invite.responded_at,
    } as CollabInvite;
  }

  async getCollabInvitesForMember(memberId: string): Promise<CollabInvite[]> {
    const { data, error } = await supabase
      .from('collab_invites')
      .select('*')
      .eq('invitee_id', memberId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((invite) => ({
      ...invite,
      collabId: invite.collab_id,
      inviterId: invite.inviter_id,
      inviteeId: invite.invitee_id,
      createdAt: invite.created_at,
      respondedAt: invite.responded_at,
    })) as CollabInvite[];
  }

  async getCollabInvite(inviteId: string): Promise<CollabInvite | null> {
    const { data, error } = await supabase
      .from('collab_invites')
      .select('*')
      .eq('id', inviteId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return {
      ...data,
      collabId: data.collab_id,
      inviterId: data.inviter_id,
      inviteeId: data.invitee_id,
      createdAt: data.created_at,
      respondedAt: data.responded_at,
    } as CollabInvite;
  }

  async updateCollabInviteStatus(inviteId: string, status: string): Promise<CollabInvite | null> {
    const { data, error } = await supabase
      .from('collab_invites')
      .update({
        status,
        responded_at: new Date().toISOString(),
      })
      .eq('id', inviteId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return null;
    return {
      ...data,
      collabId: data.collab_id,
      inviterId: data.inviter_id,
      inviteeId: data.invitee_id,
      createdAt: data.created_at,
      respondedAt: data.responded_at,
    } as CollabInvite;
  }

  // ===== MISSIONS =====
  async createMission(data: InsertMission): Promise<Mission> {
    const { data: mission, error } = await supabase
      .from('missions')
      .insert({
        creator_id: data.creatorId,
        title: data.title,
        description: data.description || null,
        type: data.type,
        coin_address: data.coinAddress || null,
        required_amount: data.requiredAmount || null,
        required_days: data.requiredDays || null,
        required_actions: data.requiredActions || null,
        reward_type: data.rewardType,
        reward_value: data.rewardValue || null,
        status: data.status || 'active',
        starts_at: data.startsAt || null,
        ends_at: data.endsAt || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return {
      ...mission,
      creatorId: mission.creator_id,
      coinAddress: mission.coin_address,
      requiredAmount: mission.required_amount,
      requiredDays: mission.required_days,
      requiredActions: mission.required_actions,
      rewardType: mission.reward_type,
      rewardValue: mission.reward_value,
      startsAt: mission.starts_at,
      endsAt: mission.ends_at,
      createdAt: mission.created_at,
      updatedAt: mission.updated_at,
    } as Mission;
  }

  async getMissions(): Promise<Mission[]> {
    const { data, error } = await supabase
      .from('missions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((mission: any) => ({
      ...mission,
      creatorId: mission.creator_id,
      coinAddress: mission.coin_address,
      requiredAmount: mission.required_amount,
      requiredDays: mission.required_days,
      requiredActions: mission.required_actions,
      rewardType: mission.reward_type,
      rewardValue: mission.reward_value,
      startsAt: mission.starts_at,
      endsAt: mission.ends_at,
      createdAt: mission.created_at,
      updatedAt: mission.updated_at,
    })) as Mission[];
  }

  async getMission(id: string): Promise<Mission | null> {
    const { data, error } = await supabase
      .from('missions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return {
      ...data,
      creatorId: data.creator_id,
      coinAddress: data.coin_address,
      requiredAmount: data.required_amount,
      requiredDays: data.required_days,
      requiredActions: data.required_actions,
      rewardType: data.reward_type,
      rewardValue: data.reward_value,
      startsAt: data.starts_at,
      endsAt: data.ends_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    } as Mission;
  }

  async updateMission(id: string, updates: Partial<InsertMission>): Promise<Mission | null> {
    const payload: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.type !== undefined) payload.type = updates.type;
    if (updates.coinAddress !== undefined) payload.coin_address = updates.coinAddress;
    if (updates.requiredAmount !== undefined) payload.required_amount = updates.requiredAmount;
    if (updates.requiredDays !== undefined) payload.required_days = updates.requiredDays;
    if (updates.requiredActions !== undefined) payload.required_actions = updates.requiredActions;
    if (updates.rewardType !== undefined) payload.reward_type = updates.rewardType;
    if (updates.rewardValue !== undefined) payload.reward_value = updates.rewardValue;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.startsAt !== undefined) payload.starts_at = updates.startsAt;
    if (updates.endsAt !== undefined) payload.ends_at = updates.endsAt;

    const { data, error } = await supabase
      .from('missions')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return null;
    return {
      ...data,
      creatorId: data.creator_id,
      coinAddress: data.coin_address,
      requiredAmount: data.required_amount,
      requiredDays: data.required_days,
      requiredActions: data.required_actions,
      rewardType: data.reward_type,
      rewardValue: data.reward_value,
      startsAt: data.starts_at,
      endsAt: data.ends_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    } as Mission;
  }

  async getUserMission(missionId: string, userId: string): Promise<UserMission | null> {
    const { data, error } = await supabase
      .from('user_missions')
      .select('*')
      .eq('mission_id', missionId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return {
      ...data,
      missionId: data.mission_id,
      userId: data.user_id,
      rewardStatus: data.reward_status,
      rewardDeliveredAt: data.reward_delivered_at,
      rewardDeliveryNotes: data.reward_delivery_notes,
      rewardDeliveryValue: data.reward_delivery_value,
      joinedAt: data.joined_at,
      completedAt: data.completed_at,
      claimedAt: data.claimed_at,
    } as UserMission;
  }

  async getUserMissions(userId: string): Promise<UserMission[]> {
    const { data, error } = await supabase
      .from('user_missions')
      .select('*')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((entry: any) => ({
      ...entry,
      missionId: entry.mission_id,
      userId: entry.user_id,
      rewardStatus: entry.reward_status,
      rewardDeliveredAt: entry.reward_delivered_at,
      rewardDeliveryNotes: entry.reward_delivery_notes,
      rewardDeliveryValue: entry.reward_delivery_value,
      joinedAt: entry.joined_at,
      completedAt: entry.completed_at,
      claimedAt: entry.claimed_at,
    })) as UserMission[];
  }

  async getUserMissionsByMissionIds(missionIds: string[]): Promise<UserMission[]> {
    if (!missionIds.length) return [];
    const { data, error } = await supabase
      .from('user_missions')
      .select('*')
      .in('mission_id', missionIds);

    if (error) throw error;
    return (data || []).map((entry: any) => ({
      ...entry,
      missionId: entry.mission_id,
      userId: entry.user_id,
      rewardStatus: entry.reward_status,
      rewardDeliveredAt: entry.reward_delivered_at,
      rewardDeliveryNotes: entry.reward_delivery_notes,
      rewardDeliveryValue: entry.reward_delivery_value,
      joinedAt: entry.joined_at,
      completedAt: entry.completed_at,
      claimedAt: entry.claimed_at,
    })) as UserMission[];
  }

  async createUserMission(data: InsertUserMission): Promise<UserMission> {
    const { data: record, error } = await supabase
      .from('user_missions')
      .insert({
        mission_id: data.missionId,
        user_id: data.userId,
        status: data.status || 'in_progress',
        progress: data.progress ?? 0,
        reward_status: (data as any).rewardStatus || null,
        reward_delivery_notes: (data as any).rewardDeliveryNotes || null,
        reward_delivery_value: (data as any).rewardDeliveryValue || null,
        joined_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return {
      ...record,
      missionId: record.mission_id,
      userId: record.user_id,
      rewardStatus: record.reward_status,
      rewardDeliveredAt: record.reward_delivered_at,
      rewardDeliveryNotes: record.reward_delivery_notes,
      rewardDeliveryValue: record.reward_delivery_value,
      joinedAt: record.joined_at,
      completedAt: record.completed_at,
      claimedAt: record.claimed_at,
    } as UserMission;
  }

  async updateUserMission(
    id: string,
    updates: Partial<InsertUserMission> & {
      completedAt?: string | null;
      claimedAt?: string | null;
      rewardStatus?: string | null;
      rewardDeliveredAt?: string | null;
      rewardDeliveryNotes?: string | null;
      rewardDeliveryValue?: string | null;
    },
  ): Promise<UserMission | null> {
    const payload: any = {};
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.progress !== undefined) payload.progress = updates.progress;
    if (updates.completedAt !== undefined) payload.completed_at = updates.completedAt;
    if (updates.claimedAt !== undefined) payload.claimed_at = updates.claimedAt;
    if (updates.rewardStatus !== undefined) payload.reward_status = updates.rewardStatus;
    if (updates.rewardDeliveredAt !== undefined) payload.reward_delivered_at = updates.rewardDeliveredAt;
    if (updates.rewardDeliveryNotes !== undefined) payload.reward_delivery_notes = updates.rewardDeliveryNotes;
    if (updates.rewardDeliveryValue !== undefined) payload.reward_delivery_value = updates.rewardDeliveryValue;

    const { data, error } = await supabase
      .from('user_missions')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return null;
    return {
      ...data,
      missionId: data.mission_id,
      userId: data.user_id,
      rewardStatus: data.reward_status,
      rewardDeliveredAt: data.reward_delivered_at,
      rewardDeliveryNotes: data.reward_delivery_notes,
      rewardDeliveryValue: data.reward_delivery_value,
      joinedAt: data.joined_at,
      completedAt: data.completed_at,
      claimedAt: data.claimed_at,
    } as UserMission;
  }

  async getPendingMissionFulfillments(creatorId?: string): Promise<Array<{
    userMissionId: string;
    missionId: string;
    missionTitle: string;
    userId: string;
    rewardType: string;
    rewardValue?: string | null;
    rewardStatus?: string | null;
    completedAt?: string | null;
    coinAddress?: string | null;
  }>> {
    const missions = await this.getMissions();
    const filtered = creatorId
      ? missions.filter((mission) => mission.creatorId === creatorId)
      : missions;

    if (!filtered.length) return [];

    const missionIds = filtered.map((mission) => mission.id);
    const userMissions = await this.getUserMissionsByMissionIds(missionIds);

    const missionMap = new Map<string, Mission>();
    filtered.forEach((mission) => missionMap.set(mission.id, mission));

    return userMissions
      .filter((entry) => entry.rewardStatus === 'pending')
      .map((entry) => {
        const mission = missionMap.get(entry.missionId);
        return {
          userMissionId: entry.id,
          missionId: entry.missionId,
          missionTitle: mission?.title || 'Mission',
          userId: entry.userId,
          rewardType: mission?.rewardType || 'unknown',
          rewardValue: mission?.rewardValue || null,
          rewardStatus: entry.rewardStatus || null,
          completedAt: entry.completedAt || null,
          coinAddress: mission?.coinAddress || null,
        };
      });
  }

  // Points System Methods
  async addPoints(creatorId: string, amount: number, reason: string): Promise<void> {
    // Accept creator id, wallet address, or privy ID
    let creator = await this.getCreator(creatorId);
    if (!creator) {
      // Try looking up by address
      creator = await this.getCreatorByAddress(creatorId);
    }
    if (!creator) {
      // Try looking up by Privy ID (for email-only users)
      creator = await this.getCreatorByPrivyId(creatorId);
    }

    if (!creator) throw new Error('Creator not found');

    const currentPoints = parseInt(creator.points || '0');
    const newPoints = currentPoints + amount;

    await this.updateCreator(creator.id, { points: newPoints.toString() });
  }

  async awardPoints(creatorId: string, amount: number, reason: string, type: NotificationType): Promise<void> {
    // Add points (supports wallet address, creator id, or Privy ID)
    await this.addPoints(creatorId, amount, reason);

    // Resolve creator record (after points update)
    let creator = await this.getCreator(creatorId);
    if (!creator) creator = await this.getCreatorByAddress(creatorId);
    if (!creator) creator = await this.getCreatorByPrivyId(creatorId);
    if (!creator) return;

    const newPoints = parseInt(creator.points || '0');

    // Use address for wallet users, privyId for email-only users
    const userId = creator.address || creator.privyId || creator.id;

    // Use notification service
    const { notificationService } = await import('./notification-service');
    await notificationService.notifyE1XPEarned(userId, amount, reason);

    // Build profile URL - use name for email users without address
    const profileUrl = creator.address
      ? `https://every1.fun/profile/${creator.address}`
      : creator.name
        ? `https://every1.fun/@${creator.name}`
        : `https://every1.fun`;

    await this.createNotification({
      userId,
      type,
      title: '⚡ E1XP Points Earned!',
      message: `You earned ${amount} E1XP points for ${reason}`,
      metadata: {
        points: amount,
        reason,
        totalPoints: newPoints,
        shareText: `I just earned ${amount} E1XP points on @Every1Fun for ${reason}! Total: ${newPoints} ⚡\n\nJoin me: ${profileUrl}\n\n#Every1Fun #E1XP #Web3`
      },
      read: false
    });
  }

  async getDailyPointsStatus(creatorId: string): Promise<{ claimed: boolean; streak: number; nextClaimAmount: number }> {
    const today = new Date().toISOString().split('T')[0];

    const { data: claimData, error: claimError } = await supabase
      .from('daily_points')
      .select('*')
      .eq('creator_id', creatorId)
      .eq('date', today)
      .single();

    if (claimError && claimError.code !== 'PGRST116') throw claimError;

    const { data: streakData, error: streakError } = await supabase
      .from('daily_points')
      .select('date')
      .eq('creator_id', creatorId)
      .order('date', { ascending: false });

    if (streakError) throw streakError;

    let streak = 0;
    if (streakData && streakData.length > 0) {
      const dates = streakData.map(d => new Date(d.date));
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      if (dates[0].toISOString().split('T')[0] === yesterday.toISOString().split('T')[0]) {
        for (let i = 0; i < dates.length; i++) {
          const expectedDate = new Date();
          expectedDate.setDate(expectedDate.getDate() - (i + 1));
          if (dates[i].toISOString().split('T')[0] === expectedDate.toISOString().split('T')[0]) {
            streak++;
          } else break;
        }
      }
    }

    const basePoints = 10;
    const streakBonus = Math.floor(streak / 7) * 5;
    const nextClaimAmount = basePoints + streakBonus;

    return {
      claimed: !!claimData,
      streak,
      nextClaimAmount
    };
  }

  async claimDailyPoints(creatorId: string): Promise<number> {
    const { claimed, streak, nextClaimAmount } = await this.getDailyPointsStatus(creatorId);
    if (claimed) throw new Error('Daily points already claimed');

    const today = new Date().toISOString().split('T')[0];

    const { error } = await supabase
      .from('daily_points')
      .insert({
        creator_id: creatorId,
        date: today,
        points: nextClaimAmount
      });

    if (error) throw error;

    await this.awardPoints(
      creatorId,
      nextClaimAmount,
      `daily login (${streak + 1} day streak)`,
      'points_earned'
    );

    if ((streak + 1) % 7 === 0) {
      // Get creator address for notification
      const creator = await this.getCreator(creatorId);
      if (creator) {
        await this.createNotification({
          userId: creator.address,
          type: 'streak_milestone',
          title: '🎉 Weekly Streak Achievement!',
          message: `Congratulations! You've maintained a ${streak + 1} day streak! Keep it up for more bonus points!`,
          metadata: {
            streakDays: streak + 1,
            shareText: `I just hit a ${streak + 1} day streak on @Every1Fun! 🔥 Earning more E1XP points every day!\n\n#Every1Fun #E1XP #Web3`
          },
          read: false
        });
      }
    }

    return nextClaimAmount;
  }

  // Notification Methods
  // Flexible createNotification: accepts payloads with either creator_id, userId, user_id or combinations.
  async createNotification(data: any): Promise<Notification> {
    // Map creator_id or userId to user_id for the database
    const userId = data.userId || data.creator_id || data.user_id;

    if (!userId) {
      console.error('Cannot create notification: no user_id provided', data);
      throw new Error('user_id is required for notifications');
    }

    const notificationData = {
      user_id: userId,
      type: data.type,
      title: data.title,
      message: data.message,
      coin_address: data.coinAddress || data.coin_address || null,
      coin_symbol: data.coinSymbol || data.coin_symbol || null,
      amount: data.amount || null,
      transaction_hash: data.transactionHash || data.transaction_hash || null,
      read: data.read || false,
      created_at: new Date().toISOString(),
    };

    const { data: notification, error } = await supabase
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    if (error) {
      console.error('Failed to create notification:', error);
      throw error;
    }

    // Map snake_case to camelCase for the frontend
    const payload = {
      ...notification,
      userId: notification.user_id,
      coinAddress: notification.coin_address,
      coinSymbol: notification.coin_symbol,
      transactionHash: notification.transaction_hash,
      createdAt: notification.created_at,
      updatedAt: notification.updated_at,
    } as Notification;

    try {
      await triggerUserNotification(userId, payload);
    } catch (notifyError) {
      console.warn('Failed to emit Pusher notification:', notifyError);
    }

    return payload;
  }

  async getUserNotifications(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Map snake_case to camelCase for the frontend
    return (data || []).map(notification => ({
      ...notification,
      userId: notification.user_id,
      coinAddress: notification.coin_address,
      coinSymbol: notification.coin_symbol,
      transactionHash: notification.transaction_hash,
      createdAt: notification.created_at,
      updatedAt: notification.updated_at,
    })) as Notification[];
  }

  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Map snake_case to camelCase for the frontend
    return (data || []).map(notification => ({
      ...notification,
      userId: notification.user_id,
      coinAddress: notification.coin_address,
      coinSymbol: notification.coin_symbol,
      transactionHash: notification.transaction_hash,
      createdAt: notification.created_at,
      updatedAt: notification.updated_at,
    })) as Notification[];
  }

  async getUnreadNotificationsByUser(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('read', false)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Map snake_case to camelCase for the frontend
    return (data || []).map(notification => ({
      ...notification,
      userId: notification.user_id,
      coinAddress: notification.coin_address,
      coinSymbol: notification.coin_symbol,
      transactionHash: notification.transaction_hash,
      createdAt: notification.created_at,
      updatedAt: notification.updated_at,
    })) as Notification[];
  }

  async markNotificationAsRead(id: string): Promise<Notification | undefined> {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Map snake_case to camelCase for the frontend
    if (data) {
      return {
        ...data,
        userId: data.user_id,
        coinAddress: data.coin_address,
        coinSymbol: data.coin_symbol,
        transactionHash: data.transaction_hash,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      } as Notification;
    }
    return undefined;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId);

    if (error) throw error;
  }

  async deleteNotification(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  // Moderation Methods
  async moderateUser(creatorId: string, action: ModerationType): Promise<void> {
    const now = new Date();
    const expiresAt = action.duration
      ? new Date(now.getTime() + action.duration * 24 * 60 * 60 * 1000)
      : null;

    const { error: moderationError } = await supabase
      .from('moderation_actions')
      .insert({
        creator_id: creatorId,
        type: action.type,
        reason: action.reason,
        expires_at: expiresAt?.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      });

    if (moderationError) throw moderationError;

    const updates: any = {
      status: action.type === 'warning' ? 'warned' : action.type,
      restricted_until: expiresAt?.toISOString(),
      updated_at: now.toISOString()
    };

    const { error: updateError } = await supabase
      .from('creators')
      .update(updates)
      .eq('id', creatorId);

    if (updateError) throw updateError;

    const notification = {
      creator_id: creatorId,
      type: `account_${action.type}`,
      title: `Account ${action.type === 'warning' ? 'Warning' : action.type === 'restrict' ? 'Restricted' : 'Banned'}`,
      message: `Your account has been ${action.type === 'warning' ? 'warned' : action.type === 'restrict' ? 'restricted' : 'banned'} for the following reason: ${action.reason}`,
      metadata: {
        type: action.type,
        reason: action.reason,
        duration: action.duration,
        expiresAt: expiresAt?.toISOString()
      },
      read: false,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert(notification);

    if (notificationError) throw notificationError;
  }

  async getModerationHistory(creatorId: string): Promise<ModerationType[]> {
    const { data, error } = await supabase
      .from('moderation_actions')
      .select('*')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as ModerationType[];
  }

  // ===== PUSH SUBSCRIPTIONS =====
  async createPushSubscription(data: { userAddress: string; subscription: string; endpoint: string }): Promise<void> {
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_address: data.userAddress,
        subscription: data.subscription,
        endpoint: data.endpoint,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'user_address'
      });

    if (error) throw error;
  }

  async getPushSubscriptionsByUser(userAddress: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_address', userAddress);

    if (error) throw error;
    return data || [];
  }

  async getAllPushSubscriptions(): Promise<any[]> {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (error) throw error;
    return data || [];
  }

  // ===== COMMENTS =====
  async createComment(comment: InsertComment): Promise<Comment> {
    const { data, error } = await supabase
      .from('comments')
      .insert({
        coin_address: comment.coinAddress,
        user_address: comment.userAddress,
        comment: comment.comment,
        transaction_hash: comment.transactionHash,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data as Comment;
  }

  async getCommentsByCoin(coinAddress: string): Promise<Comment[]> {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('coin_address', coinAddress)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Comment[];
  }

  async getAllComments(): Promise<Comment[]> {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Comment[];
  }

  // ===== FOLLOWS =====
  async createFollow(insertFollow: InsertFollow): Promise<Follow> {
    const { data, error } = await supabase
      .from('follows')
      .insert({
        follower_address: insertFollow.followerAddress,
        creator_address: insertFollow.followingAddress,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data as Follow;
  }

  async deleteFollow(followerAddress: string, followingAddress: string): Promise<boolean> {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_address', followerAddress)
      .eq('creator_address', followingAddress);

    if (error) throw error;
    return true;
  }

  async getFollowers(userAddress: string): Promise<Follow[]> {
    const { data, error } = await supabase
      .from('follows')
      .select('*')
      .eq('creator_address', userAddress)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Follow[];
  }

  async getFollowing(userAddress: string): Promise<Follow[]> {
    const { data, error } = await supabase
      .from('follows')
      .select('*')
      .eq('follower_address', userAddress)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Follow[];
  }

  async isFollowing(followerAddress: string, followingAddress: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_address', followerAddress)
      .eq('creator_address', followingAddress)
      .single();

    return data !== null && !error;
  }

  async getFollowersByAddress(userAddress: string): Promise<Follow[]> {
    return this.getFollowers(userAddress);
  }

  async getFollowingByAddress(userAddress: string): Promise<Follow[]> {
    return this.getFollowing(userAddress);
  }

  // ===== REFERRALS =====
  async createReferral(insertReferral: InsertReferral): Promise<Referral> {
    const { data, error } = await supabase
      .from('referrals')
      .insert({
        referrer_address: insertReferral.referrerAddress,
        referred_address: insertReferral.referredAddress,
        referral_code: insertReferral.referralCode,
        points_earned: insertReferral.pointsEarned || '100',
        claimed: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data as Referral;
  }

  async getReferralsByReferrer(referrerAddress: string): Promise<Referral[]> {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_address', referrerAddress)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Referral[];
  }

  async getReferralsByCode(referralCode: string): Promise<Referral[]> {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referral_code', referralCode)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Referral[];
  }

  async getReferralByAddresses(referrerAddress: string, referredAddress: string): Promise<Referral | undefined> {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_address', referrerAddress)
      .eq('referred_address', referredAddress)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as Referral | undefined;
  }

  async updateReferralByAddresses(
    referrerAddress: string,
    referredAddress: string,
    updates: { pointsEarned?: string | number; claimed?: boolean }
  ) {
    const payload: any = {};
    if (updates.pointsEarned !== undefined) {
      payload.points_earned = updates.pointsEarned;
    }
    if (updates.claimed !== undefined) {
      payload.claimed = updates.claimed;
    }

    const { data, error } = await supabase
      .from('referrals')
      .update(payload)
      .eq('referrer_address', referrerAddress)
      .eq('referred_address', referredAddress)
      .select()
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  // ===== LOGIN STREAKS =====
  async getLoginStreak(userId: string): Promise<LoginStreak | undefined> {
    console.log('[Storage] getLoginStreak for identifier:', userId);

    const { data, error } = await supabase
      .from('login_streaks')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('[Storage] No login streak found for user:', userId);
        return undefined;
      }
      console.error('Login streak fetch error:', error);
      throw error;
    }

    if (!data) {
      console.log('[Storage] No login streak data returned for user:', userId);
      return undefined;
    }

    console.log('[Storage] Found login streak:', {
      currentStreak: data.current_streak,
      longestStreak: data.longest_streak,
      lastLoginDate: data.last_login_date,
    });

    const now = new Date();
    const lastLoginDate = data.last_login_date;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];

    // Build weekly calendar showing which days this week were checked in
    const weeklyCalendar = [false, false, false, false, false, false, false];
    const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const mondayIndex = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1; // Convert to Monday-first (0 = Monday)

    // Mark today as checked in if user has checked in today
    if (lastLoginDate === today) {
      weeklyCalendar[mondayIndex] = true;
    }

    // Map snake_case to camelCase
    return {
      id: data.id,
      userId: data.user_id,
      currentStreak: data.current_streak,
      longestStreak: data.longest_streak,
      lastLoginDate: data.last_login_date,
      totalPoints: data.total_points,
      loginDates: data.login_dates,
      weeklyCalendar: weeklyCalendar,
    } as LoginStreak;
  }

  async createLoginStreak(insertLoginStreak: InsertLoginStreak): Promise<LoginStreak> {
    const { data, error } = await supabase
      .from('login_streaks')
      .insert({
        user_id: insertLoginStreak.userId,
        current_streak: insertLoginStreak.currentStreak,
        longest_streak: insertLoginStreak.longestStreak,
        last_login_date: insertLoginStreak.lastLoginDate,
        total_points: insertLoginStreak.totalPoints,
        login_dates: insertLoginStreak.loginDates,
        weekly_calendar: insertLoginStreak.weeklyCalendar || [false, false, false, false, false, false, false],
      })
      .select()
      .single();

    if (error) throw error;

    // Map snake_case to camelCase
    return {
      id: data.id,
      userId: data.user_id,
      currentStreak: data.current_streak,
      longestStreak: data.longest_streak,
      lastLoginDate: data.last_login_date,
      totalPoints: data.total_points,
      loginDates: data.login_dates,
      weeklyCalendar: data.weekly_calendar,
    } as LoginStreak;
  }

  async updateLoginStreak(userAddress: string, update: UpdateLoginStreak): Promise<LoginStreak | undefined> {
    const updates: any = { updated_at: new Date().toISOString() };

    if (update.currentStreak !== undefined) updates.current_streak = update.currentStreak;
    if (update.longestStreak !== undefined) updates.longest_streak = update.longestStreak;
    if (update.lastLoginDate !== undefined) updates.last_login_date = update.lastLoginDate;
    if (update.totalPoints !== undefined) updates.total_points = update.totalPoints;
    if (update.loginDates !== undefined) updates.login_dates = update.loginDates;
    if (update.weeklyCalendar !== undefined) updates.weekly_calendar = update.weeklyCalendar;

    const { data, error } = await supabase
      .from('login_streaks')
      .update(updates)
      .eq('user_address', userAddress)
      .select()
      .single();

    if (error) throw error;
    return data as LoginStreak | undefined;
  }

  async checkInStreak(userId: string): Promise<{ currentStreak: number; pointsEarned: number; isFirstLogin: boolean }> {
    const today = new Date().toISOString().split('T')[0];

    // Get existing streak data
    const { data: existingStreak, error: fetchError } = await supabase
      .from('login_streaks')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    // Check if already checked in today
    if (existingStreak?.last_login_date === today) {
      throw new Error('You have already checked in today. Come back tomorrow!');
    }

    // Check if this is the user's first login
    const isFirstLogin = !existingStreak;

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let currentStreak = 1;
    let pointsEarned = 10;

    if (existingStreak) {
      if (existingStreak.last_login_date === yesterday) {
        currentStreak = (existingStreak.current_streak || 0) + 1;
      }
    }

    // Calculate bonus points for streaks
    if (currentStreak === 3) pointsEarned = 25;
    else if (currentStreak === 7) pointsEarned = 50;
    else if (currentStreak === 30) pointsEarned = 200;

    const longestStreak = Math.max(currentStreak, existingStreak?.longest_streak || 0);

    if (existingStreak) {
      const { error } = await supabase
        .from('login_streaks')
        .update({
          current_streak: currentStreak,
          longest_streak: longestStreak,
          last_login_date: today,
          total_points: (existingStreak.total_points || 0) + pointsEarned,
        })
        .eq('user_id', userId);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('login_streaks')
        .upsert({
          user_id: userId,
          current_streak: currentStreak,
          longest_streak: longestStreak,
          last_login_date: today,
          total_points: pointsEarned,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
    }

    // Award points to creator
    await this.awardPoints(userId, pointsEarned, `Daily login streak (Day ${currentStreak})`, 'daily_login');

    return { currentStreak, pointsEarned, isFirstLogin };
  }


  // ===== E1XP REWARDS =====
  async getE1xpRewardsByUser(userId: string): Promise<E1xpReward[]> {
    const { data, error } = await supabase
      .from('e1xp_rewards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      // Return empty array if table doesn't exist yet
      if (error.code === 'PGRST205') {
        console.log('e1xp_rewards table not found, returning empty array');
        return [];
      }
      throw error;
    }
    return data || [];
  }

  async getUnclaimedE1xpRewardsByUser(userId: string): Promise<E1xpReward[]> {
    const { data, error } = await supabase
      .from('e1xp_rewards')
      .select('*')
      .eq('user_id', userId)
      .eq('claimed', false)
      .order('created_at', { ascending: false });

    if (error) {
      // Return empty array if table doesn't exist yet
      if (error.code === 'PGRST205') {
        console.log('e1xp_rewards table not found, returning empty array');
        return [];
      }
      throw error;
    }
    return data || [];
  }

  async claimE1xpReward(rewardId: string): Promise<E1xpReward | undefined> {
    const { data, error } = await supabase
      .from('e1xp_rewards')
      .update({ claimed: true, claimed_at: new Date().toISOString() })
      .eq('id', rewardId)
      .select()
      .single();

    if (error) throw error;
    return data as E1xpReward | undefined;
  }

  async createE1xpReward(reward: any): Promise<E1xpReward> {
    const { data, error } = await supabase
      .from('e1xp_rewards')
      .insert({
        user_id: reward.userId,
        amount: reward.amount,
        type: reward.type,
        title: reward.title,
        message: reward.message,
        metadata: reward.metadata || {},
        claimed: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data as E1xpReward;
  }

  async getRewardsByCreator(address: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('recipient_address', address)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getRewardsByCreatorInRange(address: string, startIso: string, endIso?: string): Promise<any[]> {
    let query = supabase
      .from('rewards')
      .select('*')
      .eq('recipient_address', address)
      .gte('created_at', startIso);

    if (endIso) {
      query = query.lt('created_at', endIso);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // ===== USERS (for E1XP and referrals) =====
  async getAllUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all users:', error);
      // Return empty array if table doesn't exist or other error
      if (error.code === 'PGRST205') {
        console.log('users table not found, returning empty array');
        return [];
      }
      throw error;
    }
    return data as User[];
  }

  async getUserByPrivyId(privyId: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.privyId, privyId))
      .limit(1);
    return result[0];
  }

  async getUserByAddress(address: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.walletAddress, address))
      .limit(1);
    return result[0];
  }

  async getUserById(id: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUser(id: string, update: Partial<User>): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set(update)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async getUserByReferralCode(referralCode: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.referralCode, referralCode))
      .limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as User | undefined;
  }

  // ===== COMMENT REACTIONS =====
  async addCommentReaction(data: { commentId: string; userAddress: string; emoji: string }) {
    const { data: reaction, error } = await supabase
      .from('comment_reactions')
      .upsert({
        comment_id: data.commentId,
        user_address: data.userAddress,
        emoji: data.emoji,
      })
      .select()
      .single();

    if (error) throw error;
    return reaction;
  }

  async removeCommentReaction(commentId: string, userAddress: string, emoji: string) {
    const { error } = await supabase
      .from('comment_reactions')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_address', userAddress)
      .eq('emoji', emoji);

    if (error) throw error;
  }

  async getCommentReactions(commentId: string) {
    const { data, error } = await supabase
      .from('comment_reactions')
      .select('*')
      .eq('comment_id', commentId);

    if (error) throw error;
    return data || [];
  }

  // ===== USER BADGES =====
  async awardBadge(data: { userId: string; badgeType: string; badgeName: string; badgeIcon?: string; description?: string; metadata?: any }) {
    const { data: badge, error } = await supabase
      .from('user_badges')
      .insert({
        user_id: data.userId,
        badge_type: data.badgeType,
        badge_name: data.badgeName,
        badge_icon: data.badgeIcon,
        description: data.description,
        metadata: data.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return badge;
  }

  async getUserBadges(userId: string) {
    const { data, error } = await supabase
      .from('user_badges')
      .select('*')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // ===== TRADE HISTORY =====
  async recordTrade(data: {
    userAddress: string;
    coinAddress: string;
    coinSymbol?: string;
    tradeType: string;
    amountEth: string;
    amountTokens?: string;
    pricePerToken?: string;
    totalValueUsd?: string;
    transactionHash?: string;
    blockNumber?: number;
    gasUsed?: string;
    gasPrice?: string;
    metadata?: any;
  }) {
    const { data: trade, error } = await supabase
      .from('trade_history')
      .insert({
        user_address: data.userAddress,
        coin_address: data.coinAddress,
        coin_symbol: data.coinSymbol,
        trade_type: data.tradeType,
        amount_eth: data.amountEth,
        amount_tokens: data.amountTokens,
        price_per_token: data.pricePerToken,
        total_value_usd: data.totalValueUsd,
        transaction_hash: data.transactionHash,
        block_number: data.blockNumber,
        gas_used: data.gasUsed,
        gas_price: data.gasPrice,
        metadata: data.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return trade;
  }

  async getUserTradeHistory(userAddress: string, limit = 50) {
    const { data, error } = await supabase
      .from('trade_history')
      .select('*')
      .eq('user_address', userAddress)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async getCoinTradeHistory(coinAddress: string, limit = 50) {
    const { data, error } = await supabase
      .from('trade_history')
      .select('*')
      .eq('coin_address', coinAddress)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  // ===== CREATOR STORIES =====
  async createStory(data: {
    creatorAddress: string;
    contentType?: string;
    contentUrl?: string;
    textContent?: string;
    thumbnailUrl?: string;
    duration?: number;
  }) {
    const expiresAt = new Date(Date.now() + (data.duration || 86400) * 1000);

    const { data: story, error } = await supabase
      .from('creator_stories')
      .insert({
        creator_address: data.creatorAddress,
        content_type: data.contentType || 'image',
        content_url: data.contentUrl,
        text_content: data.textContent,
        thumbnail_url: data.thumbnailUrl,
        duration: data.duration || 86400,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return story;
  }

  async getActiveStories(creatorAddress?: string) {
    let query = supabase
      .from('creator_stories')
      .select('*')
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (creatorAddress) {
      query = query.eq('creator_address', creatorAddress);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async recordStoryView(storyId: string, viewerAddress: string) {
    const { error: viewError } = await supabase
      .from('story_views')
      .upsert({
        story_id: storyId,
        viewer_address: viewerAddress,
      });

    if (viewError && viewError.code !== '23505') throw viewError;

    const { error: updateError } = await supabase.rpc('increment_story_views', { story_id: storyId });
    if (updateError) console.error('Error incrementing story views:', updateError);
  }

  async getStoryViews(storyId: string) {
    const { data, error } = await supabase
      .from('story_views')
      .select('*')
      .eq('story_id', storyId);

    if (error) throw error;
    return data || [];
  }

  // ===== SEARCH HISTORY =====
  async recordSearch(data: {
    userAddress?: string;
    searchQuery: string;
    searchType?: string;
    resultCount?: number;
    clickedResult?: string;
  }) {
    const { data: search, error } = await supabase
      .from('search_history')
      .insert({
        user_address: data.userAddress,
        search_query: data.searchQuery,
        search_type: data.searchType || 'general',
        result_count: data.resultCount || 0,
        clicked_result: data.clickedResult,
      })
      .select()
      .single();

    if (error) throw error;
    return search;
  }

  async getPopularSearches(limit = 10) {
    const { data, error } = await supabase
      .from('search_history')
      .select('search_query, COUNT(*) as count')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .group('search_query')
      .order('count', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async getUserSearchHistory(userAddress: string, limit = 20) {
    const { data, error } = await supabase
      .from('search_history')
      .select('*')
      .eq('user_address', userAddress)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  // ===== MESSAGES =====
  async createMessage(insertMessage: any): Promise<any> {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: insertMessage.senderId,
        recipient_id: insertMessage.recipientId,
        content: insertMessage.content,
        message_type: insertMessage.messageType || 'text',
        is_read: false,
      })
      .select()
      .single();

    if (error) throw error;

    // Map snake_case to camelCase
    return {
      id: data.id,
      senderId: data.sender_id,
      recipientId: data.recipient_id,
      content: data.content,
      messageType: data.message_type,
      isRead: data.is_read,
      createdAt: new Date(data.created_at),
    };
  }

  async getMessagesBetweenUsers(userId1: string, userId2: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${userId1},recipient_id.eq.${userId2}),and(sender_id.eq.${userId2},recipient_id.eq.${userId1})`)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Map snake_case to camelCase
    return (data || []).map(msg => ({
      id: msg.id,
      senderId: msg.sender_id,
      recipientId: msg.recipient_id,
      content: msg.content,
      messageType: msg.message_type,
      isRead: msg.is_read,
      createdAt: new Date(msg.created_at),
    }));
  }

  async markMessagesAsRead(userId: string, otherUserId: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('recipient_id', userId)
      .eq('sender_id', otherUserId)
      .eq('is_read', false);

    if (error) throw error;
  }

  async getConversationsForUser(userId: string): Promise<Array<{ otherUserId: string, lastMessage: any }>> {
    // Get all messages where user is sender or recipient
    const { data: allMessages, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group by conversation partner
    const conversationMap = new Map<string, any>();

    for (const msg of allMessages || []) {
      const otherUserId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id;
      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, {
          id: msg.id,
          senderId: msg.sender_id,
          recipientId: msg.recipient_id,
          content: msg.content,
          messageType: msg.message_type,
          isRead: msg.is_read,
          createdAt: new Date(msg.created_at),
        });
      }
    }

    return Array.from(conversationMap.entries()).map(([otherUserId, lastMessage]) => ({
      otherUserId,
      lastMessage
    }));
  }

  async getUnreadMessageCount(userId: string, otherUserId: string): Promise<number> {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('sender_id', otherUserId)
      .eq('is_read', false);

    if (error) throw error;
    return count || 0;
  }

  // ===== FIAT TRANSACTIONS =====
  async createFiatTransaction(insertTx: InsertFiatTransaction): Promise<FiatTransaction> {
    const { data, error } = await supabase
      .from('fiat_transactions')
      .insert({
        user_id: insertTx.userId,
        creator_token_address: insertTx.creatorTokenAddress,
        amount_ngn: insertTx.amountNgn,
        amount_eth: insertTx.amountEth ?? null,
        eth_usd_rate: insertTx.ethUsdRate ?? null,
        usd_ngn_rate: insertTx.usdNgnRate ?? null,
        eth_ngn_rate: insertTx.ethNgnRate ?? null,
        provider: insertTx.provider,
        provider_reference: insertTx.providerReference,
        provider_status: insertTx.providerStatus ?? null,
        status: insertTx.status ?? 'pending',
        metadata: insertTx.metadata ?? {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data as FiatTransaction;
  }

  async updateFiatTransactionByReference(reference: string, updates: Partial<FiatTransaction>): Promise<FiatTransaction | null> {
    const { data, error } = await supabase
      .from('fiat_transactions')
      .update({
        amount_eth: updates.amountEth ?? undefined,
        eth_usd_rate: updates.ethUsdRate ?? undefined,
        usd_ngn_rate: updates.usdNgnRate ?? undefined,
        eth_ngn_rate: updates.ethNgnRate ?? undefined,
        provider_status: updates.providerStatus ?? undefined,
        status: updates.status ?? undefined,
        metadata: updates.metadata ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('provider_reference', reference)
      .select()
      .single();

    if (error) throw error;
    return data as FiatTransaction;
  }

  async getFiatTransactionByReference(reference: string): Promise<FiatTransaction | null> {
    const { data, error } = await supabase
      .from('fiat_transactions')
      .select('*')
      .eq('provider_reference', reference)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as FiatTransaction;
  }

  // ===== WITHDRAWAL REQUESTS =====
  async createWithdrawalRequest(insertRequest: InsertWithdrawalRequest): Promise<WithdrawalRequest> {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .insert({
        user_id: insertRequest.userId,
        token_address: insertRequest.tokenAddress,
        token_amount: insertRequest.tokenAmount,
        token_decimals: insertRequest.tokenDecimals ?? 18,
        amount_ngn: insertRequest.amountNgn,
        usd_ngn_rate: insertRequest.usdNgnRate ?? null,
        provider: insertRequest.provider ?? 'paystack',
        provider_reference: insertRequest.providerReference ?? null,
        status: insertRequest.status ?? 'pending',
        bank_code: insertRequest.bankCode,
        bank_account: insertRequest.bankAccount,
        bank_name: insertRequest.bankName,
        payout_recipient_code: insertRequest.payoutRecipientCode ?? null,
        onchain_tx_hash: insertRequest.onchainTxHash ?? null,
        metadata: insertRequest.metadata ?? {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data as WithdrawalRequest;
  }

  async updateWithdrawalRequestById(id: string, updates: Partial<WithdrawalRequest>): Promise<WithdrawalRequest | null> {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .update({
        token_decimals: updates.tokenDecimals ?? undefined,
        amount_ngn: updates.amountNgn ?? undefined,
        usd_ngn_rate: updates.usdNgnRate ?? undefined,
        provider_reference: updates.providerReference ?? undefined,
        status: updates.status ?? undefined,
        payout_recipient_code: updates.payoutRecipientCode ?? undefined,
        onchain_tx_hash: updates.onchainTxHash ?? undefined,
        metadata: updates.metadata ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as WithdrawalRequest;
  }

  async getWithdrawalRequestById(id: string): Promise<WithdrawalRequest | null> {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as WithdrawalRequest;
  }

  // ===== BLOG POSTS =====
  async listBlogPosts(options?: {
    status?: string;
    category?: string;
    includeDrafts?: boolean;
  }) {
    let query = supabase
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    if (!options?.includeDrafts) {
      query = query.eq('status', options?.status || 'published');
    } else if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async getBlogPostBySlug(slug: string, includeDrafts = false) {
    let query = supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .limit(1)
      .single();

    if (!includeDrafts) {
      query = query.eq('status', 'published');
    }

    const { data, error } = await query;
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async getBlogPostById(id: string) {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async createBlogPost(post: {
    title: string;
    slug: string;
    subtitle?: string | null;
    excerpt?: string | null;
    content?: string | null;
    coverUrl?: string | null;
    category?: string | null;
    authorName?: string | null;
    status?: string | null;
    publishedAt?: string | null;
  }) {
    const { data, error } = await supabase
      .from('blog_posts')
      .insert({
        title: post.title,
        slug: post.slug,
        subtitle: post.subtitle ?? null,
        excerpt: post.excerpt ?? null,
        content: post.content ?? null,
        cover_url: post.coverUrl ?? null,
        category: post.category ?? null,
        author_name: post.authorName ?? null,
        status: post.status || 'draft',
        published_at: post.publishedAt ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateBlogPost(id: string, updates: {
    title?: string;
    subtitle?: string | null;
    excerpt?: string | null;
    content?: string | null;
    coverUrl?: string | null;
    category?: string | null;
    status?: string | null;
    publishedAt?: string | null;
  }) {
    const { data, error } = await supabase
      .from('blog_posts')
      .update({
        title: updates.title ?? undefined,
        subtitle: updates.subtitle ?? undefined,
        excerpt: updates.excerpt ?? undefined,
        content: updates.content ?? undefined,
        cover_url: updates.coverUrl ?? undefined,
        category: updates.category ?? undefined,
        status: updates.status ?? undefined,
        published_at: updates.publishedAt ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

export const storage = new SupabaseStorage();
