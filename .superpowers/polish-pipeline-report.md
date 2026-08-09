# Polish + Pipeline Report

Status: complete, committed on `main`, not pushed.

**A. Motion** — `components/Reveal.tsx` (IntersectionObserver, SSR/no-JS-safe, once-only) wraps the poll band, notebook band, store band, and tailgate-cards grid on `/`. Shared card hover-lift added to globals.css targeting card-l/panel/art/feat/guide/rankcard/log-card/aside-card/score-card/team-tile/game/bracket-round/mail/ep/wire (translateY(-3px) + shadow + border warm). Hero photo moved to `.hero::before` (unchanged JSX) so a 40s alternate `transform:scale(1→1.06)` drift never moves the text. All three respect `prefers-reduced-motion`.

**B. Grain** — `.on-dark`/`.on-field` (the site's existing dark-band wrapper classes) get a `::after` feTurbulence noise overlay, opacity .05, `mix-blend-mode:overlay`, `pointer-events:none` — applies sitewide with zero JSX changes.

**C. OG images** — `app/opengraph-image.tsx` (existing) got a gold rule + period on the tagline; added matching `app/twitter-image.tsx`. `app/notebook/[slug]/page.tsx` `generateMetadata` now sets openGraph/twitter images from the article's `heroUrl`, falling back to the episode YouTube thumbnail, and leaves images unset (inheriting the root file-convention OG image) when neither exists.

**D. Auto hero pipeline** — `lib/hero-image.ts` (`generateArticleHero`, pure `buildHeroPrompt` keyword→scene map + guardrail suffix, fail-soft/never-throws) calls BFL `flux-2-pro`, polls every 4s up to 90s. `studio/schemas/article.ts` got a `heroImage` field, deployed via `sanity schema deploy` (succeeded). `lib/ingest.ts` generates+uploads+patches the hero after article creation, wrapped so failure never turns `created` into `failed`. `lib/sanity.ts` GROQ now projects `heroUrl`; render wired into the article page (full-width `.cover-img` above the headline), notebook listing (lead + feat-grid), and the homepage Notebook-lead thumb. `next.config.ts` allow-lists `cdn.sanity.io` for `next/image`.

**Backfill**: ran `npx tsx scripts/backfill-heroes.mts` — 12/12 articles now have a hero (all were `ai-drafted`, none `published` yet, so they aren't live on `/notebook` until an editor publishes; GROQ confirms `heroUrl` resolves non-null on all 12). Cost ≈12 × ~4¢.

**Vercel**: `BFL_API_KEY` pushed to prod+preview env via the Projects API (201 Created).

**Tests/build**: `npm test` 94/94 passed (10 new, incl. `lib/hero-image.test.ts` covering the keyword map + guardrail-always-present + no-team-names rule). `npm run build` clean, TypeScript clean, both `/opengraph-image` and `/twitter-image` routes generated.

**Concerns**: none blocking. Hero images are `image/jpeg` from BFL despite requesting `image/png` upload content-type (Sanity accepted it fine — cosmetic mismatch only, not fixed). All 12 backfilled articles remain in `ai-drafted` — the hero pipeline is proven end-to-end but won't be visibly live until editorial publishes them.
