// Six-piece review pack for Josh (2026-08-28): four Josh columns from Engine
// A (one segment per episode) and two desk pieces from Engine B. Publishes
// nothing; writes JSON + a reader page under docs/review/v3-pack/.
//   npx tsx scripts/editorial-v3-pack.mts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
for (const l of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim(); }
process.env.EDITORIAL_V3_ENABLED ??= "true";
const { runJoshEngine } = await import("../lib/editorial-v3/josh-engine.ts");
const { runReportedEngine } = await import("../lib/editorial-v3/reported-engine.ts");
const { rosterNames } = await import("../lib/editorial-v3/roster.ts");
type Run = import("../lib/editorial-v3/v3-types.ts").V3Run;

const argv = process.argv; const argOf = (k: string) => { const i = argv.indexOf(k); return i !== -1 ? argv[i + 1] : undefined; };
const DIR = "fixtures/editorial-replay"; const OUT = "docs/review/v3-pack"; mkdirSync(OUT, { recursive: true });
const SHOW = ["miami-acc", "portal-on-fire", "truth-2026", "boldest-2026", "final-predictions"];
const ORDER = ["miami-acc", "final-predictions", "truth-2026", "portal-on-fire", "brewster-texas-tech", "sec-pro-penalties"];
const REPORTED = (argOf("--reported") ?? "brewster-texas-tech,sec-pro-penalties").split(",");
const PAGE = argOf("--page") ?? "six-for-josh"; const TITLE = argOf("--title") ?? "Six for Josh";
const APPEND = argv.includes("--append"); const SKIP_SHOW = argv.includes("--no-show"); const ONLY = argOf("--only"); const ASSIGN = argOf("--assignment");
const pack: { id: string; engine: string; episode?: string; run: Run }[] = APPEND && existsSync(`${OUT}/${PAGE}.json`) ? JSON.parse(readFileSync(`${OUT}/${PAGE}.json`, "utf8")) : [];

import { existsSync } from "node:fs";
if (!APPEND && !SKIP_SHOW && existsSync(".superpowers/v3-miami-tightened.json")) {
  const d = JSON.parse(readFileSync(".superpowers/v3-miami-tightened.json", "utf8"))[0];
  const runs = readFileSync(".superpowers/v3-josh-engine-latest.json", "utf8");
  void runs;
  pack.push({ id: "miami-acc", engine: "josh", episode: d.episode, run: { id: "reviewed", engine: "josh", sourceId: d.ytId, mode: "replay", status: "completed", startedAt: "", artifacts: { segment: { decision: "segment", segmentStart: "02:06", segmentEnd: "03:51", reason: "" }, quit: { neverWantedToQuit: true, reason: "none", didFinish: true, soundsLikeFootballPerson: true, worthTheTime: false, wouldClickAnother: true, wouldSend: false, note: "" }, smell: { pass: true, sentences: [], structural: false, note: "" }, fact: { verdict: "pass", claims: [], joshMisattribution: [] } }, final: d, words: d.bodyMarkdown.replace(/\[[^\]]*\]/g, " ").split(/\s+/).filter(Boolean).length - 2, calls: new Array(8).fill({ stage: "", role: "", vendor: "openai", model: "", inputTokens: 0, outputTokens: 0, costUsd: 0.038, ms: 0 }), totalCostUsd: 0.3 } as unknown as Run });
}
for (const id of SKIP_SHOW ? [] : ONLY ? [ONLY] : SHOW) {
  if (id === "miami-acc" && pack.some((p) => p.id === "miami-acc")) continue;
  if (!ONLY && pack.filter((p) => p.engine === "josh").length >= 4) break;
  const fx = JSON.parse(readFileSync(`${DIR}/show-${id}.json`, "utf8"));
  const names = await rosterNames(fx.teams ?? []).catch(() => "");
  const run = await runJoshEngine({ ytId: fx.episode.ytId, title: fx.episode.title, description: fx.episode.description, publishedAt: fx.episode.publishedAt, transcriptText: fx.transcriptText, factSheet: fx.factSheet, onRecord: fx.onRecord, assignment: ASSIGN ?? fx.focus, rosterNames: names }, { mode: "replay", fixture: fx.id, log: (l) => console.log(`  ${id}: ${l}`) });
  if (run.status === "completed" && run.final) pack.push({ id, engine: "josh", episode: fx.episode.title, run });
  else console.log(`  ${id}: ${run.status} — ${run.error ?? run.artifacts.segment?.reason ?? ""}`);
}
for (const id of ONLY ? [] : REPORTED) {
  const fx = JSON.parse(readFileSync(`${DIR}/reported-${id}.json`, "utf8"));
  const run = await runReportedEngine({ sourceId: fx.id, sources: fx.sources, factSheet: fx.factSheet }, { mode: "replay", fixture: fx.id, log: (l) => console.log(`  ${id}: ${l}`) });
  if (run.status === "completed" && run.final) pack.push({ id, engine: "reported", run });
}
pack.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
writeFileSync(`${OUT}/${PAGE}.json`, JSON.stringify(pack, null, 2));

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const para = (body: string) => body.replace(/\[EMBED:[^\]]*\]\s*|\[PULLQUOTE\]\s*/g, "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => p.startsWith("## ") ? `<h3>${esc(p.slice(3))}</h3>` : /^—\s*JP$/.test(p) ? `<p class="sig">— JP</p>` : `<p>${esc(p).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")}</p>`).join("\n");
const html = `<title>${esc(TITLE)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=Barlow+Condensed:wght@600;700&display=swap">
<style>
:root{--bg:#FAFAF7;--ink:#1A1D21;--mute:#6B7178;--rule:#DCDDD6;--card:#fff;--acc:#1E6B47;--josh:#6B4A9A}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#15181C;--ink:#ECEDE8;--mute:#9AA0A6;--rule:#2D3238;--card:#1E2227;--acc:#5CC08E;--josh:#B79AE0}}
:root[data-theme="dark"]{--bg:#15181C;--ink:#ECEDE8;--mute:#9AA0A6;--rule:#2D3238;--card:#1E2227;--acc:#5CC08E;--josh:#B79AE0}
body{margin:0;background:var(--bg);color:var(--ink);font:18px/1.6 "Source Serif 4",Georgia,serif}
.wrap{max-width:720px;margin:0 auto;padding:40px 22px 90px}
h1{font:700 44px/1 "Barlow Condensed","Arial Narrow",sans-serif;margin:0 0 6px;letter-spacing:.01em}
.lede{color:var(--mute);font:15px/1.5 "Helvetica Neue",Arial,sans-serif;max-width:60ch}
nav{margin:26px 0 8px;font:14px/1.7 "Helvetica Neue",Arial,sans-serif}
nav a{color:var(--ink);text-decoration:none;border-bottom:1px solid var(--rule)}
article{border-top:3px solid var(--acc);margin-top:56px;padding-top:14px}
article.josh{border-top-color:var(--josh)}
.tag{font:600 12px/1 "Helvetica Neue",Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--acc)}
article.josh .tag{color:var(--josh)}
h2{font:700 30px/1.1 "Barlow Condensed","Arial Narrow",sans-serif;margin:10px 0 8px}
.dek{color:var(--mute);font-style:italic;margin:0 0 16px}
h3{font:700 20px/1.2 "Barlow Condensed",sans-serif;margin:24px 0 4px}
.sig{font-weight:600}
.meta{font:13px/1.5 "Helvetica Neue",Arial,sans-serif;color:var(--mute);border-top:1px solid var(--rule);margin-top:18px;padding-top:8px}
</style>
<div class="wrap">
<h1>${esc(TITLE)}</h1>
<p class="lede">${argv.includes("--no-show") ? "Editorial Engine V3, Aug 28. Desk pieces written from today's outlet reporting: a reporting pack, a fan brief that decides how much story there is, one writer on the desk voice, a subtraction editor, the reader tests. Third person, no imitation of anyone. None is published." : "Editorial Engine V3, Aug 28. Four are your own segments edited down (your words, your order; verified facts folded in; a tightening pass; nothing invented). Two are desk pieces written from outlet reporting. None is published. Read them as a reader; the numbers underneath are just what the machine's reader test said."}</p>
<nav>${pack.map((p, i) => `<a href="#a${i}">${i + 1}. ${esc(p.run.final!.headline)}</a><br>`).join("")}</nav>
${pack.map((p, i) => { const r = p.run; const q = r.artifacts.quit; return `<article id="a${i}" class="${p.engine}"><div class="tag">${p.engine === "josh" ? "Josh's Read · from the show" : "The desk · reported"} · ${r.words} words</div><h2>${esc(r.final!.headline)}</h2>${r.final!.dek ? `<p class="dek">${esc(r.final!.dek)}</p>` : ""}${para(r.final!.bodyMarkdown)}<p class="meta">${p.episode ? `Source: ${esc(p.episode)}${r.artifacts.segment?.segmentStart ? ` · segment ${esc(r.artifacts.segment.segmentStart)}–${esc(r.artifacts.segment.segmentEnd ?? "")}` : ""}` : `Source: outlet reporting (${esc(p.id)})${r.artifacts.brief ? ` · depth: ${r.artifacts.brief.depth}` : ""}`} · reader test: ${q?.neverWantedToQuit ? "never wanted to quit" : `would skim at ¶${q?.quitParagraphIndex} (${q?.reason})`}, ${q?.worthTheTime ? "worth the time" : "not worth the time"} · AI smell ${r.artifacts.smell?.pass ? "pass" : `${r.artifacts.smell?.sentences.length} flagged`} · facts ${r.artifacts.fact?.verdict} · ${r.calls.length} calls, $${r.totalCostUsd.toFixed(2)}</p></article>`; }).join("\n")}
</div>`;
writeFileSync(`${OUT}/${PAGE}.html`, html);
console.log(`\nPACK (${pack.length}):`);
for (const p of pack) { const q = p.run.artifacts.quit; console.log(`${p.engine.padEnd(8)} ${p.id.padEnd(22)} ${String(p.run.words).padStart(4)}w · quit ${q?.neverWantedToQuit ? "never" : `¶${q?.quitParagraphIndex} ${q?.reason}`} · worth ${q?.worthTheTime} · smell ${p.run.artifacts.smell?.pass ? "PASS" : p.run.artifacts.smell?.sentences.length} · fact ${p.run.artifacts.fact?.verdict} · $${p.run.totalCostUsd} · ${p.run.final!.headline}`); }
console.log(`wrote ${OUT}/${PAGE}.html`);
