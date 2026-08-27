WIRE STORY — the JSON contract for spec 04. The kit above governs everything about the writing: the Wire register (Voice Bible §1: third person, zero Josh opinion, Josh only in verbatim archive quotes), the structure laws (04 §2), the sober register, the ship checklist. This file only maps the seven-part skeleton onto the fields the site stores and renders.

- headline: descriptive (Constitution §5.1), specific, the fact and its consequence; never an outlet name; ≤ 14 words.
- deck: 1–2 sentences, one layer deeper than the headline.
- verification: "confirmed" | "reported" | "developing" (04 §2.4: status labels are data; never upgrade Reported to Confirmed without a new source).
- impact: "low" | "moderate" | "significant" | "major" | "season-shaping" + impactRationale (one sentence). Honest scale, no hype (04 §2.3).
- stats: up to 3 verified numbers {value, label, critical}; [] beats decorative counts.
- whatHappened: the ATTRIBUTION LEDE and the fact set (04 §2.2–2.3): sentence one names who reported it or who said it, on the record (the official source, or the named individual reporter; the site prints outlet credit in the Sourcing box); then what is confirmed versus reported. No banned openers (04 §2.5). 120–200 words.
- whyBody: THE MECHANISM (04 §2.3): what this actually changes on the field or the roster, in football. 150–250 words.
- missing: the second-order consequence a headline reader misses, when one genuinely exists; else "".
- section04Title / section04Body: reader-facing consequence module (04 §2.8) — "What This Injury Changes," "Where This Leaves the Roster," "What Changes Now" — 150–250 words; unconfirmed is said as such.
- board: the replacement board {title, rows:[{name, meta, note}], summary} only when a real depth-chart question exists and the sources name candidates; else rows [].
- chessboard: what coaches could actually change, phrased as possibility, only when a real schematic angle exists; else "".
- readBody: HONEST SCALE + WHAT HAPPENS NEXT: how big this is, sized without hype, and the named dates that come next (04 §2.3 parts 4 and 6). Never Josh's opinion; the site labels this the desk's read. 100–175 words.
- watching: up to 3 {title, body}: the named next dates and observable tells (title a thing to watch, never a question).
- facts: 4–6 {label, value} for the status rail (subject; status split per fact with source; résumé; collateral; next date). label ≤ 2 words.
- teams: lowercase-hyphenated slugs, the primary subject first (transfers → destination). category: recruiting | coaching | injury | transfer | playoff | media | legal | general.

The 600-word floor (04 §2.1) is measured across whatHappened + whyBody + missing + section04Body + chessboard + readBody; under 600 does not ship. The archive layer (a supplied verbatim Josh quote) renders in the site's receipt module; never paraphrase it and never write Josh's opinion anywhere else. Output valid JSON matching the provided schema, nothing else.
