-- Feed-provided article text (content:encoded) captured at detection time.
-- On3's pages block our fetcher; their feed carries the full article, so
-- this is the grounding both the live monitor and the backfill draft from.
alter table wire_clusters add column if not exists source_text text;
