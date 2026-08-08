# The Pate State — Weeks 1–2 Design (v2, supersedes lean-v1 spec)

**Date:** 2026-08-07
**Status:** Approved by Isaac (2026-08-07, evening)
**Supersedes:** `2026-08-07-pate-state-site-design.md` (lean 3-page v1)
**Authority:** `wireframes/` (Josh's v1.1, 17 pages) wins on design;
`docs/pate-state-operations-manual.md` wins on behavior. Conflicts logged as
issues against manual section numbers.

## Scope: manual §17 "Weeks 1–2"

Four sub-projects, each with its own plan and execution cycle:

- **A. Wireframe port** — pixel-faithful Next.js port of all wireframe pages,
  design system, live YouTube-driven surfaces (home hero, Show page, clips).
  No new accounts required. Starts immediately.
- **B. Citizenship** — Supabase auth (email magic link + Google OAuth), ≤30s
  signup (handle + optional favorite team), gating per manual §9.2 (gate card
  UX, 🔑 badges), citizens table per §9.3.
- **C. Episode ingest + companion pipeline** — YouTube push webhook (PuSH) +
  polling fallback, captions-based transcripts, Claude companion-article
  drafts (manual §12.2 prompt), Sanity as CMS + approval dashboard
  (draft → ai-drafted → approved → published), article pages per
  `wireframes/article.html`.
- **D. The Playbook** — daily 5:30 AM ET assembly from published content,
  Claude subject/intro (§12.7), Resend send at 6:00 AM. Test mode (Isaac's
  inbox) until a sending domain exists.

## Locked service decisions

| Concern | Choice | Notes |
|---|---|---|
| Framework/host | Next.js App Router on Vercel | unchanged from v1 spec |
| CMS + approval UI | **Sanity** | Studio's workflow states ARE the §2.4 approval dashboard |
| DB/auth | **Supabase** | citizens, gating; pg_cron for schedules |
| Email | **Resend** | manual permits swap to Customer.io/Beehiiv later |
| Scheduling | **Supabase pg_cron → Next API routes** + YouTube PuSH webhook | Vercel Hobby cron is daily-only; avoids Inngest account |
| Transcripts | **YouTube captions only** (Whisper deferred) | no captions → draft from title/description, flagged low-confidence |
| Generation model | **current Sonnet** (`claude-sonnet-5`) | manual's `claude-sonnet-4-6` is stale |
| Prompts | repo `/prompts`, versioned | verbatim from manual §12 + global preamble |

## Demo-state rule (revised de-faking)

Pages whose data engines land in Weeks 3–6 (scores, poll voting, pick'em,
recruiting, playoffs interactions) are built pixel-faithful NOW with the
wireframe's sample data, but every such surface carries a visible
`PRESEASON PREVIEW` label chip. Label it, don't fake it. Surfaces that ARE
live in Weeks 1–2 (episodes, clips, articles, citizenship) show only real data.

## Accounts (all under the new Gmail)

Existing: Gmail, GitHub `thepatestate`, Vercel. To create as sub-projects
need them: Google Cloud (YouTube Data API v3 key), Anthropic (card required),
Sanity, Supabase, Resend. Secrets live in `.env.local` (gitignored) and Vercel
env vars — never in chat or git.

## Out of scope for Weeks 1–2 (manual Weeks 3–6)

JP Poll voting/tabulation, live scores (CFBD), Wire monitoring/Wire Desk,
Pick'Em engine, pros harvesting, recruiting sync, playoff systems, brackets,
ledger, moderation, dashboards, social auto-posting, shop integration,
licensing swaps.

## Success criteria (manual §17 definition of done)

Each feature runs on schedule unattended for 7 days, editor touch-time within
targets (companion approval 5–10 min/day), and a runbook entry exists for its
failure mode (seed from §18).
