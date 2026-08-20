-- Story-attempt counter: verification-failed items stop consuming the
-- self-heal budget after 3 tries on identical grounding.
alter table wire_clusters add column if not exists backfill_attempts int not null default 0;
