// Editorial Engine V2 — replay (brief §30): load a frozen fixture, run V1
// and V2 from the same material, score both with identical judges, and
// write a blinded comparison report. Publishes nothing.
//
//   npm run editorial:replay -- --fixture miami-acc [--skip-v1] [--v2-only] [--label note]
//   npm run editorial:replay -- --baseline          # score every fixture's known V1 outputs
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

function loadDotEnvLocal() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim(); if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("="); if (eq === -1) continue;
    const key = line.slice(0, eq).trim(); if (key && !(key in process.env)) process.env[key] = line.slice(eq + 1).trim();
  }
}
loadDotEnvLocal();
process.env.EDITORIAL_V2_ENABLED ??= "true";
process.env.EDITORIAL_V2_SHOW_ENABLED ??= "true";
process.env.EDITORIAL_V2_SHADOW_MODE ??= "true";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i !== -1 ? process.argv[i + 1] : undefined; };
const has = (k: string) => process.argv.includes(k);
const FIX = arg("--fixture");
const LABEL = arg("--label") ?? "";
const DIR = "fixtures/editorial-replay";
const REPORTS = "docs/editorial-v2/replays";
mkdirSync(REPORTS, { recursive: true });

const { draftCompanion } = await import("../lib/generate.ts");
const { runShowColumnV2 } = await import("../lib/editorial-v2/show-column.ts");
const { finalEvaluation, fanMean } = await import("../lib/editorial-v2/final-eval.ts");
const { styleDiagnostics } = await import("../lib/editorial-v2/diagnostics.ts");
const { hardPolicyGates } = await import("../lib/editorial-v2/policy-gates.ts");
type ShowFixture = import("../lib/editorial-v2/types.ts").ShowFixture;
type ArticleDraft = import("../lib/editorial-v2/types.ts").ArticleDraft;
type FinalEvaluation = import("../lib/editorial-v2/types.ts").FinalEvaluation;

const loadFixture = (id: string): ShowFixture => JSON.parse(readFileSync(`${DIR}/show-${id}.json`, "utf8"));
const benchmarkFor = (id: string) => { const p = `${DIR}/benchmark-${id.replace(/-traps$/, "")}.json`; return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null; };

interface Scored { system: string; label: string; draft: ArticleDraft; evaluation: FinalEvaluation; words: number; cost?: number; calls?: number; ms?: number; decision?: string }

async function score(system: string, label: string, draft: ArticleDraft, extra: Partial<Scored> = {}): Promise<Scored> {
  const { evaluation } = await finalEvaluation(draft, { lane: "show", product: "josh-column", includeLegacy: true });
  return { system, label, draft, evaluation, words: styleDiagnostics(draft.bodyMarkdown).words, ...extra };
}

function line(s: Scored): string {
  const e = s.evaluation;
  return `| ${s.label} | **${fanMean(e)}** (${e.fanA.overall}/${e.fanB.overall}) | ${Math.min(e.fanA.legibility, e.fanB.legibility)} | ${((e.fanA.sendability + e.fanB.sendability) / 2).toFixed(1)} | ${e.humanity.humanity} | ${e.voice.score} | ${e.legacyFan?.score ?? "—"} | ${s.words} | ${s.cost !== undefined ? `$${s.cost.toFixed(2)} / ${s.calls} calls / ${Math.round((s.ms ?? 0) / 1000)}s` : "—"} | ${s.decision ?? "—"} |`;
}
const HEAD = `| draft | fan mean (A/B) | min legibility | sendability | humanity | voice | legacy fan | words | cost | decision |\n|---|---|---|---|---|---|---|---|---|---|`;

function shuffle<T>(xs: T[]): T[] { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

async function replay(id: string) {
  const fx = loadFixture(id);
  const bench = benchmarkFor(id);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  console.log(`\n=== replay ${id} · ${fx.episode.title} · shape ${fx.shape} ===`);
  const results: Scored[] = [];

  // V1 from the same frozen material (draftCompanion takes the inputs directly).
  if (!has("--v2-only") && !has("--skip-v1")) {
    const t0 = Date.now();
    const v1 = await draftCompanion({ title: fx.episode.title, description: fx.episode.description, publishedAt: fx.episode.publishedAt, series: fx.episode.series, transcriptText: fx.transcriptText, extractedQuotes: fx.quotes, factSheet: fx.factSheet });
    if (v1) { results.push(await score("v1", "V1 (fresh run)", v1, { ms: Date.now() - t0 })); console.log(`V1: ${results.at(-1)!.words}w · fan ${fanMean(results.at(-1)!.evaluation)}`); }
    else console.log("V1: no draft");
  }
  // V2
  const t1 = Date.now();
  const run = await runShowColumnV2({ sourceId: fx.episode.ytId, fixture: fx.id, mode: "replay", material: { episode: fx.episode, transcriptText: fx.transcriptText, quotes: fx.quotes, factSheet: fx.factSheet, onRecord: fx.onRecord }, excludeFragmentSources: bench ? [bench.sourceId] : [] });
  console.log(`V2: ${run.status} · ${run.decision?.decision} (${run.decision?.failureClass}) · ${run.calls.length} calls · $${run.totalCostUsd} · ${Math.round((Date.now() - t1) / 1000)}s · run ${run.id}`);
  if (run.final && run.artifacts.evaluation) {
    results.push({ system: "v2", label: "V2 (fresh run)", draft: run.final, evaluation: run.artifacts.evaluation, words: styleDiagnostics(run.final.bodyMarkdown).words, cost: run.totalCostUsd, calls: run.calls.length, ms: Date.now() - t1, decision: `${run.decision?.decision} / ${run.decision?.failureClass}` });
  }
  // Trap check (fixture §26.5)
  const trapReport = fx.traps.length && run.final ? fx.traps.map((t) => `- ${t.kind}: ${run.final!.bodyMarkdown.toLowerCase().includes(t.text.toLowerCase()) ? "**LEAKED**" : "caught"} (${t.text.slice(0, 60)})`).join("\n") : "";

  // Blinded report: drafts shuffled and labeled by letter; the key is sealed in a separate file.
  const order = shuffle(results);
  const letters = "ABCDEF";
  const key = order.map((r, i) => ({ letter: letters[i], system: r.system, label: r.label }));
  const md = [
    `# Blind comparison — ${fx.episode.title}`,
    `*Fixture \`${fx.id}\` (${fx.shape}) · ${stamp}${LABEL ? ` · ${LABEL}` : ""}. Drafts are labeled by letter in random order; the authorship key is in \`${stamp}-${id}.key.json\`. Read and rank before opening it.*`,
    ``,
    `## Scores (identical judges for every draft)`,
    HEAD,
    ...order.map((r, i) => line({ ...r, label: `Draft ${letters[i]}` })),
    ...(bench ? [`| Josh's own edit (hidden benchmark) | — | — | — | — | — | — | ${styleDiagnostics(bench.bodyMarkdown).words} | — | — |`] : []),
    ``,
    ...(trapReport ? [`## Fact traps`, trapReport, ``] : []),
    ...order.flatMap((r, i) => [`## Draft ${letters[i]}`, `**${r.draft.headline}**`, ``, `*${r.draft.dek}*`, ``, r.draft.bodyMarkdown, ``, `<details><summary>Judges on Draft ${letters[i]}</summary>`, ``, `Fan A: ${r.evaluation.fanA.machine} — would text: ${r.evaluation.fanA.wouldText}`, ``, `Fan B: ${r.evaluation.fanB.machine} — would text: ${r.evaluation.fanB.wouldText}`, ``, `Humanity: ${r.evaluation.humanity.notes}`, ``, `</details>`, ``]),
    ...(bench ? [`## Josh's own edit (benchmark, shown last on purpose)`, `**${bench.headline}**`, ``, `*${bench.dek}*`, ``, bench.bodyMarkdown, ``] : []),
    `## V2 run record`,
    `Run \`${run.id}\` · decision ${run.decision?.decision} (${run.decision?.failureClass}: ${run.decision?.reason}) · ${run.cycles} cycles · ${run.calls.length} calls · est. $${run.totalCostUsd}`,
    ``,
    `| stage | model | in | out | $ | s |\n|---|---|---|---|---|---|`,
    ...run.calls.map((c) => `| ${c.stage} | ${c.vendor}/${c.model} | ${c.inputTokens} | ${c.outputTokens} | ${c.costUsd.toFixed(3)} | ${Math.round(c.ms / 1000)} |`),
    ``,
    run.artifacts.angleDecision ? `**Selected angle:** ${run.artifacts.angleDecision.finalThesis ?? ""}` : "",
    run.artifacts.miner ? `**Source shape (miner):** ${run.artifacts.miner.sourceShape} — ${run.artifacts.miner.note}` : "",
    run.artifacts.dossier ? `**Source sufficiency:** ${run.artifacts.dossier.sourceSufficiency.score}/10 — ${run.artifacts.dossier.sourceSufficiency.reason}` : "",
    run.artifacts.policy ? `**Policy:** ${run.artifacts.policy.pass ? "pass" : run.artifacts.policy.violations.join("; ")}` : "",
    run.error ? `**Error:** ${run.error}` : "",
  ].filter((l) => l !== undefined).join("\n");
  writeFileSync(`${REPORTS}/${stamp}-${id}.md`, md);
  writeFileSync(`${REPORTS}/${stamp}-${id}.key.json`, JSON.stringify({ key, runId: run.id, results: results.map((r) => ({ system: r.system, fanMean: fanMean(r.evaluation), humanity: r.evaluation.humanity.humanity, voice: r.evaluation.voice.score, legacy: r.evaluation.legacyFan?.score, words: r.words, cost: r.cost })) }, null, 2));
  console.log(`report: ${REPORTS}/${stamp}-${id}.md`);
  for (const r of results) console.log(`  ${r.system.padEnd(3)} fan ${fanMean(r.evaluation)} · humanity ${r.evaluation.humanity.humanity} · voice ${r.evaluation.voice.score} · legacy ${r.evaluation.legacyFan?.score ?? "—"} · ${r.words}w`);
  return { fx, run, results };
}

if (has("--baseline")) {
  // Phase 0: record the current scores of every known V1 output on the new judges.
  const out: Record<string, unknown[]> = {};
  for (const f of readdirSync(DIR).filter((f) => f.startsWith("show-") && f.endsWith(".json"))) {
    const fx = JSON.parse(readFileSync(`${DIR}/${f}`, "utf8")) as ShowFixture;
    out[fx.id] = [];
    for (const k of fx.knownOutputs) {
      const s = await score(k.system, k.label, { headline: k.headline, dek: k.dek, bodyMarkdown: k.bodyMarkdown, pullQuote: k.pullQuote, primaryTeam: "", teams: [], tags: [], seo: { title: "", description: "" } });
      const policy = hardPolicyGates({ draft: s.draft, lane: "show", transcriptText: fx.transcriptText });
      (out[fx.id] as unknown[]).push({ label: k.label, system: k.system, fanMean: fanMean(s.evaluation), fanA: s.evaluation.fanA.overall, fanB: s.evaluation.fanB.overall, humanity: s.evaluation.humanity.humanity, voice: s.evaluation.voice.score, legacyFan: s.evaluation.legacyFan?.score, legacyFanRecorded: k.legacyFan?.score, words: s.words, policy: policy.pass ? "pass" : policy.violations });
      console.log(`${fx.id} · ${k.label}: fan ${fanMean(s.evaluation)} (A ${s.evaluation.fanA.overall} / B ${s.evaluation.fanB.overall}) · humanity ${s.evaluation.humanity.humanity} · voice ${s.evaluation.voice.score} · legacy ${s.evaluation.legacyFan?.score} (recorded ${k.legacyFan?.score ?? "—"})`);
    }
  }
  writeFileSync(`${DIR}/baseline-scores.json`, JSON.stringify({ scoredAt: new Date().toISOString(), judges: "final-eval v2 (fan A Claude, fan B OpenAI, humanity, voice) + legacy fanScore", fixtures: out }, null, 2));
  console.log(`wrote ${DIR}/baseline-scores.json`);
} else if (FIX === "all") {
  for (const f of readdirSync(DIR).filter((f) => f.startsWith("show-") && f.endsWith(".json"))) await replay(f.replace(/^show-|\.json$/g, ""));
} else if (FIX) {
  await replay(FIX);
} else {
  console.error("usage: --fixture <id|all> | --baseline"); process.exit(1);
}
