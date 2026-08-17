# V3 Site Rollout — Josh's 7-Page Update + Light-Touch Restyle

**Date:** 2026-08-17
**Source of truth:** the seven mockups in `patestatev3updates/` (to be moved into `wireframes/v3/` for permanence). Pixel-level details live in the mockups, not this spec — each implementer reads their mockup directly.
**Approved scope:** all 7 mocked pages rebuilt + best-effort light-touch restyle of the remaining dark pages + deploy to production.

## Page map

| Mockup | Route | Engine(s) |
|---|---|---|
| `pate-state-homepage-v25-LAUNCH.html` | `/` | all existing homepage fetchers (revision of shipped v5) |
| `show-v2.html` | `/show` | `lib/youtube.ts` (episodes, shorts, stats) |
| `notebook-v2.html` | `/notebook` | `lib/sanity.ts` (articles, wire) |
| `rankings-v2_1.html` | `/poll` | `lib/jp-poll.ts` + Sanity poll-day articles |
| `recruiting-v1_1.html` | `/recruiting` | `lib/cfbd.ts` recruiting feed + Sanity wire (recruiting category) |
| `community-v1.html` | `/community` | `lib/community.ts` (boards, threads) |
| `play.html` | `/play` | `lib/play.ts`, `lib/play-week.ts`, `lib/score-play.ts` |

## Architecture

1. **Homepage v25** — implemented as a diff against the shipped v5: `app/v5.css` + `app/page.tsx` + `components/home/*` revised per the mockup. Shared-token changes (if the mockup's `:root` differs from v5's) land here first, because interior pages inherit them.
2. **Six interior pages** — one implementer per page, independent and parallelizable:
   - Styles in `app/styles/v3-<page>.css` (one file per page; imported from `app/layout.tsx`; NO page touches `app/v5.css` or another page's file). Selectors scoped `.v5.pg-<page> …` with the page's `<main className="v5 pg-<page>">` as the scope root. The same porting recipe as v5 applies (documented in `docs/superpowers/plans/2026-08-16-homepage-v5.md` §CSS Porting Recipe): element selectors converted to classes, `@keyframes` names prefixed per page, `position:relative` fill-anchors for `next/image`, and explicit neutralization of globals.css bleed-through (known offenders: `nav`, `footer`, `section`, `.wrap`, `.eyebrow`, `.btn`, `.wire`, `.feat`, `.game`, `.duo`, `.show-grid`, `.card`, `.panel`).
   - `app/<route>/page.tsx` rebuilt as server components; existing metadata exports, JSON-LD, and canonical URLs preserved.
   - **Data honesty (§0.1):** every mockup number, name, and record is presumed fictional. Wire live engines; where an engine has no data (or none exists), render the section with honest copy, `EmptyState`, or omit it. Fictional content renders only under `DEMO_MODE`. Mockup-marked placeholders (e.g., recruiting "FLIP WATCH — PLACEHOLDER names") must NOT ship as-is in production.
   - **Detail routes keep working:** `/notebook/[slug]`, `/community/[board]`, `/community/thread/[id]`, `/play/*`, `/wire/[slug]` render correctly after their index pages change. Client components already in use (ballot form, pick'em forms, thread composer, session components) are re-skinned or re-mounted, not rewritten.
3. **Light-touch pass** — `app/styles/v5-lite.css`: a token/typography overlay under `.v5-lite` that re-maps the chalk theme (`--paper`, `--paper-2`, `--ink`, `--chalk`, `--chalk-dim`, `--lamp`, `--lamp-deep`, `--line-l`, `--line-d`, `--display`, `--body`, `--mono` usage) to the light editorial look (v5 palette + Barlow Condensed/Public Sans). Each remaining page's top-level `<main>` gains `className="v5-lite"` plus at most small per-page fixes. Structure and data untouched. Pages that cannot read acceptably without a real design stay dark and are listed in the final report. Candidate routes: scores, teams (+hubs), wire (+stories), tailgate, shop, playoffs, report, about, ledger, porch, search, standards, privacy, terms, contact, me, join, welcome, authors.
4. **Housekeeping** — mockups move to `wireframes/v3/`; `patestatev3updates/` is removed after migration; retired components deleted only when a grep proves them orphaned.

## Error handling
Same as v5: every fetch `.catch`-guarded; sections degrade to EmptyState/omission; no invented data in production.

## Verification
1. `npx tsc --noEmit` per page task; full `npm run build` + `npm test` before deploy.
2. Screenshot each of the 7 mocked pages (desktop 1440 + mobile 390) against its mockup; spot-check ≥5 light-touch pages and the key detail routes (article, thread, pick'em week).
3. Deploy = merge to `main`, push (gh account `thepatestate`), poll production, then smoke test: chrome + new sections present, analytics alive, image optimizer serving.

## Constraints
- Follow repo patterns; read `node_modules/next/dist/docs/` before using any Next API not already used in the repo.
- Preserve routes, auth/session behavior, metadata, sitemap, analytics.
- Masthead/rhythm-bar/footer chrome is untouched by this rollout except where the homepage mockup's chrome differs (evaluate in the homepage diff; chrome changes apply site-wide from `app/v5.css`).
- Known local quirks: `pkill -f next-server` (not "next start"); `/_next/image` 404s locally under the custom loader — image verification happens in production.
