alter table public.citizens add column if not exists playbook_opt_out boolean not null default false;

create table if not exists public.playbook_sends (
  send_date date primary key,
  recipients int not null default 0,
  sent_at timestamptz not null default now()
);
alter table public.playbook_sends enable row level security;
-- no policies: service-role only

create or replace function call_site_endpoint(path text) returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  secret text;
begin
  if path not in ('/api/ingest/poll', '/api/ingest/enrich', '/api/youtube/subscribe', '/api/playbook/send') then
    return;
  end if;
  select cron_secret into secret from private_cron_config where id = 1;
  if secret is null then return; end if;
  perform net.http_post(
    url := 'https://thepatestate.com' || path,
    headers := jsonb_build_object('x-cron-secret', secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;
revoke execute on function call_site_endpoint(text) from public, anon, authenticated;

select cron.schedule('send-playbook', '0 10 * * *', $$select call_site_endpoint('/api/playbook/send')$$);
