# Overhaul B — scores filters, playoff predictor, poll rail + logos

**Status:** Complete. **Commit:** pending (see below) on `main`, branched from `efa6e4e` — not pushed.
**Tests:** `npm run build` green (TypeScript clean), `npm test` 94/94 passing. `next start` + curl DOM checks all pass.

## What changed, per section

**B1 — `/scores`:** New `components/ScoreboardTabs.tsx` client component drives a TOP 25 / SEC / BIG TEN / BIG 12 / ACC / G5 / ALL 136 filter over `lib/scores-demo.ts`'s new `DEMO_SCOREBOARD_GAMES` (22 games, each tagged with a `conf` field; every conference tab clears 4+, TOP 25 clears 9). Default tab is TOP 25, so curl (no JS) already shows a real scoreboard. Watch List helmets switched to `helmetLightUrl()` with the away/left helmet mirrored (was the home/right one — backwards for the new right-facing set) on a light chip background. Added a "This Week's Slate" day-by-day section (Thu/Fri/Sat AM/Sat PM/Sun/Mon) built from the same `DEMO_WATCHLIST` games, and a "Film Room" module at the bottom: `getVideos()[0]` in a real `EpisodeLead` card beside an invented `/notebook`-linked article teaser.

**B2 — `/playoffs`:** Top banner (`matchup-helmets.jpg`) removed entirely — the page opens straight into the AI/Josh brackets. Bracket helmets switched to `helmetLightUrl()`. New "Playoff Predictor" section: 16 teams (12 seeds + the 4 already-named "First Four Out"), gold progress bars on white, percentages in JP Poll order, `PreseasonChip`-labeled. New "Read the Room" strip below it (bento tile layout): lead card is "My 2026 Playoff Bracket, On the Record" → `/notebook` (where part C will publish Josh's real column), 3 more invented teasers. One care-about: the editorial-art picker's `"playoffs"` category falls back to `matchup-helmets.jpg` as its 2nd candidate — had to keep that category to a single use on this page so the verify grep for zero `matchup-helmets` references stays clean.

**B3 — `/poll`:** Found and fixed the rendering bug: `app/globals.css` had two `.art` rules — a base one (column layout, for plain teaser cards) and a later unscoped `.art{flex-direction:row}` meant only for the thumb+body row pattern used elsewhere (team-page article list). The row rule clobbered every `.art` site-wide, so poll's "Poll Day, Explained" card (kicker/heading/paragraph/button, no thumb) got squashed into a horizontal row instead of stacking. Fixed by renaming the row variant to a `.art-thumbrow` modifier and adding that class only where the thumb+body pattern is actually used (`app/teams/georgia/page.tsx`), restoring the base column layout everywhere else. Added a right rail (Poll Movement risers/fallers, How the Poll Works, latest-video card via `getVideos()`) beside the Top 25 content in one `.duo` grid, matching `/notebook`'s pattern. Expanded the JP Top 25 table from a truncated 12-of-25 to the actual full 25 rows (dead "See 13–25" link removed) and added a team logo to every row of both tables — no letter tiles remain on the page.

## Verify results
- `/scores`: 7 tab labels render, 9 score-cards SSR for the default TOP 25 tab, 20 slate rows, `helmets-light/*.jpg` paths present, Film Room + real YouTube link present.
- `/playoffs`: 0 references to `matchup-helmets` (confirmed after a fix — the art-picker fallback initially leaked one in), 16 predictor percentage rows, bracket helmets on `helmets-light`, Read-the-Room tile strip present.
- `/poll`: 0 `logo-box` occurrences (no letter tiles), 6 rail cards, 25+10-row tables, right rail present in a two-column `.duo`.

## Concerns / judgment calls for the client to weigh in on
- Expanded the JP Top 25 table to all 25 rows rather than just adding logos to the existing 12 — read "the full Top-25 table" plus the density mandate as license to do this; all 13 added teams already had mapped ESPN logos so no letter-tile fallback was needed.
- "This Week's Slate" reuses the same 10 `DEMO_WATCHLIST` games (day-grouped) rather than a separate dataset — kept it DRY with the Watch List below it instead of inventing a second game list.
- The away/home helmet-flip direction was backwards on `/scores` and `/playoffs` for the old dark-helmet set; fixed to match the convention `components/SlateStrip.tsx` already established in Part A (mirror the away/left helmet).
