-- Weekday-only playbook (homepage promises "every weekday morning"); stagger enrich before send
select cron.unschedule('send-playbook');
select cron.schedule('send-playbook', '0 10 * * 1-5', $$select call_site_endpoint('/api/playbook/send')$$);
select cron.unschedule('enrich-episodes');
select cron.schedule('enrich-episodes', '0 9 * * *', $$select call_site_endpoint('/api/ingest/enrich')$$);

alter table public.playbook_sends add column if not exists content_key text;
