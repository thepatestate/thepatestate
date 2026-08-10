# 2026 Design Pass — Report

**Status:** Complete. Branch `main`, commit `e2352b8` (not pushed).
**Commit:** `feat: 2026 design pass — image-first tiles, bento grids, unique editorial art per slot`
**Tests:** `npm run build` green, `npm test` green (94/94).

**Per-page unique-image audit:** Built `next start` + curled every page, extracted
each rendered `<img src>` (final URL, not srcset variants) under `/img/`, counted
duplicates. Result: **0 repeated files on every page checked** (`/`, `/notebook`,
`/porch`, `/teams`, `/teams/georgia`, `/playoffs`, `/tailgate`, `/scores`, `/shop`,
`/report`). Fixed one incidental duplicate on `/report` (a `DEMO_SPREADS` tile
reused the magazine-cover photo) even though `/report` wasn't an explicit target.

**What shipped:** `lib/editorial-art.ts` (keyword→image picker, one instance per
page render, falls through candidate lists so no two cards repeat a photo) built
on 16 new `cfb-*.jpg` images converted from `josh-assets/generated/` (sips,
quality 82, 1152×768, under the 1200px cap). New CSS tile system in
`globals.css` (`.tile`/`.tile-media`/`.tile-scrim`/`.tile-body`, `.bento`/
`.bento-stack`, `.tile-grid`, `.bleed-thumb`, `.cover`) — image-first, scrim
overlay, hover zoom, no border strokes, all `prefers-reduced-motion`-safe.
Homepage Notebook band is now a bento grid; `/notebook`'s feature grid is
tiles; the article page (`app/notebook/[slug]`) hero is a full-bleed magazine
cover with headline/dek/byline overlaid; Latest News, Wire, Porch hot-rows,
and the Georgia team page's article rows got bleed thumbnails (border
removed, shadow + hover zoom added). Also: oversized gold-outlined rank
numerals on JP Poll cards (`-webkit-text-stroke`), an 8%-visible aerial-photo
texture behind the poll/pick'em band, `priority` on the slate strip's
helmets, and boxed "Load More"/"More Popular" buttons on `/notebook` swapped
for inline kicker-row text links (`.sec-head`/`.view-all`).

**Not changed:** `/playoffs` helmets banner, homepage/`/tailgate` fan-culture
guide cards, `/teams` directory tiles, `/poll`, `/pickem`, `/scores`, `/shop`,
`/show`, `/recruiting`, `/about` — none had the image-above-text pattern or
weren't in scope per the brief. Palette, fonts, PreseasonChip copy, and all
links/content are untouched.

**Concerns:** No published Sanity articles exist, so the bento/tile/cover
logic only exercises its demo-data branches in this environment — verified by
code reading that `heroUrl`/`episode.thumbnailUrl` branches render correctly,
not by hitting a live article. `-webkit-text-stroke` is a legacy-prefixed
property; it degrades gracefully (faint gold fill, no outline) in browsers
that don't support it, but isn't a standard CSS property. Mobile stacking
verified via build + CSS media queries only, not a real viewport screenshot.
