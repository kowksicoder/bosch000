-- Create fiat_transactions table for Naira on-ramp flows
create table if not exists fiat_transactions (
  id varchar primary key default gen_random_uuid()::varchar,
  user_id varchar not null references users(id) on delete cascade,
  creator_token_address text not null,
  amount_ngn numeric(18,2) not null,
  amount_eth numeric(18,8),
  eth_usd_rate numeric(18,6),
  usd_ngn_rate numeric(18,6),
  eth_ngn_rate numeric(18,6),
  provider text not null,
  provider_reference text not null unique,
  provider_status text,
  status text not null default 'pending',
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists idx_fiat_transactions_user_id on fiat_transactions(user_id);
create index if not exists idx_fiat_transactions_status on fiat_transactions(status);
