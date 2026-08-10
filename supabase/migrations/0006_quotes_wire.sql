-- v1.2 ops manual: verbatim quote archive (§26) + Wire Desk cluster state (§3) + monitor cron

-- Josh's quote archive — "Josh said it first" (§2.4a / §26). Service-role only.
create table if not exists josh_quotes (
  id uuid primary key default gen_random_uuid(),
  yt_id text not null,
  quote text not null,
  ts_seconds int not null default 0,
  topic text not null default '',
  teams text[] not null default '{}',
  heat int not null default 1 check (heat between 1 and 5),
  created_at timestamptz not null default now(),
  unique (yt_id, quote)
);
create index if not exists josh_quotes_yt_idx on josh_quotes (yt_id);
create index if not exists josh_quotes_teams_idx on josh_quotes using gin (teams);
alter table josh_quotes enable row level security; -- no policies: service-role only

-- Wire Desk cluster/dedup state (§3.2). One row per detected story cluster.
create table if not exists wire_clusters (
  id uuid primary key default gen_random_uuid(),
  cluster_key text not null unique,
  title text not null,
  source_urls text[] not null default '{}',
  source_outlets text[] not null default '{}',
  importance int,
  item_id text,   -- Sanity wireItem _id once created
  story_id text,  -- Sanity wireStory _id once created (importance >= 7)
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists wire_clusters_seen_idx on wire_clusters (last_seen);
alter table wire_clusters enable row level security; -- no policies: service-role only

-- Extend the cron endpoint allow-list with the wire monitor.
create or replace function call_site_endpoint(path text) returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  secret text;
begin
  if path not in ('/api/ingest/poll', '/api/ingest/enrich', '/api/youtube/subscribe', '/api/playbook/send', '/api/wire/monitor') then
    return;
  end if;
  select cron_secret into secret from private_cron_config where id = 1;
  if secret is null then return; end if;
  perform net.http_post(
    url := 'https://thepatestate.com' || path,
    headers := jsonb_build_object('x-cron-secret', secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;
revoke execute on function call_site_endpoint(text) from public, anon, authenticated;

-- Wire monitoring cadence (§11): every 10 minutes, 6am–midnight ET (10-04 UTC covers ET across DST edge).
select cron.schedule('wire-monitor', '*/10 10-23,0-4 * * *', $$select call_site_endpoint('/api/wire/monitor')$$);
