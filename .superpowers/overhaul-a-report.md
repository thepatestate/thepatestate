# Overhaul A — density + color rebalance, homepage restructure, show page rebuild

**Status:** Complete. **Commit:** `efa6e4e` on `main` (not pushed).
**Tests:** `npm run build` green, `npm test` 94/94 passing. `next start` + curl DOM checks all pass (see below).

## What changed, per section

**A1 — global density + color (`app/globals.css`):** `section`/`.tight` padding ~halved (78→40px, 56→26px), `.hero`/`.page-head`/`.cta-band`/`footer` padding cut similarly, heading margins tightened. Sitewide color audit: every full-bleed `.on-field` (green) band and every non-essential `.on-dark` band beyond the 1-2/page budget was converted to a light/cream section (`about`, `ledger`, `report`, `recruiting`, `porch`, `playoffs`, `tailgate`, plus most of the homepage). Full green backgrounds are gone entirely — green now only appears as tiny accents (`.fr-field` badge, `.panel-accent-field` top-rule, existing `.note` chip). Navy stays on nav/ticker/hero/footer plus 1-2 accent bands per page (verified per-file: home=2 [Show band, Citizen Gift], others ≤1). Hero photo removed; grain texture extended to `.hero` so it doesn't go flat.

**A2 — homepage (`app/page.tsx`):** Hero has no photo, no "Watch on YouTube" button (removed `SubscribeCTA`), compressed. Show band rebuilt ESPN-Watch-style: big lead thumbnail (new `EpisodeLead` component, links out to YouTube, no iframe) + 3 bigger thumbnail-on-top cards on the right (`VideoGrid variant="stack"`). Notebook band moved directly under the Show band, before the poll/pick'em band. Tailgate badge chips moved bottom-left→bottom-right (CSS). Live & On Campus section now has the `campus-live.jpg` photo.

**Homepage helmets:** `components/SlateStrip.tsx` (the only homepage helmet consumer) now uses `helmetLightUrl()` on a cream chip instead of the dark navy one, and mirrors the away-side helmet (`scaleX(-1)`) since the new set all faces right.

**A3 — show page (`app/show/page.tsx`), full rebuild:** Wider container (`.wrap-wide`, 1440px vs 1180px). Lead uses `EpisodeLead` with a description line. All remaining feed videos (up to 14, everything but the lead) render in one dense `.ep-grid` (thumbnail-on-top, ≥2x the old thumb size) — no more splitting into separate Episodes/Clips sections. The weekly-series table became a horizontal `.franchise-strip` of chips (kept per instructions — it's the actual weekly lineup, not "host chapters"). Grepped the whole codebase for "chapter": nothing matching the "host chapters" concept existed anywhere (only unrelated "City Chapters" fan-club copy on `/porch`), so nothing needed removing there.

**New/removed:** `components/EpisodeLead.tsx` added (thumbnail lead, links to YouTube); `components/EpisodeHero.tsx` (iframe embed) deleted, now fully replaced. `VideoCard`/`VideoGrid` switched from side-by-side rows to thumbnail-on-top cards with a `variant` prop. `lib/teams-meta.ts` gained `helmetLightUrl()`. `public/img/campus-live.jpg` converted via `sips` from `josh-assets/generated/campus-live.png` (1400px, q82).

## Verify results
- `curl /`: 0 hits for `hero-porch`; hero section contains no "Watch on YouTube"; "The Notebook" appears before the `poll-band` section in DOM order; 10 unique `helmets-light/*.jpg` paths present.
- `curl /show`: 15 unique YouTube video IDs rendered (1 lead + 14 grid thumbnails), well over the ≥10 requirement.

## Concerns / judgment calls for the client to weigh in on
- Kept the homepage Show band and Citizen Gift band as the two allowed navy accent bands; everything else (poll/pick'em, newsletter, tailgate, follow-porch) is now light. Flag if a different pair should stay dark.
- `cta-band` (the "Who's In? See the Playoff Picture" strip on every page, right above the footer) was switched from full green to navy so it reads as one continuous dark zone into the footer — this affects every page, not just the homepage.
- No literal "franchise-of-the-day" component existed before; interpreted that instruction as the existing weekly-series table and restyled it as a strip rather than building something new.
- One real gotcha during verification: a stale Turbopack `.next` cache served old pre-edit HTML through `next start` even after a fresh `npm run build`; a clean `rm -rf .next && npm run build` fixed it. Worth remembering if a future deploy looks like it "didn't take."
