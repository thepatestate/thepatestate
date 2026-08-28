// Josh's Read, additive (Isaac, 2026-08-28: the show-cut columns "don't
// reward a reader at all if they already listened to the show"). The
// segment and the Josh Cut are the PREMISE; the column is what the show did
// not have — verified facts, the alternative's case, the consequence, the
// dated test — in the Voice Bible's blend (50% national journalist / 30%
// Josh / 20% football analyst), with his on-camera register turned down.
//
//   segment → Josh Cut → additions (verifier) → column (Opus) → tightening
//   → gates → fact check → quit test → smell → additive judge + overlap
import { callJSON, modelForRole, oppositeOf } from "./models";
import { v3Prompt, S, arr, obj, ARTICLE_SCHEMA, cleanDraft, words, hardPolicyForLane } from "./v3-context";
import { selectSegment, buildJoshCut, segmentText, segmentSeconds, MAX_SEGMENT_SECONDS, tightenPass, type JoshMaterial, type JoshRunOptions } from "./josh-engine";
import { hardPolicyGates } from "./policy-gates";
import { factCheckSources, factRepair } from "./fact-check";
import { quitReadingTest, aiSmellTest } from "./judges";
import { liftReport } from "./lift-check";
import { newRunId, recordV3Run } from "./telemetry";
import type { ArticleDraft, JoshCut, StageCall, V3Run } from "./v3-types";

export interface Addition { addition: string; kind: string; sourceRef: string; changesWhat: string; newVsShow: boolean }
const ADDITIONS_SCHEMA = obj({ additions: arr(obj({ addition: S, kind: { type: "string", enum: ["fact", "alternative-case", "consequence", "dated-test", "on-record"] }, sourceRef: S, changesWhat: S, newVsShow: { type: "boolean" } })) });
const ADDITIVE_SCHEMA = obj({ additions: arr(S), worthItForListener: { type: "boolean" }, replayPassage: S, note: S });

const cutProse = (cut: JoshCut) => cut.blocks.map((b) => b.text).join("\n\n");

export async function findAdditions(cut: JoshCut, m: JoshMaterial): Promise<{ additions: Addition[]; call: StageCall }> {
  const { data, call } = await callJSON<{ additions: Addition[] }>({ stage: "josh-additions", role: "supportFacts", choice: { ...modelForRole("supportFacts"), effort: "medium" }, maxTokens: 4000, schemaName: "additions", schema: ADDITIONS_SCHEMA as unknown as Record<string, unknown>, system: v3Prompt("josh-additions"), user: `THE JOSH CUT (what listeners already heard):\n${cutProse(cut)}\n\nVERIFIED TEAM FACTS [sourceRef: fact-sheet]:\n${m.factSheet}\n\n${m.rosterNames ?? ""}\n\n${m.onRecord} [sourceRef: on-record]` });
  return { additions: data.additions.filter((a) => a.newVsShow).slice(0, 6), call };
}

export async function writeAdditiveColumn(cut: JoshCut, additions: Addition[], m: JoshMaterial): Promise<{ draft: ArticleDraft; call: StageCall }> {
  const { data, call } = await callJSON<ArticleDraft>({
    stage: "josh-column-additive", role: "joshProseEdit", maxTokens: 8000, schemaName: "article", schema: ARTICLE_SCHEMA as unknown as Record<string, unknown>,
    system: `${v3Prompt("josh-column-additive")}\n\n${hardPolicyForLane("show")}`,
    user: `EPISODE: ${m.title} (${m.publishedAt})\nSEGMENT STARTS AT: ${cut.segmentStart}\nHIS TAKE, IN ONE LINE: ${cut.centralThought}\n\nTHE JOSH CUT (the premise; listeners heard this — quote at most one line of it):\n${cutProse(cut)}\n\nTHE ADDITIONS (what the show did not have; the column is built from these):\n${additions.map((a, i) => `${i + 1}. [${a.kind}] ${a.addition} (${a.sourceRef}) — ${a.changesWhat}`).join("\n")}\n\nVERIFIED TEAM FACTS [sourceRef: fact-sheet]:\n${m.factSheet}\n\n${m.rosterNames ?? ""}\n\n${m.onRecord}`,
  });
  return { draft: cleanDraft(data), call };
}

export async function additiveJudge(cut: JoshCut, draft: ArticleDraft): Promise<{ result: { additions: string[]; worthItForListener: boolean; replayPassage: string; note: string }; call: StageCall }> {
  const { data, call } = await callJSON<{ additions: string[]; worthItForListener: boolean; replayPassage: string; note: string }>({ stage: "additive-judge", role: "quitJudge", choice: oppositeOf("anthropic", "low"), maxTokens: 2000, schemaName: "additive_judgement", schema: ADDITIVE_SCHEMA as unknown as Record<string, unknown>, system: v3Prompt("additive-judge"), user: `THE JOSH CUT (what the show said):\n${cutProse(cut)}\n\nTHE COLUMN:\nHEADLINE: ${draft.headline}\nDEK: ${draft.dek}\n\n${draft.bodyMarkdown}` });
  return { result: data, call };
}

export async function runJoshAdditive(m: JoshMaterial, opts: JoshRunOptions): Promise<V3Run> {
  const log = opts.log ?? ((l: string) => console.log(`[v3:josh+:${m.ytId}] ${l}`));
  const run: V3Run = { id: newRunId(), engine: "josh", sourceId: m.ytId, fixture: opts.fixture, mode: opts.mode, status: "completed", startedAt: new Date().toISOString(), artifacts: { repairs: [] }, calls: [], totalCostUsd: 0 };
  const add = (...cs: StageCall[]) => { for (const c of cs) { run.calls.push(c); run.totalCostUsd = Math.round((run.totalCostUsd + c.costUsd) * 10000) / 10000; } };
  try {
    let seg = await selectSegment(m); add(seg.call); run.artifacts.segment = seg.decision;
    if (seg.decision.decision === "segment" && segmentSeconds(seg.decision) > MAX_SEGMENT_SECONDS) {
      seg = await selectSegment(m, `The stretch ${seg.decision.segmentStart}–${seg.decision.segmentEnd} is the whole episode. Choose the single strongest contiguous 3–10 minute stretch inside it where Josh is on ONE thought with football reasons behind it.`); add(seg.call); run.artifacts.segment = seg.decision;
      if (seg.decision.decision === "segment" && segmentSeconds(seg.decision) > MAX_SEGMENT_SECONDS) seg.decision = { decision: "no-article", reason: "no single segment under 12 minutes" };
    }
    log(`segment: ${seg.decision.decision} ${seg.decision.segmentStart ?? ""}–${seg.decision.segmentEnd ?? ""} · ${seg.decision.centralThought ?? seg.decision.reason}`);
    if (seg.decision.decision !== "segment" || !seg.decision.segmentStart || !seg.decision.segmentEnd) { run.status = "no-article"; run.completedAt = new Date().toISOString(); await recordV3Run(run); return run; }
    const cut = await buildJoshCut(m, seg.decision); add(cut.call); run.artifacts.cut = cut.cut;
    if (cut.cut.blocks.length === 0) throw new Error("empty Josh Cut");
    const ad = await findAdditions(cut.cut, m); add(ad.call); run.artifacts.additions = ad.additions;
    log(`cut: ${cut.cut.blocks.length} blocks · additions: ${ad.additions.length} (${ad.additions.map((a) => a.kind).join(", ")})`);
    if (ad.additions.length < 2) { run.status = "no-article"; run.artifacts.segment = { ...seg.decision, decision: "no-article", reason: `only ${ad.additions.length} verified addition(s) beyond the show; a column would replay the episode` }; run.completedAt = new Date().toISOString(); await recordV3Run(run); return run; }
    const col = await writeAdditiveColumn(cut.cut, ad.additions, m); add(col.call); run.artifacts.draft = col.draft;
    log(`column (${col.call.model}): ${words(col.draft.bodyMarkdown)} words`);
    const t = await tightenPass(col.draft); add(t.call);
    let draft = t.draft; run.artifacts.tightened = draft;
    log(`tighten: ${words(col.draft.bodyMarkdown)} → ${words(draft.bodyMarkdown)} words`);
    const source = `TRANSCRIPT SEGMENT (auto-captioned; the roster block carries official spellings):\n${segmentText(m.transcriptText, cut.cut.segmentStart, cut.cut.segmentEnd)}\n\n${m.rosterNames ?? ""}\n\nVERIFIED TEAM FACTS:\n${m.factSheet}\n\n${m.onRecord}`;
    const verbatimUniverse = `${m.transcriptText}\n${cutProse(cut.cut)}`;
    run.artifacts.policy = hardPolicyGates({ draft, lane: "show", transcriptText: verbatimUniverse });
    const fc = await factCheckSources(draft, source); add(fc.call); run.artifacts.fact = fc.result;
    log(`policy ${run.artifacts.policy.pass ? "pass" : run.artifacts.policy.violations.join("; ")} · fact ${fc.result.verdict}`);
    const q = await quitReadingTest(draft, oppositeOf("anthropic", "low")); add(q.call); run.artifacts.quit = q.result;
    log(`quit test: ${q.result.neverWantedToQuit ? "never wanted to quit" : `quit at ¶${q.result.quitParagraphIndex} (${q.result.reason})`} · finished ${q.result.didFinish} · worth it ${q.result.worthTheTime} · send ${q.result.wouldSend}`);
    let smell = await aiSmellTest(draft, modelForRole("smellJudge")); add(smell.call); run.artifacts.smell = smell.result;
    // One local repair (brief §16): named sentences cut or rewritten in place,
    // policy hits removed, unsupported claims dropped. Structural smell is
    // not repaired here; it is reported.
    const notes: string[] = [];
    if (!run.artifacts.policy.pass) notes.push(...run.artifacts.policy.violations.map((v) => `policy: ${v}`));
    if (!smell.result.pass) notes.push(...smell.result.sentences.map((s) => `reads machine-written; cut it or say it plainly: "${s}"`));
    if (fc.result.verdict !== "pass") {
      const rp = await factRepair(draft, fc.result, { subject: cut.cut.centralThought, teams: [], coreDevelopment: "", confirmedFacts: ad.additions.map((a) => ({ fact: a.addition, sourceRef: a.sourceRef, confidence: "confirmed" as const })), uncertainOrMissing: [], numbers: [], quotes: [], joshOnRecord: cut.cut.blocks.map((b) => ({ text: b.text, timestamp: b.sourceStart, topic: cut.cut.centralThought })), footballMechanisms: [], tensions: [], contradictions: [], fanObjections: [], secondOrderConsequences: [], observableTests: [], thingsActuallyInteresting: [], sourceSufficiency: { score: 0, canSupportBrief: true, canSupportReaction: true, canSupportPremiumColumn: true, reason: "" } }); add(rp.call);
      draft = rp.draft; run.artifacts.repairs!.push(...rp.removed.map((r) => `fact repair: ${r}`));
    }
    if (notes.length) {
      const fix = await tightenPass(draft, undefined, notes); add(fix.call); draft = fix.draft; run.artifacts.repairs!.push(...notes.map((n) => `local repair: ${n.slice(0, 100)}`));
    }
    if (notes.length || fc.result.verdict !== "pass") {
      run.artifacts.policy = hardPolicyGates({ draft, lane: "show", transcriptText: verbatimUniverse });
      const fc2 = await factCheckSources(draft, source); add(fc2.call); run.artifacts.fact = fc2.result;
      smell = await aiSmellTest(draft, modelForRole("smellJudge")); add(smell.call); run.artifacts.smell = smell.result;
      const q2 = await quitReadingTest(draft, oppositeOf("anthropic", "low")); add(q2.call); run.artifacts.quitAfterRepair = q2.result; run.artifacts.quit = q2.result;
      log(`after repair: policy ${run.artifacts.policy.pass ? "pass" : run.artifacts.policy.violations.join("; ")} · fact ${fc2.result.verdict} · smell ${smell.result.pass ? "PASS" : smell.result.sentences.length} · quit ${q2.result.neverWantedToQuit ? "never" : `¶${q2.result.quitParagraphIndex} ${q2.result.reason}`}`);
    }
    run.artifacts.tightened = draft;
    const aj = await additiveJudge(cut.cut, draft); add(aj.call);
    const overlap = liftReport(draft.bodyMarkdown, [cutProse(cut.cut)], 7);
    run.artifacts.additive = { ...aj.result, overlapPct: overlap.pct };
    log(`additive: ${aj.result.additions.length} new things for a listener · worth it ${aj.result.worthItForListener} · ${overlap.pct}% of words shared with the tape · smell ${smell.result.pass ? "PASS" : smell.result.sentences.length}`);
    run.final = draft; run.words = words(draft.bodyMarkdown); run.completedAt = new Date().toISOString();
    await recordV3Run(run);
    return run;
  } catch (err) {
    run.status = "failed"; run.error = err instanceof Error ? err.message.slice(0, 500) : String(err); run.completedAt = new Date().toISOString();
    await recordV3Run(run);
    return run;
  }
}
