// Visual modules for the published long-form staff pieces (2026-09-02).
//   npx tsx scripts/article-visuals-backfill.mts [--only <slug>] [--dry]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim().replace(/^"|"$/g, ""); }
const args = process.argv.slice(2); const ONLY = args[args.indexOf("--only") + 1]; const DRY = args.includes("--dry");
const { writeClient } = await import("../lib/sanity.ts");
const { articleVisuals, visualsPatch } = await import("../lib/editorial-v3/article-visuals.ts");
mkdirSync(".superpowers/article-visuals", { recursive: true });
const rows: any[] = await writeClient.fetch(`*[_type=="article" && workflowState=="published" && byline!="Josh Pate"${args.includes("--only") ? " && slug.current==$slug" : ""}] | order(publishedAt desc)`, { slug: ONLY ?? "" });
console.log(`staff articles: ${rows.length}`); let cost = 0;
for (const a of rows) {
  try {
    writeFileSync(`.superpowers/article-visuals/${a._id}.json`, JSON.stringify(a, null, 1));
    const v = await articleVisuals({ headline: a.headline, dek: a.dek, bodyMarkdown: a.bodyMarkdown }, "premium", (l) => console.log(`  ${l}`));
    for (const c of v.calls) cost += c.costUsd ?? 0;
    if (!DRY) await writeClient.patch(a._id).set(visualsPatch(v.visuals)).commit();
    console.log(`OK ${a.slug.current.slice(0, 60)}`);
  } catch (err) { console.log(`FAILED ${a._id}: ${err instanceof Error ? err.message.slice(0, 140) : err}`); }
}
console.log(`DONE · $${cost.toFixed(2)}`);
