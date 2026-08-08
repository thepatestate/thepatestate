# The Pate State — v1 Site Design

**Date:** 2026-08-07
**Status:** Approved by Isaac (2026-08-07)

## Purpose

A public website for Josh Pate's college football brand ("The Pate State — The Front
Porch of College Football") that:

1. Runs **more or less autonomously** — no weekly content upkeep by anyone.
2. **Drives traffic to his YouTube channel** (Josh Pate's College Football Show).
3. Is **fully untangled** from Isaac's other projects — brand-new accounts for
   everything, transferable to Josh Pate by handing over credentials.
4. Is built on a stack that can grow into the full interactive vision (JP Poll
   voting, Porch Pick'Em, member profiles) without a rewrite.

## V1 Scope

Three pages, ported from the existing static mockups in `thepatestatesite/`
(design system preserved: Big Shoulders Display / Newsreader / IBM Plex Mono,
navy/field/lamp palette, ticker + yardline chrome):

- **Home** (`/`) — from `index_43.html`, trimmed. Hero, latest episode embedded
  and playable on-page, weekly show schedule, recent-uploads row, subscribe CTAs.
  Pick'em / poll / shop / porch sections cut. Nav reduced to: The Show, About,
  plus a Subscribe CTA.
- **The Show** (`/show`) — from `show.html`. Latest episode embed, recent-uploads
  grid with real thumbnails, platform links (YouTube, Apple Podcasts, Spotify),
  weekly series rundown as evergreen copy.
- **About** (`/about`) — from `about.html`. Evergreen copy only; fake stats removed.

### Non-goals (v1)

No accounts, no voting, no pick'em, no shop, no CMS, no analytics beyond what the
host provides, no email capture, no custom domain (added later, ~10 minutes, when
Josh Pate is bought in — ideally on his card).

## Architecture

- **Framework:** Next.js (App Router, TypeScript), created fresh in this repo.
- **Hosting:** Vercel Hobby tier, on a brand-new Vercel account.
- **Content engine:** a server-side fetch of the channel's public YouTube RSS feed
  (`https://www.youtube.com/feeds/videos.xml?channel_id=<ID>`), parsed into a
  typed `Video[]` (id, title, published, thumbnail URL). Fetched with Next ISR
  (`revalidate: 21600` — every 6 hours). No API key, no quota, no cron, no
  commits. The channel ID is resolved once during implementation from the
  channel's public page and stored as a constant/env var.
- **Rendering:** server components consume the feed; pages are statically served
  and regenerate in the background. If a fetch fails, ISR serves the last good
  version — the site degrades to "slightly older videos," never to an error page.

### Component boundaries

- `lib/youtube.ts` — feed fetch + parse; the only module that knows about RSS.
  Returns `Video[]`; everything else consumes that type.
- `components/` — Nav, Footer, Ticker (evergreen copy), EpisodeHero (embed),
  VideoCard / VideoGrid (deep-link to YouTube), SubscribeCTA.
- `app/` — the three routes composing those components.

## De-faking rule

Anything that claims to be live data must actually be live, or it goes.

- Video titles, thumbnails, dates, "latest episode": real, from the feed.
- Cut or reword as evergreen: JP Poll ticker rankings, leaderboards, view counts,
  citizen counts, mailbag entries, prize ladder, subscriber claims.
- The ticker chrome stays but carries evergreen copy (weekly show schedule /
  taglines), not fake poll data.

The site never lies, so it never looks stale.

## Traffic mechanics

- Hero/latest episode: playable on-site via YouTube embed (still counts as a
  YouTube view).
- All other video cards deep-link to `youtube.com/watch?v=…` — no on-site hoarding.
- Subscribe buttons link with `?sub_confirmation=1`.
- Proper metadata: OG/Twitter cards, favicon, sitemap, sensible titles — shared
  links and search results look legitimate.

## Accounts & handoff

Created fresh, in a clean browser profile, Isaac at the keyboard for phone
verification:

1. **New Gmail** — root identity for everything.
2. **New GitHub** — owns this repo; site deploys from it.
3. **New Vercel** — signs in via the new GitHub (no separate credential).

Handoff to Josh Pate = transfer the Gmail + GitHub credentials. Nothing touches
Isaac's existing accounts, orgs, or billing. Vercel Hobby disallows commercial
use — when the site becomes a commercial Pate property (shop, sponsorship),
upgrade to Pro (~$20/mo) on Pate's card.

## Error handling

- Feed unreachable at revalidation → serve cached ISR output (automatic).
- Feed shape changes → parser returns `[]`; pages render with the evergreen
  shell and hide video sections rather than crash (explicit empty-state handling).
- No client-side data fetching — nothing for ad blockers or CORS to break.

## Testing

- Unit tests for the RSS parser (fixture of the real feed XML, plus malformed
  input → `[]`).
- Build-time type safety on the `Video` contract.
- Manual/visual: pages render correctly with a live feed, an empty feed, and
  long titles. `next build` passing is the deploy gate.

## Future roadmap (explicitly deferred)

The remaining mockup pages (poll, pickem, scores, playoffs, recruiting, notebook,
porch, tailgate, shop, teams) stay in `thepatestatesite/` as the design source of
truth. The Next app's structure (typed lib layer, per-route pages) is the
foundation they slot into, each as its own future project with its own spec.
