# Overhaul C — Report

## Status: Complete

- **C1 /recruiting**: added a 6-tile articles grid (`DEMO_ARTICLES`, PreseasonChip'd), gave each Wire item a `bleed-thumb` image + real team-logo chip(s) via `teamLogoUrl`, and added a "The Pate Read" video card (real `getVideos()`, title-matched on `/recruit|portal/i`, falls back to `videos[0]`) linking out to YouTube.
- **C2 /pickem**: expanded `DEMO_PUNDITS` to 24 (added David Pollack, Booger McFarland, Charles Davis, Cole Cubelic — all real, em-dash records, no invented numbers), split into two even 12/12 columns via new `.pundit-grid` CSS, gave every pundit a distinctive monogram-avatar color pair (`AVATAR_COLORS`, 12-pair cycle, Josh keeps his own gold/navy), added a videos strip (`VideoGrid`, real `getVideos().slice(0,3)`), a 3-tile article-teaser row, and a styled `.x-card` linking to `x.com/JoshPateCFB` with zero fabricated tweet content. Density pass: tightened leaderboard/wire margins, bumped avatar size in the grid, enlarged the streak flame icon.
- **C3 /shop**: converted `josh-assets/pate-state-sc-tee.jpg` and `josh-assets/generated/tee-no-offseason.png` via `sips` (quality 88, 900px, matching the site's existing product-photo convention) to `public/img/product-sc-tee.jpg` / `product-no-offseason-tee.jpg`, added as two new gear cards, extended the grid to 6 (kept hoodie/apron placeholders). Flagship SVG tee untouched.
- **C4 Sanity publish**: wrote `scripts/publish-josh-bracket.mts`, ran it. It parsed `docs/content/josh-playoff-bracket-2026.md`, found the real "Boldest CFB Predictions For 2026" episode via GROQ, replaced the source's fabricated companion-episode line/timestamp with `[EMBED:00:00]` against that *real* episode (never asserting an unverified timestamp), inserted one `[PULLQUOTE]` after "Ten-and-two teams don't fear road games. Grown-ups don't fear zip codes.", created `article-josh-bracket-2026` as `published` with byline "Josh Pate", and generated+attached its hero image. Updated `/playoffs`'s "Read the Room" lead card href to `/notebook/my-2026-playoff-bracket-on-the-record`.

## Verify

- `npm run build` — green (33 routes, no errors).
- `npm test` — 94/94 passed.
- `next start` + curl: `/notebook`, `/notebook/my-2026-playoff-bracket-on-the-record`, `/recruiting`, `/pickem`, `/shop`, `/playoffs` all 200.
- Confirmed via grep: real article is the Notebook lead (headline renders, no more placeholder), pull quote + embed iframe present, playoffs lead card href updated, shop has both new tee cards + real image files, pickem renders 24 pundits + the videos strip + X card, recruiting has the article grid + "Watch the latest read" link.

## Commit

`feat(overhaul-C): recruiting depth, pickem experts+visuals, real merch, publish josh bracket article` — **not pushed**.

## Concerns / notes for the client

- `josh-assets/` (23MB of raw source art) was left untracked, matching the established convention from parts A/B — only the derived, sized `public/img/*.jpg` files get committed.
- The Sanity dataset had two duplicate "Boldest CFB Predictions For 2026" episode docs (different `ytId`s, likely a prior ingest artifact, unrelated to this task); the script picks the earlier-published one deterministically. Worth a cleanup pass separately.
- Josh's bracket article is now the *only* published article in the dataset, so it's also the Notebook's lead story by default — expected, not a bug.
