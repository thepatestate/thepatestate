-- Daily long-form pipeline (Josh, 2026-08-21: 1-2 standalone articles/day).
-- Extends the hardened call_site_endpoint allow-list and schedules two runs
-- (14:00 & 20:00 UTC = 10 AM & 4 PM ET).
create or replace function call_site_endpoint(path text) returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  secret text;
begin
  if path not in ('/api/ingest/poll', '/api/ingest/enrich', '/api/youtube/subscribe', '/api/playbook/send', '/api/wire/monitor', '/api/community/game-threads', '/api/play/score', '/api/articles/longform') then
    return;
  end if;
  select cron_secret into secret from private_cron_config where id = 1;
  if secret is null then return; end if;
  perform net.http_post(
    url := 'https://thepatestate.com' || path,
    headers := jsonb_build_object('x-cron-secret', secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
end;
$$;

select cron.schedule('longform-articles', '0 14,20 * * *', $$select call_site_endpoint('/api/articles/longform')$$);
