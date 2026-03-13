import postgres from 'postgres';
import { readFileSync } from 'fs';

const databaseUrl = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL or DATABASE_DIRECT_URL must be set');
}

const sql = postgres(databaseUrl, {
  max: 1,
  ssl: { rejectUnauthorized: false },
  idle_timeout: 20,
  connect_timeout: 10
});

async function migrate() {
  try {
    console.log('📝 Reading migration file...');
    const migrationSQL = readFileSync('./migrations/0000_bizarre_mad_thinker.sql', 'utf8');
    
    console.log('🚀 Applying migration to Supabase...');
    await sql.unsafe(migrationSQL);
    
    console.log('✅ Migration applied successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
