import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hgwhbdlejogerdghkxac.supabase.co';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnd2hiZGxlam9nZXJkZ2hreGFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc1MzI4NiwiZXhwIjoyMDc2MzI5Mjg2fQ.pTy3zUBuCUqZJd-tC4VXu-HYCO1SfrObTGh2eXHYY3g';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface Creator {
  id: string;
  address: string;
  name: string | null;
  bio: string | null;
  avatar: string | null;
  points: string;
  referral_code: string | null;
  created_at: string;
}

function generateUsername(creator: Creator): string {
  if (creator.name && creator.name.trim() !== '') {
    // Clean up the name to make it username-friendly
    const cleaned = creator.name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    return cleaned || `user_${creator.address.slice(2, 8)}`;
  }
  
  // If no name, use address
  if (creator.address.startsWith('0x')) {
    return `user_${creator.address.slice(2, 8)}`;
  }
  
  // For email-based addresses
  return creator.address.replace(/[@.]/g, '_').toLowerCase();
}

async function migrateCreatorsToUsers() {
  console.log('🔄 Starting migration of creators to users table...\n');

  // Fetch all creators
  const { data: creators, error: fetchError } = await supabase
    .from('creators')
    .select('*');

  if (fetchError) {
    console.error('❌ Error fetching creators:', fetchError);
    return;
  }

  if (!creators || creators.length === 0) {
    console.log('✅ No creators to migrate');
    return;
  }

  console.log(`📊 Found ${creators.length} creators to migrate\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const creator of creators) {
    const username = generateUsername(creator);
    
    console.log(`Processing: ${creator.name || creator.address}`);

    // Check if user already exists by wallet address
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('wallet_address', creator.address)
      .single();

    if (existingUser) {
      console.log(`  ⏭️  Skipped - already exists in users table`);
      skipCount++;
      continue;
    }

    // Check if username is taken
    const { data: existingUsername } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    const finalUsername = existingUsername ? `${username}_${creator.address.slice(-4)}` : username;

    // Insert into users table
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        wallet_address: creator.address,
        username: finalUsername,
        display_name: creator.name,
        bio: creator.bio,
        avatar_url: creator.avatar,
        e1xp_points: parseInt(creator.points) || 0,
        referral_code: creator.referral_code,
        is_admin: creator.address === 'admin_bloombetgaming_at_gmail_com' ? 1 : 0,
        created_at: creator.created_at,
      });

    if (insertError) {
      console.log(`  ❌ Error: ${insertError.message}`);
      errorCount++;
    } else {
      console.log(`  ✅ Migrated as @${finalUsername}`);
      successCount++;
    }
  }

  console.log('\n📈 Migration Summary:');
  console.log(`  ✅ Successfully migrated: ${successCount}`);
  console.log(`  ⏭️  Skipped (already exists): ${skipCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`\n🎉 Migration complete!`);
}

// Run the migration
migrateCreatorsToUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
