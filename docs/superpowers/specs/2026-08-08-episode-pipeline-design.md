# Sub-project C: Episode Ingest + Companion Pipeline — Design

**Date:** 2026-08-08
**Status:** Approved by Isaac (2026-08-08)
**Parent:** `2026-08-07-pate-state-weeks-1-2-design.md` (sub-project C) · behavior per
operations manual §2 (pipeline), §12.1–12.2 (prompts), §13 (guardrails), §23 (voice)

## Purpose

The heartbeat: every new episode on Josh Pate's channel automatically becomes a
draft companion article in his voice, waiting in an approval queue; approved
articles publish to the site within a minute. Backfill the 5 most recent full
episodes at launch.

## Authorization record

Josh Pate approved the site and the use of his byline on companion articles
(communicated via Josh Axe; affirmed by Isaac 2026-08-08). Byline remains a
single config constant (`BYLINE_JOSH = "Josh Pate"`) — additional bylines
(Wire Desk, Staff) arrive with later sub-projects. Isaac holds the approval
seat until Pate/his producer takes it (Studio invite).

## Architecture

- **CMS/queue: Sanity** — new project under the project's own Sanity account.
  Schema lives in repo `/studio` (its own package.json; NOT a dependency of the
  Next app). Studio is **hosted** at `thepatestate.sanity.studio` (no embedded
  /studio route). Dataset `production`. Site reads via `@sanity/client` with
  public dataset reads for published content; server writes use
  `SANITY_WRITE_TOKEN` (editor token, env-only).
- **Documents:**
  - `episode`: ytId (unique), title, description, publishedAt, thumbnailUrl,
    durationSeconds (nullable until Data API enriches), series
    (weekend-truths | poll-day | sit-down | picks-drop | espn-friday | mailbag
    | general), viewCount (nullable), transcriptStatus (fetched | unavailable).
  - `article`: slug, headline, dek, bodyMarkdown (with `[EMBED:HH:MM:SS]` and
    `[PULLQUOTE]` markers preserved as text), pullQuote, episode (reference),
    primaryTeam, teams[], tags[], seoTitle (≤60), seoDescription (≤155),
    byline, workflowState (ai-drafted | approved | published), lowConfidence
    (bool), publishedAt.
- **Generation: Anthropic API, current Sonnet** (`claude-sonnet-5`), called
  server-side only. Two calls per episode: series classifier (§12.1) and
  companion draft (§12.2 with the global preamble + §23 voice guide), both
  with structured-output enforcement and one retry on schema mismatch, 3×
  backoff on API errors. Prompts live in repo `/prompts` as versioned .md
  files (manual §12 requirement), loaded at runtime.
- **Transcripts: YouTube public caption track** (timedtext — unofficial
  endpoint; the official captions API is owner-only). Parse to
  timestamped segments. On any failure: proceed with title+description only
  and set `lowConfidence: true` (visible as a ⚠ field in the Studio queue).
  No Whisper in this sub-project (locked in parent spec).
- **Detection:**
  - Primary: PubSubHubbub subscription → `POST /api/youtube/webhook` (Atom
    payload; GET echo of `hub.challenge` for (re)subscription verification).
  - Fallback: pg_cron every 15 min → `POST /api/ingest/poll` (RSS feed diff vs
    Sanity episodes; also catches anything the webhook missed).
  - Renewal: pg_cron weekly → `POST /api/youtube/subscribe` (re-issues the
    PuSH lease).
  - Enrichment: pg_cron daily 06:00 ET → `POST /api/ingest/enrich` (YouTube
    Data API: durations + view counts for known episodes; most-popular
    ordering data).
  - All internal routes require header `x-cron-secret: $CRON_SECRET`
    (random 32+ chars; in Supabase pg_net calls and Vercel env).
- **Publish flow:** Isaac flips workflowState to `approved` in Studio → a
  Sanity webhook hits `POST /api/revalidate` (secret-protected) → route sets
  `published` + publishedAt via write token if approved, and revalidates the
  article, notebook, and home paths. Manual override: re-running revalidate is
  idempotent. NOTHING publishes without the human click (manual §13).

## Site rendering

- New route `app/notebook/[slug]/page.tsx` styled from `wireframes/article.html`:
  series badge, headline/dek, byline + date, body rendered from markdown with
  `[EMBED:ts]` markers replaced by the episode's YouTube embed
  (`?start=<seconds>`, youtube-nocookie) and `[PULLQUOTE]` by the styled pull
  quote; episode card + platform links at the foot; ≥1 internal team/franchise
  link enforced at generation and render-checked.
- `app/notebook/page.tsx`: when ≥1 published article exists, the lead story +
  latest grid render real articles (demo cards yield); Wire strip and other
  engine-less sections stay demo+chip. Zero published articles → current
  preview page unchanged.
- Homepage notebook section: latest 3 published articles when available, else
  current demo (chip stays until real).
- Published articles use ISR with tag-based revalidation (`revalidateTag`),
  so publishing is sub-minute without redeploys.
- SEO: NewsArticle JSON-LD on article pages; articles enter the sitemap
  dynamically.

## Failure posture (all fail-soft)

- Caption fetch fails → thin draft, lowConfidence flag. Never blocks.
- Claude fails after retries → episode doc saved with no article; poll cycle
  retries draft generation on next pass (idempotent: skips episodes that
  already have an article).
- Sanity write fails → ingestion retried next poll; webhook handler returns
  200 to YouTube regardless (never causes PuSH unsubscribe) while logging.
- Site rendering never depends on live Sanity: published content is
  ISR-cached; Sanity down = stale-but-served.

## Env additions

`ANTHROPIC_API_KEY`, `SANITY_PROJECT_ID`, `SANITY_DATASET=production`,
`SANITY_WRITE_TOKEN`, `YOUTUBE_API_KEY`, `CRON_SECRET`, `REVALIDATE_SECRET`
(.env.local + Vercel; never in git).

## Testing

- Unit (vitest): timedtext XML → segments parser; `[EMBED:]`/`[PULLQUOTE]`
  marker renderer (marker → embed URL with correct start seconds); Claude
  output schema validator (valid passes, missing fields rejected, byline
  forced from config not model output); slug generation.
- Integration (manual, documented in plan): backfill run produces 5 queue
  drafts; approve one → live article within a minute; webhook challenge echo
  verified with curl; poll idempotency (second run creates nothing).

## Out of scope

Wire Desk / breaking news (Weeks 3–4), Playbook email (D), comments,
most-popular reordering UI beyond data capture, Whisper transcription,
per-article social auto-posting.

## Success criteria

Josh posts a video → a faithful draft in his voice sits in the Studio queue
within ~15 minutes (60-min manual target, with margin) → one human click →
live on thepatestate.com/notebook/<slug> with correct embeds. 5 backfilled
drafts at launch. Zero published words that no human approved.
