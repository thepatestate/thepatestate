// Editorial Engine V2 — Phase 0: freeze the replay set (brief §25 Phase 0,
// §26). Pulls the live inputs the V1 pipeline would receive for a known set
// of episodes, standalones and Wire items, and writes them as JSON fixtures
// so V1 and V2 can be replayed from identical material, offline. Also
// records the V1 outputs we already have for those inputs, with their
// scores, as the baseline.
//
// Run once (needs .env.local):  npx tsx scripts/editorial-freeze-fixtures.mts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
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

const { writeClient } = await import("../lib/sanity.ts");
const { fetchTranscript, transcriptToPromptText } = await import("../lib/transcript.ts");
const { extractQuotes } = await import("../lib/generate.ts");
const { teamFactSheet } = await import("../lib/fact-sheet.ts");
const { createAdminClient, isAdminConfigured } = await import("../lib/supabase/admin.ts");
const { JOSH_BRACKET_FIELD, JOSH_BRACKET_FINAL, JOSH_BRACKET_LABEL } = await import("../lib/josh-bracket.ts");
type ShowFixture = import("../lib/editorial-v2/types.ts").ShowFixture;
type KnownOutput = import("../lib/editorial-v2/types.ts").KnownOutput;

const OUT = "fixtures/editorial-replay";
mkdirSync(OUT, { recursive: true });
const db = isAdminConfigured ? createAdminClient() : null;

// --- the show replay set ------------------------------------------------
// shape: argument episodes (V1 reached 7–7.8) and list episodes (5–6).
const SHOW: { id: string; yt: string; shape: "argument" | "list"; note: string }[] = [
  { id: "miami-acc", yt: "fx52TLhd8Cs", shape: "argument", note: "Why EVERYONE Is Wrong About The 2026 Season — the Miami/ACC segment. V1 lab reached 7.8; production 5.5. Josh's hand edit of the 7.8 draft is the hidden benchmark." },
  { id: "portal-on-fire", yt: "nSmIs0OL16s", shape: "argument", note: "Transfer Portal On Fire / Big Ten & SEC ban NFL players. V1 lab 7.0." },
  { id: "truth-2026", yt: "GnsM0vg8rko", shape: "list", note: "The TRUTH About The 2026 Season — five takes. Plain kit-v4 production draft scored 5." },
  { id: "boldest-2026", yt: "g6qRL024YoA", shape: "list", note: "Boldest CFB Predictions — listener predictions rated. Production 4–5.5." },
  { id: "final-predictions", yt: "3f58dSytoSA", shape: "list", note: "Final 2026 CFP & conference title predictions — a list product by design." },
  { id: "top-10-games", yt: "seRM0BbQgVM", shape: "list", note: "Biggest games of the season, top 10 — list-shaped." },
];

// Known V1 outputs for those episodes, from the review/lab runs (scores are
// the legacy fanScore: mean of legibility and enjoyment).
const KNOWN: { file: string; yt: string; label: string; system: string }[] = [
  { file: ".superpowers/kit4-lab-a.json", yt: "fx52TLhd8Cs", label: "voice lab: terra + Opus edit (Josh: 'close')", system: "v1-lab" },
  { file: ".superpowers/voice-lab-3.json", yt: "fx52TLhd8Cs", label: "voice lab: opus", system: "v1-lab" },
  { file: ".superpowers/column-preview-v42-wrong2.json", yt: "fx52TLhd8Cs", label: "production pipeline (Aug 27, rolled back)", system: "v1-pipeline" },
  { file: ".superpowers/kit4-lab-b.json", yt: "nSmIs0OL16s", label: "voice lab: terra", system: "v1-lab" },
  { file: ".superpowers/kit4-show.json", yt: "GnsM0vg8rko", label: "kit v4 plain production draft", system: "v1" },
  { file: ".superpowers/column-preview-v42-bold.json", yt: "g6qRL024YoA", label: "production pipeline (Aug 27, rolled back)", system: "v1-pipeline" },
  { file: ".superpowers/column-preview-v42.json", yt: "g6qRL024YoA", label: "production pipeline, first run", system: "v1-pipeline" },
];

const secondsToTs = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

for (const s of SHOW) {
  const ep = await writeClient.fetch<{ title: string; description?: string; publishedAt: string; series?: string } | null>(
    `*[_type=="episode" && ytId==$yt][0]{title, description, publishedAt, series}`, { yt: s.yt });
  if (!ep) { console.warn(`skip ${s.id}: episode ${s.yt} not in Sanity`); continue; }
  const segs = await fetchTranscript(s.yt);
  const transcriptText = segs ? transcriptToPromptText(segs) : null;
  if (!transcriptText) { console.warn(`skip ${s.id}: no transcript`); continue; }
  let quotes: { quote: string; timestamp: string; topic: string; teams: string[]; heat: number }[] = [];
  if (db) {
    const { data } = await db.from("josh_quotes").select("quote, ts_seconds, topic, teams, heat").eq("yt_id", s.yt).order("heat", { ascending: false }).limit(12);
    quotes = (data ?? []).map((q) => ({ quote: q.quote, timestamp: secondsToTs(q.ts_seconds), topic: q.topic, teams: q.teams, heat: q.heat }));
  }
  if (quotes.length === 0) quotes = await extractQuotes(transcriptText);
  const teams = [...new Set(quotes.flatMap((q) => q.teams))];
  const factSheet = await teamFactSheet(teams).catch(() => "");
  const known: KnownOutput[] = [];
  for (const k of KNOWN.filter((k) => k.yt === s.yt)) {
    if (!existsSync(k.file)) continue;
    const arr = JSON.parse(readFileSync(k.file, "utf8")); const d = Array.isArray(arr) ? arr[0] : arr;
    if (!d?.bodyMarkdown) continue;
    known.push({ label: k.label, system: k.system, headline: d.headline, dek: d.dek, bodyMarkdown: d.bodyMarkdown, pullQuote: d.pullQuote ?? "", legacyFan: d.fan ? { score: d.fan.score, legibility: d.fan.legibility, enjoyment: d.fan.enjoyment, joshVoice: d.fan.joshVoice, notes: d.fan.notes } : undefined, legacyVoice: d.voice ? { score: d.voice.score, notes: d.voice.notes } : undefined });
  }
  const fx: ShowFixture = {
    id: s.id, lane: "show", shape: s.shape, note: s.note, frozenAt: new Date().toISOString(),
    episode: { ytId: s.yt, title: ep.title, description: ep.description ?? "", publishedAt: ep.publishedAt, series: ep.series ?? "general" },
    transcriptText, quotes, teams, factSheet,
    onRecord: `ON-RECORD SITE POSITIONS (never contradict silently): ${JOSH_BRACKET_LABEL} — field: ${JOSH_BRACKET_FIELD.map((t) => `${t.seed} ${t.name}`).join(", ")}; final on record: ${JOSH_BRACKET_FINAL}.`,
    knownOutputs: known,
    traps: [],
  };
  writeFileSync(`${OUT}/show-${s.id}.json`, JSON.stringify(fx, null, 2));
  console.log(`show-${s.id}: transcript ${transcriptText.length} chars · ${quotes.length} quotes · ${teams.length} teams · fact sheet ${factSheet.length} chars · ${known.length} known outputs`);
}

// --- the hidden Miami benchmark (Josh's own edit; judges/humans only) -----
const drop = ".superpowers/drops/kit-v4.2-2026-08-27/reference-builds/article-miami-acc-favorite-v2.html";
if (existsSync(drop)) {
  const html = readFileSync(drop, "utf8");
  const m = html.match(/<div class="a-body">([\s\S]*?)<div class="a-pb">/);
  const body = (m ? m[1] : "").replace(/<a class="a-ep"[\s\S]*?<\/a>/g, "").replace(/<div class="(receipt|pulse)"[\s\S]*?<\/div>\s*<\/div>/g, "").replace(/<h2>/g, "\n\n## ").replace(/<\/h2>/g, "\n").replace(/<p>/g, "\n").replace(/<[^>]+>/g, "").replace(/&rsquo;/g, "’").replace(/&amp;/g, "&").replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”").replace(/\n{3,}/g, "\n\n").trim();
  const hl = html.match(/<h1 class="a-hl">([\s\S]*?)<\/h1>/)?.[1] ?? "";
  const dek = html.match(/<p class="a-dek">([\s\S]*?)<\/p>/)?.[1] ?? "";
  writeFileSync(`${OUT}/benchmark-miami-acc.json`, JSON.stringify({ fixture: "miami-acc", label: "Josh's own edit of the 7.8 draft (kit v4.2 second approved build) — HIDDEN from generation; judges and humans only", headline: hl, dek, bodyMarkdown: body, sourceId: "article-miami-acc-favorite-v2" }, null, 2));
  console.log("benchmark-miami-acc written");
}

// --- fact traps for the Miami fixture (brief §26.5) ------------------------
// A copy of the Miami fixture with four seeded traps; the final fact gate
// must catch each. The traps live in the fact sheet and transcript, where
// the writer would meet them.
const miamiPath = `${OUT}/show-miami-acc.json`;
if (existsSync(miamiPath)) {
  const fx = JSON.parse(readFileSync(miamiPath, "utf8")) as ShowFixture;
  const trapped: ShowFixture = { ...fx, id: "miami-acc-traps", note: `${fx.note} FACT-TRAP VARIANT: four seeded errors the final fact gate must catch.`, knownOutputs: [] };
  trapped.factSheet = `${fx.factSheet}\n\nSEEDED TRAP (unsupported stat): Miami returned 91 percent of its offensive production from 2025.\nSEEDED TRAP (outdated date): Miami at Clemson is on November 14.`;
  trapped.transcriptText = fx.transcriptText.replace(/Mensah/g, "Mensa");
  trapped.traps = [
    { kind: "unsupported-stat", text: "Miami returned 91 percent of its offensive production from 2025", mustNotAppearAsFact: true },
    { kind: "outdated-date", text: "Miami at Clemson is on November 14", mustNotAppearAsFact: true },
    { kind: "asr-misspelling", text: "Mensa", mustNotAppearAsFact: true },
    { kind: "unstated-josh-inference", text: "Josh said Miami will win the national championship", mustNotAppearAsFact: true },
  ];
  writeFileSync(`${OUT}/show-miami-acc-traps.json`, JSON.stringify(trapped, null, 2));
  console.log("show-miami-acc-traps written");
}

// --- representative standalones + Wire items (frozen for Phases 3–4) -------
try {
  const stories = await writeClient.fetch<any[]>(`*[_type == "wireStory" && defined(whyBody)] | order(publishedAt desc)[0...6]{ _id, headline, deck, whatHappened, whyBody, missing, section04Body, readBody, teams, category, publishedAt }`);
  writeFileSync(`${OUT}/standalone-recent-coverage.json`, JSON.stringify({ id: "standalone-recent-coverage", lane: "standalone", frozenAt: new Date().toISOString(), note: "72h-style coverage window frozen for Phase 3 replay (selection + dossier candidates).", stories }, null, 2));
  console.log(`standalone-recent-coverage: ${stories.length} stories`);
  if (db) {
    const { data: clusters } = await db.from("wire_clusters").select("cluster_key, title, source_urls, source_outlets, source_text, importance, story_id, created_at").not("source_text", "is", null).order("created_at", { ascending: false }).limit(40);
    const rows = (clusters ?? []).map((c) => ({ ...c, chars: (c.source_text ?? "").length })).sort((a, b) => a.chars - b.chars);
    const pick = [rows[0], rows[Math.floor(rows.length / 2)], rows[rows.length - 1]].filter(Boolean);
    writeFileSync(`${OUT}/wire-items.json`, JSON.stringify({ id: "wire-items", lane: "wire", frozenAt: new Date().toISOString(), note: "Thin, medium and long Wire sources for Phase 4 depth classification (item-only / brief / developed).", items: pick }, null, 2));
    console.log(`wire-items: ${pick.map((p) => p.chars).join(", ")} chars`);
  }
} catch (err) { console.warn("standalone/wire freeze failed", err instanceof Error ? err.message : err); }
console.log("done");
