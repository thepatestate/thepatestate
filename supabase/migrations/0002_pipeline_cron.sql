create extension if not exists pg_cron;
create extension if not exists pg_net;

-- One-row config table holding the cron secret (populated out-of-band, never in git)
create table if not exists private_cron_config (
  id int primary key default 1 check (id = 1),
  cron_secret text not null
);
alter table private_cron_config enable row level security;
-- no policies: service-role/superuser only

create or replace function call_site_endpoint(path text) returns void
language plpgsql security definer as $$
declare
  secret text;
begin
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

select cron.schedule('poll-youtube', '*/15 * * * *', $$select call_site_endpoint('/api/ingest/poll')$$);
select cron.schedule('enrich-episodes', '0 10 * * *', $$select call_site_endpoint('/api/ingest/enrich')$$);
select cron.schedule('renew-push-lease', '0 8 * * 1', $$select call_site_endpoint('/api/youtube/subscribe')$$);
