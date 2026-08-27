# SPEC: THE DESIGN SYSTEM — v2.0
### The look is not interpreted. It is copied.

## 1. THE PRIME DIRECTIVE

**Copy the chrome from the reference builds verbatim; swap only the article block.** The `<head>`, CSS, masthead, weekly-strip, rail, and footer come byte-for-byte from the approved files in `reference-builds/`. Claude Code never restyles from a description — every new page matches by construction, not by taste. If the needed reference build is missing, stop and request it; never approximate chrome from memory.

## 2. TOKENS (as shipped in the gold standard)

Navy `#0E2240` (deep `#0A1730`, mast `#0D1321`) · Gold `#C9A227` (dark `#A8861B`) · Red `#C8102E` · Green `#1E7D3E` · Ink `#151A22` · Muted `#5F6B7A` · Hairline `#E5E9EF`. Type lock: **Barlow Condensed** (display/data) + **Public Sans** (body). Shadows via the `--sh-sm/md/lg` scale. The AI Predictor surfaces use the dark "machine" treatment so readers can always distinguish model output from editorial opinion, and every Predictor citation carries its "Inputs:" line.

## 3. THE VISUAL LAWS

1. **The Contrast Law:** no team logos directly on dark surfaces — logos sit in light chips/circles. Every module passes the squint test.
2. **The dedup law:** never two major modules back-to-back performing the same editorial job. If a visual board carries the framing, the adjacent module compresses to a compact data strip or is cut. The visual makes the article easier to understand — never makes the reader process the same information twice.
3. **Light 3D depth:** soft layered shadows from the token scale; never flat, never heavy.
4. **Visual budget:** max three major modules per column beyond the hero (spec 06 §4).
5. **Drop-cap scoping:** the drop-cap style is scoped to the opening paragraph selector only — the unscoped giant-numeral bug is a known trap; the validator checks for it.

## 4. THE MODULE INVENTORY (reference renders in `feature-three-boards-v3_1.html`)

- **The three-chip board:** logo chips on the dark gradient card, gold eyebrow, white value, muted descriptor.
- **The compact data strip:** single row, hairline border, red condensed-caps eyebrow + value pairs, optional Ledger footer. The sanctioned "restate the facts without a second module" pattern.
- **The Number That Matters:** one huge numeral on the dark card, gold rule, one sentence stating what the number does and does not tell us. Used whenever one number carries the argument.
- **The Line Worth Keeping (receipt/pullquote):** standalone quote + Ledger log line.
- **The Ledger receipts module, Citizen Pulse, companion-episode card, Wire status rows** ("Confirmed · 11:40 AM · Sarkisian, On the Record"), reader-facing consequence labels ("What This Injury Changes").

## 5. BUILD MECHANICS (for Claude Code)

- All HTML edits use `rep(old, new, c=1)` with a count assertion before writing; on mismatch, `repr()` ~200 chars around the target and reconcile encoding (curly vs. straight quotes, entities vs. Unicode). Never guess.
- Tag-balance QA loops over standard tags comparing open vs. close counts (`img` skipped, self-closing).
- Helmet/asset embedding per spec 05 §3.5 (PIL trim → resize → compress → base64).
- Outputs to the pipeline's designated build directory; single-file pages (CSS inline).

## 6. HANDOFF SHAPE (Isaac)

Templates implement as React components with Sanity CMS schema (required-visual prompting) and CFBD API population; server-side PNG rendering for social sharing. Homepage dedup logic: featured-content IDs render once; hub modules count as already-shown.

## 7. THE SHIP VALIDATOR (fail-closed, every page)

- [ ] Chrome byte-identical to the reference build for the lane
- [ ] Tokens only — no off-palette hex, no off-lock fonts
- [ ] Tag balance clean · drop-cap scoped · logos on light chips only · squint test passed
- [ ] Module count within budget · no adjacent same-job modules
- [ ] Predictor surfaces dark-treated with Inputs line · internal links resolve · no off-site Wire links
- [ ] Voice Bible §13 validator passed for the article block

---
*v2.0 (Aug 26, 2026) — kit v4.0 consolidation: dedup law + Number That Matters + compact data strip specced with reference renders in the hybrid gold standard.*
