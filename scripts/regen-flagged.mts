// Retro-cleanup (2026-08-21): v1.2 stories generated BEFORE the prose gates
// landed (first-person, source-narration) regenerate through the gated
// pipeline. Flagged set is computed here with the same predicates the gates
// use. Slug/publishedAt never change; a story that fails the gates twice
// keeps its current text and is reported (better a known offender on the
// list than silent).
//
// Run:  npx tsx scripts/regen-flagged.mts [--dry-run] [--limit N]
import { readFileSync, existsSync, appendFileSync } from "node:fs";
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
    const value = line.slice(eq + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
}
loadDotEnvLocal();

const { default: Anthropic } = await import("@anthropic-ai/sdk");
const { writeClient } = await import("../lib/sanity.ts");
const { generateWireStory, fetchSourceText, titleKeywords, hasFirstPersonProse, narratesSourcing } = await import("../lib/wire.ts");
const { createAdminClient, isAdminConfigured } = await import("../lib/supabase/admin.ts");

const DRY_RUN = process.argv.includes("--dry-run");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : 200;
const anthropic = new Anthropic();
const db = isAdminConfigured ? createAdminClient() : null;
const logPath = join(process.cwd(), ".superpowers", "regen-flagged.log");

interface Row {
  _id: string;
  headline: string;
  deck?: string; whatHappened?: string; whyBody?: string; missing?: string;
  section04Body?: string; chessboard?: string; readBody?: string;
  item?: { _id: string; headline: string; sub?: string; teams?: string[]; sourceUrls?: string[]; sourceOutlets?: string[] } | null;
}
const rows = await writeClient.fetch<Row[]>(
  `*[_type == "wireStory" && defined(deck)]{
    _id, headline, deck, whatHappened, whyBody, missing, section04Body, chessboard, readBody,
    "item": *[_type == "wireItem" && references(^._id)][0]{ _id, headline, sub, teams, sourceUrls, sourceOutlets }
  }`
);
const prose = (s: Row) =>
  [s.deck, s.whatHappened, s.whyBody, s.missing, s.section04Body, s.chessboard, s.readBody].filter(Boolean).join("\n");
const flagged = rows.filter((s) => hasFirstPersonProse(prose(s)) || narratesSourcing(prose(s))).slice(0, LIMIT);
console.log(`${flagged.length} flagged v1.2 stories (of ${rows.length})${DRY_RUN ? " (DRY RUN)" : ""}\n`);
if (DRY_RUN) process.exit(0);

let fixed = 0, held = 0, failed = 0;
for (const s of flagged) {
  const label = s.headline.slice(0, 60);
  try {
    if (!s.item) { held++; console.log(`HOLD (no item)        ${label}`); continue; }
    const outlets = s.item.sourceOutlets?.length ? s.item.sourceOutlets : ["the original report"];
    const urls = s.item.sourceUrls ?? [];
    const texts = await Promise.all(urls.slice(0, 2).map(fetchSourceText));
    if (!texts.some(Boolean) && db) {
      const { data: cl } = await db.from("wire_clusters").select("source_text").eq("item_id", s.item._id).maybeSingle();
      if (cl?.source_text) texts[0] = cl.source_text;
    }
    const sourceBlock = outlets
      .map((o, i) => `- [${o}] ${s.item!.headline}\n  ${texts[i] || texts[0] || s.item!.sub || ""}\n  ${urls[i] ?? urls[0] ?? ""}`)
      .join("\n");
    const gen = await generateWireStory(anthropic, {
      sourceBlock,
      outlets,
      sources: outlets.map((o, i) => ({ outlet: o, url: urls[i] ?? urls[0] ?? "" })),
      clusterKey: s._id.replace(/^wireStory-/, ""),
      teams: s.item.teams ?? [],
      receiptKeywords: [...titleKeywords(s.item.headline)],
      itemId: s.item._id,
    });
    if (!gen.ok) { held++; console.log(`HOLD (${gen.reason.split(":")[0]})  ${label}`); continue; }
    await writeClient.patch(s._id).set({ ...gen.fields, updatedAt: new Date().toISOString() }).commit();
    appendFileSync(logPath, JSON.stringify({ id: s._id }) + "\n");
    fixed++;
    console.log(`OK   ${label}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${label}`, err instanceof Error ? err.message.slice(0, 120) : err);
  }
}
console.log(`\ndone: ${fixed} regenerated, ${held} held (kept current text), ${failed} failed`);
