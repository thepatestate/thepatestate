# SPEC: THE PRESEASON ANNUAL — v7.0
### The magazine, at every scale. One thesis, one record everywhere, graded in January. Every FBS team gets a page.

**Load with:** `01-constitution.md` + `02-voice-bible.md` + `07-current-state.md` + a fresh research file. Consolidates Production Guide v6.1 and the 06A X-Ray editing discipline. Reference builds: `annual-ohio-state-v6-print.html` (and the Notre Dame, Oregon, Georgia siblings) — the voice standard, per Josh.

---

## 1. WHAT AN ANNUAL IS

A Pate State Annual is a **magazine, not an article**: a premium digital publication for one team that makes one central argument (the thesis), proves it across chapters, commits to a record pick on a public receipt, and hands the last word to the Porch. Three non-negotiables:

- **One thesis, stated once, echoed everywhere.** It must be *Josh's* argument, from the Josh file — never invented for narrative effect. Find the single sentence that explains the team's season and let every chapter earn it.
- **Everything is graded later.** Record pick, game picks, position grades — all land in a Ledger Entry receipt marked ⏳ OPEN, graded in the January Receipts Special, misses printed first.
- **The Porch gets the final say.** Every annual ends with a ballot on the season's biggest question: Josh's call, the Model's call, and the Porch percentage side by side.

**Length: the spec targets are floors, not caps.** There is no word-count ceiling on an annual. A Full Annual's job is done when nothing meaningful is omitted — Josh's explicit rule. Padding is still a defect; depth means more real material, never longer sentences.

## 2. THE THREE COVERAGE TIERS (every FBS team, no 404s)

The team page is the evergreen URL; the annual is its yearly refresh; Wire briefs, reaction pieces, and rankings placements attach to it all season.

**TIER 1 — FULL ANNUAL** (🟣, top 25–30: JP Poll Top 25 + bubble contenders). The complete magazine per §5–6: all pages, all boxes, The Four That Decide It spread, signature diagram, projected 22, Film Room blueprints, The Road, the receipt, the ballot. Publishes July–August, top-10 first. Each pre-lists 4–6 derivative children (PS-04/05/06, breakout, schedule shape) at commission.

**TIER 2 — STANDARD ANNUAL** (🟢, remaining P4, ~40 teams). One article-format build (the `annual-article-page` pattern), same voice and receipts discipline, condensed architecture: cold open + thesis → State of the State box → autopsy (short) → offense case → defense case → three-numbers box → best position group / biggest concern → best player + breakout + impact newcomer (profile paragraphs, not full cards) → schedule read with the tier table → ceiling/floor/most-likely → record pick with per-loss reasons → Ledger receipt → ballot. Typically 1,500–2,500 words. Derivatives only when triggered.

**TIER 3 — TEAM CAPSULE** (⚪, all G5 + independents, ~65 teams). One structured capsule, 400–700 words: the one thing that decides their season → projected record with one-sentence reasoning → best player → the game that matters most → one honest ceiling sentence, one honest floor sentence → Ledger receipt line. Capsules roll up into the G5 guide and conference sub-pages. Same voice laws, same consistency ledger, same no-fabrication standard — a capsule is small, never sloppy.

**Consistency at scale:** every predicted result in every annual and capsule writes to the consistency ledger at commission; the engine validates head-to-head consistency across all ~130 documents before any publish. The same game never has two winners anywhere.

## 3. BEFORE YOU WRITE: THE RESEARCH FILE + THE JOSH FILE

**Never write from memory — rosters move.** Verified from current reporting before the file opens:
- Final JP Poll rank + rating, AP, Coaches, Model rank
- Prior-season record and how it ended (the emotional residue: playoff result, snub, opt-outs)
- Full schedule: dates, opponents, venues, trophies, kickoff/TV where announced (TBA where not — never invented)
- QB file: class, size, starts, full stat line, one defining quote if available
- Complete departures (draft round, portal, medical) and arrivals (prior-school production, class rank, key freshmen) — quantified, "312 of 379" style
- Likely starting 22 + nickel + specialists from the most recent camp reporting. **Named humans at every spot.** A genuinely contested job is a battle between two named players — never a placeholder.
- Coordinator changes and year-in-system, injury files shaping the depth chart, market title odds

**The Josh File (mandatory, built first).** This site is the primary source for Josh Pate content and can never contradict him. Compile from primary sources (his show, @JoshPateCFB, TV appearances), fresh every build:
- His current rank for this team — the annual's rank IS his rank
- His projected record and CFP outcome — his public projection is the annual's pick; the annual adds texture, never a different result
- His stated concern — whatever he has named becomes the central question, never an invented worry
- His actual quotes, lightly cleaned for print per the two-lanes rule — never fabricated
- His framing devices and bits — use them, credit the show
- His full projected bracket — it settles cross-team consistency automatically
- **Version-stamp it** ("built on CFP Prediction Version 1.0, August 2026"); when he updates, the annual updates with a timestamped revision, never silently

If Josh hasn't spoken on something, the annual may extend his logic in his voice — an extension a show listener would recognize, never colliding with anything he *has* said.

## 4. THE EDITORIAL SPINE (decided before layout)

Seven decisions, everything downstream of them: the thesis sentence · the record pick, loss by loss, with a reason per loss (never "just feels like a loss") · the Josh-vs-Model tension, staged in the Verdict · the two-questions frame ONLY when Josh himself splits rank and January outlook · the linchpin, the breakout, and the biggest risk · the ballot question (the single argument the fanbase will actually fight about) · the one NFL comp maximum, only when it genuinely illuminates — everyone else gets a Bottom Line box.

## 5. FULL ANNUAL PAGE ARCHITECTURE (build in this order)

Each "page" is an `<article class="page">` with folios and running page numbers; dark pages use `class="page darkpg dark"`.

| # | Page | Contents |
|---|---|---|
| 1 | **Opener** | Team-gradient hero, ghost rank numeral, logo + rank chips (gold chip only for special status), H1 with italic accent word, dek states the thesis, 4-cell numrail, hero photo frame, byline strip with "Grade me in January." |
| 2 | **The Verdict** | Dark page. 9-cell grid: JP Poll, Model, record, playoff, championship, linchpin, biggest risk, signature game, flag plant — **every cell fully explained, no koans.** Three-questions strip. Josh-vs-Model split panel with VS medallion, 3 bullets and a crown line per side. |
| 3 | **The Autopsy** | Last year, honestly. Drop-cap lead, credit-the-opponent-first on losses, split-stat panel, trio of context stats, Out/In turnover table with quantified lines. |
| 4 | **Offense** | Prose → pullquote → watch box (one observable + a date). Stress bars. One signature diagram (reinvented per thesis — the diagram proves the argument visually). One deep-dive box on the unit that decides the season with if-holds / if-not / how-you'll-know rows. |
| 5 | **Defense** | Same tools; ends with the 4-cell timeline mapping the unit's arc to specific dates. |
| 6 | **Marquee I** | Two half-page player profiles: jersey watermark, stat line, what's-real paragraph + the honest flaw, strengths/weaknesses row, Bottom Line (or the one comp), grade chip, watch line. |
| 7 | **Marquee II** | Eight quarter-page profiles, each with a role label, mechanism paragraph, grade, watch stat; 8-cell supporting-cast strip. A position *group* can be profiled as a unit when the group is the story. |
| 8 | **The Four That Decide It** | The spread Josh added: the 4 biggest games, each with the compelling matchup, why it matters, and the in-game matchups — half a page each (one or two pages as needed). |
| 9 | **Projected 22** | Green field graphic, every starter a named chip color-coded lock / leader / new arrival / open battle, nickel included, named backups strip, 12-grade strip + OFF/DEF summaries, four camp storylines. |
| 10 | **Film Room** | Four numbered blueprints for how opponents attack this team, SHOW→BRING chips, mechanism paragraphs; "What Breaks the Blueprints" box; "What Would Change the Pick" two-column flip. |
| 11 | **The Road** | Vertical timeline, every game a stop with a 1–2 sentence read; W/L chips on swing games; tier colors per the fixed scale (§6); the gauntlet stretch shaded; sticky stress sidebar (real numbers only); four-marquee strip; seasonline bar with the record. |
| 12 | **The Ledger** | Clean table (date, opponent+venue+trophy, TV real-or-TBA, W/L), danger rows shaded, footer record → playoff → outcome. Then **Five Things I'd Bet On** (substantive) and **The Margins** (4 cells: schedule math, layoffs, market anomalies, travel shape). |
| 13 | **The Close** | Dark page. Three futures: Ceiling / Pate Case / Floor, each with the mechanism that produces it (gold Pate Case panel only for the champion pick). Month-test strip. **The Ledger Entry receipt** (record, losses by date, playoff call, outcome, ⏳ OPEN — graded January). **The Porch Ballot** with working three-way JS. CTA row. |

## 6. VISUAL SYSTEM (per-team skin, same skeleton)

Identical CSS skeleton; only the `:root` token block changes: `--team / --team-dk / --team-deep` + accent, with paper, ink, and field tones constant house-wide. Opener gradient light-primary → primary → deep; ghost numeral = JP Poll rank at ~25–30% opacity. Logo via official mark with ESPN CDN fallback (`https://a.espncdn.com/i/teamlogos/ncaa/500/{id}.png`). Fonts house-wide: **Barlow Condensed (display) + Public Sans (body)** — never substitute. Field graphics stay green regardless of team. Real helmet art assets from the approved library (base64-embedded via the trim/resize pipeline) — never CSS-drawn substitutes, never AI-generated images. Photo frames ship as labeled gradient slots with credit slots. `@media print` breaks pages, hides chrome. Gold champion treatments belong to the champion pick's annual ONLY. Volume numbers run sequentially.

**Schedule tier labels — the fixed, self-explanatory set (Josh's correction, law):** 🟢 **Expected Win** · 🟡 **Handle Business** · 🟠 **Upset Watch** · 🔴 **Season-Definer**. Beneath every table: the toughest game, THE trap, and the stretch that decides everything, named in prose.

## 7. WHAT SHIPS vs. WHAT DOESN'T

The shipped file contains **zero internal machinery**: no "Flagged · verify" chips, no sourcing/fineprint blocks, no Operations Manual references, no "awaiting select" language, no unresolved "?" grades except as a deliberate editorial device explained in prose. If a fact can't be verified, the fix is research or omission — never a visible flag. Internal notes live in the handoff message, not the file.

**Keeps (public brand):** the Ledger Entry receipt, "graded in January," "misses printed first," "corrections timestamped, never silent," the Josh-vs-Model rivalry, the Porch ballot. Receipts language IS the product.

## 8. BUILD WORKFLOW (chunked, verified)

Large single-file writes fail. Build in appended chunks (head/tokens → component CSS + mast → pages in order → close + JS). Verify after every chunk: `wc -c`; at the end, tag-balance check (open counts = close counts, `img` exempt) and a grep for banned internal strings (Flagged, verify, awaiting, fineprint, Operations Manual). All edits via `rep(old, new, c=1)` with count assertion; on any miss, print `repr()` around the target — never guess encoding. Test both ballot button paths. Ship to `/mnt/user-data/outputs/annual-{team}-v{n}-print.html`.

## 9. QA CHECKLIST

☐ Thesis in dek, echoed in a pullquote, resolved in the close ☐ Josh file check: rank, record, champion call, stated concerns match his latest positions; every quote real; projection version-stamped ☐ Nothing contradicts his public record; old site canon conflicts corrected with timestamps ☐ **One record, everywhere:** pick = ledger table = road picks = seasonline = receipt = ballot ☐ Every game vs. an already-covered team matches that team's published result ☐ Prior published lines about this team honored ☐ All 22 + nickel + key backups named, current, camp-verified; battles are battles between named players, zero placeholders ☐ Twelve grades present, every grade defensible from the prose ☐ Max one NFL comp ☐ Every watch box names an observable + a date ☐ TV real-or-TBA, never invented ☐ Tier labels from the fixed set ☐ No fake precision, no koans, motif budgets enforced (Voice Bible §7) ☐ No internal machinery ☐ Tag balance clean, ballot works, anchors match nav, folios run, volume correct ☐ Voice Bible §14 checklist + revision passes ☐ Tier 1 file lands ~100–115KB+ (parity is a floor)

---
*Changelog: v7.0 (Aug 2026) — Production Guide v6.1 consolidated into the kit; three-tier every-team scaling added; The Four That Decide It made a standard page; no-ceiling length rule codified; fixed tier-label set locked; 06A editing discipline (fake precision, template phrases, motif budgets) folded into QA via the Voice Bible.*
