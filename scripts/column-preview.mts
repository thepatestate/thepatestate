// Draft ONE Josh's Read column from an episode through the PRODUCTION path
// (lib/generate.ts draftCompanion → lib/column-pipeline.ts: plan → best-of-N
// → line edit) and print it. Publishes nothing. Writes the review-pack JSON
// shape so scripts/render-column.mts can drop it into the gold-standard chrome.
//
// Run:  npx tsx scripts/column-preview.mts [--episode "<title fragment>"] [--out path]
//       npx tsx scripts/render-column.mts <out.json> docs/review/<name>.html
import { readFileSync, existsSync, writeFileSync } from "node:fs";
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

const epArg = process.argv.indexOf("--episode"); const EPISODE = epArg !== -1 ? process.argv[epArg + 1].toLowerCase() : "";
const outArg = process.argv.indexOf("--out"); const OUT = outArg !== -1 ? process.argv[outArg + 1] : ".superpowers/column-preview.json";

const { default: Anthropic } = await import("@anthropic-ai/sdk");
const { getVideos, isEpisode } = await import("../lib/youtube.ts");
const { fetchTranscript, transcriptToPromptText } = await import("../lib/transcript.ts");
const { extractQuotes, classifySeries, draftCompanion } = await import("../lib/generate.ts");
const { boilerplateViolations, fanScore, voiceMatch, proseWords, kickerBudget } = await import("../lib/editorial.ts");
const { teamFactSheet } = await import("../lib/fact-sheet.ts");

const episodes = (await getVideos()).filter(isEpisode);
const v = EPISODE ? episodes.find((x) => x.title.toLowerCase().includes(EPISODE)) : episodes[0];
if (!v) { console.error("episode not found"); process.exit(1); }
const segs = await fetchTranscript(v.id);
const transcriptText = segs ? transcriptToPromptText(segs) : null;
const [series, quotes] = await Promise.all([
  classifySeries({ title: v.title, description: v.description ?? "", publishedAt: v.published }),
  transcriptText ? extractQuotes(transcriptText) : Promise.resolve([]),
]);
const factSheet = await teamFactSheet(quotes.flatMap((q) => q.teams)).catch(() => "");
console.log(`episode: ${v.title} (${v.id})\n${quotes.length} quotes · fact sheet ${factSheet.length} chars · transcript ${transcriptText?.length ?? 0} chars\n`);

const t0 = Date.now();
const draft = await draftCompanion({
  title: v.title, description: v.description ?? "", publishedAt: v.published,
  series: series ?? "general", transcriptText, extractedQuotes: quotes, factSheet,
});
if (!draft) { console.error("no draft"); process.exit(1); }
console.log(`\ndrafted in ${Math.round((Date.now() - t0) / 1000)}s · ${proseWords(draft.bodyMarkdown)} words · kickers ${kickerBudget(draft.bodyMarkdown).kickers.length}/${kickerBudget(draft.bodyMarkdown).allowed} · gates: ${boilerplateViolations(draft.bodyMarkdown).join("; ") || "clean"}${draft.lowConfidence ? " · LOW CONFIDENCE" : ""}`);

const anthropic = new Anthropic();
const [fan, voice] = await Promise.all([
  fanScore(anthropic, { headline: draft.headline, dek: draft.dek, body: draft.bodyMarkdown }),
  voiceMatch(anthropic, { lane: "feature", draft: draft.bodyMarkdown }),
]);
console.log(`fan ${fan.score} (leg ${fan.legibility} · enj ${fan.enjoyment} · josh ${fan.joshVoice}) · voice ${voice.score}\n${fan.notes}\n`);
console.log(`# ${draft.headline}\n${draft.dek}\n\n${draft.bodyMarkdown}`);

writeFileSync(OUT, JSON.stringify([{ lane: "show", label: "Josh's Read · production pipeline", episode: v.title, ytId: v.id, series, writer: "production", ...draft, problems: boilerplateViolations(draft.bodyMarkdown), fan, voice }], null, 2));
console.log(`\nwrote ${OUT}`);
