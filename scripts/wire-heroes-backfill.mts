// Every Wire story carries an AI editorial illustration (Isaac, 2026-09-02).
// Backfill for the live catalog; the monitor's addWireHeroes drain handles
// new stories from here on.  npx tsx scripts/wire-heroes-backfill.mts [--limit N] [--pool 3]
import { readFileSync, appendFileSync, mkdirSync } from "node:fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim().replace(/^"|"$/g, ""); }
const args = process.argv.slice(2);
const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const LIMIT = Number(opt("--limit") ?? 0); const POOL = Number(opt("--pool") ?? 3);
const { writeClient, uploadHeroImage, setArticleHeroImage } = await import("../lib/sanity.ts");
const { generateWireHero } = await import("../lib/hero-image.ts");
mkdirSync(".superpowers", { recursive: true });
const log = (l: string) => { console.log(l); appendFileSync(".superpowers/wire-heroes-backfill.log", `${new Date().toISOString()} ${l}\n`); };
let rows: { _id: string; headline: string; category?: string; teams?: string[] }[] = await writeClient.fetch(`*[_type=="wireStory" && !defined(heroImage)] | order(publishedAt desc){_id, headline, category, teams}`);
if (LIMIT) rows = rows.slice(0, LIMIT);
log(`stories without an illustration: ${rows.length}`);
let done = 0, failed = 0;
async function one(r: typeof rows[number]) {
  try {
    const buf = await generateWireHero(r.headline, r.category ?? "general", r.teams ?? []);
    if (!buf) { failed++; log(`NONE ${r._id} "${r.headline.slice(0, 50)}"`); return; }
    const assetId = await uploadHeroImage(buf);
    if (!assetId) { failed++; log(`UPLOAD-FAILED ${r._id}`); return; }
    await setArticleHeroImage(r._id, assetId);
    done++; log(`OK ${r._id} (${r.category ?? "general"}) "${r.headline.slice(0, 50)}"`);
  } catch (err) { failed++; log(`ERROR ${r._id}: ${err instanceof Error ? err.message.slice(0, 120) : err}`); }
}
const queue = [...rows];
await Promise.all(Array.from({ length: Math.min(POOL, queue.length) }, async () => { while (queue.length) await one(queue.shift()!); }));
log(`DONE: ${done} illustrated · ${failed} failed`);
