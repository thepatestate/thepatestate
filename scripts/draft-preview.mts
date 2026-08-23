// Draft ONE wire story under the CURRENT prompts and print it — nothing is
// published, no Anthropic call is made (writer only, so it works even when
// the verification side is out of credits). Runs the pure-code gates on the
// result so a prompt change can be read and judged before it ships.
//
// Run:  npx tsx scripts/draft-preview.mts [--story <wireStory _id>]
import { readFileSync, existsSync, writeFileSync } from "node:fs";
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

const { writeClient } = await import("../lib/sanity.ts");
const { writeJSON, WRITER_PROVIDER } = await import("../lib/writer.ts");
const { editorialSystem, readPrompt, VOICE_V4_PROMPT, BOILERPLATE_PROMPT, boilerplateViolations } = await import("../lib/editorial.ts");
const { STORY_SCHEMA, fetchSourceText, headlineNamesOutlet, hasAttributionOpener, narratesSourcing, hasFirstPersonProse, selectCallout, cleanSectionTitle } = await import("../lib/wire.ts");
const { createAdminClient, isAdminConfigured } = await import("../lib/supabase/admin.ts");

const storyArg = process.argv.indexOf("--story");
const storyId = storyArg !== -1 ? process.argv[storyArg + 1] : null;
const db = isAdminConfigured ? createAdminClient() : null;

interface Row { _id: string; headline: string; item?: { _id: string; headline: string; sub?: string; sourceUrls?: string[]; sourceOutlets?: string[] } | null }
const PROJ = `{ _id, headline, "item": *[_type == "wireItem" && references(^._id)][0]{ _id, headline, sub, sourceUrls, sourceOutlets } }`;
const candidates = storyId
  ? await writeClient.fetch<Row[]>(`*[_type == "wireStory" && _id == $id]${PROJ}`, { id: storyId })
  : await writeClient.fetch<Row[]>(`*[_type == "wireStory" && defined(deck)] | order(publishedAt desc)[0...12]${PROJ}`);

// Same grounding the pipeline uses: fetched source pages, else the feed
// text stored on the cluster. Without --story, take the newest story whose
// grounding is substantial enough for a full treatment.
let row: Row | null = null; let texts: string[] = [];
for (const c of candidates) {
  if (!c.item) continue;
  const urls = c.item.sourceUrls ?? [];
  const t = await Promise.all(urls.slice(0, 2).map(fetchSourceText));
  if (!t.some(Boolean) && db) {
    const { data: cl } = await db.from("wire_clusters").select("source_text").eq("item_id", c.item._id).maybeSingle();
    if (cl?.source_text) t[0] = cl.source_text;
  }
  row = c; texts = t;
  if (storyId || t.join("").length >= 1500) break;
}
if (!row?.item) { console.error("no story/item found"); process.exit(1); }
const outlets = row.item.sourceOutlets?.length ? row.item.sourceOutlets : ["the original report"];
const urls = row.item.sourceUrls ?? [];
const sourceBlock = outlets
  .map((o, i) => `- [${o}] ${row.item!.headline}\n  ${texts[i] || texts[0] || row.item!.sub || ""}\n  ${urls[i] ?? urls[0] ?? ""}`)
  .join("\n");
console.log(`writer: ${WRITER_PROVIDER}\nstory: ${row._id}\ngrounding: ${texts.filter(Boolean).length} source text(s), ${sourceBlock.length} chars\n`);

const system = editorialSystem("wire", readPrompt("wire-story.md"));
const user = `${VOICE_V4_PROMPT}\n\n${BOILERPLATE_PROMPT}\n\nSource cluster:\n${sourceBlock}`;
const t0 = Date.now();
const raw = await writeJSON({ system, user, schema: STORY_SCHEMA, schemaName: "wire_story", maxTokens: 8192 });
const d = JSON.parse(raw) as Record<string, any>;
writeFileSync(join(process.cwd(), ".superpowers", "draft-preview.json"), JSON.stringify(d, null, 2));
const prose = ["deck", "whatHappened", "whyBody", "missing", "section04Body", "chessboard", "readBody"].map((k) => d[k] ?? "").join("\n");
const wc = (s: string) => (s ?? "").split(/\s+/).filter(Boolean).length;

console.log(`drafted in ${Math.round((Date.now() - t0) / 1000)}s — ${wc(prose)} prose words\n`);
console.log(`HEADLINE: ${d.headline}\nDECK (${wc(d.deck)}w): ${d.deck}\nverification=${d.verification} impact=${d.impact} category=${d.category} teams=${JSON.stringify(d.teams)}\n`);
const sections: [string, string, string][] = [
  [cleanSectionTitle(d.openTitle) || "(default) What Happened", "whatHappened", d.whatHappened],
  [cleanSectionTitle(d.whyTitle) || "(default) Why This One Matters", "whyBody", d.whyBody],
  [cleanSectionTitle(d.missingTitle) || "(default) What Most People Are Missing", "missing", d.missing],
  [cleanSectionTitle(d.section04Title) || "(default) What Changes Now", "section04Body", d.section04Body],
  [cleanSectionTitle(d.chessboardTitle) || "(default) The Chessboard", "chessboard", d.chessboard],
  ["The Pate State Read", "readBody", d.readBody],
];
for (const [title, key, body] of sections) {
  if (!body) { console.log(`## ${title} [${key}] — EMPTY\n`); continue; }
  console.log(`## ${title} [${key}, ${wc(body)}w]\n${body}\n`);
}
if (d.board?.rows?.length) console.log(`BOARD "${d.board.title}": ${d.board.rows.map((r: any) => r.name).join(" · ")} — tell: ${d.board.summary}\n`);
console.log(`WATCHING: ${(d.watching ?? []).map((w: any) => w.title).join(" | ")}\nSTATS: ${(d.stats ?? []).map((s: any) => `${s.value} (${s.label})`).join(" · ")}\n`);
console.log("GATES:");
console.log(`  outlet in upper page: ${headlineNamesOutlet(`${d.deck}\n${d.whatHappened}`)}`);
console.log(`  attribution opener:   ${hasAttributionOpener(d.whatHappened ?? "")}`);
console.log(`  narrates sourcing:    ${narratesSourcing(prose)}`);
console.log(`  first person:         ${hasFirstPersonProse(prose)}`);
console.log(`  em/en dashes:         ${(prose.match(/[—–]/g) ?? []).length}`);
console.log(`  boilerplate:          ${JSON.stringify(boilerplateViolations(prose))}`);
console.log(`  callout:              ${selectCallout({ ...d, headline: d.headline, category: d.category }) || "(none)"}`);
