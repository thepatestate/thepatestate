// Engine B — reported Pate State articles (brief §8–§16): reporting pack →
// fan brief (depth is a decision) → one writer → subtraction editor → hard
// gates → fact check → quit-reading test (delete the quit paragraph, once)
// → AI-smell. Third person, desk voice, no Josh imitation. Never publishes.
import { callJSON, modelForRole, oppositeOf } from "./models";
import { v3Prompt, S, arr, obj, nullable, ARTICLE_SCHEMA, OUTPUT_CONTRACT, cleanDraft, words, hardPolicyForLane } from "./v3-context";
import { hardPolicyGates } from "./policy-gates";
import { factCheckSources } from "./fact-check";
import { quitReadingTest, aiSmellTest } from "./judges";
import { newRunId, recordV3Run } from "./telemetry";
import { DEPTH_WORDS, type ArticleDraft, type FanBrief, type ReportingPack, type StageCall, type V3Run } from "./v3-types";

export interface ReportedMaterial {
  sourceId: string;
  sources: { key: string; title: string; outlets: string[]; urls: string[]; text: string }[];
  factSheet: string;
  onRecord?: string;
}

const PACK_SCHEMA = obj({
  development: S,
  facts: arr(obj({ fact: S, sourceRef: S, status: { type: "string", enum: ["confirmed", "reported"] } })),
  quotes: arr(obj({ speaker: S, text: S, sourceRef: S })),
  numbers: arr(obj({ value: S, meaning: S, sourceRef: S })),
  unknowns: arr(S),
  relevantTeamContext: arr(S),
});
const BRIEF_SCHEMA = obj({ theNews: S, whyAFanCares: S, interestingDetail: nullable(S), footballAngle: nullable(S), importantUnknown: nullable(S), depth: { type: "string", enum: ["item", "brief", "story", "analysis"] }, depthReason: S });
const SUBTRACT_SCHEMA = obj({ cuts: arr(S), draft: ARTICLE_SCHEMA });

export function sourcesBlock(m: ReportedMaterial): string {
  return `${m.sources.map((s, i) => `SOURCE ${i + 1} [sourceRef: source-${i + 1}] — ${s.title} (${s.outlets.join(", ")})\n${s.text}`).join("\n\n")}\n\nVERIFIED TEAM FACTS [sourceRef: fact-sheet]:\n${m.factSheet || "none"}${m.onRecord ? `\n\n${m.onRecord} [sourceRef: on-record]` : ""}`;
}

export async function extractPack(m: ReportedMaterial): Promise<{ pack: ReportingPack; call: StageCall }> {
  const { data, call } = await callJSON<ReportingPack>({ stage: "reporting-pack", role: "packExtract", maxTokens: 5000, schemaName: "reporting_pack", schema: PACK_SCHEMA as unknown as Record<string, unknown>, system: v3Prompt("reporting-pack"), user: sourcesBlock(m) });
  return { pack: data, call };
}

export async function fanBrief(pack: ReportingPack): Promise<{ brief: FanBrief; call: StageCall }> {
  const { data, call } = await callJSON<FanBrief & { interestingDetail: string | null; footballAngle: string | null; importantUnknown: string | null }>({ stage: "fan-brief", role: "fanBrief", maxTokens: 2000, schemaName: "fan_brief", schema: BRIEF_SCHEMA as unknown as Record<string, unknown>, system: v3Prompt("fan-brief"), user: `REPORTING PACK:\n${JSON.stringify(pack, null, 1)}` });
  return { brief: { ...data, interestingDetail: data.interestingDetail ?? undefined, footballAngle: data.footballAngle ?? undefined, importantUnknown: data.importantUnknown ?? undefined }, call };
}

function briefBlock(b: FanBrief): string {
  const w = DEPTH_WORDS[b.depth];
  return `FAN BRIEF:\nTHE NEWS: ${b.theNews}\nWHY A FAN CARES: ${b.whyAFanCares}${b.interestingDetail ? `\nTHE INTERESTING DETAIL: ${b.interestingDetail}` : ""}${b.footballAngle ? `\nTHE FOOTBALL ANGLE: ${b.footballAngle}` : ""}${b.importantUnknown ? `\nWHAT WE DON'T KNOW: ${b.importantUnknown}` : ""}\n\nDEPTH: ${b.depth.toUpperCase()} (${w.min}–${w.max} words; stop when the useful story ends) — ${b.depthReason}`;
}

export async function writeReported(pack: ReportingPack, brief: FanBrief): Promise<{ draft: ArticleDraft; call: StageCall }> {
  const { data, call } = await callJSON<ArticleDraft>({
    stage: "reported-writer", role: "reportedWriter", maxTokens: 6000, schemaName: "article", schema: ARTICLE_SCHEMA as unknown as Record<string, unknown>,
    system: `${v3Prompt("reported-writer")}\n\n${v3Prompt("desk-voice")}\n\n${hardPolicyForLane("standalone")}`,
    user: `${briefBlock(brief)}\n\nREPORTING PACK (the factual universe):\n${JSON.stringify(pack, null, 1)}\n\n${OUTPUT_CONTRACT}`,
  });
  return { draft: cleanDraft(data), call };
}

export async function subtractionEdit(draft: ArticleDraft, pack: ReportingPack, brief: FanBrief): Promise<{ draft: ArticleDraft; cuts: string[]; call: StageCall }> {
  const { data, call } = await callJSON<{ cuts: string[]; draft: ArticleDraft }>({ stage: "subtraction-editor", role: "subtractionEditor", maxTokens: 6000, schemaName: "subtraction", schema: SUBTRACT_SCHEMA as unknown as Record<string, unknown>, system: `${v3Prompt("subtraction-editor")}\n\n${v3Prompt("desk-voice")}`, user: `${briefBlock(brief)}\n\nREPORTING PACK:\n${JSON.stringify(pack, null, 1)}\n\nDRAFT:\n${JSON.stringify(draft, null, 1)}` });
  return { draft: cleanDraft(data.draft), cuts: data.cuts, call };
}

export interface ReportedRunOptions { mode: V3Run["mode"]; fixture?: string; log?: (l: string) => void }

export async function runReportedEngine(m: ReportedMaterial, opts: ReportedRunOptions): Promise<V3Run> {
  const log = opts.log ?? ((l: string) => console.log(`[v3:reported:${m.sourceId}] ${l}`));
  const run: V3Run = { id: newRunId(), engine: "reported", sourceId: m.sourceId, fixture: opts.fixture, mode: opts.mode, status: "completed", startedAt: new Date().toISOString(), artifacts: { repairs: [] }, calls: [], totalCostUsd: 0 };
  const add = (...cs: StageCall[]) => { for (const c of cs) { run.calls.push(c); run.totalCostUsd = Math.round((run.totalCostUsd + c.costUsd) * 10000) / 10000; } };
  try {
    const p = await extractPack(m); add(p.call); run.artifacts.pack = p.pack;
    log(`pack: ${p.pack.facts.length} facts · ${p.pack.quotes.length} quotes · ${p.pack.unknowns.length} unknowns`);
    const b = await fanBrief(p.pack); add(b.call); run.artifacts.brief = b.brief;
    log(`brief: depth ${b.brief.depth} — ${b.brief.depthReason.slice(0, 120)}`);
    const w = await writeReported(p.pack, b.brief); add(w.call); run.artifacts.draft = w.draft;
    log(`writer (${w.call.model}): ${words(w.draft.bodyMarkdown)} words`);
    const s = await subtractionEdit(w.draft, p.pack, b.brief); add(s.call);
    let draft = s.draft; run.artifacts.subtracted = draft; run.artifacts.repairs!.push(...s.cuts.map((c) => `cut: ${c}`));
    log(`subtraction (${s.call.model}): ${words(draft.bodyMarkdown)} words · ${s.cuts.length} cuts`);
    const source = sourcesBlock(m);
    run.artifacts.policy = hardPolicyGates({ draft, lane: "standalone", suppliedQuotes: p.pack.quotes.map((q) => q.text) });
    const fc = await factCheckSources(draft, source); add(fc.call); run.artifacts.fact = fc.result;
    log(`policy ${run.artifacts.policy.pass ? "pass" : run.artifacts.policy.violations.join("; ")} · fact ${fc.result.verdict}`);
    const q1 = await quitReadingTest(draft, oppositeOf(w.call.vendor, "low")); add(q1.call); run.artifacts.quit = q1.result;
    log(`quit test: ${q1.result.neverWantedToQuit ? "never wanted to quit" : `quit at ¶${q1.result.quitParagraphIndex} (${q1.result.reason})`} · finished ${q1.result.didFinish} · worth it ${q1.result.worthTheTime} · send ${q1.result.wouldSend}`);
    if (!q1.result.neverWantedToQuit && q1.result.quitParagraphIndex !== undefined) {
      // Default repair: delete the paragraph where interest dropped (brief §15).
      const paras = draft.bodyMarkdown.split(/\n{2,}/);
      const idx = q1.result.quitParagraphIndex;
      if (paras.length > 2 && idx < paras.length && idx > 0) {
        const trimmed: ArticleDraft = { ...draft, bodyMarkdown: paras.filter((_, i) => i !== idx).join("\n\n") };
        const fc2 = await factCheckSources(trimmed, source); add(fc2.call);
        const q2 = await quitReadingTest(trimmed, oppositeOf(w.call.vendor, "low")); add(q2.call); run.artifacts.quitAfterRepair = q2.result;
        const better = fc2.result.verdict === "pass" && (q2.result.neverWantedToQuit || (q2.result.didFinish && !q1.result.didFinish) || (q2.result.quitParagraphIndex ?? 0) > idx);
        log(`after deleting ¶${idx}: ${q2.result.neverWantedToQuit ? "never wanted to quit" : `quit at ¶${q2.result.quitParagraphIndex}`} · ${better ? "adopted" : "kept the original"}`);
        run.artifacts.repairs!.push(`${better ? "deleted" : "tried deleting"} ¶${idx} (${q1.result.reason})`);
        if (better) { draft = trimmed; run.artifacts.fact = fc2.result; run.artifacts.policy = hardPolicyGates({ draft, lane: "standalone", suppliedQuotes: p.pack.quotes.map((q) => q.text) }); }
      }
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
