-- The Porch community MVP (v2 brief §3, §12 Phase 2).
-- Boards / threads / posts / reactions / reports / mutes / moderation log,
-- with RLS doing the enforcement: citizens write their own content, staff
-- moderate, nobody posts anonymously, staff-only thread types stay
-- staff-only, and the moderation log is append-only.

-- ---- roles ---------------------------------------------------------------
alter table public.citizens
  add column if not exists role text not null default 'citizen'
  check (role in ('citizen', 'staff'));

-- Citizen #1 is the site owner (verified at citizenship launch).
update public.citizens set role = 'staff'
  where id = (select id from public.citizens order by joined_at asc limit 1);

-- Staff check used by policies below. SECURITY DEFINER so it can read
-- citizens regardless of the caller's row visibility.
create or replace function public.is_staff() returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (select 1 from public.citizens where id = auth.uid() and role = 'staff');
$$;

-- ---- boards --------------------------------------------------------------
create table public.boards (
  slug text primary key check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name text not null,
  kind text not null check (kind in ('national', 'recruiting', 'gameday', 'film', 'fantasy', 'askjosh', 'team')),
  team_slug text,
  description text not null default '',
  sort integer not null default 100
);

alter table public.boards enable row level security;
create policy "boards_read" on public.boards for select using (true);
-- no insert/update/delete policies: boards are managed via service role only.

insert into public.boards (slug, name, kind, team_slug, description, sort) values
  ('front-porch', 'The Front Porch', 'national', null, 'The national board: news, rankings, playoff, coaching, conferences, and the latest episode.', 10),
  ('recruiting-portal', 'Recruiting & Portal', 'recruiting', null, 'Commits, flips, the portal, and what it all actually means.', 20),
  ('game-day', 'Game Day', 'gameday', null, 'Live game threads, every big Saturday. Auto-created from the real schedule.', 30),
  ('film-room', 'Film Room', 'film', null, 'Scheme, tactics, and the why behind what you watched.', 40),
  ('fantasy-games', 'Fantasy & Games', 'fantasy', null, 'League recruitment, draft talk, and pick''em strategy.', 50),
  ('ask-josh', 'Ask Josh', 'askjosh', null, 'Mailbag submissions — the best questions get answered on the show.', 60),
  ('georgia-porch', 'Georgia Porch', 'team', 'georgia', 'The Dawgs'' corner of the porch.', 110),
  ('alabama-porch', 'Alabama Porch', 'team', 'alabama', 'The Tide''s corner of the porch.', 111),
  ('ohio-state-porch', 'Ohio State Porch', 'team', 'ohio-state', 'The Buckeyes'' corner of the porch.', 112),
  ('texas-porch', 'Texas Porch', 'team', 'texas', 'The Longhorns'' corner of the porch.', 113),
  ('michigan-porch', 'Michigan Porch', 'team', 'michigan', 'The Wolverines'' corner of the porch.', 114),
  ('lsu-porch', 'LSU Porch', 'team', 'lsu', 'The Tigers'' corner of the porch.', 115),
  ('tennessee-porch', 'Tennessee Porch', 'team', 'tennessee', 'The Vols'' corner of the porch.', 116),
  ('oregon-porch', 'Oregon Porch', 'team', 'oregon', 'The Ducks'' corner of the porch.', 117),
  ('notre-dame-porch', 'Notre Dame Porch', 'team', 'notre-dame', 'The Irish corner of the porch.', 118),
  ('clemson-porch', 'Clemson Porch', 'team', 'clemson', 'The Tigers'' corner of the porch.', 119);

-- ---- threads -------------------------------------------------------------
create table public.threads (
  id uuid primary key default gen_random_uuid(),
  board_slug text not null references public.boards (slug),
  -- Null author = system-created (auto game threads); real citizens always
  -- have author_id = their uid, enforced by the insert policy.
  author_id uuid references public.citizens (id) on delete set null,
  author_label text, -- display name for system threads ("The Porch Desk")
  title text not null check (char_length(title) between 4 and 140),
  body text not null default '' check (char_length(body) <= 10000),
  thread_type text not null default 'discussion'
    check (thread_type in ('discussion', 'question', 'poll', 'prediction', 'news', 'rumor', 'game', 'staff')),
  source_url text check (source_url is null or source_url ~* '^https?://'),
  pinned boolean not null default false,
  locked boolean not null default false,
  hidden boolean not null default false,
  reply_count integer not null default 0,
  view_count integer not null default 0,
  last_reply_at timestamptz,
  created_at timestamptz not null default now(),
  constraint system_threads_labeled check (author_id is not null or author_label is not null)
);

create index threads_board_idx on public.threads (board_slug, pinned desc, created_at desc);
create index threads_activity_idx on public.threads (coalesce(last_reply_at, created_at) desc);

alter table public.threads enable row level security;

create policy "threads_select" on public.threads for select
  using (not hidden or author_id = auth.uid() or public.is_staff());

-- Citizens create their own threads; staff-only types (news/staff/game) are
-- reserved (v2 §3.5: only staff apply Breaking News; rumors can never be
-- labeled confirmed — there is no "confirmed" type at all for citizens).
create policy "threads_insert" on public.threads for insert
  with check (
    author_id = auth.uid()
    and (thread_type in ('discussion', 'question', 'poll', 'prediction', 'rumor') or public.is_staff())
  );

-- Authors edit their own thread inside a 15-minute window; staff always.
create policy "threads_update" on public.threads for update
  using (public.is_staff() or (author_id = auth.uid() and created_at > now() - interval '15 minutes'))
  with check (public.is_staff() or (author_id = auth.uid() and created_at > now() - interval '15 minutes'));

-- Moderation columns are staff-only even where the row-level policy lets an
-- author edit: guard trigger rejects non-staff flips.
create or replace function public.guard_thread_mod_columns() returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if (new.pinned is distinct from old.pinned
      or new.locked is distinct from old.locked
      or new.hidden is distinct from old.hidden
      or new.thread_type is distinct from old.thread_type
      or new.board_slug is distinct from old.board_slug)
     and not public.is_staff()
     and auth.uid() is not null then
    raise exception 'moderation columns are staff-only';
  end if;
  return new;
end;
$$;

create trigger threads_guard_mod before update on public.threads
  for each row execute function public.guard_thread_mod_columns();

-- ---- posts (replies) -----------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  author_id uuid not null references public.citizens (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 10000),
  quoted_post_id uuid references public.posts (id),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index posts_thread_idx on public.posts (thread_id, created_at);

alter table public.posts enable row level security;

create policy "posts_select" on public.posts for select
  using (not hidden or author_id = auth.uid() or public.is_staff());

create policy "posts_insert" on public.posts for insert
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.threads t where t.id = thread_id and not t.locked and not t.hidden)
  );

create policy "posts_update" on public.posts for update
  using (public.is_staff() or (author_id = auth.uid() and created_at > now() - interval '15 minutes'))
  with check (public.is_staff() or (author_id = auth.uid() and created_at > now() - interval '15 minutes'));

-- Hidden flips on posts are staff-only.
create or replace function public.guard_post_mod_columns() returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if new.hidden is distinct from old.hidden and not public.is_staff() and auth.uid() is not null then
    raise exception 'moderation columns are staff-only';
  end if;
  if new.body is distinct from old.body and new.edited_at is null then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger posts_guard_mod before update on public.posts
  for each row execute function public.guard_post_mod_columns();

-- Reply bookkeeping on the parent thread (definer: authors can't UPDATE
-- threads directly).
create or replace function public.bump_thread_reply() returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  update public.threads
    set reply_count = reply_count + 1, last_reply_at = new.created_at
    where id = new.thread_id;
  return new;
end;
$$;

create trigger posts_bump_thread after insert on public.posts
  for each row execute function public.bump_thread_reply();

-- ---- reactions (upvotes) -------------------------------------------------
create table public.reactions (
  user_id uuid not null references public.citizens (id) on delete cascade,
  target_type text not null check (target_type in ('thread', 'post')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

alter table public.reactions enable row level security;
create policy "reactions_select" on public.reactions for select using (true);
create policy "reactions_insert" on public.reactions for insert with check (user_id = auth.uid());
create policy "reactions_delete" on public.reactions for delete using (user_id = auth.uid());

-- ---- reports -------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.citizens (id) on delete set null,
  target_type text not null check (target_type in ('thread', 'post')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create index reports_open_idx on public.reports (status, created_at desc);

alter table public.reports enable row level security;
create policy "reports_insert" on public.reports for insert with check (reporter_id = auth.uid());
create policy "reports_staff_select" on public.reports for select using (public.is_staff());
create policy "reports_staff_update" on public.reports for update using (public.is_staff());

-- ---- mutes ---------------------------------------------------------------
create table public.mutes (
  user_id uuid not null references public.citizens (id) on delete cascade,
  muted_id uuid not null references public.citizens (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, muted_id),
  constraint no_self_mute check (user_id <> muted_id)
);

alter table public.mutes enable row level security;
create policy "mutes_own" on public.mutes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---- moderation log (append-only) ---------------------------------------
create table public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.citizens (id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  note text,
  created_at timestamptz not null default now()
);

alter table public.moderation_log enable row level security;
create policy "modlog_staff_insert" on public.moderation_log for insert
  with check (public.is_staff() and actor_id = auth.uid());
create policy "modlog_staff_select" on public.moderation_log for select using (public.is_staff());
-- no update/delete policies: immutable (v2 §3.4).

-- ---- auto game threads (v2 §3.2 Game Day) --------------------------------
create or replace function call_site_endpoint(path text) returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  secret text;
begin
  if path not in ('/api/ingest/poll', '/api/ingest/enrich', '/api/youtube/subscribe', '/api/playbook/send', '/api/wire/monitor', '/api/community/game-threads') then
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

-- Daily at 12:00 UTC (7/8am ET): create game threads for today's marquee
-- slate. The endpoint no-ops outside the season.
select cron.schedule('game-threads', '0 12 * * *', $$select call_site_endpoint('/api/community/game-threads')$$);
