-- Editorial Engine V2 — run-level observability (brief §24, Phase 0).
-- One row per V2 run (shadow, replay, or live). Stores structured stage
-- outputs and decisions only; never model reasoning. Service-role only.
create table if not exists editorial_runs (
  id text primary key,
  lane text not null,
  product text not null,
  source_id text not null,
  fixture text,
  mode text not null check (mode in ('shadow', 'replay', 'live')),
  status text not null check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null,
  completed_at timestamptz,
  cycles int not null default 0,
  decision text,
  failure_class text,
  final_score numeric,
  published_content_id text,
  total_cost_usd numeric not null default 0,
  total_calls int not null default 0,
  artifacts jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists editorial_runs_lane_started_idx on editorial_runs (lane, started_at desc);
create index if not exists editorial_runs_source_idx on editorial_runs (source_id);
alter table editorial_runs enable row level security; -- no policies: service-role only
