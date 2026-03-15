-- FOMO state tracking for coin-level notifications
create table if not exists coin_fomo_state (
  coin_address text primary key,
  last_market_cap numeric,
  last_volume_24h numeric,
  last_holders integer,
  last_market_cap_tier integer default 0,
  last_holder_tier integer default 0,
  last_volume_alert_at timestamptz,
  last_swap_tx_hash text,
  last_swap_timestamp timestamptz,
  updated_at timestamptz default now()
);

create index if not exists coin_fomo_state_updated_at_idx
  on coin_fomo_state (updated_at);
