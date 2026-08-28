// Editorial Engine V3 — the two controlled tests (brief §21) and the replay
// command (brief §22 step 5). Publishes nothing.
//
//   npm run editorial:v3-replay -- --fixture miami          # Test A: A cut · B cut+facts · C edited (terra and opus) · vs V1, V2, Josh's edit
//   npm run editorial:v3-replay -- --fixture reported-sample # Test B: three reported sources → three lengths
//   npm run editorial:v3-replay -- --fixture <show-id|reported-id>
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
for (const l of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim(); }
process.env.EDITORIAL_V3_ENABLED ??= "true";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i !== -1 ? process.argv[i + 1] : undefined; };
const FIX = arg("--fixture") ?? "miami";
const DIR = "fixtures/editorial-replay";
const OUT = "docs/editorial-v3/replays";
mkdirSync(OUT, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

const { runJoshEngine, selectSegment, buildJoshCut, supportFacts, cutOnlyArticle, lightProseEdit, segmentText } = await import("../lib/editorial-v3/josh-engine.ts");
const { runReportedEngine } = await import("../lib/editorial-v3/reported-engine.ts");
const { quitReadingTest, aiSmellTest } = await import("../lib/editorial-v3/judges.ts");
const { factCheckSources } = await import("../lib/editorial-v3/fact-check.ts");
const { modelForRole, oppositeOf } = await import("../lib/editorial-v3/models.ts");
const { words } = await import("../lib/editorial-v3/v3-context.ts");
type Draft = import("../lib/editorial-v3/v3-types.ts").ArticleDraft;
type Quit = import("../lib/editorial-v3/v3-types.ts").QuitReading;
type Smell = import("../lib/editorial-v3/v3-types.ts").AiSmell;

interface Row { label: string; system: string; draft: Draft; quit?: Quit; smell?: Smell; fact?: string; words: number; cost?: number; calls?: number; ms?: number }

async function judgeRow(label: string, system: string, draft: Draft, source: string, extra: Partial<Row> = {}): Promise<Row> {
  const [q, s, f] = await Promise.all([quitReadingTest(draft, modelForRole("quitJudge")), aiSmellTest(draft), factCheckSources(draft, source)]);
  return { label, system, draft, quit: q.result, smell: s.result, fact: f.result.verdict, words: words(draft.bodyMarkdown), ...extra };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const para = (body: string) => body.replace(/\[EMBED:[^\]]*\]\s*|\[PULLQUOTE\]\s*/g, "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => p.startsWith("## ") ? `<h3>${esc(p.slice(3))}</h3>` : `<p>${esc(p).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")}</p>`).join("\n");
function shuffle<T>(xs: T[]): T[] { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function blindHtml(title: string, rows: Row[], questions: string[], extraNote: string): { html: string; key: { letter: string; system: string; label: string }[] } {
  const order = shuffle(rows);
  const letters = "ABCDEFGH";
  const key = order.map((r, i) => ({ letter: letters[i], system: r.system, label: r.label }));
  const html = `<title>${esc(title)}</title>
<style>
:root{--bg:#FAFAF7;--ink:#1A1D21;--mute:#6B7178;--rule:#DCDDD6;--card:#fff;--acc:#1E6B47}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#15181C;--ink:#ECEDE8;--mute:#9AA0A6;--rule:#2D3238;--card:#1E2227;--acc:#5CC08E}}
:root[data-theme="dark"]{--bg:#15181C;--ink:#ECEDE8;--mute:#9AA0A6;--rule:#2D3238;--card:#1E2227;--acc:#5CC08E}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.55 Georgia,"Times New Roman",serif}
.wrap{max-width:760px;margin:0 auto;padding:36px 22px 80px}
h1{font:700 34px/1.05 "Helvetica Neue",Arial,sans-serif;margin:0 0 8px}
.lede{color:var(--mute);font:15px/1.5 "Helvetica Neue",Arial,sans-serif}
.q{background:var(--card);border:1px solid var(--rule);border-radius:8px;padding:14px 18px;margin:22px 0;font:15px/1.5 "Helvetica Neue",Arial,sans-serif}
.q ol{margin:6px 0 0;padding-left:20px}
article{border-top:2px solid var(--acc);margin-top:44px;padding-top:12px}
.tag{font:600 12px/1 "Helvetica Neue",Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--acc)}
h2{font:700 26px/1.15 "Helvetica Neue",Arial,sans-serif;margin:8px 0 6px}
.dek{color:var(--mute);font-style:italic;margin:0 0 14px}
h3{font:700 19px/1.2 "Helvetica Neue",Arial,sans-serif;margin:22px 0 4px}
.meta{font:13px/1.4 "Helvetica Neue",Arial,sans-serif;color:var(--mute);margin-top:14px}
</style>
<div class="wrap">
<h1>${esc(title)}</h1>
<p class="lede">Drafts are labeled by letter in random order. The authorship key is sealed in a separate file. Read first; answer the questions; then open the key. ${esc(extraNote)}</p>
<div class="q"><b>Answer for each draft:</b><ol>${questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ol></div>
${order.map((r, i) => `<article><div class="tag">Draft ${letters[i]} · ${r.words} words</div><h2>${esc(r.draft.headline)}</h2>${r.draft.dek ? `<p class="dek">${esc(r.draft.dek)}</p>` : ""}${para(r.draft.bodyMarkdown)}</article>`).join("\n")}
</div>`;
  return { html, key };
}

const scoreLine = (r: Row) => `${r.label.padEnd(44)} ${String(r.words).padStart(5)}w · finish ${r.quit?.didFinish ? "yes" : "NO "} · quit ${r.quit?.neverWantedToQuit ? "never" : `¶${r.quit?.quitParagraphIndex} ${r.quit?.reason}`} · football person ${r.quit?.soundsLikeFootballPerson ? "yes" : "no"} · worth it ${r.quit?.worthTheTime ? "yes" : "no"} · send ${r.quit?.wouldSend ? "yes" : "no"} · smell ${r.smell?.pass ? "PASS" : `${r.smell?.sentences.length}${r.smell?.structural ? " structural" : ""}`} · fact ${r.fact}${r.cost !== undefined ? ` · $${r.cost.toFixed(2)}/${r.calls} calls/${Math.round((r.ms ?? 0) / 1000)}s` : ""}`;

// ------------------------------------------------------------ TEST A (Josh)
async function testA(id: string) {
  const fx = JSON.parse(readFileSync(`${DIR}/show-${id}.json`, "utf8"));
  const bench = existsSync(`${DIR}/benchmark-${id}.json`) ? JSON.parse(readFileSync(`${DIR}/benchmark-${id}.json`, "utf8")) : null;
  const m = { ytId: fx.episode.ytId, title: fx.episode.title, description: fx.episode.description, publishedAt: fx.episode.publishedAt, transcriptText: fx.transcriptText, factSheet: fx.factSheet, onRecord: fx.onRecord, assignment: fx.focus };
  console.log(`\n=== TEST A · ${fx.episode.title} ===`);
  const rows: Row[] = [];
  const t0 = Date.now(); let cost = 0, calls = 0;
  const seg = await selectSegment(m); cost += seg.call.costUsd; calls++;
  console.log(`segment: ${seg.decision.decision} ${seg.decision.segmentStart}–${seg.decision.segmentEnd} · ${seg.decision.centralThought}`);
  if (seg.decision.decision !== "segment") { console.log("no-article:", seg.decision.reason); return; }
  const cut = await buildJoshCut(m, seg.decision); cost += cut.call.costUsd; calls++;
  const sup = await supportFacts(cut.cut, m); cost += sup.call.costUsd; calls++;
  const source = `TRANSCRIPT SEGMENT:\n${segmentText(fx.transcriptText, cut.cut.segmentStart, cut.cut.segmentEnd)}\n\nVERIFIED TEAM FACTS:\n${fx.factSheet}\n\n${fx.onRecord}`;
  console.log(`cut: ${cut.cut.blocks.length} blocks · support: ${sup.support.length} facts (${sup.support.map((s) => s.fact.slice(0, 50)).join(" | ")})`);
  rows.push(await judgeRow("A · Josh Cut only", "v3-A", cutOnlyArticle(cut.cut), source));
  rows.push(await judgeRow("B · Josh Cut + verified facts", "v3-B", cutOnlyArticle(cut.cut, sup.support), source));
  for (const [name, choice] of [["opus", modelForRole("joshProseEdit")], ["terra", oppositeOf("anthropic", "medium")]] as const) {
    const t = Date.now();
    const ed = await lightProseEdit(cut.cut, sup.support, m, choice);
    rows.push(await judgeRow(`C · light edit (${name})`, `v3-C-${name}`, ed.draft, source, { cost: cost + ed.call.costUsd, calls: calls + 1, ms: Date.now() - t }));
  }
  // The full engine (segment → cut → facts → edit → quit repair → smell), for the record.
  const full = await runJoshEngine(m, { mode: "replay", fixture: fx.id, log: (l) => console.log(`  engine: ${l}`) });
  if (full.final) rows.push(await judgeRow("C′ · full V3 engine (with quit repair)", "v3-engine", full.final, source, { cost: full.totalCostUsd, calls: full.calls.length, ms: Date.now() - t0 }));
  for (const k of fx.knownOutputs ?? []) if (/lab: terra|production pipeline \(Aug 27, rolled back\)/.test(k.label)) rows.push(await judgeRow(`${/lab/.test(k.label) ? "V1 lab (Josh: 'close')" : "V1 production"}`, "v1", { headline: k.headline, dek: k.dek, bodyMarkdown: k.bodyMarkdown, pullQuote: "", primaryTeam: "", teams: [], tags: [], seo: { title: "", description: "" } }, source));
  const v2 = existsSync(".superpowers/v2-miami-loop4.json") ? JSON.parse(readFileSync(".superpowers/v2-miami-loop4.json", "utf8"))[0] : null;
  if (v2) rows.push(await judgeRow("V2 (loop 4)", "v2", { headline: v2.headline, dek: v2.dek, bodyMarkdown: v2.bodyMarkdown, pullQuote: "", primaryTeam: "", teams: [], tags: [], seo: { title: "", description: "" } }, source));
  if (bench) rows.push(await judgeRow("D · Josh's hand edit", "josh", { headline: bench.headline, dek: bench.dek, bodyMarkdown: bench.bodyMarkdown + "\n\n— JP", pullQuote: "", primaryTeam: "", teams: [], tags: [], seo: { title: "", description: "" } }, source));
  console.log("\nRESULTS (quit-reading judge + AI-smell + fact check; identical for every draft):");
  for (const r of rows) console.log(scoreLine(r));
  const { html, key } = blindHtml(`Test A — ${fx.episode.title}`, rows, ["Which would you voluntarily keep reading?", "Which feels most like a guy who loves football?", "Where does each one first feel AI-generated?", "Which would you publish with the fewest edits?"], "One of these is Josh's own hand edit.");
  writeFileSync(`${OUT}/${stamp}-test-a-${id}.html`, html);
  writeFileSync(`${OUT}/${stamp}-test-a-${id}.key.json`, JSON.stringify({ key, rows: rows.map((r) => ({ label: r.label, system: r.system, words: r.words, finish: r.quit?.didFinish, quit: r.quit?.neverWantedToQuit ? "never" : `${r.quit?.quitParagraphIndex}:${r.quit?.reason}`, quitText: r.quit?.quitText, smell: r.smell?.pass ? "pass" : r.smell?.sentences, fact: r.fact, cost: r.cost })) }, null, 2));
  console.log(`\nblind page: ${OUT}/${stamp}-test-a-${id}.html`);
}

// ------------------------------------------------------ TEST B (reported)
async function testB(ids: string[]) {
  console.log(`\n=== TEST B · reported ===`);
  const rows: Row[] = [];
  for (const id of ids) {
    const fx = JSON.parse(readFileSync(`${DIR}/reported-${id}.json`, "utf8"));
    const t = Date.now();
    const run = await runReportedEngine({ sourceId: fx.id, sources: fx.sources, factSheet: fx.factSheet }, { mode: "replay", fixture: fx.id, log: (l) => console.log(`  ${id}: ${l}`) });
    const source = fx.sources.map((s: { text: string }) => s.text).join("\n\n") + "\n\n" + fx.factSheet;
    if (run.final) rows.push(await judgeRow(`V3 · ${id} (${fx.shape}; depth ${run.artifacts.brief?.depth})`, "v3", run.final, source, { cost: run.totalCostUsd, calls: run.calls.length, ms: Date.now() - t }));
    for (const k of fx.knownOutputs ?? []) rows.push(await judgeRow(`${k.label} · ${id}`, "v1", { headline: k.headline, dek: k.dek, bodyMarkdown: k.bodyMarkdown, pullQuote: "", primaryTeam: "", teams: [], tags: [], seo: { title: "", description: "" } }, source));
  }
  console.log("\nRESULTS:");
  for (const r of rows) console.log(scoreLine(r));
  const { html, key } = blindHtml("Test B — three reported stories", rows, ["Which would you keep reading?", "Does it sound like people who know football?", "Where does it first feel AI-generated?", "Is the length right for the news?"], "Each source appears more than once (V3 and the site's V1 outputs).");
  writeFileSync(`${OUT}/${stamp}-test-b.html`, html);
  writeFileSync(`${OUT}/${stamp}-test-b.key.json`, JSON.stringify({ key, rows: rows.map((r) => ({ label: r.label, system: r.system, words: r.words, finish: r.quit?.didFinish, quit: r.quit?.neverWantedToQuit ? "never" : `${r.quit?.quitParagraphIndex}:${r.quit?.reason}`, smell: r.smell?.pass ? "pass" : r.smell?.sentences, fact: r.fact, cost: r.cost })) }, null, 2));
  console.log(`\nblind page: ${OUT}/${stamp}-test-b.html`);
}

if (arg("--josh-engine")) {
  const fx = JSON.parse(readFileSync(`${DIR}/show-${arg("--josh-engine")}.json`, "utf8"));
  const m = { ytId: fx.episode.ytId, title: fx.episode.title, description: fx.episode.description, publishedAt: fx.episode.publishedAt, transcriptText: fx.transcriptText, factSheet: fx.factSheet, onRecord: fx.onRecord, assignment: fx.focus };
  const run = await runJoshEngine(m, { mode: "replay", fixture: fx.id });
  if (run.final) {
    console.log(`\n${run.status} · ${run.words} words · ${run.calls.length} calls · ${run.totalCostUsd} · quit ${run.artifacts.quit?.neverWantedToQuit ? "never" : `¶${run.artifacts.quit?.quitParagraphIndex} ${run.artifacts.quit?.reason}`} · smell ${run.artifacts.smell?.pass ? "PASS" : run.artifacts.smell?.sentences.join(" | ")} · fact ${run.artifacts.fact?.verdict} · policy ${run.artifacts.policy?.pass ? "pass" : run.artifacts.policy?.violations.join("; ")}`);
    console.log(`\n# ${run.final.headline}\n${run.final.dek}\n\n${run.final.bodyMarkdown}`);
    writeFileSync(".superpowers/v3-josh-engine-latest.json", JSON.stringify([{ lane: "show", label: "Editorial Engine V3 · Josh Cut + facts + light edit + tightening pass · unpublished", episode: fx.episode.title, ytId: fx.episode.ytId, ...run.final }], null, 2));
  } else console.log(run.status, run.error ?? run.artifacts.segment?.reason);
}
else if (FIX === "miami") await testA("miami-acc");
else if (FIX === "reported-sample") await testB(["fsu-edge-visit", "alabama-beaman-acl", "castellanos-texas-tech"]);
else if (existsSync(`${DIR}/show-${FIX}.json`)) await testA(FIX);
else if (existsSync(`${DIR}/reported-${FIX}.json`)) await testB([FIX]);
else { console.error("unknown fixture"); process.exit(1); }
