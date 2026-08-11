-- Weekly Pick'Em auto-creation cron: after the current week locks, the next
-- week's competition seeds itself from the live schedule + rankings.
create or replace function call_site_endpoint(path text) returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  secret text;
begin
  if path not in ('/api/ingest/poll', '/api/ingest/enrich', '/api/youtube/subscribe', '/api/playbook/send', '/api/wire/monitor', '/api/community/game-threads', '/api/play/score', '/api/poll/tabulate', '/api/play/create-week') then
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

select cron.schedule('play-create-week', '10 17 * * *', $$select call_site_endpoint('/api/play/create-week')$$);
