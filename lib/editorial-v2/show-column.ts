// The V2 editorial room for a show-derived column (brief §20.1): the
// orchestrator that runs the stages in order, routes failures backward to
// the stage that made the bad decision, and never publishes. Returns the
// full run record; the caller decides what to do with the final draft.
import { editorialV2Flags } from "./flags";
import { buildDossier, showMaterialBlock, type ShowMaterial } from "./dossier";
import { mineStories } from "./story-miner";
import { judgeAngles, selectAngle, consensus } from "./angle-tournament";
import { buildBlueprint, reviewBlueprint } from "./blueprint";
import { retrieveFragments } from "./voice-retrieval";
import { writeDrafts, type ContextPack } from "./writers";
import { editDrafts } from "./draft-editor";
import { developmentalRewrite } from "./developmental-rewrite";
import { audienceEdit } from "./audience-edit";
import { factCheck, factRepair } from "./fact-check";
import { hardPolicyGates } from "./policy-gates";
import { styleDiagnostics } from "./diagnostics";
import { finalEvaluation, fanMean } from "./final-eval";
import { finalDecision, DEFAULT_BUDGET, type LoopBudget, type Spent } from "./failure-router";
import { newRunId, recordRun } from "./telemetry";
import type { ArticleDraft, EditorialDecision, EditorialRun, StageCall, StoryAngle } from "./types";

export interface ShowColumnInput {
  sourceId: string;
  material: ShowMaterial;
  mode: "shadow" | "replay" | "live";
  fixture?: string;
  /** Optional editorial assignment: the segment or claim the column is about (the replay's acceptance case; a human commissioning note in production). */
  assignment?: string;
  /** Fragment sources to hide (a replay's benchmark). */
  excludeFragmentSources?: string[];
  budget?: Partial<LoopBudget>;
  /** Production: verified facts for teams the dossier names that the material's fact sheet does not cover (replays are frozen and pass nothing). */
  factSheetProvider?: (slugs: string[]) => Promise<string>;
  log?: (line: string) => void;
}

const REMINE_GUIDANCE = "The previous round's angles were rejected as obvious, unsupported, or duplicates of one another. Look for the second-order consequence, the distinction a fan has not drawn, or a narrower claim the dossier can actually prove.";

export async function runShowColumnV2(input: ShowColumnInput): Promise<EditorialRun> {
  const flags = editorialV2Flags();
  const budget: LoopBudget = { ...DEFAULT_BUDGET, total: flags.maxCycles, ...input.budget };
  const log = input.log ?? ((l: string) => console.log(`[v2:${input.sourceId}] ${l}`));
  const run: EditorialRun = { id: newRunId(), lane: "show", product: "josh-column", sourceId: input.sourceId, fixture: input.fixture, mode: input.mode, status: "running", startedAt: new Date().toISOString(), cycles: 0, artifacts: { history: [] }, calls: [], totalCostUsd: 0 };
  const add = (...calls: (StageCall | null)[]) => { for (const c of calls) if (c) { run.calls.push(c); run.totalCostUsd = Math.round((run.totalCostUsd + c.costUsd) * 10000) / 10000; } };
  const spent: Spent = { remine: 0, blueprint: 0, rewrite: 0, factRepair: 0, cycles: 0 };
  if (input.assignment) input.material.assignment = input.assignment;
  let raw = showMaterialBlock(input.material);
  const finish = async (decision: EditorialDecision, final?: ArticleDraft) => {
    run.decision = decision; run.final = final; run.status = "completed"; run.completedAt = new Date().toISOString(); run.cycles = spent.cycles;
    if (run.artifacts.evaluation) run.finalScore = fanMean(run.artifacts.evaluation);
    await recordRun(run);
    return run;
  };

  try {
    // 1. dossier
    const d = await buildDossier(input.material); add(d.call); run.artifacts.dossier = d.dossier;
    log(`dossier: sufficiency ${d.dossier.sourceSufficiency.score}/10 · premium ${d.dossier.sourceSufficiency.canSupportPremiumColumn} · ${d.dossier.confirmedFacts.length} facts · ${d.dossier.joshOnRecord.length} Josh positions`);
    // Fact-sheet top-up: the dossier names the teams the argument is about; if
    // the material's sheet does not cover them, fetch them and re-report once.
    if (input.factSheetProvider) {
      const missing = d.dossier.teams.filter((t) => !new RegExp(`^${t.replace(/-/g, "[ -]")}\\b`, "im").test(input.material.factSheet));
      if (missing.length) {
        const extra = await input.factSheetProvider(missing.slice(0, 8)).catch(() => "");
        if (extra) {
          input.material.factSheet = `${input.material.factSheet}\n\n${extra}`; raw = showMaterialBlock(input.material);
          const d2 = await buildDossier(input.material); add(d2.call); d.dossier = d2.dossier; run.artifacts.dossier = d2.dossier;
          log(`fact sheet topped up for ${missing.join(", ")} · dossier re-reported: sufficiency ${d2.dossier.sourceSufficiency.score}/10`);
        }
      }
    }
    if (!d.dossier.sourceSufficiency.canSupportPremiumColumn && d.dossier.sourceSufficiency.score < 4) {
      return finish({ decision: "kill", failureClass: "evidence", reason: `source cannot support a premium column: ${d.dossier.sourceSufficiency.reason}`, routeTo: "human", instructions: [] });
    }

    // 2–4. mine → tournament → select (with remine budget)
    let angle: StoryAngle | undefined;
    let guidance: string | undefined;
    for (;;) {
      const m = await mineStories(d.dossier, { lane: "show", recentHeadlines: input.material.recentHeadlines, guidance, assignment: input.assignment }); add(m.call); run.artifacts.miner = m.result;
      log(`miner: ${m.result.angles.length} angles · shape ${m.result.sourceShape} · premium ${m.result.premiumWarranted}`);
      const j = await judgeAngles(d.dossier, m.result.angles, { lane: "show", recentHeadlines: input.material.recentHeadlines }); add(...j.calls); run.artifacts.angleJudgements = j.judgements;
      const s = await selectAngle(d.dossier, m.result.angles, j.judgements, { lane: "show", minerNote: m.result.note, premiumWarranted: m.result.premiumWarranted, assignment: input.assignment }); add(s.call); run.artifacts.angleDecision = s.decision;
      log(`eic: ${s.decision.decision}${s.decision.selectedAngleId ? ` ${s.decision.selectedAngleId}` : ""} · consensus ${JSON.stringify(consensus(j.judgements))} · ${s.decision.reason.slice(0, 140)}`);
      if (s.decision.decision === "select") { angle = m.result.angles.find((a) => a.id === s.decision.selectedAngleId) ?? m.result.angles[0]; break; }
      if (s.decision.decision === "kill") return finish({ decision: "kill", failureClass: "angle", reason: s.decision.reason, routeTo: "human", instructions: [] });
      if (spent.remine >= budget.remine) return finish({ decision: "hold", failureClass: "angle", reason: `no angle selected after ${spent.remine + 1} mining rounds: ${s.decision.reason}`, routeTo: "human", instructions: [] });
      spent.remine++; guidance = `${REMINE_GUIDANCE}\n${s.decision.reason}`;
    }
    const decision = run.artifacts.angleDecision!;

    // 5–6. blueprint → editor (with blueprint budget; may route back)
    let blueprint = (await (async () => { const b = await buildBlueprint(d.dossier, angle!, decision, { product: "josh-column", factSheet: input.material.factSheet }); add(b.call); return b.blueprint; })());
    for (;;) {
      const r = await reviewBlueprint(d.dossier, blueprint, angle!, input.material.factSheet); add(r.call); run.artifacts.blueprintReview = r.review;
      log(`blueprint editor: ${r.review.verdict} · ${r.review.problems.slice(0, 3).join(" | ").slice(0, 200)}`);
      if (r.review.verdict === "pass") break;
      if (r.review.verdict === "kill") return finish({ decision: "kill", failureClass: "structure", reason: r.review.reason, routeTo: "human", instructions: r.review.problems });
      if (r.review.verdict === "revise-blueprint" && r.review.revisedBlueprint && spent.blueprint < budget.blueprint) { spent.blueprint++; blueprint = r.review.revisedBlueprint; continue; }
      if (spent.blueprint >= budget.blueprint) { log("blueprint budget spent; proceeding with the last revision"); break; }
      spent.blueprint++;
      const b = await buildBlueprint(d.dossier, angle!, decision, { product: "josh-column", factSheet: input.material.factSheet, guidance: `${r.review.verdict}: ${r.review.reason}\nProblems: ${r.review.problems.join("; ")}\nCut: ${r.review.cutBeats.join("; ")}` }); add(b.call); blueprint = b.blueprint;
    }
    run.artifacts.blueprint = blueprint;

    // 7. voice retrieval
    const fragments = retrieveFragments(blueprint, { teams: d.dossier.teams, topics: input.material.quotes.map((q) => q.topic), excludeSourceIds: input.excludeFragmentSources, min: 6 });
    run.artifacts.voiceFragmentIds = fragments.map((f) => f.id);
    const pack: ContextPack = { lane: "show", product: "josh-column", dossier: d.dossier, angle: angle!, decision, blueprint, fragments, factSheet: input.material.factSheet, quoteCandidates: input.material.quotes.map((q) => ({ quote: q.quote, timestamp: q.timestamp })) };

    // 8–9. two writers → editor
    const w = await writeDrafts(pack); add(...w.calls); run.artifacts.drafts = w.drafts; run.artifacts.writerPrompts = w.prompts;
    if (w.drafts.length === 0) return finish({ decision: "hold", failureClass: "prose", reason: "both writers failed", routeTo: "human", instructions: [] });
    log(`writers: ${w.drafts.map((x) => `${x.writer}=${x.model} (${x.draft.bodyMarkdown.split(/\s+/).length}w)`).join(", ")}`);
    let sel = await editDrafts(w.drafts, blueprint, decision.finalThesis ?? angle!.thesis); add(sel.call); run.artifacts.selection = sel.selection;
    log(`draft editor: ${sel.selection.winner} → ${sel.selection.route} · ${sel.selection.developmentalPlan.slice(0, 2).join(" | ").slice(0, 200)}`);
    if (sel.selection.route !== "developmental-rewrite" && spent.blueprint < budget.blueprint) {
      // Both drafts failed for the same structural/idea reason: the editor
      // says the blueprint (or angle) was wrong. One rebuild, then proceed.
      spent.blueprint++;
      const b = await buildBlueprint(d.dossier, angle!, decision, { product: "josh-column", factSheet: input.material.factSheet, guidance: `The draft editor sent both drafts back (${sel.selection.route}): ${sel.selection.structuralProblems.join("; ")}` }); add(b.call); blueprint = b.blueprint; run.artifacts.blueprint = blueprint; pack.blueprint = blueprint;
      const w2 = await writeDrafts(pack); add(...w2.calls); if (w2.drafts.length) { run.artifacts.drafts = w2.drafts; run.artifacts.writerPrompts = w2.prompts; }
      sel = await editDrafts(run.artifacts.drafts!, blueprint, decision.finalThesis ?? angle!.thesis); add(sel.call); run.artifacts.selection = sel.selection;
    }

    // 10–15. rewrite → audience edit → fact → policy → judges → EIC, with routing
    let instructions: string[] = [];
    let draft: ArticleDraft | undefined;
    for (;;) {
      spent.cycles++;
      const rw = await developmentalRewrite(pack, run.artifacts.drafts!, sel.selection, { instructions, previous: draft }); add(rw.call); run.artifacts.rewrite = rw.draft; spent.rewrite++;
      const ae = await audienceEdit(rw.draft, { lane: "show", product: "josh-column", fragments, diagnostics: styleDiagnostics(rw.draft.bodyMarkdown) }); add(ae.call); run.artifacts.audienceEdit = ae.edit;
      draft = ae.edit.draft;
      log(`cycle ${spent.cycles}: rewrite ${rw.call.model} (${draft.bodyMarkdown.split(/\s+/).length}w) · audience edit ${ae.edit.verdict}`);
      let fc = await factCheck(draft, d.dossier, raw); add(fc.call); run.artifacts.factCheck = fc.result;
      if (fc.result.verdict !== "pass" && spent.factRepair < budget.factRepair) {
        spent.factRepair++;
        const rp = await factRepair(draft, fc.result, d.dossier); add(rp.call); run.artifacts.factRepair = { removed: rp.removed, draft: rp.draft }; draft = rp.draft;
        fc = await factCheck(draft, d.dossier, raw); add(fc.call); run.artifacts.factCheck = fc.result;
        log(`fact repair: removed ${rp.removed.length} → ${fc.result.verdict}`);
      }
      const policy = hardPolicyGates({ draft, lane: "show", transcriptText: input.material.transcriptText }); run.artifacts.policy = policy;
      const diagnostics = styleDiagnostics(draft.bodyMarkdown); run.artifacts.diagnostics = diagnostics;
      const ev = await finalEvaluation(draft, { lane: "show", product: "josh-column", includeLegacy: true }); add(...ev.calls); run.artifacts.evaluation = ev.evaluation;
      log(`judges: fan ${ev.evaluation.fanA.overall}/${ev.evaluation.fanB.overall} · humanity ${ev.evaluation.humanity.humanity} · voice ${ev.evaluation.voice.score} · fact ${fc.result.verdict} · policy ${policy.pass ? "pass" : policy.violations.join("; ")}`);
      const fd = await finalDecision({ draft, lane: "show", product: "josh-column", evaluation: ev.evaluation, fact: fc.result, policy, diagnostics, spent, budget }); add(fd.call);
      run.artifacts.history!.push({ cycle: spent.cycles, decision: fd.decision });
      log(`eic: ${fd.decision.decision} (${fd.decision.failureClass} → ${fd.decision.routeTo}) ${fd.decision.reason.slice(0, 160)}`);
      if (fd.decision.decision !== "revise") return finish(fd.decision, draft);
      instructions = fd.decision.instructions;
      if (fd.decision.routeTo === "fact-repair") {
        if (spent.factRepair >= budget.factRepair) return finish({ ...fd.decision, decision: "hold", routeTo: "human" }, draft);
        spent.factRepair++;
        const rp = await factRepair(draft, fc.result, d.dossier); add(rp.call); draft = rp.draft; run.artifacts.factRepair = { removed: rp.removed, draft: rp.draft };
        continue;
      }
      if (fd.decision.routeTo === "blueprint" || fd.decision.routeTo === "story-miner" || fd.decision.routeTo === "reporting") {
        if (spent.blueprint >= budget.blueprint) return finish({ ...fd.decision, decision: "hold", routeTo: "human" }, draft);
        spent.blueprint++;
        const b = await buildBlueprint(d.dossier, angle!, decision, { product: "josh-column", factSheet: input.material.factSheet, guidance: `Final editor routed the piece back (${fd.decision.failureClass}): ${fd.decision.reason}\n${instructions.join("\n")}` }); add(b.call); blueprint = b.blueprint; run.artifacts.blueprint = blueprint; pack.blueprint = blueprint;
        const w2 = await writeDrafts(pack); add(...w2.calls); if (w2.drafts.length) { run.artifacts.drafts = w2.drafts; run.artifacts.writerPrompts = w2.prompts; }
        sel = await editDrafts(run.artifacts.drafts!, blueprint, decision.finalThesis ?? angle!.thesis); add(sel.call); run.artifacts.selection = sel.selection;
      }
      // developmental-rewrite / voice-edit: loop with the EIC's instructions
    }
  } catch (err) {
    run.status = "failed"; run.error = err instanceof Error ? err.message.slice(0, 500) : String(err); run.completedAt = new Date().toISOString(); run.cycles = spent.cycles;
    await recordRun(run);
    return run;
  }
}
