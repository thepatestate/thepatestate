-- Private OAuth token store (YouTube channel access — captions pipeline).
-- Same posture as private_cron_config: RLS enabled, zero policies, so only
-- the service role can touch it.
create table if not exists private_oauth (
  id text primary key,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);
alter table private_oauth enable row level security;
