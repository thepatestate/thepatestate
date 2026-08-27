# SPEC: PRESEASON ANNUALS — v2.0
### Every FBS team has a page. No 404s. Three tiers, one architecture.

**Load with:** `01-constitution.md` + `02-voice-bible.md` (Josh register — annuals are approval-lane). Reference build: the Ohio State annual print build in `reference-builds/` — the magazine chrome is copied verbatim.

## 1. THE THREE TIERS

- **PS-01 Full Annual (top 25–30 programs):** the 06A Team X-Ray architecture, complete. **6,000–7,000 words is the floor, not a cap — there is no word-count ceiling.** Includes the two-page "The Four That Decide It" spread.
- **PS-02 Standard Annual (remaining Power 4):** the X-Ray architecture at reduced depth; every section present, the spread optional.
- **PS-03 Team Capsule (Group of 5 + independents):** the compact treatment — identity, the one unit that decides the season, the schedule truth, the prediction with its grading date.

Coverage goal: all ~130 FBS programs have a live page before kickoff. A fan of any team who arrives at The Pate State finds their team treated seriously.

## 2. THE 06A TEAM X-RAY ARCHITECTURE (PS-01/PS-02)

The spine of every annual: the identity thesis (what this team actually is) → the line of scrimmage first (both lines, mechanism-level) → unit-by-unit X-Ray (QB comfort, the rooms, the two-deep — flaws to units, never named players) → the personnel bet of the offseason, named honestly → the schedule truth (named dates, named collisions) → "The Four That Decide It" spread (the four games/questions that swing the season, each with its watch date) → the prediction block: record, floor/ceiling, and every claim logged to the Ledger with its grading date → the Josh verdict close, signed "— JP."

## 3. THE LAWS

1. **Every head-to-head prediction runs through the consistency ledger before publish** (Constitution §4.4): no game may have two winners anywhere on the site. The build fails closed on a conflict.
2. **Boldest-bet honesty:** every annual names the program's riskiest personnel decision plainly ("the boldest personnel bet of any championship contender") and states what has to be true for it to work, with a watch date.
3. **Market framing, never dunk framing:** "the market is too high on," never "overrated" (Constitution §5.1).
4. **Numbers everywhere a vague quantifier could live** (Voice Bible §0B) — returning starts, sacks allowed, draft picks lost, rating points.
5. **Helmet/asset pipeline:** supplied helmet art only (never CSS-drawn substitutes): PIL `getbbox()` on the alpha channel to trim, `resize()` to target height, compress, base64-embed.
6. **Print chrome verbatim** from the reference build; only content blocks are new. Every annual passes the design system's ship validator.

---
*v2.0 (Aug 26, 2026) — kit v4.0 consolidation of the 06A spec + three-tier scaling; no-ceiling rule and consistency-ledger gate restated as law.*
