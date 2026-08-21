// Archive upgrade (Isaac, 2026-08-20): regenerate the ~50 most-trafficked
// legacy wire stories to Production Guide v1.2. Traffic proxy: wire-item
// importance (desc), then recency — a news site's traffic concentrates on
// high-importance recent stories surfaced by the homepage and rails.
//
// Each story regenerates through the SAME stack as live generation
// (generateWireStory: Luna draft → §5 attribution gates with corrective
// retry → fact-check → receipt relevance) grounded in re-fetched source
// pages with the cluster's stored feed text as fallback. The existing doc
// is PATCHED: slug and publishedAt never change (URL stability), legacy
// fields are unset, updatedAt stamps the upgrade. Stories that fail a gate
// stay legacy — verification never bends for a redesign.
//
// Run:  npx tsx scripts/upgrade-stories.mts [--limit N] [--dry-run]
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
const { generateWireStory, fetchSourceText, titleKeywords } = await import("../lib/wire.ts");
const { createAdminClient, isAdminConfigured } = await import("../lib/supabase/admin.ts");

const DRY_RUN = process.argv.includes("--dry-run");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : 50;
const anthropic = new Anthropic();
const db = isAdminConfigured ? createAdminClient() : null;
const logPath = join(process.cwd(), ".superpowers", "story-upgrades.log");

interface Candidate {
  _id: string;
  importance?: number;
  publishedAt?: string;
  headline: string;
  sub?: string;
  teams?: string[];
  sourceUrls?: string[];
  sourceOutlets?: string[];
  storyId: string;
  storyHeadline?: string;
}

const candidates = await writeClient.fetch<Candidate[]>(
  `*[_type == "wireItem" && defined(story) && !defined(story->deck)]{
    _id, importance, publishedAt, headline, sub, teams, sourceUrls, sourceOutlets,
    "storyId": story->_id, "storyHeadline": story->headline
  } | order(coalesce(importance, 4) desc, publishedAt desc) [0...$limit]`,
  { limit: LIMIT },
);
// Two items can reference one story — first (highest-ranked) wins.
const seen = new Set<string>();
const deduped = candidates.filter((c) => (seen.has(c.storyId) ? false : (seen.add(c.storyId), true)));
console.log(`${deduped.length} legacy stories selected (importance-desc, recency)${DRY_RUN ? " (DRY RUN)" : ""}\n`);
if (DRY_RUN) {
  for (const c of deduped) console.log(`- [imp ${c.importance ?? "?"}] ${c.storyHeadline?.slice(0, 70)}`);
  process.exit(0);
}

let upgraded = 0, skipped = 0, failed = 0;

for (const c of deduped) {
  const label = (c.storyHeadline ?? c.headline).slice(0, 60);
  try {
    const outlets = c.sourceOutlets?.length ? c.sourceOutlets : ["the original report"];
    const urls = c.sourceUrls ?? [];
    const texts = await Promise.all(urls.slice(0, 2).map(fetchSourceText));
    if (!texts.some(Boolean) && db) {
      const { data: cl } = await db.from("wire_clusters").select("source_text").eq("item_id", c._id).maybeSingle();
      if (cl?.source_text) texts[0] = cl.source_text;
    }
    const sourceBlock = outlets
      .map((o, i) => {
        const body = texts[i] || texts[0] || c.sub || "";
        return `- [${o}] ${c.headline}\n  ${body}\n  ${urls[i] ?? urls[0] ?? ""}`;
      })
      .join("\n");

    const gen = await generateWireStory(anthropic, {
      sourceBlock,
      outlets,
      sources: outlets.map((o, i) => ({ outlet: o, url: urls[i] ?? urls[0] ?? "" })),
      clusterKey: c.storyId.replace(/^wireStory-/, ""),
      teams: c.teams ?? [],
      receiptKeywords: [...titleKeywords(c.headline)],
      itemId: c._id,
    });
    if (!gen.ok) {
      skipped++;
      console.log(`SKIP (${gen.reason.split(":")[0]})  ${label}`);
      continue;
    }

    await writeClient
      .patch(c.storyId)
      .set({ ...gen.fields, updatedAt: new Date().toISOString() })
      .unset(["whyItMatters", "whatsNext"])
      .commit();
    appendFileSync(logPath, JSON.stringify({ storyId: c.storyId, item: c._id }) + "\n");
    upgraded++;
    console.log(`OK   ${label}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${label}`, err instanceof Error ? err.message.slice(0, 150) : err);
  }
}
console.log(`\ndone: ${upgraded} upgraded, ${skipped} gate-skipped (stay legacy), ${failed} failed`);
