-- Team-follow foundation (v2 brief §6): citizens.favorite_team stays the
-- primary team; this table holds up to 5 additional followed teams. Slugs
-- are the canonical slugifyTeam() form ("ohio-state"). RLS: own rows only.
create table public.team_follows (
  user_id uuid not null references auth.users (id) on delete cascade,
  team_slug text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, team_slug),
  constraint team_slug_format check (team_slug ~ '^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$')
);

create index team_follows_user_idx on public.team_follows (user_id);

alter table public.team_follows enable row level security;

create policy "team_follows_select_own" on public.team_follows
  for select using (auth.uid() = user_id);

create policy "team_follows_insert_own" on public.team_follows
  for insert with check (auth.uid() = user_id);

create policy "team_follows_delete_own" on public.team_follows
  for delete using (auth.uid() = user_id);
