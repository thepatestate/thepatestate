# ESPN-pattern pass: placeholder sweep + week selector + Wk1 slate strip

## Status: complete

## Workstream 1 — placeholder sweep (counts of graphics fixed)
- `/notebook`: 3 feat-grid demo cards (diagonal-stripe `.ph`), 4 `HelmetIcon`
  two-tone thumbs in Latest News, 8 `HelmetIcon` tiles in the Breaking News
  rail — all now editorial/team photos, `HelmetIcon`/`IconColors` removed.
- `/recruiting`: 5 `logo-box` code chips replaced with real team logos (all
  5 teams were already in `TEAM_LOGOS`, matching the `/poll` pattern).
- `/porch`: 3 `.hthumb` diagonal-stripe tiles → editorial/team photos.
- `/report`: cover placeholder gradient → editorial-goalpost + navy overlay
  + existing title text (dignified cover); 3 empty Sample Spreads `.ph`
  divs → photos.
- `/shop`: Pate Report tile gradient placeholder → same goalpost+overlay
  treatment as `/report`, matching sibling `has-photo` tiles.
- `/teams/georgia`: 2 `.art-thumb` diagonal-stripe article tiles → editorial
  photos (this route is the template for all future team pages).
- `/tailgate`: 4 of 8 guide tiles were solid-gradient+emoji swatches
  standing in for photos (Sanford/Kyle Field/Autzen/Notre Dame Stadium) →
  each team's real studio helmet photo, unlocking the logo badge too.
- Homepage (`/`) was already fixed in a prior pass — used as the reference
  pattern throughout.

All photo choices follow the homepage's category→image mapping
(recruiting/portal→turf, media/coaching→film, poll/state→goalpost,
TV/matchups→matchup-helmets, store→train-tee) or a team helmet when the
story is team-specific; verified no two adjacent tiles repeat a photo.

## Left intentionally
- `/show`, `/pickem`, `/join`: no placeholder graphics found — `/show`
  uses real YouTube thumbnails/embeds throughout, `/pickem`'s pundit
  avatars are text-initial chips (not photo stand-ins), `/join` is a bare
  auth form.
- `/shop`'s two gear items with no product photo (Citizen Hoodie, Tailgate
  Apron) — left photo-less rather than faking product shots; no matching
  imagery exists in `public/img/`, and misrepresenting real merchandise
  seemed worse than a plain card.
- `/tailgate`'s color-gradient system for the 4 fixed tiles is gone now
  that all 8 have real photos; the `emoji`/`bg` fields are unused dead data
  left in place (harmless) rather than restructuring the type.

## Workstream 2 — ESPN-pattern structures
- `/scores`: new `.week-strip` of 14 pills above the scoreboard — "WEEK 1 ·
  AUG 29–SEP 7" active (gold), weeks 2–14 dimmed/disabled with computed
  date ranges, plus a note chip ("Live weekly slates arrive with the
  season"). Pure CSS, horizontal-scroll only.
- Homepage: new dark `SlateStrip` component directly under the nav, above
  the hero — "WK 1 PREVIEW" tag + 5 Week 1 matchups (away helmet @ home
  helmet, codes, date · TV), horizontally scrollable, linking to `/scores`.
- Extracted `/scores`'s previously-inline demo data (live/upcoming scores,
  conference matchups, Watch List) into `lib/scores-demo.ts`; the homepage
  slate strip imports `DEMO_WATCHLIST` from there (first 5 games) instead
  of copy-pasting a game list. Added `codeA`/`codeB`/`date` fields to
  support the strip's abbreviated-name + date/TV display.

## Verification
- `npm run build` — green (clean `.next`; a stale Turbopack incremental
  cache briefly served an old homepage bundle mid-session — a fresh
  `rm -rf .next && npm run build` fixed it, noted in case it recurs).
- `npm test` — 94/94 passing.
- `next start` + curl on all listed pages: `/notebook` (7 distinct
  `/img/*.jpg`), `/scores` (21, incl. week-strip pill text), `/` (21,
  incl. slate-strip markup and helmet images), `/porch` (3), `/report` (3,
  incl. cover text), `/shop` (3), `/tailgate` (8, incl. all 4 new helmet
  tiles), `/teams/georgia` (2). All pages 200.
- Also found and killed an unrelated stray `next-server` process that had
  been squatting on port 3000 for ~1.75 days from an earlier session —
  it was serving stale content and caused a false-negative on the first
  verification pass; killing it and using a clean build/port fixed the
  check.

## Commit
`feat: placeholder sweep site-wide + week selector and wk1 slate strip` —
committed to `main`, not pushed.

## Concerns
- None outstanding. The Turbopack stale-cache issue above is worth a
  mental note for future sessions doing rapid build/verify loops on this
  repo — prefer `rm -rf .next` before the verification build if the dev
  server has been running a while.
