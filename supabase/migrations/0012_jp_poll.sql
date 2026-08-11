-- The JP Poll — the People's Top 25 (site promise: ballots open Aug 24,
-- citizens rank a top 10 weekly, lock Sunday 8 PM ET, reveal Tuesday, full
-- vote distribution public, no anonymous ballots). Same enforcement
-- posture as the competition engine: RLS owns the lifecycle — ballots are
-- own-rows while private, immutable at lock (policies + belt-and-braces
-- trigger), world-readable once the board publishes. Tabulation is
-- deterministic code in /api/poll/tabulate; no LLM anywhere near it.

-- ---- boards --------------------------------------------------------------
create table public.jp_boards (
  id text primary key check (id ~ '^[0-9]{4}-w[0-9]{1,2}$'),
  season integer not null,
  week integer not null,
  label text not null,
  opens_at timestamptz not null,
  locks_at timestamptz not null,
  reveals_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'tabulated', 'published')),
  unique (season, week)
);
alter table public.jp_boards enable row level security;
create policy "jp_boards_read" on public.jp_boards for select using (true);
-- writes: service role only.

create or replace function public.jp_board_locked(bid text) returns boolean
language sql stable
set search_path = pg_catalog, public
as $$
  select coalesce((select locks_at <= now() from public.jp_boards where id = bid), true);
$$;
create or replace function public.jp_board_published(bid text) returns boolean
language sql stable
set search_path = pg_catalog, public
as $$
  select coalesce((select status = 'published' from public.jp_boards where id = bid), false);
$$;

-- ---- ballots -------------------------------------------------------------
create table public.jp_ballots (
  id uuid primary key default gen_random_uuid(),
  board_id text not null references public.jp_boards (id) on delete cascade,
  user_id uuid not null references public.citizens (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, user_id)
);
create table public.jp_ballot_ranks (
  ballot_id uuid not null references public.jp_ballots (id) on delete cascade,
  rank integer not null check (rank between 1 and 10),
  team_slug text not null check (team_slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
  primary key (ballot_id, rank),
  unique (ballot_id, team_slug)
);
alter table public.jp_ballots enable row level security;
alter table public.jp_ballot_ranks enable row level security;

-- Own ballots always; everyone's once the board is published ("the full
-- vote distribution goes public" — no anonymous ballots).
create policy "jp_ballots_read" on public.jp_ballots for select
  using (user_id = auth.uid() or public.jp_board_published(board_id));
create policy "jp_ballots_insert" on public.jp_ballots for insert
  with check (
    user_id = auth.uid()
    and not public.jp_board_locked(board_id)
    and exists (select 1 from public.jp_boards b where b.id = board_id and b.status = 'open' and b.opens_at <= now())
  );
create policy "jp_ballots_update" on public.jp_ballots for update
  using (user_id = auth.uid() and not public.jp_board_locked(board_id))
  with check (user_id = auth.uid() and not public.jp_board_locked(board_id));

create or replace function public.jp_ballot_owned_unlocked(bid uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.jp_ballots b
    where b.id = bid and b.user_id = auth.uid() and not public.jp_board_locked(b.board_id)
  );
$$;
create or replace function public.jp_ballot_visible(bid uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.jp_ballots b
    where b.id = bid and (b.user_id = auth.uid() or public.jp_board_published(b.board_id))
  );
$$;

create policy "jp_ranks_read" on public.jp_ballot_ranks for select
  using (public.jp_ballot_visible(ballot_id));
create policy "jp_ranks_insert" on public.jp_ballot_ranks for insert
  with check (public.jp_ballot_owned_unlocked(ballot_id));
create policy "jp_ranks_update" on public.jp_ballot_ranks for update
  using (public.jp_ballot_owned_unlocked(ballot_id))
  with check (public.jp_ballot_owned_unlocked(ballot_id));
create policy "jp_ranks_delete" on public.jp_ballot_ranks for delete
  using (public.jp_ballot_owned_unlocked(ballot_id));

-- Belt-and-braces immutability after lock (service role stays free).
create or replace function public.jp_lock_guard() returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare bid uuid;
begin
  bid := coalesce(new.ballot_id, old.ballot_id);
  if auth.uid() is not null and exists (
    select 1 from public.jp_ballots b
    where b.id = bid and public.jp_board_locked(b.board_id)
  ) then
    raise exception 'ballots are locked';
  end if;
  if tg_op in ('INSERT', 'UPDATE') then return new; end if;
  return old;
end;
$$;
create trigger jp_ranks_lock_guard before insert or update or delete on public.jp_ballot_ranks
  for each row execute function public.jp_lock_guard();

create or replace function public.jp_ballots_touch() returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger jp_ballots_touch before update on public.jp_ballots
  for each row execute function public.jp_ballots_touch();

-- Ballot writes land in the engine's append-only audit trail.
create trigger jp_ballots_audit after insert or update on public.jp_ballots
  for each row execute function public.play_audit_log();

-- Pre-publish participation count without exposing ballots.
create or replace function public.jp_ballot_count(bid text) returns integer
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select count(*)::integer from public.jp_ballots where board_id = bid;
$$;
grant execute on function public.jp_ballot_count(text) to anon, authenticated;

-- ---- published results ---------------------------------------------------
-- One row per board rank, written by the deterministic tabulator. Readable
-- only once the board publishes (the Tuesday reveal).
create table public.jp_results (
  board_id text not null references public.jp_boards (id) on delete cascade,
  rank integer not null,
  team_slug text not null,
  points numeric not null,
  first_place integer not null default 0,
  ballots integer not null,
  primary key (board_id, rank)
);
alter table public.jp_results enable row level security;
create policy "jp_results_read" on public.jp_results for select
  using (public.jp_board_published(board_id));
-- writes: service role only.

-- ---- season boards (DST-correct: America/New_York -> UTC) ----------------
insert into public.jp_boards (id, season, week, label, opens_at, locks_at, reveals_at) values
  ('2026-w1', 2026, 1, 'Week 1', '2026-08-24T12:00:00Z', '2026-08-31T00:00:00Z', '2026-09-01T16:00:00Z'),
  ('2026-w2', 2026, 2, 'Week 2', '2026-08-31T12:00:00Z', '2026-09-07T00:00:00Z', '2026-09-08T16:00:00Z'),
  ('2026-w3', 2026, 3, 'Week 3', '2026-09-07T12:00:00Z', '2026-09-14T00:00:00Z', '2026-09-15T16:00:00Z'),
  ('2026-w4', 2026, 4, 'Week 4', '2026-09-14T12:00:00Z', '2026-09-21T00:00:00Z', '2026-09-22T16:00:00Z'),
  ('2026-w5', 2026, 5, 'Week 5', '2026-09-21T12:00:00Z', '2026-09-28T00:00:00Z', '2026-09-29T16:00:00Z'),
  ('2026-w6', 2026, 6, 'Week 6', '2026-09-28T12:00:00Z', '2026-10-05T00:00:00Z', '2026-10-06T16:00:00Z'),
  ('2026-w7', 2026, 7, 'Week 7', '2026-10-05T12:00:00Z', '2026-10-12T00:00:00Z', '2026-10-13T16:00:00Z'),
  ('2026-w8', 2026, 8, 'Week 8', '2026-10-12T12:00:00Z', '2026-10-19T00:00:00Z', '2026-10-20T16:00:00Z'),
  ('2026-w9', 2026, 9, 'Week 9', '2026-10-19T12:00:00Z', '2026-10-26T00:00:00Z', '2026-10-27T16:00:00Z'),
  ('2026-w10', 2026, 10, 'Week 10', '2026-10-26T12:00:00Z', '2026-11-02T01:00:00Z', '2026-11-03T17:00:00Z'),
  ('2026-w11', 2026, 11, 'Week 11', '2026-11-02T13:00:00Z', '2026-11-09T01:00:00Z', '2026-11-10T17:00:00Z'),
  ('2026-w12', 2026, 12, 'Week 12', '2026-11-09T13:00:00Z', '2026-11-16T01:00:00Z', '2026-11-17T17:00:00Z'),
  ('2026-w13', 2026, 13, 'Week 13', '2026-11-16T13:00:00Z', '2026-11-23T01:00:00Z', '2026-11-24T17:00:00Z'),
  ('2026-w14', 2026, 14, 'Week 14', '2026-11-23T13:00:00Z', '2026-11-30T01:00:00Z', '2026-12-01T17:00:00Z'),
  ('2026-w15', 2026, 15, 'Week 15', '2026-11-30T13:00:00Z', '2026-12-07T01:00:00Z', '2026-12-08T17:00:00Z');

-- ---- cron ----------------------------------------------------------------
create or replace function call_site_endpoint(path text) returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  secret text;
begin
  if path not in ('/api/ingest/poll', '/api/ingest/enrich', '/api/youtube/subscribe', '/api/playbook/send', '/api/wire/monitor', '/api/community/game-threads', '/api/play/score', '/api/poll/tabulate') then
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

select cron.schedule('jp-poll-tabulate', '40 * * * *', $$select call_site_endpoint('/api/poll/tabulate')$$);
