# SPEC: THE PATE STATE DESIGN SYSTEM — v1.0
### How every page looks. The chrome is canonical: copy it from the reference builds, never rebuild it from memory.

**Load with:** `01-constitution.md` + the product spec for the piece being built. The reference builds in `/reference-builds/` are the single source of truth for aesthetics. This file explains how to use them and the rules that govern them.

---

## 1. THE PRIME DIRECTIVE: COPY THE CHROME, SWAP THE CONTENT

Never write page CSS from scratch and never restyle by description. The build method for every article page:

1. Open the matching reference build (see §2).
2. Keep its `<head>`, CSS, mast/nav, rail, Keep Reading section, footer, and scripts **verbatim**.
3. Replace only the `<article class="article">…</article>` block with the new story, reusing the existing class names.
4. Update: the `<title>` tag, the Pulse initial numbers in the script (`var yes=…, votes=…`), the yt-tab `data` object, and the rail's "Latest on the Wire" items.
5. Run the validator (§7) before shipping.

This is how every approved page in the set was produced, and it is why they all match. A page that "looks close" is a defect; a page that shares the chrome is correct by construction.

## 2. WHICH CHROME FOR WHICH PIECE

| Building | Copy chrome from | Notes |
|---|---|---|
| Wire story (any type) | `wire-article-page-v2.html` (the Whitmore build) or `wire-ohio-state-rowe-safety.html` | Same chrome; Rowe is the newest full-rulebook build. |
| Josh's Read / Notebook feature | `feature-three-boards-josh.html` | Same site chrome with the JP byline treatment (red avatar gradient, "Josh's Read · Logged to the Ledger" chip). |
| Preseason Annual (Tier 1 print) | `annual-ohio-state-v6-print.html` | The separate magazine chrome — full spec in `05-spec-annual.md` §5–6. |
| Standard Annual / capsule article pages | site article chrome (feature variant) | Annual content architecture per `05-spec-annual.md` §2. |

The Kansas State build's visual modules (chips, stat rail, board cards, sourcing box) are already folded into the shipped wire chrome; do not source prose from it (Voice Bible §12).

## 3. DESIGN TOKENS (site article chrome)

```
--navy:#0E2240   --navy-deep:#0A1730   --gold:#C9A227   --gold-dk:#A8861B
--red:#C8102E    --ink:#151A22        paper/white surfaces per the build
```
Annual print chrome swaps in a per-team block (`--team / --team-dk / --team-deep` + paper `#FDFCF8`) over the same skeleton; house field graphics stay green regardless of team.

**Fonts, house-wide and non-negotiable:** Barlow Condensed (display, weights 500–800) + Public Sans (body), loaded exactly as in the reference builds. Never substitute, never add a third family.

**Logos:** official marks with the ESPN CDN fallback `https://a.espncdn.com/i/teamlogos/ncaa/500/{id}.png`. **Images:** photo frames ship as labeled gradient slots with credit slots ("Photo Slot — …" + "Photo credit slot"). No stock art, no AI-generated images, ever. Helmet/art assets come from the approved library via the base64 trim/resize pipeline.

## 4. THE MODULE INVENTORY (class names are the API)

Article header: `a-crumb` breadcrumb → `a-kick` chips (lane · status · category) → `a-hl` headline → `a-dek` → `a-by` byline row (avatar `av`; JP pieces use the red gradient) → `a-hero .ph` photo slot → `a-cap` caption.

Body modules, in the order the specs call them: `a-body` prose with `h2` sections · `ul.why` (Why It Matters) · `nums/num` (Three Numbers) · `impact` + `drow` rows + `foot` (the "What Changes" box and the Replacement Board) · `receipt` (On the Record / The Line Worth Keeping) · `a-ep` episode card · `read` (The Pate State Read) · `next/nrow` (What to Watch Next) · `pulse` with working buttons, bar, and `ft` foot · `yt` tabs · `a-pb` forward-link banner · `a-src` sourcing + `disc` disclosure · `a-tags` · `a-author` · `a-porch` thread banner. Rail: `trend` items, `rail-poll`, `rail-pb` newsletter.

**Module-language rules (reader-facing, from Josh's corrections):**
- Module titles are plain descriptions of what the module shows: "What This Injury Changes," never insider file-naming ("The Communication File").
- Chips carry product language, never workflow language: "Josh's Read · Logged to the Ledger," never "Approved Byline."
- Impact chips split status per fact ("Confirmed by Day · Timeline Reported") and every impact rating carries its reason.
- Precise volatile numbers live in these dated modules with their as-of framing; evergreen prose gets the durable phrasing (Voice Bible).

## 5. INTERACTIONS & SCRIPTS

Keep the reference scripts as-is: reading progress bar, Citizen Pulse one-tap demo (update `yes` and `votes` per story; foot line follows the completeness rule — a full sentence, no em dash), yt-tab swap (update the `data` object copy per story). Test both Pulse buttons before shipping. Artifact/localStorage-style persistence is never used; state is in-page only.

## 6. KNOWN BUILD TRAPS (each one has bitten us once)

- **Drop cap scoping:** the lede drop cap must be `.a-body > p:first-of-type::first-letter`. Without the direct-child `>`, the first paragraph of every module gets a 54px capital — this is the giant "6," bug from the Pulse vote count.
- **Full-node text sweeps:** voice QA must scan every text node (spans, captions, module notes, script strings), not just `<p>`/`<li>` — "the machine's counter-board" survived one round by hiding in a module span.
- **Encoding:** all edits via exact-match replace with count assertion; on a miss, inspect the raw bytes around the target (curly vs. straight quotes) — never guess.
- **Em dashes:** banned in prose *and* in module furniture sentences (Pulse foots, author bios). Allowed only in data labels/annotations and the "— JP" sign-off.
- **Tag balance:** open counts must equal close counts for every tag before shipping (`img` exempt).

## 7. THE SHIP VALIDATOR (run on every page, fail closed)

☐ Chrome byte-identical to the reference outside the article block, title, Pulse numbers, yt data, and rail items ☐ Tag balance clean ☐ Full-node sweep: zero "machine," zero banned words, zero internal vocabulary ("multiplier," "price," "ecosystem"…), zero "the honest read," zero exclamation points, "elite" ≤ 1 ☐ Em dashes only in data labels and the sign-off ☐ Drop cap scoped with `>` ☐ Module titles plain-language; chips reader-facing ☐ Receipt/pullquote passes the standalone test ☐ Magnitude adjectives replaced by real numbers where a number exists ☐ Photo slots labeled with credit slots; logos via approved sources ☐ Pulse buttons work; progress bar works ☐ Demo builds carry the demo-figures disclosure in `a-src` ☐ YouTube card present; internal links present; forward link present (Wire)

---
*Changelog: v1.0 (Aug 2026) — first standalone design spec, extracted from the approved reference builds and the session corrections (drop-cap bug, module-title rule, chip language, full-node QA).*
