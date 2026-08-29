// Wire backfill for a date window through the economy tier + desk gate
// (Isaac, 2026-08-28: "the cheapest sensible move"). Wire stories only —
// Josh's Read and the staff articles are untouched. Each story is regenerated
// from its own sources with the same _id, slug and publishedAt. The desk gate
// runs on the STORY'S OWN TEXT first (never on a fetched page, which can be
// thin or wrong): not college football → deleted with its item; college
// football but not desk-worthy → left as is; otherwise → rewritten. Every
// replaced or deleted document is snapshotted first. Already-rewritten
// stories are skipped, so the script can be re-run.
//   npx tsx scripts/wire-backfill-window.mts [--since 2026-08-27T04:00:00Z] [--until ...] [--dry] [--concurrency 3]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim(); }
process.env.EDITORIAL_V3_ENABLED = "true"; process.env.EDITORIAL_V3_REPORTED_ENABLED = "true"; process.env.EDITORIAL_V3_SHADOW_MODE = "false";
const arg = (k: string) => { const i = process.argv.indexOf(k); return i !== -1 ? process.argv[i + 1] : undefined; };
const SINCE = arg("--since") ?? "2026-08-27T04:00:00Z"; const UNTIL = arg("--until") ?? "2026-08-29T02:30:00Z";
const DRY = process.argv.includes("--dry"); const CONC = Number(arg("--concurrency") ?? 3);
const { writeClient } = await import("../lib/sanity.ts");
const { v3WireStory } = await import("../lib/editorial-v3/production.ts");
const { deskGate } = await import("../lib/editorial-v3/desk-gate.ts");
const DIR = ".superpowers/wire-backfill"; mkdirSync(DIR, { recursive: true });
const report: string[] = []; const say = (l: string) => { console.log(l); report.push(l); };
type S = { _id: string; headline: string; deck?: string; bodyMarkdown?: string; whyBody?: string; publishedAt: string; category?: string; teams?: string[]; whatHappened?: string; sources?: { outlet?: string; url?: string }[]; corrections?: { note?: string }[]; item: { _id: string; sourceUrls?: string[]; sourceOutlets?: string[] } | null };
const stories = await writeClient.fetch<S[]>(`*[_type=="wireStory" && !(_id in path("drafts.**")) && publishedAt >= $since && publishedAt < $until] | order(publishedAt asc){ _id, headline, deck, bodyMarkdown, whyBody, publishedAt, category, teams, whatHappened, sources, corrections, "item": *[_type=="wireItem" && references(^._id)][0]{ _id, sourceUrls, sourceOutlets } }`, { since: SINCE, until: UNTIL });
say(`Wire stories ${SINCE} → ${UNTIL}: ${stories.length}${DRY ? " (dry run)" : ""}`);
const counts = { rewritten: 0, deleted: 0, left: 0, skipped: 0, cost: 0 };
async function one(s: S) {
  if ((s.corrections ?? []).some((c) => /Rewritten by the desk from the same sources/.test(c.note ?? ""))) { counts.skipped++; return; }
  const g = await deskGate({ headline: s.headline, text: `${s.deck ?? ""}\n${s.whatHappened ?? ""}\n${s.bodyMarkdown ?? s.whyBody ?? ""}` }); counts.cost += g.call.costUsd;
  if (!g.result.collegeFootball) {
    const snap = await writeClient.fetch<unknown[]>(`*[_id in $ids]`, { ids: [s._id, s.item?._id].filter(Boolean) });
    writeFileSync(`${DIR}/${s._id}.before.json`, JSON.stringify(snap, null, 2));
    say(`DELETE  ${s.publishedAt.slice(5, 16)}  ${s.headline.slice(0, 70)}  — not college football: ${g.result.reason.slice(0, 80)}`);
    if (!DRY) { let tx = writeClient.transaction(); if (s.item) tx = tx.delete(s.item._id); tx = tx.delete(s._id); await tx.commit(); }
    counts.deleted++; return;
  }
  if (!g.result.nationalDeskWouldRun) { say(`leave   ${s.publishedAt.slice(5, 16)}  ${s.headline.slice(0, 70)}  — desk would not run it; left as is`); counts.left++; return; }
  const urls = s.item?.sourceUrls?.length ? s.item.sourceUrls : (s.sources ?? []).map((x) => x.url!).filter(Boolean);
  const outlets = s.item?.sourceOutlets ?? (s.sources ?? []).map((x) => x.outlet ?? "web");
  const refs = urls.map((u, i) => ({ outlet: outlets[i] ?? outlets[0] ?? "web", url: u, feedText: s.whatHappened }));
  const before = await writeClient.fetch<unknown[]>(`*[_id in $ids]`, { ids: [s._id, s.item?._id].filter(Boolean) });
  writeFileSync(`${DIR}/${s._id}.before.json`, JSON.stringify(before, null, 2));
  const v3 = await v3WireStory({ clusterKey: s._id.replace(/^wireStory-/, ""), teams: s.teams ?? [], refs, category: s.category, mode: "live", tier: "economy", gate: false });
  if (v3.run) counts.cost += v3.run.totalCostUsd;
  if (!v3.ok) { say(`skip    ${s.publishedAt.slice(5, 16)}  ${s.headline.slice(0, 70)}  — ${v3.reason.slice(0, 90)}`); counts.skipped++; return; }
  say(`REWRITE ${s.publishedAt.slice(5, 16)}  ${s.headline.slice(0, 60)} → "${(v3.fields.headline as string).slice(0, 70)}" · ${(v3.fields.bodyMarkdown as string).split(/\s+/).length}w · $${v3.run.totalCostUsd}`);
  if (DRY) { counts.rewritten++; return; }
  const cur = (before as Record<string, unknown>[]).find((d) => d._id === s._id) ?? {};
  await writeClient.patch(s._id).set({ ...v3.fields, updatedAt: new Date().toISOString(), corrections: [...((cur.corrections as unknown[]) ?? []), { _key: `v4-${Date.now()}`, at: new Date().toISOString(), note: "Rewritten by the desk from the same sources; original date kept." }] }).unset(["whyBody", "missing", "section04Title", "section04Body", "chessboard", "board", "readBody", "readLabel", "whatsNext", "whyItMatters", "callout"]).commit();
  if (s.item) await writeClient.patch(s.item._id).set({ headline: v3.fields.headline as string }).commit();
  counts.rewritten++;
}
let i = 0;
await Promise.all(Array.from({ length: CONC }, async () => { while (i < stories.length) { const s = stories[i++]; try { await one(s); } catch (e) { say(`ERROR   ${s.headline.slice(0, 60)} — ${String(e).slice(0, 120)}`); counts.skipped++; } } }));
say(`\nDONE rewritten ${counts.rewritten} · deleted ${counts.deleted} · left as is ${counts.left} · skipped ${counts.skipped} · model cost ${counts.cost.toFixed(2)}`);
writeFileSync(`${DIR}/report-${SINCE.slice(0, 10)}.txt`, report.join("\n"));
