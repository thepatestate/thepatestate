# Josh edits batch 2 — report

## 1. Team logos (`lib/teams-meta.ts`)

Created `TEAM_LOGOS: Record<string, number>`, `slugifyTeam(name)`, and
`teamLogoUrl(slug)`. All 34 client-supplied ids verified 200 via curl.
Scanning every DEMO_* dataset on the pages in scope (home, `/poll`,
`/playoffs`, `/scores` incl. the watch list) turned up five more teams
without an id in the client's list — Texas Tech, Oklahoma State, UNLV,
Iowa State, Vanderbilt. I looked up and curl-verified ids for all five
(also 200) and added them, so **every team referenced in the in-scope demo
data now has a real logo — no unmapped teams remain there.**

`next.config.ts` images.remotePatterns now includes `a.espncdn.com`.

## 2. Logo swaps (+20% sizing, unmapped falls back to old rendering)

- `app/page.tsx` — JP Poll top-5 rank cards: letter box → 60x60 `.logo-img` (was 50x50 `.logo-box`).
- `app/poll/page.tsx` — Top Five rank cards: same swap.
- `app/playoffs/page.tsx` — Current Playoff Rankings `SeedTable`: added a 24x24 logo next to each team name (this table never had a letter box, so there was nothing to "enlarge"; sized to fit the row).
- `app/scores/page.tsx`:
  - Scoreboard `ScoreCard`s: added a 20x20 logo before each team name (no pre-existing abbr box was there to swap — the wireframe just used plain text — so I added logos for coverage rather than skipping the bullet).
  - Watch List: `HelmetIcon`/`Helmet` SVGs replaced with real logos at 46x36 (was 38x30, ~20% larger), via a new `TeamIcon` component that falls back to the colored helmet per-team if unmapped. Bumped `.wk .helms` CSS flex-basis 96px→124px so the wider logos don't overflow the row.
  - Conference-matchup "schedule rows" (`ConfMatchups`) render plain text, never abbr boxes — left untouched per the spec's "where team abbr boxes render" condition.
- `app/teams/georgia/page.tsx` — rank history is a plain `<table>`, never used letter boxes — nothing to change there.

## 3. "IN WATCH ORDER"

Removed from `app/scores/page.tsx`'s h2 (was "Top 10 Games of the Week, In Watch Order" → now "Top 10 Games of the Week"). Confirmed no other case-insensitive occurrence anywhere in `app/`.

## 4. Creed Tee copy (`app/shop/page.tsx`)

Tee SVG text changed from "God, / FAMILY, / FOOTBALL" to "No / OFFSEASON" (kept the same tri-blend/field-green/porch-lamp-gold styling, "EST. THE PATE STATE" footer line, price, and both CTAs unchanged). Updated the adjacent lede copy from "Three words, in order." to "Two words, year-round." for consistency. Did not touch "Creed Tee" as a product/section name, or the homepage's unrelated "Creed Tee" mentions (DEMO_SHOP tile label, DEMO_WIRE headline) — out of the stated scope (`app/shop/page.tsx` only). No train graphic attempted.

## 5. Social strips

- `app/porch/page.tsx` — the "Follow the Mayor" panel already existed (sidebar of the first section, with YouTube/X/Instagram/TikTok links) and is reasonably prominent, but it's a sidebar item next to a duo layout, so per your "verify or make visible near top" instruction I also added a chip row (same YouTube/X/Instagram/TikTok pattern as `/show`) directly under the "From the Mailbag" eyebrow, at the very top of the page's main content.
- `app/notebook/[slug]/page.tsx` — added a "Follow the Porch" card to the sticky aside, below "Keep Exploring," with the same 4 chips.
- `app/page.tsx` — added a "Follow the Porch Everywhere" chip row in its own `on-dark tight` section, immediately above the closing `cta-band`/footer.

All three reuse `SOCIAL_LINKS` + `CHANNEL_URL` from `@/lib/youtube` and the `.chip`/`.platforms` classes already used on `/show`.

## Verification

- `npm run build` — passed (TS + lint clean).
- `npm test` — 67/67 passed.
- Local prod server (`next start -p 3411`), curled:
  - `/` contains an `a.espncdn.com/.../61.png` (Georgia) image and "Follow the Porch Everywhere".
  - `/poll`, `/playoffs`, `/scores` each contain `a.espncdn.com` image URLs.
  - No "IN WATCH ORDER" (case-insensitive) anywhere under `app/`.
  - `/scores` heading reads "Top 10 Games of the Week" (no trailing suffix); watch-list rows render real espncdn logos for all 10 games, including the 5 extra-verified teams.
  - `/shop` contains "OFFSEASON".
  - `/porch` contains all 4 chip links (YouTube/X/Instagram/TikTok).
  - `/notebook/[slug]` aside code confirmed via build (typechecks, no local published article to hit live) — contains `SOCIAL_LINKS.instagram` chip in the JSX.
- Logo URL verification: 34 client-supplied ids + 5 self-sourced ids = **39 URLs, all curl-verified 200**. Zero ids dropped.

## Unmapped teams

None remaining among teams actually used in the in-scope pages/data. (Any team not in `TEAM_LOGOS` anywhere else in the app — e.g. Vanderbilt only appears in a plain `<option>` dropdown, not a logo slot — still falls back to its original letter-box/helmet rendering automatically.)
