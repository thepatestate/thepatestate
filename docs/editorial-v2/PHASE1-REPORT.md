# Editorial Engine V2 — Phase 0 + Phase 1 report

Branch `editorial-v2-phase1` · Aug 27, 2026 · brief §31.13 deliverables.

## Status in one paragraph

V1 is untouched and still produces every held draft. V2 is built end to end for show columns behind flags that default off, runs offline against a frozen replay set, logs every run to `editorial_runs`, and writes blinded V1-vs-V2 reports. Four improvement loops ran today. **The result is not at 8.5**, so per Isaac's instruction nothing was switched on and no article was replaced. The loop stopped because Anthropic credits ran out (fourth time this week), not because the ideas ran out — the fourth loop's change is implemented and tested but unmeasured.

## What the replays showed (calibrated judges)

The single most important finding: **the brief's judges, as written, scored Josh's own hand-edited, approved Miami column 6.5 fan / 6 humanity / 6 voice.** They docked his section headers, dated concessions and one-line dares as machine tells. Every threshold in the brief is meaningless on that scale. Loop 3 anchored the fan, humanity and voice judges to the two Josh-approved columns ("this is what a 9 reads like; judge effect, not resemblance"). Josh's column then scores **9.3 / 9 / 9.7**, and the scale finally measures his taste.

On that scale (fan mean of two cross-family judges):

| draft | fan | sendability | humanity | voice | words |
|---|---|---|---|---|---|
| Josh's own edit (benchmark) | **9.3** | 9.0 | 9 | 9.7 | 894 |
| V2 run 1, Writer B alone (Opus, reader-first) | **8.1** | 7.8 | 8.5 | 8.5 | 813 |
| V2 run 1 final (after rewrite + audience edit) | 6.8–7.4 | 6.0 | 8 | 7.5 | 546 |
| Lab column Josh called "close" (legacy 7.8) | 6.6 | 5.8 | 8 | 8.4 | 515 |
| V2 portal final | 5.8–6.3 | 4.5 | 4–6.5 | 6.5–7 | 542 |
| V1 fresh (Miami episode) | 5.5 | — | 4 | 4 | 1460 |
| V1 fresh (portal episode) | 5.7 | — | 3.5 | 4 | 1238 |

Stage-by-stage scoring of every intermediate draft (`scripts/editorial-rescore.mts --stages <run>`) found the same shape in all three completed runs: **Writer B (Opus) produced the best draft in the room, and the developmental rewrite and audience edit made it worse** (Miami: B 8.1 → rewrite 6.4 → audience edit 6.2; portal: audience edit cut humanity 8 → 4 and the piece to 546 words each time).

## The four loops

1. **Loop 1** — the miner chose a "Josh audits his own bracket" essay; writers produced aphoristic pivot lines; the same point circled; the rewrite budget held a cycle early. Added: assignment focus for the acceptance fixture, no self-audit angles, restatement signals to the rewrite/audience stages, a sharper voice card, a third rewrite cycle.
2. **Loop 2** — the run was **killed at the angle stage**: the frozen fact sheet covered only quote-tagged teams (the helper caps at four), so the dossier reported "no 2026 ACC schedule" and missed the "then who" dare hidden in an ASR garble ("then whomsted"); the angle judges scored the brief's own example angles 5. Added: assignment-aware dossier, garble rule, production fact-sheet top-up from the dossier's teams, the brief's good/bad angle calibration in the miner/judges/EIC, kill reserved for material that cannot support the assigned claim.
3. **Loop 3** — judge calibration (above); the truncated Sonnet blueprint reviews (16k tokens now); the verified fact sheet passed whole to the blueprint, its editor and the writers.
4. **Loop 4 (implemented, unmeasured)** — every candidate in the room (writers A/B/C, each rewrite, each audience edit) is judged and the best clean one is the piece; later stages must score higher to be adopted; a third writer (Opus on the argument-first brief); the audience editor may not shrink a draft below 90% or drop a mandatory beat.

## Cost and time per V2 show column

Completed runs: $4.95 / 26 calls / 17 min · $6.19 / 26 calls / 21 min · $6.78 / 36 calls / 19 min (estimated list prices). Killed at angle stage: $1.09 / 5 calls / 4 min. **Average ≈ $6.00 and ~29 calls per completed column**, inside the brief's 10–18 "distinct jobs" only if the judge calls are counted separately (each final evaluation is 5 calls). Loop 4 adds ~15 judge calls (cheap models) per run.

## Tests

`npx vitest run`: 230 passed (17 new in `lib/editorial-v2/editorial-v2.test.ts`): flags default off / shadow on / may-write only when both set; model fallback chain; cross-family creative path; writer context contains no gold-standard prose; both writers receive identical facts and no draft; retrieval excludes the hidden benchmark; hard gates fail fact/brand not style; quote fidelity fail-closed; a 690-word column is not a length failure; fact-check failure routes to repair then hold; router maps every class to a valid stage and budgets convert revise → hold; telemetry strips reasoning fields; every stage schema is strict. `npx tsc --noEmit`: clean.

## The top remaining quality failure

**Sendability.** Even the best V2 draft (8.1) scored 7.8 on "would you send this to another fan"; every final scored 4.5–6.5. The fan judges' "machine" notes are consistent: a neat closing sentence generated from the thesis, a polished pivot line, the same point restated. Josh's column gets 9 on sendability from a real dare ("So name the alternative") and a real consequence with his name on it. The room does not yet produce the *idea* a fan would text; loop 4's judged selection protects the best draft but does not create that idea. The next lever to test (when credits return): a blueprint beat for "the idea a fan would text, stated plainly" (the lab's `textLine`, which correlated with its best scores), and Opus-only writers with the reader-first brief.

## Acceptance checklist (brief §26.1, Miami)

Not yet run to completion on the loop-3/4 process (credits). Loop-2 run: no banal QB-injury thread ✔, no "calendar is doing more work" ✔, no Ledger narration ✔, no whomst ✔, "then who" argument present ✔, fact pass ✔, fan ≥ 8.5 ✘ (4.5 on the old judges; the Writer B draft of the same run re-scored 7.3 on the anchored judges).

## What happens next

- Reload Anthropic credits; run `npm run editorial:replay -- --fixture miami-acc --skip-v1 --label loop4` and `--fixture portal-on-fire`; then `--fixture all` for the distribution.
- If the replay set clears 8.5 on the anchored judges with fact pass: set `EDITORIAL_V2_ENABLED=true`, `EDITORIAL_V2_SHOW_ENABLED=true`, `EDITORIAL_V2_SHADOW_MODE=false` on Vercel; V2 drafts land in Studio as `ai-drafted`; review the first eight.
- Otherwise the shadow route (`POST /api/editorial/v2/shadow`) keeps producing blind candidates alongside V1 for human review.
