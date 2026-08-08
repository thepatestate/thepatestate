create table public.citizens (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null,
  display_handle text not null,
  favorite_team text,
  joined_at timestamptz not null default now(),
  constraint handle_format check (handle ~ '^[a-z0-9][a-z0-9_]{1,18}[a-z0-9]$')
);

create unique index citizens_handle_key on public.citizens (handle);

alter table public.citizens enable row level security;

create policy "citizens_select_own" on public.citizens
  for select using (auth.uid() = id);

create policy "citizens_insert_own" on public.citizens
  for insert with check (auth.uid() = id);

create policy "citizens_update_own" on public.citizens
  for update using (auth.uid() = id) with check (auth.uid() = id);
