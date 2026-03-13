create table if not exists public.withdrawal_requests (
  id varchar primary key default gen_random_uuid()::varchar,
  user_id varchar not null references public.users(id) on delete cascade,
  token_address text not null,
  token_amount numeric(36, 18) not null,
  token_decimals integer default 18,
  amount_ngn numeric(18, 2) not null,
  usd_ngn_rate numeric(18, 6),
  provider text not null default 'paystack',
  provider_reference text,
  status text not null default 'pending',
  bank_code text not null,
  bank_account text not null,
  bank_name text not null,
  payout_recipient_code text,
  onchain_tx_hash text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists withdrawal_requests_user_id_idx on public.withdrawal_requests(user_id);
create index if not exists withdrawal_requests_status_idx on public.withdrawal_requests(status);
