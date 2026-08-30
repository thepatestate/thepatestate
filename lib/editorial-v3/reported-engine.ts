// Engine B — reported Pate State articles (brief §8–§16): reporting pack →
// fan brief (depth is a decision; desk gate) → one reporter (ChatGPT Sol,
// writing from the sources themselves plus the pack, with the date) → desk
// editor (Opus: lead, clock, quotes, rhythm, kicker, subtraction) → hard
// gates + lift gate → fact check → quit-reading test (delete the quit
// paragraph, once) → AI-smell. Third person, desk voice. Never publishes.
// 2026-08-28 (Isaac): the writer was Opus working from a JSON pack, which
// produced stat-stack leads, uniform paragraphs and no clock; see
// .claude/skills/sports-desk-editor/references/ai-tells.md.
import { callJSON, modelForRole, oppositeOf, choiceFor, type Tier } from "./models";
import { deskGate } from "./desk-gate";
import { v3Prompt, S, arr, obj, nullable, ARTICLE_SCHEMA, OUTPUT_CONTRACT, cleanDraft, words, hardPolicyForLane, dateLine } from "./v3-context";
import { hardPolicyGates } from "./policy-gates";
import { factCheckSources, factRepair } from "./fact-check";
import { quitReadingTest, aiSmellTest } from "./judges";
import { newRunId, recordV3Run } from "./telemetry";
import { liftReport, liftVerdict } from "./lift-check";
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
const BRIEF_SCHEMA = obj({ theNews: S, whyAFanCares: S, interestingDetail: nullable(S), footballAngle: nullable(S), importantUnknown: nullable(S), depth: { type: "string", enum: ["item", "brief", "story", "analysis"] }, depthReason: S, nationalDeskWouldRun: { type: "boolean" }, deskReason: S });
const SUBTRACT_SCHEMA = obj({ cuts: arr(S), draft: ARTICLE_SCHEMA });

export function sourcesBlock(m: ReportedMaterial): string {
  return `${m.sources.map((s, i) => `SOURCE ${i + 1} [sourceRef: source-${i + 1}] — ${s.title} (${s.outlets.join(", ")})\n${s.text}`).join("\n\n")}\n\nVERIFIED TEAM FACTS [sourceRef: fact-sheet]:\n${m.factSheet || "none"}${m.onRecord ? `\n\n${m.onRecord} [sourceRef: on-record]` : ""}`;
}

export async function extractPack(m: ReportedMaterial, tier: Tier = "premium"): Promise<{ pack: ReportingPack; call: StageCall }> {
  const { data, call } = await callJSON<ReportingPack>({ stage: "reporting-pack", role: "packExtract", choice: choiceFor("packExtract", tier), maxTokens: 5000, schemaName: "reporting_pack", schema: PACK_SCHEMA as unknown as Record<string, unknown>, system: v3Prompt("reporting-pack"), user: sourcesBlock(m) });
  return { pack: data, call };
}

export async function fanBrief(pack: ReportingPack, raw?: string, tier: Tier = "premium"): Promise<{ brief: FanBrief; call: StageCall }> {
  const { data, call } = await callJSON<FanBrief & { interestingDetail: string | null; footballAngle: string | null; importantUnknown: string | null }>({ stage: "fan-brief", role: "fanBrief", choice: choiceFor("fanBrief", tier), maxTokens: 2000, schemaName: "fan_brief", schema: BRIEF_SCHEMA as unknown as Record<string, unknown>, system: v3Prompt("fan-brief"), user: `REPORTING PACK:\n${JSON.stringify(pack, null, 1)}${raw ? `\n\nTHE SOURCES THEMSELVES (so you can judge how much is really here):\n${raw.slice(0, 12000)}` : ""}` });
  return { brief: { ...data, interestingDetail: data.interestingDetail ?? undefined, footballAngle: data.footballAngle ?? undefined, importantUnknown: data.importantUnknown ?? undefined }, call };
}

function briefBlock(b: FanBrief): string {
  const w = DEPTH_WORDS[b.depth];
  return `FAN BRIEF:\nTHE NEWS: ${b.theNews}\nWHY A FAN CARES: ${b.whyAFanCares}${b.interestingDetail ? `\nTHE INTERESTING DETAIL: ${b.interestingDetail}` : ""}${b.footballAngle ? `\nTHE FOOTBALL ANGLE: ${b.footballAngle}` : ""}${b.importantUnknown ? `\nWHAT WE DON'T KNOW: ${b.importantUnknown}` : ""}\n\nDEPTH: ${b.depth.toUpperCase()} (${w.min}–${w.max} words) — ${b.depthReason}\nThe range is real in both directions: a ${b.depth} under ${w.min} words has left out facts the pack carries; one over ${w.max} is padded. Use the pack's facts, quotes and team context until the range is honestly filled, then stop.`;
}

/** The reporter's draft. Sol writes from the sources themselves (the quotes,
 * the sequence, the texture) with the pack as the checklist of verified
 * facts and today's date as the clock. */
export async function writeReported(pack: ReportingPack, brief: FanBrief, m?: ReportedMaterial, tier: Tier = "premium"): Promise<{ draft: ArticleDraft; call: StageCall }> {
  const raw = m ? sourcesBlock(m).slice(0, 16000) : "";
  const { data, call } = await callJSON<ArticleDraft>({
    stage: "reported-writer", role: "reportedWriter", choice: choiceFor("reportedWriter", tier), maxTokens: 6000, schemaName: "article", schema: ARTICLE_SCHEMA as unknown as Record<string, unknown>,
    system: `${v3Prompt("reported-writer")}\n\n${v3Prompt("desk-voice")}\n\n${hardPolicyForLane("standalone")}`,
    user: `${dateLine()}\n\n${briefBlock(brief)}${raw ? `\n\nTHE SOURCES (your notes: the quotes, the sequence, the texture; the facts are yours, the sentences are not):\n${raw}` : ""}\n\nREPORTING PACK (the checklist of verified facts, quotes and numbers; everything you state must be here or in the sources):\n${JSON.stringify(pack, null, 1)}\n\n${OUTPUT_CONTRACT}`,
  });
  return { draft: cleanDraft(data), call };
}

/** The desk edit (Opus, after the draft): the lead, the clock, the quotes,
 * the rhythm, the kicker, and subtraction — adding nothing. Replaces the
 * pure subtraction editor, whose compression produced fact-bricks. */
export async function deskEdit(draft: ArticleDraft, pack: ReportingPack, brief: FanBrief, liftedRuns?: string[], raw?: string, note?: string, tier: Tier = "premium"): Promise<{ draft: ArticleDraft; cuts: string[]; call: StageCall }> {
  const w = DEPTH_WORDS[brief.depth]; const n = words(draft.bodyMarkdown);
  const { data, call } = await callJSON<{ cuts: string[]; draft: ArticleDraft }>({ stage: "desk-editor", role: "deskEditor", choice: choiceFor("deskEditor", tier), maxTokens: 6000, schemaName: "desk_edit", schema: SUBTRACT_SCHEMA as unknown as Record<string, unknown>, system: `${v3Prompt("desk-editor")}\n\n${v3Prompt("desk-voice")}`, user: `${dateLine()}\n\n${note ? `EDITOR'S NOTE ON YOUR LAST PASS: ${note}\n\n` : ""}${briefBlock(brief)}\n\nDRAFT LENGTH: ${n} words against a ${brief.depth} range of ${w.min}–${w.max}. ${n <= w.min ? "The draft is already at or under the range: edit for craft, remove over-explanation and repetition only, and restore any pack fact the writer dropped." : "Cut toward the range."}${liftedRuns?.length ? `\n\nVERBATIM LIFTS: these word runs are copied from the source outside quotation marks; rewrite each in the desk's own words, keeping the fact (lists of names may stay):\n- ${liftedRuns.map((r) => r.slice(0, 160)).join("\n- ")}` : ""}\n\nREPORTING PACK (facts to keep):\n${JSON.stringify(pack, null, 1)}${raw ? `\n\nTHE SOURCES (for restoring a clipped quote to its full length; add nothing else from them):\n${raw.slice(0, 10000)}` : ""}\n\nDRAFT:\n${JSON.stringify(draft, null, 1)}` });
  return { draft: cleanDraft(data.draft), cuts: data.cuts, call };
}
/** @deprecated the desk edit replaced the subtraction editor on 2026-08-28. */
export const subtractionEdit = deskEdit;

export interface ReportedRunOptions {
  mode: V3Run["mode"]; fixture?: string; log?: (l: string) => void;
  /** premium (Sol + Opus) or economy (Luna + Sonnet); default premium. */
  tier?: Tier;
  /** Run the desk gate on the sources before any other call, and enforce the
   * fan brief's "would a national desk run this". */
  gate?: boolean;
}

export async function runReportedEngine(m: ReportedMaterial, opts: ReportedRunOptions): Promise<V3Run> {
  const log = opts.log ?? ((l: string) => console.log(`[v3:reported:${m.sourceId}] ${l}`));
  const run: V3Run = { id: newRunId(), engine: "reported", sourceId: m.sourceId, fixture: opts.fixture, mode: opts.mode, status: "completed", startedAt: new Date().toISOString(), artifacts: { repairs: [] }, calls: [], totalCostUsd: 0 };
  const add = (...cs: StageCall[]) => { for (const c of cs) { run.calls.push(c); run.totalCostUsd = Math.round((run.totalCostUsd + c.costUsd) * 10000) / 10000; } };
  const tier = opts.tier ?? "premium";
  try {
    if (opts.gate) {
      const g = await deskGate({ headline: m.sources[0]?.title ?? m.sourceId, text: m.sources.map((s) => `${s.title}\n${s.text}`).join("\n\n") }); add(g.call);
      log(`desk gate: ${g.pass ? "pass" : "NO"} · ${g.result.level} · ${g.result.reason.slice(0, 100)}`);
      if (!g.pass) { run.status = "no-article"; run.error = `desk gate: ${g.result.reason}`.slice(0, 500); run.completedAt = new Date().toISOString(); await recordV3Run(run); return run; }
    }
    const p = await extractPack(m, tier); add(p.call); run.artifacts.pack = p.pack;
    log(`pack: ${p.pack.facts.length} facts · ${p.pack.quotes.length} quotes · ${p.pack.unknowns.length} unknowns`);
    const b = await fanBrief(p.pack, sourcesBlock(m), tier); add(b.call); run.artifacts.brief = b.brief;
    log(`brief: depth ${b.brief.depth} — ${b.brief.depthReason.slice(0, 120)}${b.brief.nationalDeskWouldRun === false ? ` · DESK WOULD NOT RUN: ${b.brief.deskReason ?? ""}` : ""}`);
    if (b.brief.nationalDeskWouldRun === false && (opts.gate || process.env.EDITORIAL_V3_DESK_GATE === "true")) {
      run.status = "no-article"; run.error = `desk gate: ${b.brief.deskReason ?? "not a national college football story"}`.slice(0, 500); run.completedAt = new Date().toISOString();
      await recordV3Run(run); return run;
    }
    const w = await writeReported(p.pack, b.brief, m, tier); add(w.call); run.artifacts.draft = w.draft;
    log(`reporter (${w.call.model}, ${tier}): ${words(w.draft.bodyMarkdown)} words`);
    // Lift gate: the writer's sentences are its own; the sources' sentences are not.
    const lift0 = liftReport(w.draft.bodyMarkdown, m.sources.map((x) => x.text));
    let s = await deskEdit(w.draft, p.pack, b.brief, lift0.runs.length ? lift0.runs : undefined, sourcesBlock(m), undefined, tier); add(s.call);
    // The range floor is real (brief §11): a cut that drops a brief well below
    // its minimum has removed news, not padding. The desk edit is where the
    // craft happens, so it is not thrown away for a few words: the floor has
    // a 15% tolerance, and one over-cut gets one retry with the floor stated
    // before the reporter's draft is kept instead (2026-08-28).
    const floor = DEPTH_WORDS[b.brief.depth].min; const tolerated = Math.round(floor * 0.85);
    const under = (d: ArticleDraft) => words(d.bodyMarkdown) < tolerated && words(w.draft.bodyMarkdown) >= tolerated;
    if (under(s.draft)) {
      const retry = await deskEdit(w.draft, p.pack, b.brief, lift0.runs.length ? lift0.runs : undefined, sourcesBlock(m), `Your previous edit came back at ${words(s.draft.bodyMarkdown)} words, under the ${b.brief.depth} floor of ${floor}: it removed reporting, not padding. Keep at least ${floor} words this time — restore the facts you cut and do the craft work (lead, clock, quotes, rhythm, kicker) instead.`, tier); add(retry.call);
      log(`desk edit retry (${retry.call.model}): ${words(s.draft.bodyMarkdown)} → ${words(retry.draft.bodyMarkdown)} words`);
      if (!under(retry.draft)) s = retry;
    }
    // Lift retry (2026-08-30): if the edited draft still carries verbatim runs,
    // one more desk pass with those runs named — Luna lifts more than Sol.
    if (!under(s.draft)) {
      const lift1 = liftReport(s.draft.bodyMarkdown, m.sources.map((x) => x.text));
      if (!liftVerdict(lift1).pass) {
        const fix = await deskEdit(s.draft, p.pack, b.brief, lift1.runs, sourcesBlock(m), `Your edit still carries ${lift1.pct}% verbatim source text outside quotation marks (limit 12%; longest run ${lift1.runs.reduce((a2, x) => Math.max(a2, x.split(" ").length), 0)} words). Rewrite every run listed under VERBATIM LIFTS in the desk's own sentences — keep the facts, change the words — and change nothing else.`, tier); add(fix.call);
        const lift2 = liftReport(fix.draft.bodyMarkdown, m.sources.map((x) => x.text));
        log(`lift retry (${fix.call.model}): ${lift1.pct}% → ${lift2.pct}%`);
        if (!under(fix.draft) && lift2.pct <= lift1.pct) s = fix;
      }
    }
    const overCut = under(s.draft);
    let draft = overCut ? w.draft : s.draft; run.artifacts.subtracted = s.draft; run.artifacts.repairs!.push(...s.cuts.map((c) => `cut: ${c}`));
    log(`desk edit (${s.call.model}): ${words(s.draft.bodyMarkdown)} words · ${s.cuts.length} changes${overCut ? ` · below the ${b.brief.depth} floor (${floor}); kept the reporter's ${words(w.draft.bodyMarkdown)}` : ""}`);
    const source = sourcesBlock(m);
    // A pull quote the pack does not carry verbatim is dropped, not a reason
    // to lose the story (the desk's quotes live in the body, attributed).
    const normQ = (x: string) => x.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    if (draft.pullQuote.trim() && !p.pack.quotes.some((q) => normQ(q.text).includes(normQ(draft.pullQuote)))) { draft = { ...draft, pullQuote: "", bodyMarkdown: draft.bodyMarkdown.replace(/\s*\[PULLQUOTE\]\s*/g, "\n\n") }; run.artifacts.repairs!.push("dropped a pull quote the sources did not carry verbatim"); }
    run.artifacts.policy = hardPolicyGates({ draft, lane: "standalone", suppliedQuotes: p.pack.quotes.map((q) => q.text) });
    const lift = liftReport(draft.bodyMarkdown, m.sources.map((x) => x.text)); const lv = liftVerdict(lift);
    run.artifacts.lift = { pct: lift.pct, longestRun: lift.runs.reduce((a, x) => Math.max(a, x.split(" ").length), 0), pass: lv.pass, reason: lv.reason };
    if (!lv.pass) run.artifacts.policy = { pass: false, violations: [...run.artifacts.policy.violations, `verbatim lift: ${lv.reason}`] };
    log(`lift check: ${lv.reason}`);
    let fc = await factCheckSources(draft, source); add(fc.call); run.artifacts.fact = fc.result;
    log(`policy ${run.artifacts.policy.pass ? "pass" : run.artifacts.policy.violations.join("; ")} · fact ${fc.result.verdict}`);
    // One fact repair before a story dies (2026-08-30): drop or narrow the
    // flagged claims, keep everything else, re-check once. Only what the
    // pack carries survives; nothing is added.
    if (fc.result.verdict !== "pass" && fc.result.claims.some((c) => c.status === "unsupported" || c.status === "contradicted")) {
      const rp = await factRepair(draft, fc.result, { subject: b.brief.theNews, teams: run.final?.teams ?? [], coreDevelopment: p.pack.development, confirmedFacts: p.pack.facts.map((f) => ({ fact: f.fact, sourceRef: f.sourceRef, confidence: f.status === "confirmed" ? "confirmed" as const : "reported" as const })), uncertainOrMissing: p.pack.unknowns.map((u) => ({ item: u, whyItMatters: "" })), numbers: p.pack.numbers.map((x) => ({ value: x.value, meaning: x.meaning, sourceRef: x.sourceRef })), quotes: p.pack.quotes.map((q) => ({ speaker: q.speaker, text: q.text, sourceRef: q.sourceRef, role: "evidence" as const })), joshOnRecord: [], footballMechanisms: [], tensions: [], contradictions: [], fanObjections: [], secondOrderConsequences: [], observableTests: [], thingsActuallyInteresting: [], sourceSufficiency: { score: 0, canSupportBrief: true, canSupportReaction: true, canSupportPremiumColumn: false, reason: "" } }, choiceFor("factRepair", tier)); add(rp.call);
      if (rp.draft.bodyMarkdown.trim() && words(rp.draft.bodyMarkdown) >= Math.round(DEPTH_WORDS[b.brief.depth].min * 0.7)) {
        // The repair model sometimes returns the body alone; the headline, dek
        // and metadata carry over from the draft it repaired.
        draft = cleanDraft({ ...draft, ...rp.draft, headline: rp.draft.headline?.trim() || draft.headline, dek: rp.draft.dek?.trim() || draft.dek, primaryTeam: rp.draft.primaryTeam || draft.primaryTeam, teams: rp.draft.teams?.length ? rp.draft.teams : draft.teams, tags: rp.draft.tags?.length ? rp.draft.tags : draft.tags, seo: rp.draft.seo?.title ? rp.draft.seo : draft.seo });
        run.artifacts.repairs!.push(...rp.removed.map((r) => `fact repair: ${r}`));
        run.artifacts.policy = hardPolicyGates({ draft, lane: "standalone", suppliedQuotes: p.pack.quotes.map((q) => q.text) });
        fc = await factCheckSources(draft, source); add(fc.call); run.artifacts.fact = fc.result;
        log(`fact repair: removed ${rp.removed.length} · re-check ${fc.result.verdict} · ${words(draft.bodyMarkdown)} words`);
      }
    }
    const quitChoice = tier === "economy" ? choiceFor("quitJudge", tier) : oppositeOf(w.call.vendor, "low");
    const q1 = await quitReadingTest(draft, quitChoice); add(q1.call); run.artifacts.quit = q1.result;
    log(`quit test: ${q1.result.neverWantedToQuit ? "never wanted to quit" : `quit at ¶${q1.result.quitParagraphIndex} (${q1.result.reason})`} · finished ${q1.result.didFinish} · worth it ${q1.result.worthTheTime} · send ${q1.result.wouldSend}`);
    if (!q1.result.neverWantedToQuit && q1.result.quitParagraphIndex !== undefined) {
      // Default repair: delete the paragraph where interest dropped (brief §15).
      const paras = draft.bodyMarkdown.split(/\n{2,}/);
      const idx = q1.result.quitParagraphIndex;
      if (paras.length > 2 && idx < paras.length && idx > 0 && words(paras.filter((_, i) => i !== idx).join("\n\n")) >= DEPTH_WORDS[b.brief.depth].min) {
        const trimmed: ArticleDraft = { ...draft, bodyMarkdown: paras.filter((_, i) => i !== idx).join("\n\n") };
        const fc2 = await factCheckSources(trimmed, source); add(fc2.call);
        const q2 = await quitReadingTest(trimmed, quitChoice); add(q2.call); run.artifacts.quitAfterRepair = q2.result;
        const better = fc2.result.verdict === "pass" && (q2.result.neverWantedToQuit || (q2.result.didFinish && !q1.result.didFinish) || (q2.result.quitParagraphIndex ?? 0) > idx);
        log(`after deleting ¶${idx}: ${q2.result.neverWantedToQuit ? "never wanted to quit" : `quit at ¶${q2.result.quitParagraphIndex}`} · ${better ? "adopted" : "kept the original"}`);
        run.artifacts.repairs!.push(`${better ? "deleted" : "tried deleting"} ¶${idx} (${q1.result.reason})`);
        if (better) { draft = trimmed; run.artifacts.fact = fc2.result; run.artifacts.policy = hardPolicyGates({ draft, lane: "standalone", suppliedQuotes: p.pack.quotes.map((q) => q.text) }); }
      }
    }
    if (tier === "economy") { run.artifacts.smell = { pass: true, sentences: [], structural: false, note: "skipped (economy tier)" }; }
    else {
      const smell = await aiSmellTest(draft, modelForRole("smellJudge")); add(smell.call); run.artifacts.smell = smell.result;
      log(`ai smell: ${smell.result.pass ? "PASS" : `${smell.result.sentences.length} sentence(s)${smell.result.structural ? ", structural" : ""}`}`);
    }
    run.final = draft; run.words = words(draft.bodyMarkdown); run.completedAt = new Date().toISOString();
    await recordV3Run(run);
    return run;
  } catch (err) {
    run.status = "failed"; run.error = err instanceof Error ? err.message.slice(0, 500) : String(err); run.completedAt = new Date().toISOString();
    await recordV3Run(run);
    return run;
  }
}
