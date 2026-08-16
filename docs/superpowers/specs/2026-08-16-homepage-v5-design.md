# Homepage v5 — "Final Direction" Redesign

**Date:** 2026-08-16
**Source of truth:** `~/Desktop/pate-state-homepage-v5.html` (mockup, "Homepage v5 · Final Direction") + screenshot approved by Isaac.
**Scope decision (approved):** Full shell + homepage. The global chrome (masthead, rhythm bar, footer) is replaced site-wide; the homepage is rebuilt to match v5; interior pages keep their current layouts under the new chrome.
**Data decision (approved):** Live data everywhere a real source exists; honest fallbacks (EmptyState / omission / DEMO_MODE-only fiction) where an engine hasn't shipped, per the existing §0.1 honesty rule.

## What v5 is

A light, ESPN/SI-style editorial front page replacing the dark chalkboard homepage:

- **Rhythm bar** (navy-deep, 29px): MON–SAT weekly programming schedule with today highlighted in gold, mini social links right-aligned.
- **Masthead** (near-black `#0D1321`, sticky): wordmark + kicker, condensed uppercase nav (Latest, Show, Scores, Rankings, Recruiting, Play, Community, More▾), right side: ♡ My Teams, search, gold "Join Free" CTA.
- **Scores ticker** (white bar): WK slate games with team logos, kickoff times.
- **Top editorial grid** (3 cols: Trending .82fr / Featured 1.6fr / Latest .95fr) + **action strip** (dark rounded bar: poll-open live item, pick'em, porch, gold "Cast Your Ballot" CTA).
- **Your Teams band** (off-white): followed-team cards with next game + new-item counts.
- **The Show**: big featured video + 5-row episode list, dark **Shorts band** (6 portrait tiles), platform chips.
- **The Notebook + The Wire**: featured article card + two small cards | navy-headed live wire rail.
- **The People's Games**: JP Poll card (navy gradient) + Pick'Em card (white, navy border), schedule/prize rows.
- **Live on the Porch**: 4 thread cards (avatar, category, title, reply counts) + sticky navy join panel.
- **The Pate Playbook**: signup + rotated inbox preview.
- **The State Store**: 3 product cards.
- **Live & On Campus**: copy + photo (navy gradient band).
- **Pate Tailgate**: 4 stadium tiles (navy gradient, logo, venue).
- **Citizen Gift**: rotated guide cover + copy (navy gradient band).
- **Follow the Porch Everywhere**: 4 brand-colored social buttons.
- **Playoffs ribbon** + new **4-column footer**.

Typography: Barlow Condensed (kickers/nav/labels), Public Sans (display + body). Palette: white/off-white surfaces, `--mast #0D1321`, `--navy #0E2240`, `--gold #C9A227`, `--red #C8102E`.

## Approach (approved: Approach A)

Port the mockup's CSS nearly verbatim as a namespaced stylesheet; do NOT rewrite it into the existing chalk-theme tokens. Existing global classes stay untouched so interior pages don't regress. The v5 masthead is dark, so it reads correctly over both the light homepage and dark interior pages.

### Files

- `app/v5.css` — mockup CSS: `:root` v5 variables (prefixed only if they collide with existing globals — audit `globals.css`; the mockup's `--gold`, `--navy`, `--red`, `--ink` likely collide and MUST be prefixed `--v5-*` or scoped under a `.v5` wrapper class on `<body>`-level containers), all section classes. Imported in `app/layout.tsx`.
- Fonts via `next/font/google` in `layout.tsx`: Barlow Condensed (500–800), Public Sans (400–800). Exposed as CSS variables consumed by `v5.css`. (Zilla Slab appears in the mockup's `<link>` but is unused in its CSS — skip it.)
- `components/chrome/RhythmBar.tsx` — server component; weekday schedule (static config), "today" computed server-side in America/New_York; social links from `SOCIAL_LINKS`.
- `components/chrome/Masthead.tsx` — client component (mobile menu, More dropdown); reuses `NavSession` for auth state; routes unchanged from current `Nav.tsx` (`Latest→/notebook`, `/show`, `/scores`, `Rankings→/poll`, `/recruiting`, `Play→/play`, `Community→/community`, More▾ = current MORE_LINKS). ♡ My Teams → `/me` (the existing team-management page `MyTeams` already links to), search → `/search`, Join Free → `/join`.
- `components/Footer.tsx` — rewritten to v5 four-column layout (brand + Watch & Read / Play & Vote / The State), bottom row keeps existing legal links (Standards, AI Disclosure, Privacy, Terms, Contact).
- `components/home/` — section components, all server components unless noted:
  - `ScoresTicker.tsx` — `getSlateGames()` (same data as SlateStrip, v5 styling). <3 real games in production → render nothing.
  - `TopEditorial.tsx` — Trending: latest 4 published articles (`getPublishedArticles`). Featured: latest episode (`getVideos` + `isEpisode`) with thumb, gold tag, play overlay → YouTube. Latest: newest show upload + 3 newest wire items (team logo thumbs via `teamLogoUrl`, else art). Each column drops gracefully if its source is empty.
  - `ActionStrip.tsx` — three items + CTA. Poll/pick'em copy from live week state where cheap (`play-week.ts`); NO fictional citizen counts in production — porch item uses count-free copy unless a real count is available from `lib/community.ts`.
  - `YourTeamsBand.tsx` — adapt existing `MyTeams` logic to v5 band styling (client, as today). Signed-out/no-teams → band renders the "pick your teams" prompt as `MyTeams` does now, restyled.
  - `ShowSection` (v5) — featured latest episode + next 5 episodes as rows; `ShortsBand` from `getShorts(6)`; platform chips (YouTube/Apple/Spotify links from `lib/youtube.ts` / `site.ts`).
  - `NotebookWire.tsx` — featured article + 2 small cards | wire rail: `getWireItems(6+)`, each item links to story or source (keep current click-through rules), live badge, "All Wire Coverage →".
  - `PeoplesGames.tsx` — the two cards; row content mirrors the current production `how-rows` copy; CTAs → `/poll#ballot` and current week pick'em route via `play-week.ts`.
  - `PorchSection.tsx` — live threads via `lib/community.ts` `getThreads()` (title, board/category, reply count, last-reply time), top 4 by recency. Zero threads in production → render the side join panel full-width with honest copy and no fake threads. Sticky side panel: real online/citizen count only if available; otherwise count-free copy.
  - `PlaybookSection.tsx` — v5 layout; inbox preview reuses the current real-data pattern (latest episode + top 3 wire headlines). Email input posts to the existing join flow (`/join` or `JoinForm` action — reuse, don't rebuild).
  - `StoreSection.tsx`, `CampusSection.tsx`, `TailgateSection.tsx`, `GiftSection.tsx`, `FollowSection.tsx`, `PlayoffsRibbon.tsx` — v5 styling, same content/links/images as the current homepage equivalents (existing `/img/*` assets; ESPN logo CDN already in use).
- `app/page.tsx` — thin composition of the above; all fetches `.catch`-guarded; shared fetches (videos, wire) done once in `page.tsx` and passed down to avoid duplicate API calls.

### Removed/retired from homepage
`HeroSlider`, `PlaysBackground`, `SlateStrip` (superseded by ScoresTicker), `TrendingPorch`, dark hero. Components stay in the repo if other pages use them; delete only if orphaned (verify with grep).

### Error handling
Every data source failure degrades to the same behavior the current page has: section renders EmptyState or disappears; DEMO_MODE alone may show fictional content. No invented numbers, games, or threads in production.

### Testing & verification
1. `npm run build` clean; vitest suite green.
2. Run the app; screenshot homepage vs. mockup for visual parity (desktop + ~760px mobile).
3. Spot-check interior pages (`/show`, `/poll`, `/notebook`) under the new chrome — no layout breakage, no CSS variable collisions (the `--v5-*` prefix audit is the guard).
4. Lighthouse-level sanity: fonts via next/font (no external Google `<link>`), images via `next/image` with the existing loader rules (remote CDN images must not consume Vercel transformations — follow commit `77d54ee`'s pattern).

### Constraints
- Read `node_modules/next/dist/docs/` guides before writing code (AGENTS.md — this Next version has breaking changes).
- Preserve all existing routes, auth/session behavior, and analytics.
- Mobile: follow the mockup's two breakpoints (1080px, 760px).
