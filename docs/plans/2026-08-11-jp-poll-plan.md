# JP Poll Engine — The People's Top 25

Goal: build exactly what the site already promises (poll page + hubs + homepage copy):
ballots open **Aug 24**; every citizen ranks a **top 10** each week; ballots lock
**Sunday 8 PM ET**; the board tabulates after lock; the reveal airs **Tuesday** on the
show (site publishes the board Tuesday noon ET); **no editorial panel, no anonymous
ballots, and the full vote distribution goes public** with each board; disagreements
vs the AP / Coaches / CFP marked in gold (national polls come from the live wire —
lib/espn.ts — already built).

Mechanics (deterministic, documented):
- Ballot = ranks 1–10, ten distinct FBS teams. Points: rank 1 → 10 pts … rank 10 → 1 pt.
- Board = top 25 by points; ties broken by first-place votes, then alphabetically.
- Ballots are private until the board publishes, then world-readable (full
  transparency — "the AP's distribution isn't public, ours is"). Immutable at lock
  (RLS + belt-and-braces triggers, same posture as the Phase 4 engine).
- Boards for all 15 regular-season weeks are seeded up front with DST-correct UTC
  times (America/New_York → UTC computed, not hand-set). No weekly creation cron.
- One hourly cron does both transitions: open→tabulated (after lock; writes
  jp_results with points/first-place/ballot count), tabulated→published (after
  reveal time). LLMs nowhere in tabulation.

## Tasks

- [ ] 1. Migration 0012_jp_poll.sql — jp_boards (season/week/label/opens_at/locks_at/
  reveals_at/status), jp_ballots (unique board×user), jp_ballot_ranks (pk ballot×rank,
  unique ballot×team), jp_results (board×rank → team/points/first_place/ballots).
  RLS: boards+results-when-published public; ballots own-rows pre-publish,
  world-readable post-publish; writes only while open and before lock (policies +
  lock-guard trigger + audit into play_audit). Definer fns: jp_ballot_count(board),
  ballot visibility helpers. Seed 15 boards. Extend cron allow-list +
  schedule /api/poll/tabulate hourly.
- [ ] 2. lib/jp-poll.ts — types + reads (getBoards/getCurrentBoard/getLatestPublished/
  getMyBallot/getBoardResults/getBallotCount/getPreviousResults for movement) +
  pure tabulateBallots() and validateBallot() (unit-tested).
- [ ] 3. app/poll/actions.ts — saveBallot (citizen-gated, validates 10 unique known
  teams, rejects after lock at every layer).
- [ ] 4. components/poll/BallotBuilder.tsx — 10 rank slots over the 136-team
  directory (native selects, top-25 shortcut via current national poll), save state,
  states for: before opens_at (countdown copy) / open / locked-tabulating /
  published (my ballot vs the board).
- [ ] 5. /api/poll/tabulate route — cron-guarded; lock→tabulate (deterministic
  tally → jp_results), reveal-time→publish; run-summary logging.
- [ ] 6. /poll page wiring — real ballot module replaces the prod EmptyState;
  published board renders the real JP Top 25 (points, first-place votes, ballot
  count, movement vs previous board) with gold disagreement columns vs the live
  AP/Coaches/CFP boards; National Boards section stays; demo arrays only where no
  real data exists yet.
- [ ] 7. Surfaces — team hub rankings card adds JP Poll placement once a board is
  published; homepage poll panel links to the live ballot when one is open.
- [ ] 8. Tests (tabulation math, tie-breaks, ballot validation), build, deploy,
  prod verification (ballot save + RLS denial + board states), demo sync, memory.

## Decisions

- Dedicated jp_* tables, not the game engine: a poll has no scoring rules, leagues,
  or entries-vs-results — §12's "ONE competition engine" governs games; the poll is
  the §3 civic product. Patterns (RLS lifecycle, definer fns, audit) are shared.
- Points 10…1 with first-place tie-break mirrors the AP's method at top-10 depth —
  simple to explain on the page, deterministic to compute.
- Boards publish Tuesday noon ET automatically; if Josh's team wants reveal-gating
  tied to the episode drop later, flipping reveals_at per week is a data change.
