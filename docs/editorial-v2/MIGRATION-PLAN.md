# Editorial Engine V2 — migration plan

Governing document: `PATE-STATE-EDITORIAL-ENGINE-V2-IMPLEMENTATION-BRIEF.md` (Aug 27, 2026).
This file maps the brief onto the repository as it exists at `main @ 2b51e2a` and records what Phase 0 and Phase 1 add. Nothing in Phase 0/1 changes production output: every V2 path is behind `EDITORIAL_V2_*` flags that default off, and shadow mode never writes an article.

## 1. The brief's concepts → the actual code

| Brief concept | Exists today as | V2 disposition |
|---|---|---|
| Source pack / raw sources (show) | `lib/ingest.ts` steps 3–5: `fetchTranscript` → `transcriptToPromptText`, `extractQuotes`, `teamFactSheet` | **Reused as-is.** V2 takes the same inputs `draftCompanion` takes. |
| Source pack (standalone) | `lib/longform.ts` selection + `sourcePack` assembly (Wire stories, `josh_quotes`, fact sheet, on-record positions) | Reused in Phase 3; frozen into fixtures now. |
| Source pack (Wire) | `lib/wire.ts` `runWireMonitor` → cluster → `fetchSourceText` → `StoryJob.sourceBlock` | Reused in Phase 4; frozen into fixtures now. |
| One-shot writer | `lib/writer.ts` `writeJSON` (chat completions, luna) | **Left untouched for V1.** V2 has its own `lib/editorial-v2/models.ts` on the Responses API with role→model routing and fallbacks. |
| Verifier / fact check | `lib/judge.ts` `judgeJSON` (Sonnet → OpenAI fallback); fact-check prompts inline in `wire.ts`/`longform.ts` | **Reused.** V2's `fact-check.ts` calls `judgeJSON` with a claim-level schema; the "sources are the factual universe" rule is preserved verbatim. |
| Quote fidelity | `lib/generate.ts` `findNonVerbatimQuotes`, `normalizeForCompare` | **Reused** as a hard policy gate. |
| Lane / person / byline / approval | `lib/wire.ts` `hasFirstPersonProse`; ingest writes `workflowState: "ai-drafted"`; `longform.ts` byline routing | **Reused.** V2 never writes to Sanity in shadow mode; when it does (Phase 2+) it writes `ai-drafted` only. |
| Style regexes, restatement, abstract paragraphs, hammer budget, floors | `lib/editorial.ts` `boilerplateViolations`, `restatements`/`circles`, `abstractParagraphs`, `kickerBudget`, `proseWords` | **Reused as diagnostics** (`diagnostics.ts`) supplied to editors and the final EIC. Not fail-closed in V2 (brief §10.2). |
| Tout language, player-dunk, injury/legal, invented Josh positions | Scattered: `overrated` lint, callout vetoes, kit text | **Promoted to explicit hard gates** in `policy-gates.ts` (regex + the fact-check's Josh-attribution question). |
| Gold standard in the writer prompt | `lib/exemplars.ts` `voiceExemplarBlock` inside `editorialSystem()` | **Removed from V2 writer prompts.** Kept for `voiceMatch` (judge). Test asserts the writer context pack never contains it. |
| Voice Bible / kit | `prompts/pate-state-kit/*` loaded whole by `editorialSystem()` | Kit stays the authority for V1. V2 consumes it through `context-pack.ts`: `hardPolicyForLane`, `voiceCardForLane`, `outputContractForProduct`; `judgeReferenceForLane` = the existing exemplar. |
| Fan judge | `lib/editorial.ts` `fanScore` (review tooling only) | **Becomes the production objective** in `final-eval.ts`: fan judge A (Claude) + fan judge B (OpenAI) with the brief's nine questions and five scores; the legacy `fanScore` is kept for continuity in reports. |
| Voice / humanity judge | `voiceMatch` (register vs exemplar); `scoreDraft.humanity` category | `voiceMatch` reused; a dedicated humanity judge added (brief §18.2). |
| Run logging | none (console only) | `telemetry.ts` → Supabase `editorial_runs` (migration 0017) + local JSON under `.superpowers/editorial-runs/`. |
| Voice fragment library | none (exemplar HTML only) | `prompts/editorial-v2/voice-fragments.json`, curated from the two Josh-approved/edited columns; `voice-retrieval.ts` picks 4–8 by rhetorical job + team/topic, excluding any fragment whose source is the fixture's hidden benchmark. |
| Josh edit-diff learning (§23) | none | Deferred to Phase 2 (needs Josh's edits in Studio to flow back). Schema reserved in `types.ts`. |
| Fan context layer (§16) | none | Deferred (brief: after core path works). |

## 2. Reused unchanged

`lib/transcript.ts`, `lib/youtube.ts`, `lib/fact-sheet.ts`, `lib/quotes.ts`, `lib/sanity.ts`, `lib/supabase/admin.ts`, `lib/judge.ts`, `lib/generate.ts` (`extractQuotes`, `classifySeries`, `findNonVerbatimQuotes`, `placePullQuoteMarker`, `validateDraft`, `DRAFT_SCHEMA`, `draftCompanion` as V1), `lib/editorial.ts` (all detectors and both judges), `lib/exemplars.ts`, `lib/wire.ts`, `lib/longform.ts`, `lib/ingest.ts` (plus one flag-guarded shadow hook).

## 3. New

```
lib/editorial-v2/
  flags.ts               EDITORIAL_V2_* env → typed flags (all default off; shadow default on)
  models.ts              role → {vendor, model, effort, fallbacks}; Responses API + Anthropic; usage/cost per call
  types.ts               every stage artifact type from the brief (dossier, angle, blueprint, selection, decision…)
  context-pack.ts        hardPolicyForLane / voiceCardForLane / outputContractForProduct / judgeReferenceForLane
  dossier.ts             stage 1 (existing verifier vendor)
  story-miner.ts         stage 2
  angle-tournament.ts    stages 3A/3B/4 (two blind judges + EIC)
  blueprint.ts           stages 5–6 (builder + editor, verdict routing)
  voice-retrieval.ts     stage 7 (fragment library)
  writers.ts             stage 8 (Writer A argument-first / Writer B reader-first; same facts, blind to each other)
  draft-editor.ts        stage 9
  developmental-rewrite.ts stage 10 (opposite family from the selected author)
  audience-edit.ts       stage 11
  fact-check.ts          stage 12 (claim-level) + surgical fact repair
  policy-gates.ts        stage 13 (hard, fail-closed)
  diagnostics.ts         V1 detectors as signals
  final-eval.ts          stages 14A/B/C
  failure-router.ts      stage 15 (final EIC decision + loop budgets)
  show-column.ts         the orchestrator for the show lane
  telemetry.ts           run records
prompts/editorial-v2/*.md    one prompt per stage (starting points from brief §22)
prompts/editorial-v2/voice-fragments.json
fixtures/editorial-replay/   frozen replay set + baseline scores
scripts/editorial-freeze-fixtures.mts   builds the replay set from live data (run once, commit the output)
scripts/editorial-replay.mts            V1 vs V2 on a fixture, identical judges, blinded report
supabase/migrations/0017_editorial_runs.sql
app/api/editorial/v2/shadow/route.ts    flag-guarded shadow runner (cron-callable later)
```

## 4. Schema changes

- Supabase: `editorial_runs` (id, lane, source_id, fixture, mode, status, started_at, completed_at, final_score, decision, published_content_id, total_cost_usd, total_calls, artifacts jsonb). Service-role only. Stores structured stage outputs and decisions; never model reasoning.
- Sanity: none in Phase 0/1.

## 5. Env

```
EDITORIAL_V2_ENABLED=false
EDITORIAL_V2_SHOW_ENABLED=false
EDITORIAL_V2_STANDALONE_ENABLED=false
EDITORIAL_V2_WIRE_ENABLED=false
EDITORIAL_V2_SHADOW_MODE=true
EDITORIAL_OPENAI_STRONG_MODEL=gpt-5.6-terra
EDITORIAL_OPENAI_FAST_MODEL=gpt-5.6-luna
EDITORIAL_OPENAI_ALT_MODEL=gpt-5.6-sol        # the catalog has no plain gpt-5.6; sol is the third 5.6 tier
EDITORIAL_ANTHROPIC_STRONG_MODEL=claude-opus-5
EDITORIAL_ANTHROPIC_FAST_MODEL=claude-sonnet-5
EDITORIAL_V2_MAX_CYCLES=3
```

## 6. Tests (all under `lib/editorial-v2/*.test.ts`, offline)

Schema validation of every stage artifact · model fallback when a named model is unavailable · shadow mode never publishes · fact-check failure blocks acceptance · failure router returns a valid stage and respects loop budgets · a 690-word finished column is not failed for length · the writer context pack contains no gold-standard prose · Writer A and Writer B receive identical facts and neither sees the other's draft · telemetry strips reasoning fields.

## 7. Rollout

- **Phase 0 (this PR):** V1 untouched; `editorial_runs` logging; frozen replay set with recorded V1 scores.
- **Phase 1 (this PR):** show-column V2 behind `EDITORIAL_V2_SHOW_ENABLED` + `EDITORIAL_V2_SHADOW_MODE`; `npm run editorial:replay -- --fixture miami-acc` produces the blinded V1-vs-V2 report.
- **Phase 2:** acceptance on the replay set + fresh episodes (distribution shift, not one 9); then flip shadow off for the show lane only.
- **Phase 3:** standalone. **Phase 4:** Wire depth classification (item-only / brief / developed) replaces the 600-word floor. **Phase 5:** annuals.

## 8. Rules the brief supersedes vs. rules preserved

Preserved as hard policy: factual boundaries, quote fidelity, no invented Josh positions, current-state precedence, lane/person, byline, human approval, injury/legal register, tout ban, player-respect, AI Predictor naming.
Superseded in the V2 creative path only (V1 unchanged): 600/800 floors, kicker budget as a blocker, style regexes as blockers, full exemplar in the writer prompt, same-writer patch loops, single-model angle selection.
