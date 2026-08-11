-- Competition engine (v2 brief §5.1) + the two launch competitions (§5.2
-- Window 1 Playoff Challenge, Week 1 Pick'Em). One reusable engine — games
-- are rows, not code. RLS is the enforcement layer: citizens create their
-- own entries and edit picks ONLY before the competition's lock time;
-- after lock everything is immutable (RLS + belt-and-braces triggers +
-- append-only audit), and entries become world-readable so leaderboards,
-- consensus, and group pick-reveals work per the brief.

create extension if not exists pgcrypto with schema extensions;

-- ---- scoring rules -------------------------------------------------------
-- Versioned scoring templates; every entry records the rule id + version it
-- was created under (§5.1 "scoring-rule version recorded").
create table public.scoring_rules (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
  name text not null,
  version integer not null default 1,
  config jsonb not null
);
alter table public.scoring_rules enable row level security;
create policy "scoring_rules_read" on public.scoring_rules for select using (true);
-- writes: service role only (no policies).

-- ---- competitions --------------------------------------------------------
create table public.competitions (
  slug text primary key check (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
  type text not null check (type in ('bracket', 'pickem')),
  name text not null,
  season integer not null,
  status text not null default 'open' check (status in ('open', 'scored', 'closed')),
  opens_at timestamptz not null default now(),
  locks_at timestamptz not null,
  ends_at timestamptz,
  scoring_rule_id text not null references public.scoring_rules (id),
  terms_version text not null,
  config jsonb not null default '{}'::jsonb
);
alter table public.competitions enable row level security;
create policy "competitions_read" on public.competitions for select using (true);

-- Lock check used across policies/triggers below. Competitions are world-
-- readable so plain SQL (no definer) is fine.
create or replace function public.comp_locked(comp text) returns boolean
language sql stable
set search_path = pg_catalog, public
as $$
  select coalesce((select locks_at <= now() from public.competitions where slug = comp), true);
$$;

-- ---- entries -------------------------------------------------------------
create table public.play_entries (
  id uuid primary key default gen_random_uuid(),
  competition_slug text not null references public.competitions (slug) on delete cascade,
  user_id uuid references public.citizens (id) on delete cascade,
  -- Official exhibition entries (e.g. Josh's on-the-record bracket): no
  -- user account, labeled byline, excluded from citizen leaderboards.
  is_official boolean not null default false,
  author_label text,
  display_name text not null check (char_length(display_name) between 2 and 40),
  scoring_rule_id text not null references public.scoring_rules (id),
  scoring_rule_version integer not null,
  terms_version text not null,
  tiebreak_value numeric,
  points numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_slug, user_id),
  check (user_id is not null or (is_official and author_label is not null))
);
create index play_entries_comp_idx on public.play_entries (competition_slug, points desc nulls last);
alter table public.play_entries enable row level security;

-- Own entries always visible; official entries always visible; everyone's
-- entries visible once the competition locks (§5.2 "member picks visible
-- after lock" — applied nationally, groups just filter it).
create policy "play_entries_read" on public.play_entries for select
  using (user_id = auth.uid() or is_official or public.comp_locked(competition_slug));
create policy "play_entries_insert" on public.play_entries for insert
  with check (
    user_id = auth.uid()
    and not is_official
    and not public.comp_locked(competition_slug)
    and exists (select 1 from public.competitions c where c.slug = competition_slug and c.status = 'open')
  );
create policy "play_entries_update" on public.play_entries for update
  using (user_id = auth.uid() and not public.comp_locked(competition_slug))
  with check (user_id = auth.uid() and not public.comp_locked(competition_slug));
-- no delete policy: entries are permanent once made.

-- Client updates may only touch display_name / tiebreak_value; scoring and
-- identity columns are service-role territory (auth.uid() is null there).
create or replace function public.play_entries_guard() returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is not null and (
    new.points is distinct from old.points
    or new.is_official is distinct from old.is_official
    or new.author_label is distinct from old.author_label
    or new.user_id is distinct from old.user_id
    or new.competition_slug is distinct from old.competition_slug
    or new.scoring_rule_id is distinct from old.scoring_rule_id
    or new.scoring_rule_version is distinct from old.scoring_rule_version
    or new.terms_version is distinct from old.terms_version
  ) then
    raise exception 'column not editable';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger play_entries_guard before update on public.play_entries
  for each row execute function public.play_entries_guard();

-- ---- picks ---------------------------------------------------------------
-- Generic slot/value picks. Bracket: slots seed-1..seed-12, champion,
-- (tiebreaker lives on the entry). Pick'em: slot = ESPN game id, value =
-- {"winner":"away"|"home","confidence":1..10}.
create table public.play_picks (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.play_entries (id) on delete cascade,
  slot text not null,
  value jsonb not null,
  points numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entry_id, slot)
);
alter table public.play_picks enable row level security;

create or replace function public.pick_entry_owned(eid uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (select 1 from public.play_entries e where e.id = eid and e.user_id = auth.uid());
$$;
create or replace function public.pick_entry_visible(eid uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.play_entries e
    where e.id = eid
      and (e.user_id = auth.uid() or e.is_official or public.comp_locked(e.competition_slug))
  );
$$;
create or replace function public.pick_entry_unlocked(eid uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.play_entries e
    where e.id = eid and e.user_id = auth.uid() and not public.comp_locked(e.competition_slug)
  );
$$;

create policy "play_picks_read" on public.play_picks for select
  using (public.pick_entry_visible(entry_id));
create policy "play_picks_insert" on public.play_picks for insert
  with check (public.pick_entry_unlocked(entry_id));
create policy "play_picks_update" on public.play_picks for update
  using (public.pick_entry_unlocked(entry_id))
  with check (public.pick_entry_unlocked(entry_id));
create policy "play_picks_delete" on public.play_picks for delete
  using (public.pick_entry_unlocked(entry_id));

-- Belt-and-braces immutability (§5.1 "no edits after lock"): even if a
-- policy regressed, client mutations after lock raise. Service role
-- (auth.uid() null) stays free to write points at scoring time.
create or replace function public.play_picks_lock_guard() returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare eid uuid;
begin
  eid := coalesce(new.entry_id, old.entry_id);
  if auth.uid() is not null and exists (
    select 1 from public.play_entries e
    where e.id = eid and public.comp_locked(e.competition_slug)
  ) then
    raise exception 'competition is locked';
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    new.updated_at := now();
    return new;
  end if;
  return old;
end;
$$;
create trigger play_picks_lock_guard before insert or update or delete on public.play_picks
  for each row execute function public.play_picks_lock_guard();

-- ---- leagues (private groups, §5.2) --------------------------------------
create table public.play_leagues (
  id uuid primary key default gen_random_uuid(),
  competition_slug text not null references public.competitions (slug) on delete cascade,
  name text not null check (char_length(name) between 3 and 60),
  description text not null default '' check (char_length(description) <= 300),
  is_private boolean not null default true,
  invite_code text not null unique default encode(extensions.gen_random_bytes(6), 'hex'),
  created_by uuid not null references public.citizens (id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.play_league_members (
  league_id uuid not null references public.play_leagues (id) on delete cascade,
  user_id uuid not null references public.citizens (id) on delete cascade,
  role text not null default 'member' check (role in ('commissioner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
alter table public.play_leagues enable row level security;
alter table public.play_league_members enable row level security;

-- Definer helpers keep league policies recursion-free.
create or replace function public.is_league_member(lid uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (select 1 from public.play_league_members m where m.league_id = lid and m.user_id = auth.uid());
$$;
create or replace function public.is_league_commissioner(lid uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.play_league_members m
    where m.league_id = lid and m.user_id = auth.uid() and m.role = 'commissioner'
  );
$$;
create or replace function public.league_is_public(lid uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (select 1 from public.play_leagues l where l.id = lid and not l.is_private);
$$;
create or replace function public.league_comp(lid uuid) returns text
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select competition_slug from public.play_leagues where id = lid;
$$;

create policy "play_leagues_read" on public.play_leagues for select
  using (not is_private or created_by = auth.uid() or public.is_league_member(id) or public.is_staff());
create policy "play_leagues_insert" on public.play_leagues for insert
  with check (created_by = auth.uid());
create policy "play_leagues_update" on public.play_leagues for update
  using (public.is_league_commissioner(id))
  with check (public.is_league_commissioner(id));

create policy "play_league_members_read" on public.play_league_members for select
  using (public.is_league_member(league_id) or public.league_is_public(league_id) or public.is_staff());
-- No insert policy: joining goes through join_league() below (invite code =
-- the credential) or the creator trigger.
create policy "play_league_members_delete" on public.play_league_members for delete
  using (
    user_id = auth.uid()
    or (public.is_league_commissioner(league_id) and not public.comp_locked(public.league_comp(league_id)))
  );

-- League creator is automatically its commissioner.
create or replace function public.play_league_creator_join() returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.play_league_members (league_id, user_id, role)
  values (new.id, new.created_by, 'commissioner')
  on conflict do nothing;
  return new;
end;
$$;
create trigger play_league_creator_join after insert on public.play_leagues
  for each row execute function public.play_league_creator_join();

-- Invite-code join. The code is the credential, so this runs as definer and
-- direct inserts stay closed.
create or replace function public.join_league(code text) returns uuid
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare l public.play_leagues%rowtype;
begin
  if auth.uid() is null then
    raise exception 'sign in to join a group';
  end if;
  select * into l from public.play_leagues where invite_code = lower(code);
  if not found then
    raise exception 'invalid invite code';
  end if;
  insert into public.play_league_members (league_id, user_id)
  values (l.id, auth.uid())
  on conflict do nothing;
  return l.id;
end;
$$;
grant execute on function public.join_league(text) to authenticated;

-- Pre-lock aggregate stats without exposing pre-lock entries.
create or replace function public.play_stats(comp text) returns jsonb
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'entries', (select count(*) from public.play_entries e where e.competition_slug = comp and not e.is_official)
  );
$$;
grant execute on function public.play_stats(text) to anon, authenticated;

-- ---- official results ----------------------------------------------------
-- Deterministic scoring inputs (§5.1: the official data source writes here;
-- the LLM never does). Pick'em: slot = ESPN game id, value = {"winner":...,
-- "awayPts":n,"homePts":n}. Bracket: slot = seed-N / champion.
create table public.play_results (
  competition_slug text not null references public.competitions (slug) on delete cascade,
  slot text not null,
  value jsonb not null,
  source text not null,
  recorded_at timestamptz not null default now(),
  primary key (competition_slug, slot)
);
alter table public.play_results enable row level security;
create policy "play_results_read" on public.play_results for select using (true);
-- writes: service role only.

-- ---- audit (append-only) -------------------------------------------------
create table public.play_audit (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  subject jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.play_audit enable row level security;
create policy "play_audit_read" on public.play_audit for select using (public.is_staff());
-- inserts land via the definer trigger below only.

create or replace function public.play_audit_log() returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.play_audit (actor, action, subject)
  values (
    auth.uid(),
    tg_table_name || '_' || lower(tg_op),
    jsonb_build_object(
      'id', coalesce(to_jsonb(new) -> 'id', to_jsonb(old) -> 'id'),
      'old', case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
      'new', case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
    )
  );
  return coalesce(new, old);
end;
$$;
create trigger play_entries_audit after insert or update on public.play_entries
  for each row execute function public.play_audit_log();
create trigger play_picks_audit after insert or update or delete on public.play_picks
  for each row execute function public.play_audit_log();
create trigger play_league_members_audit after insert or delete on public.play_league_members
  for each row execute function public.play_audit_log();

-- ---- seeds ---------------------------------------------------------------
insert into public.scoring_rules (id, name, version, config) values
  ('bracket-preseason-v1', 'Preseason Bracket Standard', 1,
   '{"type":"bracket_preseason","fieldPoints":10,"seedPoints":25,"champPoints":100,"tiebreaker":"championship_total_points"}'),
  ('pickem-confidence-v1', 'Confidence Pick''Em', 1,
   '{"type":"pickem_confidence","games":10,"minConfidence":1,"maxConfidence":10,"uniqueConfidence":true}');

-- Window 1 Playoff Challenge (§5.2): field + seeds + champion + tiebreaker,
-- locked at 11:58 AM ET on opening Saturday (matches published site copy).
insert into public.competitions
  (slug, type, name, season, locks_at, ends_at, scoring_rule_id, terms_version, config) values
  ('playoff-challenge-2026', 'bracket', 'Pate State Playoff Challenge — Preseason', 2026,
   '2026-08-29T15:58:00Z', '2027-01-31T00:00:00Z', 'bracket-preseason-v1', '2026-08-11',
   '{"fieldSize":12,"seededByes":4}'),
-- Week 1 Pick'Em: the 10-game marquee slate snapshot (real ESPN week-1
-- games, ids are the scoring keys), one lock for the whole slate.
  ('pickem-week-1', 'pickem', 'Week 1 Pick''Em', 2026,
   '2026-08-29T15:58:00Z', '2026-09-08T12:00:00Z', 'pickem-confidence-v1', '2026-08-11',
   '{"games":[
     {"id":"401856766","away":"North Carolina","home":"TCU","awayAbbrev":"UNC","homeAbbrev":"TCU","awayLogo":"https://a.espncdn.com/i/teamlogos/ncaa/500/153.png","homeLogo":"https://a.espncdn.com/i/teamlogos/ncaa/500/2628.png","kickoff":"2026-08-29T16:00Z","net":"ESPN"},
     {"id":"401858202","away":"NC State","home":"Virginia","awayAbbrev":"NCSU","homeAbbrev":"UVA","awayLogo":"https://a.espncdn.com/i/teamlogos/ncaa/500/152.png","homeLogo":"https://a.espncdn.com/i/teamlogos/ncaa/500/258.png","kickoff":"2026-08-29T19:30Z","net":"ESPN"},
     {"id":"401856776","away":"Colorado","home":"Georgia Tech","awayAbbrev":"COLO","homeAbbrev":"GT","awayLogo":"https://a.espncdn.com/i/teamlogos/ncaa/500/38.png","homeLogo":"https://a.espncdn.com/i/teamlogos/ncaa/500/59.png","kickoff":"2026-09-04T00:00Z","net":"ESPN"},
     {"id":"401858206","away":"Miami","home":"Stanford","awayAbbrev":"MIA","homeAbbrev":"STAN","awayLogo":"https://a.espncdn.com/i/teamlogos/ncaa/500/2390.png","homeLogo":"https://a.espncdn.com/i/teamlogos/ncaa/500/24.png","kickoff":"2026-09-05T01:00Z","net":"ESPN"},
     {"id":"401858433","away":"Boise State","home":"Oregon","awayAbbrev":"BOIS","homeAbbrev":"ORE","awayLogo":"https://a.espncdn.com/i/teamlogos/ncaa/500/68.png","homeLogo":"https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png","kickoff":"2026-09-05T19:30Z","net":"CBS"},
     {"id":"401856636","away":"Baylor","home":"Auburn","awayAbbrev":"BAY","homeAbbrev":"AUB","awayLogo":"https://a.espncdn.com/i/teamlogos/ncaa/500/239.png","homeLogo":"https://a.espncdn.com/i/teamlogos/ncaa/500/2.png","kickoff":"2026-09-05T19:30Z","net":"ABC"},
     {"id":"401856777","away":"Boston College","home":"Cincinnati","awayAbbrev":"BC","homeAbbrev":"CIN","awayLogo":"https://a.espncdn.com/i/teamlogos/ncaa/500/103.png","homeLogo":"https://a.espncdn.com/i/teamlogos/ncaa/500/2132.png","kickoff":"2026-09-05T19:30Z","net":"FOX"},
     {"id":"401856660","away":"Clemson","home":"LSU","awayAbbrev":"CLEM","homeAbbrev":"LSU","awayLogo":"https://a.espncdn.com/i/teamlogos/ncaa/500/228.png","homeLogo":"https://a.espncdn.com/i/teamlogos/ncaa/500/99.png","kickoff":"2026-09-05T23:30Z","net":"ABC"},
     {"id":"401856661","away":"Louisville","home":"Ole Miss","awayAbbrev":"LOU","homeAbbrev":"MISS","awayLogo":"https://a.espncdn.com/i/teamlogos/ncaa/500/97.png","homeLogo":"https://a.espncdn.com/i/teamlogos/ncaa/500/145.png","kickoff":"2026-09-06T23:30Z","net":"ABC"},
     {"id":"401858212","away":"SMU","home":"Florida State","awayAbbrev":"SMU","homeAbbrev":"FSU","awayLogo":"https://a.espncdn.com/i/teamlogos/ncaa/500/2567.png","homeLogo":"https://a.espncdn.com/i/teamlogos/ncaa/500/52.png","kickoff":"2026-09-07T23:30Z","net":"ESPN"}
   ]}');
