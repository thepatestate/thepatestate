// Delete off-sport Wire stories and their items (Isaac, 2026-08-28: "delete
// them"). Selection = the keyword filter in lib/wire.ts (deterministic; the
// same one that now runs on the feed). Every document is snapshotted to
// .superpowers/offsport-deleted/ before deletion.
//   npx tsx scripts/wire-delete-offsport.mts [--dry]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim(); }
const DRY = process.argv.includes("--dry");
const { writeClient } = await import("../lib/sanity.ts");
const { isOffTopic } = await import("../lib/wire.ts");
mkdirSync(".superpowers/offsport-deleted", { recursive: true });
const stories = await writeClient.fetch<{ _id: string; headline: string; deck?: string; whatHappened?: string; publishedAt: string; "item": { _id: string } | null }[]>(`*[_type=="wireStory" && !(_id in path("drafts.**"))]{ _id, headline, deck, whatHappened, publishedAt, "item": *[_type=="wireItem" && references(^._id)][0]{ _id } }`);
const off = stories.filter((s) => isOffTopic(s.headline, `${s.deck ?? ""} ${s.whatHappened ?? ""}`));
console.log(`${stories.length} stories · ${off.length} off-sport`);
let deleted = 0, failed = 0;
for (const s of off) {
  const ids = [s.item?._id, s._id].filter(Boolean) as string[];
  const docs = await writeClient.fetch<unknown[]>(`*[_id in $ids]`, { ids });
  writeFileSync(`.superpowers/offsport-deleted/${s._id}.json`, JSON.stringify(docs, null, 2));
  console.log(`${DRY ? "would delete" : "delete"}  ${s.publishedAt.slice(0, 10)}  ${s.headline.slice(0, 80)}`);
  if (DRY) continue;
  try { let tx = writeClient.transaction(); for (const id of ids) tx = tx.delete(id); await tx.commit(); deleted++; }
  catch (e) { failed++; console.log(`   FAILED: ${String(e).slice(0, 160)}`); }
}
console.log(`\ndeleted ${deleted} stories (+ their items) · failed ${failed} · snapshots in .superpowers/offsport-deleted/`);
