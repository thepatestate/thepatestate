// Review pack: writes N pieces through the LIVE pipelines and every gate
// under the current kit, publishes NOTHING, and saves them as JSON for a
// review page. Wire stories from real recent clusters, show-derived columns
// from real episodes, house analysis from the long-form selector.
//
// Run:  npx tsx scripts/review-pack.mts [--wire 6] [--show 3] [--house 3] [--out path]
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

function loadDotEnvLocal() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (key && !(key in process.env)) process.env[key] = line.slice(eq + 1).trim();
  }
}
loadDotEnvLocal();

const arg = (name: string, dflt: number) => { const i = process.argv.indexOf(`--${name}`); return i !== -1 ? Number(process.argv[i + 1]) : dflt; };
const WIRE = arg("wire", 6), SHOW = arg("show", 3), HOUSE = arg("house", 3);
const outArg = process.argv.indexOf("--out");
const OUT = outArg !== -1 ? process.argv[outArg + 1] : join(process.cwd(), ".superpowers", `review-pack-${new Date().toISOString().slice(0, 10)}.json`);

const APPEND = process.argv.includes("--append");
// Loop variants (2026-08-26): --lean drops the kit documents from the
// writer prompt; --provider anthropic|openai and --model pick the writer.
if (process.argv.includes("--lean")) process.env.EDITORIAL_LEAN = "1";
const provArg = process.argv.indexOf("--provider");
if (provArg !== -1) process.env.WRITER_PROVIDER = process.argv[provArg + 1];
const modelArg = process.argv.indexOf("--model");
if (modelArg !== -1) { process.env.ANTHROPIC_WRITER_MODEL = process.argv[modelArg + 1]; process.env.OPENAI_WRITER_MODEL = process.argv[modelArg + 1]; }
const { default: Anthropic } = await import("@anthropic-ai/sdk");
const { writeClient } = await import("../lib/sanity.ts");
const { generateWireStory, fetchSourceText, titleKeywords, isThinSource } = await import("../lib/wire.ts");
const { createAdminClient, isAdminConfigured } = await import("../lib/supabase/admin.ts");
const { getVideos, isEpisode } = await import("../lib/youtube.ts");
const { fetchTranscript, transcriptToPromptText } = await import("../lib/transcript.ts");
const { draftCompanion, extractQuotes, classifySeries } = await import("../lib/generate.ts");
const { pickArchitecture, boilerplateViolations } = await import("../lib/editorial.ts");
const { draftLongformArticle } = await import("../lib/longform.ts");
const { fanScore, voiceMatch } = await import("../lib/editorial.ts");
const SCORE = !process.argv.includes("--no-score");

/** The reader's judge + the voice judge on a finished piece (Isaac,
 * 2026-08-26: iterate until fan legibility and enjoyment average 8.5). */
async function judge(piece: Record<string, any>) {
  if (!SCORE) return;
  const body = piece.lane === "wire"
    ? [piece.whatHappened, piece.whyBody, piece.missing, piece.section04Body, piece.chessboard, piece.readBody, ...(piece.watching ?? []).map((w: any) => `${w.title} ${w.body}`)].filter(Boolean).join("\n\n")
    : String(piece.bodyMarkdown ?? "");
  const [fan, voice] = await Promise.all([
    fanScore(anthropic, { headline: String(piece.headline), dek: String(piece.dek ?? piece.deck ?? ""), body }),
    voiceMatch(anthropic, { lane: "feature", draft: body }),
  ]);
  piece.fan = fan;
  piece.voice = { score: voice.score, notes: voice.notes };
  console.log(`   fan ${fan.score} (legibility ${fan.legibility} · enjoyment ${fan.enjoyment} · josh ${fan.joshVoice}) · voice ${voice.score}\n   ${fan.notes.replace(/\n/g, " ").slice(0, 600)}`);
}

const anthropic = new Anthropic();
const db = isAdminConfigured ? createAdminClient() : null;
const replaceArg = process.argv.indexOf("--replace-lane");
const REPLACE = replaceArg !== -1 ? process.argv[replaceArg + 1] : null;
const pack: Record<string, unknown>[] = (APPEND && existsSync(OUT) ? (JSON.parse(readFileSync(OUT, "utf8")) as Record<string, unknown>[]) : []).filter((p) => p.lane !== REPLACE);
const already = new Set(pack.map((p) => String(p.sourceItem ?? p.episode ?? p.headline)));
const save = () => { mkdirSync(join(process.cwd(), ".superpowers"), { recursive: true }); writeFileSync(OUT, JSON.stringify(pack, null, 2)); };

// ---- Wire ------------------------------------------------------------------
interface Item { _id: string; headline: string; sub?: string; category?: string; teams?: string[]; sourceUrls?: string[]; sourceOutlets?: string[]; publishedAt?: string }
const items = await writeClient.fetch<Item[]>(
  `*[_type == "wireItem"] | order(publishedAt desc)[0...90]{ _id, headline, sub, category, teams, sourceUrls, sourceOutlets, publishedAt }`,
);
const usedCategories: Record<string, number> = {};
for (const p of pack) if (p.lane === "wire") usedCategories[String(p.category ?? "general")] = (usedCategories[String(p.category ?? "general")] ?? 0) + 1;
let wireDone = 0;
for (const item of items) {
  if (wireDone >= WIRE) break;
  if (already.has(item.headline)) continue;
  // Spread across categories so the pack shows range.
  if ((usedCategories[item.category ?? "general"] ?? 0) >= 2) continue;
  const outlets = item.sourceOutlets?.length ? item.sourceOutlets : ["the original report"];
  const urls = item.sourceUrls ?? [];
  const texts = await Promise.all(urls.slice(0, 2).map(fetchSourceText));
  if (!texts.some(Boolean) && db) {
    const { data: cl } = await db.from("wire_clusters").select("source_text").eq("item_id", item._id).maybeSingle();
    if (cl?.source_text) texts[0] = cl.source_text;
  }
  const sourceBlock = outlets
    .map((o, i) => `- [${o}] ${item.headline}\n  ${texts[i] || texts[0] || item.sub || ""}\n  ${urls[i] ?? urls[0] ?? ""}`)
    .join("\n");
  if (isThinSource(sourceBlock)) { console.log(`skip (thin)      ${item.headline.slice(0, 60)}`); continue; }
  const t0 = Date.now();
  const gen = await generateWireStory(anthropic, {
    sourceBlock, outlets,
    sources: outlets.map((o, i) => ({ outlet: o, url: urls[i] ?? urls[0] ?? "" })),
    clusterKey: item._id.replace(/^wireItem-/, ""),
    teams: item.teams ?? [],
    receiptKeywords: [...titleKeywords(item.headline)],
    itemId: item._id,
  });
  if (!gen.ok) { console.log(`HOLD (${gen.reason.split(":")[0]})  ${item.headline.slice(0, 60)}`); continue; }
  usedCategories[item.category ?? "general"] = (usedCategories[item.category ?? "general"] ?? 0) + 1;
  wireDone++;
  const piece: Record<string, any> = { lane: "wire", label: "The Wire", sourceItem: item.headline, category: item.category, outlets, seconds: Math.round((Date.now() - t0) / 1000), ...gen.fields };
  console.log(`OK wire ${wireDone}/${WIRE}   ${(gen.fields.headline as string).slice(0, 70)}`);
  await judge(piece);
  pack.push(piece);
  save();
}

// ---- Show-derived columns ----------------------------------------------------
const videos = (await getVideos().catch(() => [])).filter(isEpisode).slice(0, 8);
let showDone = 0;
for (const [i, v] of videos.entries()) {
  if (showDone >= SHOW) break;
  if (already.has(v.title)) continue;
  const segs = await fetchTranscript(v.id).catch(() => null);
  const transcriptText = segs ? transcriptToPromptText(segs) : null;
  if (!transcriptText) { console.log(`skip (no transcript) ${v.title.slice(0, 60)}`); continue; }
  const [series, quotes] = await Promise.all([
    classifySeries({ title: v.title, description: v.description ?? "", publishedAt: v.published }),
    extractQuotes(transcriptText),
  ]);
  const t0 = Date.now();
  const draft = await draftCompanion({
    title: v.title, description: v.description ?? "", publishedAt: v.published, series,
    transcriptText, extractedQuotes: quotes, architecture: pickArchitecture([], i),
  });
  if (!draft || draft.lowConfidence) { console.log(`HOLD (quote gate)  ${v.title.slice(0, 60)}`); continue; }
  showDone++;
  const piece: Record<string, any> = { lane: "show", label: "Show-derived column · Josh Pate", episode: v.title, ytId: v.id, series, seconds: Math.round((Date.now() - t0) / 1000), gates: boilerplateViolations(draft.bodyMarkdown), ...draft };
  console.log(`OK show ${showDone}/${SHOW}   ${draft.headline.slice(0, 70)}`);
  await judge(piece);
  pack.push(piece);
  save();
}

// ---- House analysis ------------------------------------------------------------
const avoid: string[] = pack.filter((p) => p.lane === "house").map((p) => String(p.headline));
for (let n = 0; n < HOUSE * 2 && pack.filter((p) => p.lane === "house").length < HOUSE; n++) {
  const t0 = Date.now();
  const out = await draftLongformArticle({ avoidHeadlines: avoid });
  if ("error" in out) { console.log(`HOLD (${out.error})  house analysis attempt ${n + 1}`); continue; }
  avoid.push(out.draft.headline);
  const piece: Record<string, any> = { lane: "house", label: `Josh's Read · ${out.draft.typeId}`, seconds: Math.round((Date.now() - t0) / 1000), gates: boilerplateViolations(out.draft.bodyMarkdown), ...out.draft };
  console.log(`OK house ${pack.filter((p) => p.lane === "house").length + 1}/${HOUSE}   ${out.draft.headline.slice(0, 70)}`);
  await judge(piece);
  pack.push(piece);
  save();
}

save();
const scored = pack.filter((p) => p.fan);
if (scored.length) {
  const avg = (k: string) => (scored.reduce((s, p) => s + (p.fan as any)[k], 0) / scored.length).toFixed(2);
  console.log(`\nFAN AVERAGE over ${scored.length}: score ${avg("score")} · legibility ${avg("legibility")} · enjoyment ${avg("enjoyment")} · josh ${avg("joshVoice")} · voice-match ${(scored.reduce((s, p) => s + (p.voice as any).score, 0) / scored.length).toFixed(2)}`);
}
console.log(`variant: ${process.env.EDITORIAL_LEAN === "1" ? "lean" : "full"} prompt · writer ${process.env.WRITER_PROVIDER ?? "openai"}${process.env.ANTHROPIC_WRITER_MODEL || process.env.OPENAI_WRITER_MODEL ? ` (${process.env.ANTHROPIC_WRITER_MODEL ?? process.env.OPENAI_WRITER_MODEL})` : ""}`);
console.log(`\ndone: ${pack.length} pieces → ${OUT}`);
