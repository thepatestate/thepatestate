# Sub-project D: The Playbook (daily email) — Design

**Date:** 2026-08-08
**Status:** Approved by Isaac (2026-08-08, "It's approved")
**Parent:** `2026-08-07-pate-state-weeks-1-2-design.md` (sub-project D) · behavior per
operations manual §8 + §12.7, adapted to currently-live engines only.

## Purpose

One daily email to confirmed citizens, assembled entirely from real site content
and sent from `porch@thepatestate.com` (verified Resend domain). Retention
engine, truthfulness rule applies: no fake rituals, stats, or filler.

## Shape

- **Trigger:** pg_cron daily 10:00 UTC (≈6:00 AM ET) → `POST /api/playbook/send`
  (`x-cron-secret` guarded; added to `call_site_endpoint`'s allow-list via a new
  migration).
- **Recipients:** Supabase auth users with `email_confirmed_at != null`, a
  `citizens` row, and `citizens.playbook_opt_out = false` (new column,
  default false — migration 0004). Queried server-side with
  `SUPABASE_SERVICE_ROLE_KEY` (new env, server-only).
- **Content (all real):**
  1. Latest episode (Sanity `episode` doc): thumbnail, title, link to
     youtube.com/watch.
  2. Up to 3 latest **published** articles (headline + dek + link to
     /notebook/<slug>); section omitted when zero.
  3. One CTA: link to the Show on YouTube + "Bring a friend to the porch"
     (/join). No ritual claims for engines that don't exist.
- **Claude (claude-sonnet-5, structured outputs, same API rules as C):** subject
  ≤45 chars + intro 1–2 sentences in Josh's voice, per §12.7 prompt
  (`prompts/playbook.md`: §12 preamble reference + §12.7 verbatim + inputs =
  today's assembled items + weekday). Fallback subject/intro constants when the
  API fails — the email still sends.
- **Send:** Resend `/emails` batch (one email per recipient, BCC-free), simple
  inline-styled HTML matching brand colors (navy/lamp/chalk, mono accents), plus
  plain-text alternative. From `The Pate State <porch@thepatestate.com>`.
- **Unsubscribe (honest, one-click):** every email footers a link to
  `/api/playbook/unsubscribe?uid=<id>&sig=<hmac>` (HMAC-SHA256 of uid with
  `CRON_SECRET`); GET flips `playbook_opt_out = true` (service role) and renders
  a tiny confirmation page. Also sets the `List-Unsubscribe` header.
- **Idempotency:** `playbook_sends` table (migration 0004: `send_date date`
  primary key, `recipients int`, `sent_at timestamptz`); the route inserts the
  date first (`on conflict do nothing`) and aborts as `{ok:true, skipped:"already-sent"}`
  when the row exists. One email per day max.
- **Skip conditions (fail-soft, logged):** zero recipients → skip; Sanity
  unreachable → skip (never send an empty/broken email); Resend failure →
  logged, the send-log row is deleted so the next manual retry can run.

## Env

`SUPABASE_SERVICE_ROLE_KEY` (already captured; add to Vercel). Reuses
`ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `CRON_SECRET`.

## Testing

- vitest: HMAC sign/verify helper; HTML assembly (given fixture episode +
  articles, renders links + unsubscribe URL; zero-article variant).
- E2E: manual trigger with curl → email arrives at the.pate.state@gmail.com
  (citizen #1); unsubscribe link flips the flag; second trigger same day skips.

## Out of scope

Wire-item digest, community stats, sponsor slots, per-user personalization,
Customer.io/Beehiiv migration, welcome/gift email (arrives with the Preseason
Guide asset).
