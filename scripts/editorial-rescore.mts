// Re-score existing drafts (run records, fixture known outputs, the hidden
// benchmark) with the CURRENT final-eval judges. Cheap: judges only. Use it
// whenever the judges change, so the scale is checked against Josh's own
// approved work before any threshold decision.
//   npx tsx scripts/editorial-rescore.mts [--runs id1,id2] [--fixture miami-acc] [--benchmark miami-acc]
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
for (const l of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim(); }
const { finalEvaluation, fanMean } = await import("../lib/editorial-v2/final-eval.ts");
const arg = (k: string) => { const i = process.argv.indexOf(k); return i !== -1 ? process.argv[i + 1] : undefined; };
type Draft = import("../lib/editorial-v2/types.ts").ArticleDraft;
const items: { label: string; draft: Draft }[] = [];
const asDraft = (h: string, d: string, b: string): Draft => ({ headline: h, dek: d, bodyMarkdown: b, pullQuote: "", primaryTeam: "", teams: [], tags: [], seo: { title: "", description: "" } });
if (arg("--benchmark")) { const b = JSON.parse(readFileSync(`fixtures/editorial-replay/benchmark-${arg("--benchmark")}.json`, "utf8")); items.push({ label: "JOSH'S OWN EDIT (benchmark)", draft: asDraft(b.headline, b.dek, b.bodyMarkdown + "\n\n— JP") }); }
if (arg("--fixture")) { const fx = JSON.parse(readFileSync(`fixtures/editorial-replay/show-${arg("--fixture")}.json`, "utf8")); for (const k of fx.knownOutputs) items.push({ label: `known: ${k.label} (legacy ${k.legacyFan?.score ?? "—"})`, draft: asDraft(k.headline, k.dek, k.bodyMarkdown) }); }
if (arg("--runs")) for (const id of arg("--runs")!.split(",")) { const f = readdirSync(".superpowers/editorial-runs").find((x) => x.includes(id)); if (!f) continue; const run = JSON.parse(readFileSync(`.superpowers/editorial-runs/${f}`, "utf8")); if (run.final) items.push({ label: `run ${id} (${run.fixture ?? run.sourceId}; old judges fan ${run.finalScore ?? "—"})`, draft: run.final }); }
for (const it of items) {
  const { evaluation: e } = await finalEvaluation(it.draft, { lane: "show", product: "josh-column", includeLegacy: true });
  console.log(`${it.label}\n   fan ${fanMean(e)} (A ${e.fanA.overall} / B ${e.fanB.overall}) · legibility ${Math.min(e.fanA.legibility, e.fanB.legibility)} · sendability ${((e.fanA.sendability + e.fanB.sendability) / 2).toFixed(1)} · humanity ${e.humanity.humanity} · voice ${e.voice.score} (legacy voice ${e.legacyVoice?.score}) · legacy fan ${e.legacyFan?.score} · meets ${e.meets.all}`);
  if (process.argv.includes("--notes")) console.log(`   voice: ${e.voice.notes.slice(0, 300)}\n   fanB machine: ${e.fanB.machine.slice(0, 200)}`);
}
// --stages <runId>: score every intermediate draft of a run (writer A, writer
// B, developmental rewrite, audience edit, final) to see where value is
// lost or gained inside the room.
if (arg("--stages")) {
  const f = readdirSync(".superpowers/editorial-runs").find((x) => x.includes(arg("--stages")!));
  if (f) {
    const run = JSON.parse(readFileSync(`.superpowers/editorial-runs/${f}`, "utf8"));
    const stages: { label: string; draft: Draft }[] = [];
    for (const d of run.artifacts.drafts ?? []) stages.push({ label: `writer ${d.writer} (${d.model})`, draft: d.draft });
    if (run.artifacts.rewrite) stages.push({ label: "developmental rewrite", draft: run.artifacts.rewrite });
    if (run.artifacts.audienceEdit) stages.push({ label: `audience edit (${run.artifacts.audienceEdit.verdict})`, draft: run.artifacts.audienceEdit.draft });
    if (run.final) stages.push({ label: "final", draft: run.final });
    console.log(`\n=== stages of ${arg("--stages")} (${run.fixture ?? run.sourceId}) ===`);
    for (const s of stages) {
      const { evaluation: e } = await finalEvaluation(s.draft, { lane: "show", product: "josh-column", includeLegacy: true });
      console.log(`${s.label.padEnd(34)} ${s.draft.bodyMarkdown.split(/\s+/).length}w · fan ${fanMean(e)} (A ${e.fanA.overall} / B ${e.fanB.overall}) · send ${((e.fanA.sendability + e.fanB.sendability) / 2).toFixed(1)} · humanity ${e.humanity.humanity} · voice ${e.voice.score} · legacy ${e.legacyFan?.score}`);
    }
  }
}
