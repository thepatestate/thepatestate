create table public.citizens (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null,
  display_handle text not null,
  favorite_team text,
  joined_at timestamptz not null default now(),
  constraint handle_format check (handle ~ '^[a-z0-9][a-z0-9_]{1,18}[a-z0-9]$'),
  constraint display_handle_matches check (lower(display_handle) = handle),
  constraint favorite_team_len check (favorite_team is null or char_length(favorite_team) <= 40),
  constraint handle_not_reserved check (handle not in (
    'josh','joshpate','pate','patestate','thepatestate','admin','administrator',
    'mod','moderator','official','staff','support','wiredesk','thewire',
    'citizen','porch','mayor','help','api','root','system'
  ))
);

create unique index citizens_handle_key on public.citizens (handle);

alter table public.citizens enable row level security;

create policy "citizens_select_own" on public.citizens
  for select using (auth.uid() = id);

create policy "citizens_insert_own" on public.citizens
  for insert with check (auth.uid() = id);

create policy "citizens_update_own" on public.citizens
  for update using (auth.uid() = id) with check (auth.uid() = id);
