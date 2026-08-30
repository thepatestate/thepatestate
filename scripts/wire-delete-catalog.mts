// Delete the Wire back catalog (Josh via Isaac, 2026-08-29: "delete all the
// back catalog of stories. Everything from before this latest update with
// Sol. Only keep the Sol articles"). Keeps: stories written by the Desk v4
// pipeline (productionMethod v3-desk and published after the 2026-08-29
// 02:30Z deploy) and the window-backfill rewrites (corrections note). Deletes
// every other wireStory with its wireItem. Josh's Read and staff articles are
// not touched. Every document is snapshotted to .superpowers/catalog-deleted/.
//   npx tsx scripts/wire-delete-catalog.mts [--dry]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim(); }
const DRY = process.argv.includes("--dry");
const DEPLOY = "2026-08-29T02:30:00Z";
const { writeClient } = await import("../lib/sanity.ts");
mkdirSync(".superpowers/catalog-deleted", { recursive: true });
type S = { _id: string; headline: string; publishedAt: string; productionMethod?: string; corrections?: { note?: string }[]; item: { _id: string } | null };
const all = await writeClient.fetch<S[]>(`*[_type=="wireStory" && !(_id in path("drafts.**"))] | order(publishedAt asc){ _id, headline, publishedAt, productionMethod, corrections, "item": *[_type=="wireItem" && references(^._id)][0]{ _id } }`);
const keep = (s: S) => s.productionMethod === "v3-desk" && (s.publishedAt >= DEPLOY || (s.corrections ?? []).some((c) => /Rewritten by the desk from the same sources/.test(c.note ?? "")));
const del = all.filter((s) => !keep(s)); const kept = all.filter(keep);
console.log(`${all.length} stories · keep ${kept.length} · delete ${del.length}${DRY ? " (dry run)" : ""}`);
for (const k of kept) console.log(`  keep  ${k.publishedAt.slice(0, 16)}  ${k.headline.slice(0, 80)}`);
// Orphan items (no story) from before the deploy go too: a headline with no story is a dead click.
const orphans = await writeClient.fetch<{ _id: string; headline: string }[]>(`*[_type=="wireItem" && !(_id in path("drafts.**")) && !defined(story) && publishedAt < $deploy]{ _id, headline }`, { deploy: DEPLOY });
console.log(`orphan items before the deploy: ${orphans.length}`);
if (DRY) process.exit(0);
let deleted = 0, failed = 0;
const batches: S[][] = []; for (let i = 0; i < del.length; i += 25) batches.push(del.slice(i, i + 25));
for (const batch of batches) {
  const ids = batch.flatMap((s) => [s.item?._id, s._id].filter(Boolean) as string[]);
  const docs = await writeClient.fetch<{ _id: string }[]>(`*[_id in $ids]`, { ids });
  for (const d of docs) writeFileSync(`.superpowers/catalog-deleted/${d._id}.json`, JSON.stringify(d, null, 2));
  try { let tx = writeClient.transaction(); for (const id of ids) tx = tx.delete(id); await tx.commit(); deleted += batch.length; }
  catch (e) { console.log(`batch failed (${String(e).slice(0, 140)}); retrying one by one`); for (const s of batch) { try { let tx = writeClient.transaction(); if (s.item) tx = tx.delete(s.item._id); tx = tx.delete(s._id); await tx.commit(); deleted++; } catch (e2) { failed++; console.log(`  FAILED ${s._id}: ${String(e2).slice(0, 120)}`); } } }
  process.stdout.write(`\r  deleted ${deleted}/${del.length}`);
}
for (let i = 0; i < orphans.length; i += 50) { const chunk = orphans.slice(i, i + 50); for (const o of chunk) writeFileSync(`.superpowers/catalog-deleted/${o._id}.json`, JSON.stringify(o)); let tx = writeClient.transaction(); for (const o of chunk) tx = tx.delete(o._id); await tx.commit().catch((e) => console.log(`orphan batch failed: ${String(e).slice(0, 120)}`)); }
console.log(`\ndeleted ${deleted} stories (+ items) · ${orphans.length} orphan items · failed ${failed} · snapshots in .superpowers/catalog-deleted/`);
