// Engine A — Josh-originated articles (brief §3–§7). The job is editing
// Josh, not writing as Josh: select a segment → the Josh Cut → support
// facts → light prose edit → hard gates → fact/quote check → quit-reading
// test (delete the paragraph where interest dropped, once) → AI-smell.
import { callJSON, modelForRole, oppositeOf, type ModelChoice } from "./models";
import { v3Prompt, S, N, arr, obj, nullable, ARTICLE_SCHEMA, cleanDraft, words, paragraphs, hardPolicyForLane } from "./v3-context";
import { hardPolicyGates } from "./policy-gates";
import { factCheckSources } from "./fact-check";
import { quitReadingTest, aiSmellTest } from "./judges";
import { newRunId, recordV3Run } from "./telemetry";
import type { ArticleDraft, JoshCut, SegmentDecision, SupportFact, StageCall, V3Run } from "./v3-types";

export interface JoshMaterial {
  ytId: string;
  title: string;
  description: string;
  publishedAt: string;
  transcriptText: string;
  factSheet: string;
  onRecord: string;
  assignment?: string;
  /** Official roster spellings for caption repair (lib/editorial-v3/roster.ts). */
  rosterNames?: string;
}

const SEGMENT_SCHEMA = obj({ decision: { type: "string", enum: ["segment", "no-article"] }, segmentStart: nullable(S), segmentEnd: nullable(S), centralThought: nullable(S), reason: S });
const CUT_SCHEMA = obj({ segmentStart: S, segmentEnd: S, centralThought: S, blocks: arr(obj({ text: S, sourceStart: S, sourceEnd: S })), removedBecauseRepetitive: arr(S), removedBecauseOffTopic: arr(S) });
const SUPPORT_SCHEMA = obj({ supportFacts: arr(obj({ fact: S, sourceRef: S, insertAfterBlock: nullable({ type: "integer" }), whyUseful: S })) });

/** "[02:06]", "02:06", "0:02:06" → seconds. */
export const tsToSec = (t: string) => { const m = t.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/); if (!m) return NaN; return m[3] !== undefined ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : Number(m[1]) * 60 + Number(m[2]); };

/** The transcript lines inside [start, end], for the cut and the checks. */
export function segmentText(transcriptText: string, start: string, end: string): string {
  const a = tsToSec(start), b = tsToSec(end);
  return transcriptText.split("\n").filter((line) => { const m = line.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]/); if (!m) return false; const s = tsToSec(m[1]); return s >= a - 5 && s <= b + 5; }).join("\n");
}

export const MAX_SEGMENT_SECONDS = 12 * 60;

export async function selectSegment(m: JoshMaterial, constraint?: string): Promise<{ decision: SegmentDecision; call: StageCall }> {
  const { data, call } = await callJSON<SegmentDecision>({ stage: "josh-segment", role: "joshSegment", maxTokens: 2000, schemaName: "segment_decision", schema: SEGMENT_SCHEMA as unknown as Record<string, unknown>, system: v3Prompt("josh-segment"), user: `${m.assignment ? `ASSIGNMENT: ${m.assignment}\n\n` : ""}${constraint ? `CONSTRAINT: ${constraint}\n\n` : ""}EPISODE: ${m.title}\nDESCRIPTION: ${m.description.slice(0, 1500)}\n\nTRANSCRIPT (auto-captioned):\n${m.transcriptText}` });
  return { decision: data, call };
}

export function segmentSeconds(d: SegmentDecision): number {
  return d.segmentStart && d.segmentEnd ? tsToSec(d.segmentEnd) - tsToSec(d.segmentStart) : 0;
}

export async function buildJoshCut(m: JoshMaterial, seg: SegmentDecision): Promise<{ cut: JoshCut; call: StageCall }> {
  const text = segmentText(m.transcriptText, seg.segmentStart!, seg.segmentEnd!);
  if (!text.trim()) throw new Error(`segment ${seg.segmentStart}–${seg.segmentEnd} matched no transcript lines`);
  const { data, call } = await callJSON<JoshCut>({ stage: "josh-cut", role: "joshCut", maxTokens: 8000, schemaName: "josh_cut", schema: CUT_SCHEMA as unknown as Record<string, unknown>, system: v3Prompt("josh-cut"), user: `CENTRAL THOUGHT: ${seg.centralThought}\nSEGMENT: ${seg.segmentStart}–${seg.segmentEnd}\n\nVERIFIED NAMES AND FACTS (for caption repair only):\n${m.rosterNames ? `${m.rosterNames}\n\n` : ""}${m.factSheet.slice(0, 4000)}\n\nTRANSCRIPT SEGMENT:\n${text}` });
  return { cut: data, call };
}

export async function supportFacts(cut: JoshCut, m: JoshMaterial): Promise<{ support: SupportFact[]; call: StageCall }> {
  const { data, call } = await callJSON<{ supportFacts: (SupportFact & { insertAfterBlock: number | null })[] }>({ stage: "reporting-support", role: "supportFacts", maxTokens: 3000, schemaName: "support_facts", schema: SUPPORT_SCHEMA as unknown as Record<string, unknown>, system: v3Prompt("reporting-support"), user: `THE JOSH CUT:\n${cut.blocks.map((b, i) => `[${i}] ${b.text}`).join("\n\n")}\n\nVERIFIED TEAM FACTS [sourceRef: fact-sheet]:\n${m.factSheet}\n\n${m.onRecord} [sourceRef: on-record]` });
  return { support: data.supportFacts.slice(0, 6).map((f) => ({ ...f, insertAfterBlock: f.insertAfterBlock ?? undefined })), call };
}

export function cutAsProse(cut: JoshCut, support: SupportFact[] = []): string {
  return cut.blocks.map((b, i) => `${b.text}${support.filter((s) => s.insertAfterBlock === i).map((s) => `\n\n[VERIFIED FACT — integrate if useful: ${s.fact} (${s.sourceRef})]`).join("")}`).join("\n\n");
}

export async function lightProseEdit(cut: JoshCut, support: SupportFact[], m: JoshMaterial, choice?: ModelChoice): Promise<{ draft: ArticleDraft; call: StageCall }> {
  const { data, call } = await callJSON<ArticleDraft>({
    stage: "josh-prose-edit", role: "joshProseEdit", choice, maxTokens: 8000, schemaName: "article", schema: ARTICLE_SCHEMA as unknown as Record<string, unknown>,
    system: `${v3Prompt("josh-prose-edit")}\n\n${hardPolicyForLane("show")}`,
    user: `EPISODE: ${m.title} (${m.publishedAt})\nSEGMENT STARTS AT: ${cut.segmentStart}\nCENTRAL THOUGHT: ${cut.centralThought}\n\nTHE JOSH CUT (his words, in his order; verified facts marked where they may help):\n${cutAsProse(cut, support)}\n\n${m.rosterNames ? `${m.rosterNames}\n\n` : ""}${m.onRecord}`,
  });
  return { draft: cleanDraft(data), call };
}

/** The tightening pass (Isaac, 2026-08-28): spoken texture → written prose,
 * his sentences kept, nothing added. A second edit, not a rewrite. */
export async function tightenPass(draft: ArticleDraft, choice?: ModelChoice): Promise<{ draft: ArticleDraft; call: StageCall }> {
  const { data, call } = await callJSON<ArticleDraft>({ stage: "josh-tighten", role: "joshProseEdit", choice, maxTokens: 8000, schemaName: "article", schema: ARTICLE_SCHEMA as unknown as Record<string, unknown>, system: `${v3Prompt("josh-tighten")}\n\n${hardPolicyForLane("show")}`, user: JSON.stringify(draft, null, 1) });
  return { draft: cleanDraft(data), call };
}

export async function joshSubtraction(draft: ArticleDraft, quitParagraph: number, quitText: string, reason: string): Promise<{ draft: ArticleDraft; call: StageCall }> {
  const { data, call } = await callJSON<ArticleDraft>({ stage: "josh-subtraction", role: "joshSubtraction", maxTokens: 8000, schemaName: "article", schema: ARTICLE_SCHEMA as unknown as Record<string, unknown>, system: v3Prompt("josh-subtraction"), user: `A READER QUIT AT PARAGRAPH ${quitParagraph} (${reason}): "${quitText}"\n\nTHE ARTICLE:\n${JSON.stringify(draft, null, 1)}` });
  return { draft: cleanDraft(data), call };
}

export interface JoshRunOptions { mode: V3Run["mode"]; fixture?: string; editorChoice?: ModelChoice; /** Run the tightening pass after the light edit (default true). */ tighten?: boolean; log?: (l: string) => void }

/** Engine A end to end. Never writes to Sanity. */
export async function runJoshEngine(m: JoshMaterial, opts: JoshRunOptions): Promise<V3Run> {
  const log = opts.log ?? ((l: string) => console.log(`[v3:josh:${m.ytId}] ${l}`));
  const run: V3Run = { id: newRunId(), engine: "josh", sourceId: m.ytId, fixture: opts.fixture, mode: opts.mode, status: "completed", startedAt: new Date().toISOString(), artifacts: { repairs: [] }, calls: [], totalCostUsd: 0 };
  const add = (...cs: StageCall[]) => { for (const c of cs) { run.calls.push(c); run.totalCostUsd = Math.round((run.totalCostUsd + c.costUsd) * 10000) / 10000; } };
  try {
    let seg = await selectSegment(m); add(seg.call); run.artifacts.segment = seg.decision;
    // A segment is one thought, 3–12 minutes. A whole-episode selection is the
    // listicle the brief forbids; ask once more for the single strongest
    // stretch inside it, and give up if that is still too long.
    if (seg.decision.decision === "segment" && segmentSeconds(seg.decision) > MAX_SEGMENT_SECONDS) {
      log(`segment too long (${Math.round(segmentSeconds(seg.decision) / 60)} min); re-selecting inside ${seg.decision.segmentStart}–${seg.decision.segmentEnd}`);
      seg = await selectSegment(m, `The stretch ${seg.decision.segmentStart}–${seg.decision.segmentEnd} is the whole episode, not a segment. Choose the single strongest contiguous 3–10 minute stretch inside it where Josh is on ONE thought with football reasons behind it; every other take is out.`); add(seg.call); run.artifacts.segment = seg.decision;
      if (seg.decision.decision === "segment" && segmentSeconds(seg.decision) > MAX_SEGMENT_SECONDS) seg.decision = { decision: "no-article", reason: `no single segment under 12 minutes (${seg.decision.segmentStart}–${seg.decision.segmentEnd})` };
    }
    log(`segment: ${seg.decision.decision} ${seg.decision.segmentStart ?? ""}–${seg.decision.segmentEnd ?? ""} · ${seg.decision.centralThought ?? seg.decision.reason}`);
    if (seg.decision.decision !== "segment" || !seg.decision.segmentStart || !seg.decision.segmentEnd) { run.status = "no-article"; run.completedAt = new Date().toISOString(); await recordV3Run(run); return run; }
    const cut = await buildJoshCut(m, seg.decision); add(cut.call); run.artifacts.cut = cut.cut;
    if (cut.cut.blocks.length === 0) throw new Error(`empty Josh Cut for segment ${seg.decision.segmentStart}–${seg.decision.segmentEnd}`);
    log(`cut: ${cut.cut.blocks.length} blocks · ${words(cutAsProse(cut.cut))} words · removed ${cut.cut.removedBecauseRepetitive.length} repetitive / ${cut.cut.removedBecauseOffTopic.length} off-topic`);
    const sup = await supportFacts(cut.cut, m); add(sup.call); run.artifacts.support = sup.support;
    log(`support: ${sup.support.length} facts`);
    const ed = await lightProseEdit(cut.cut, sup.support, m, opts.editorChoice); add(ed.call);
    let draft = ed.draft; run.artifacts.draft = draft;
    log(`edit (${ed.call.model}): ${words(draft.bodyMarkdown)} words`);
    if (opts.tighten !== false) {
      const t = await tightenPass(draft, opts.editorChoice); add(t.call);
      log(`tighten (${t.call.model}): ${words(draft.bodyMarkdown)} → ${words(t.draft.bodyMarkdown)} words`);
      draft = t.draft; run.artifacts.tightened = draft;
    }
    // Hard gates + fact/quote check (the cut's segment is the source universe).
    const source = `TRANSCRIPT SEGMENT (auto-captioned; the roster block below carries the official spellings):\n${segmentText(m.transcriptText, cut.cut.segmentStart, cut.cut.segmentEnd)}\n\n${m.rosterNames ?? ""}\n\nVERIFIED TEAM FACTS:\n${m.factSheet}\n\n${m.onRecord}`;
    const gate = () => hardPolicyGates({ draft, lane: "show", transcriptText: `${m.transcriptText}\n${cut.cut.blocks.map((b) => b.text).join("\n")}` });
    run.artifacts.policy = gate();
    const fc = await factCheckSources(draft, source); add(fc.call); run.artifacts.fact = fc.result;
    log(`policy ${run.artifacts.policy.pass ? "pass" : run.artifacts.policy.violations.join("; ")} · fact ${fc.result.verdict}`);
    // Quit-reading test from the opposite family of the editor; one deletion repair.
    const editorVendor = ed.call.vendor;
    const q1 = await quitReadingTest(draft, oppositeOf(editorVendor, "low")); add(q1.call); run.artifacts.quit = q1.result;
    log(`quit test: ${q1.result.neverWantedToQuit ? "never wanted to quit" : `quit at ¶${q1.result.quitParagraphIndex} (${q1.result.reason})`} · finished ${q1.result.didFinish} · football person ${q1.result.soundsLikeFootballPerson} · worth it ${q1.result.worthTheTime} · send ${q1.result.wouldSend}`);
    if (!q1.result.neverWantedToQuit && q1.result.quitParagraphIndex !== undefined) {
      const sub = await joshSubtraction(draft, q1.result.quitParagraphIndex, q1.result.quitText ?? "", q1.result.reason); add(sub.call);
      const p = hardPolicyGates({ draft: sub.draft, lane: "show", transcriptText: `${m.transcriptText}\n${cut.cut.blocks.map((b) => b.text).join("\n")}` }); const fc2 = await factCheckSources(sub.draft, source); add(fc2.call);
      const q2 = await quitReadingTest(sub.draft, oppositeOf(editorVendor, "low")); add(q2.call); run.artifacts.quitAfterRepair = q2.result;
      const better = fc2.result.verdict === "pass" && (q2.result.neverWantedToQuit || (q2.result.didFinish && !q1.result.didFinish) || (q2.result.quitParagraphIndex ?? 0) > (q1.result.quitParagraphIndex ?? 0));
      log(`after deleting ¶${q1.result.quitParagraphIndex}: ${q2.result.neverWantedToQuit ? "never wanted to quit" : `quit at ¶${q2.result.quitParagraphIndex}`} · ${better ? "adopted" : "kept the original"}`);
      run.artifacts.repairs!.push(`${better ? "deleted" : "tried deleting"} ¶${q1.result.quitParagraphIndex} (${q1.result.reason}): "${(q1.result.quitText ?? "").slice(0, 80)}"`);
      if (better) { draft = sub.draft; run.artifacts.subtracted = draft; run.artifacts.fact = fc2.result; run.artifacts.policy = p; }
    }
    const smell = await aiSmellTest(draft, modelForRole("smellJudge")); add(smell.call); run.artifacts.smell = smell.result;
    log(`ai smell: ${smell.result.pass ? "PASS" : `${smell.result.sentences.length} sentence(s)${smell.result.structural ? ", structural" : ""}`}`);
    run.final = draft; run.words = words(draft.bodyMarkdown); run.completedAt = new Date().toISOString();
    await recordV3Run(run);
    return run;
  } catch (err) {
    run.status = "failed"; run.error = err instanceof Error ? err.message.slice(0, 500) : String(err); run.completedAt = new Date().toISOString();
    await recordV3Run(run);
    return run;
  }
}

/** Test A variants (brief §21): A = cut only, B = cut + facts (as prose, no edit). */
export function cutOnlyArticle(cut: JoshCut, support: SupportFact[] = []): ArticleDraft {
  const body = cut.blocks.map((b, i) => `${b.text}${support.filter((s) => s.insertAfterBlock === i).map((s) => ` ${s.fact}.`).join("")}`).join("\n\n");
  return { headline: cut.centralThought, dek: "", bodyMarkdown: `${body}\n\n— JP`, pullQuote: "", primaryTeam: "", teams: [], tags: [], seo: { title: "", description: "" } };
}

export { paragraphs, N };
