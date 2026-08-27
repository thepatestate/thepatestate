# SPEC: THE WIRE & THE AUTONOMOUS NEWS LANE — v4.1
### What happened, verified, in minutes — sounding like it came from Josh's building. Because it did.

**Load with:** `01-constitution.md` + `02-voice-bible.md`. Voice rules live ONLY in the Voice Bible (the Wire register, §1); this spec covers structure, modules, sourcing mechanics, and the lane's boundaries. Reference builds: the approved Wire pages in `reference-builds/` — chrome verbatim, article block new.

## 1. SCOPE — WHAT RUNS IN THIS LANE

**Autonomous (no approval click):** The Wire (`/wire/[slug]`) · house news-reaction at the Notebook (NR-01 What It Means, NR-03 Five Consequences, NR-04 Who Benefits, NR-05 What Happens Next, NR-07 Rule/Policy Explainers, NR-08 Industry Analysis, TI-05 injury roster-mechanics follow-ups) · Service Desk pages.

**Never autonomous:** anything with Josh's byline or opinion beyond verbatim archive quotes · Josh's Take additions · legally or medically sensitive stories beyond official reporting. The lane runs fast because its boundaries are absolute.

**The mission in four sentences.** The Wire answers exactly one question: what happened. It publishes autonomously because speed is its value and facts don't need Josh's signature. It reports like a wire service, explains like the Film Room, and sounds like Josh's building without ever borrowing Josh's opinions. Every story routes readers deeper into the site, never off it.

## 2. STRUCTURE LAWS

1. **600-word floor.** A Wire story under 600 words does not ship.
2. **Attribution in sentence one.** Who reported it or who said it, on the record, before anything else.
3. **The seven-part skeleton:** attribution lede → the fact set (what is confirmed vs. reported) → the mechanism (what this actually changes on the field or the roster) → honest scale (how big this is, sized without hype) → the archive layer (bolded verbatim Josh quotes only, when the archive has relevant on-record positions) → what happens next (named dates) → internal routing (links + one plain CTA).
4. **Status labels are data:** Confirmed / Reported / Updated, each with a timestamp and source line ("11:40 AM · Sarkisian, On the Record" · "League Release" · "Timeline Confirmed"). Never upgrade Reported to Confirmed without a new source.
5. **Banned openers (codified from Josh's corrections):** never open on scene-setting weather/atmosphere, never open on a rhetorical question, never open on "In a move that…", never open with the consequence before the fact. The fact, attributed, is sentence one.
6. **Category templates:** commitments · firings/hires · portal entries · injuries · legal. Injuries and legal run the sober register (Voice Bible §4.3): reporting only, humor banned, medical detail limited to what is officially confirmed, and flaws/blame never assigned to the athlete.
7. **The archive layer is verbatim-only.** Josh's words appear as bolded exact quotes with their original context and date. Paraphrasing Josh's opinion in the Wire is a violation.
8. **Reader-facing module labels** per the design system ("What This Injury Changes"). Internal links route to Pate State pages — never off-site when an internal page exists (homepage dedup flagged off-site Wire links as a defect; the fix is law).

## 3. SHIP CHECKLIST (fail-closed)

- [ ] ≥600 words · attribution in sentence one · every fact labeled Confirmed/Reported with source + timestamp
- [ ] Zero Josh opinion outside bolded verbatim archive quotes · zero editorializing adjectives
- [ ] Mechanism section present (what changes, in actual football) · honest scale, no hype
- [ ] Sober register verified for injury/legal · no banned openers · Voice Bible §2 sentence laws pass
- [ ] Named next date present · internal links only · one plain CTA · chrome copied verbatim from reference build

---
*v4.1 (Aug 26, 2026) — kit v4.0 consolidation; off-site-link ban codified from the homepage audit.*
