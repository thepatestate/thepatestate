// Two-day wire cleanup under the stakes standard (Isaac, 2026-08-31: "clean
// up the articles from the last 2 days with these new rules").
//   Phase A: desk-gate every live story on its own text; failures are
//            snapshotted (with referrers) and deleted.
//   Phase B: one Luna call groups near-duplicate stories; the fullest body
//            in each group survives, the rest are snapshotted and deleted.
//   Phase C: every survivor is rewritten through the updated economy desk
//            (stakes by ¶3, the on-record ledger available); a rewrite that
//            fails any gate keeps the old text. Voice fields only — slug,
//            publishedAt, impact, sources never change. Originals go to
//            .superpowers/wire-2day-backup.jsonl first.
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim().replace(/^"|"$/g, ""); }
const { writeClient } = await import("../lib/sanity.ts");
const { deskGate } = await import("../lib/editorial-v3/desk-gate.ts");
const { callJSON, modelForRole } = await import("../lib/editorial-v3/models.ts");
const { v3WireStory } = await import("../lib/editorial-v3/production.ts");
const DIR = ".superpowers/wire-gate4"; mkdirSync(DIR, { recursive: true });
let cost = 0;
const snapDelete = async (s: any, why: string) => {
  writeFileSync(`${DIR}/${s._id}.json`, JSON.stringify(s, null, 1));
  const refs: any[] = await writeClient.fetch(`*[references($id)]`, { id: s._id });
  for (const r of refs) { writeFileSync(`${DIR}/${r._id}.json`, JSON.stringify(r, null, 1)); await writeClient.delete(r._id); }
  await writeClient.delete(s._id);
  console.log(`DELETED (${why}) ${s._id} · ${s.headline}`);
};

const rows: any[] = await writeClient.fetch(`*[_type=="wireStory" && publishedAt >= "2026-08-30T04:00:00Z"] | order(publishedAt asc)`);
console.log(`in scope: ${rows.length} stories (published 08-30/31 ET)`);

// Phase A — gate
const survivors: any[] = [];
for (const s of rows) {
  const g = await deskGate({ headline: s.headline, text: `${s.headline}\n${s.deck ?? ""}\n${s.bodyMarkdown}` });
  cost += g.call?.costUsd ?? 0;
  if (g.pass) { survivors.push(s); continue; }
  await snapDelete(s, `gate: ${g.result.reason.slice(0, 90)}`);
}
console.log(`PHASE A done: ${survivors.length} kept, ${rows.length - survivors.length} deleted · $${cost.toFixed(2)}`);

// Phase B — dedupe
const listing = survivors.map((s, i) => `${i}: [${(s.teams ?? []).join(",")}] ${s.headline} — ${(s.deck ?? s.whatHappened ?? "").slice(0, 120)}`).join("\n");
const d = await callJSON<{ groups: number[][] }>({ stage: "wire-dedupe", role: "deskGate", choice: modelForRole("deskGate"), maxTokens: 1500, schemaName: "dupe_groups", schema: { type: "object", additionalProperties: false, required: ["groups"], properties: { groups: { type: "array", items: { type: "array", items: { type: "integer" } } } } }, system: "You are a wire editor de-duplicating a day's file. Two stories are duplicates ONLY if they cover the same single event or development (same teams, same news) — not merely the same team. Return groups of the indexes that are duplicates of each other (each group has 2+ indexes); stories with no duplicate are omitted. JSON only.", user: listing });
cost += d.call?.costUsd ?? 0;
const dropped = new Set<number>();
for (const grp of d.data.groups ?? []) {
  const real = grp.filter((i) => survivors[i]);
  if (real.length < 2) continue;
  const keep = real.reduce((a, b) => ((survivors[a].bodyMarkdown ?? "").length >= (survivors[b].bodyMarkdown ?? "").length ? a : b));
  console.log(`dupe group [${real.map((i) => survivors[i].headline).join(" || ")}] → keeping "${survivors[keep].headline}"`);
  for (const i of real) if (i !== keep) { await snapDelete(survivors[i], "duplicate"); dropped.add(i); }
}
const finals = survivors.filter((_, i) => !dropped.has(i));
console.log(`PHASE B done: ${finals.length} remain · $${cost.toFixed(2)}`);

// Phase C — rewrite
let rewritten = 0, keptOld = 0;
let backups: any[] = [];
try { backups = readFileSync(".superpowers/wire-2day-backup.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l).doc); } catch {}
for (const s of finals) {
  // Prefer the pre-rewrite original as source material — it is fuller.
  const orig = backups.find((b) => b._id === s._id) ?? s;
  const feed = `${orig.headline}\n${orig.deck ?? ""}\n\n${orig.bodyMarkdown}`;
  const refs = (s.sources?.length ? s.sources : [{ outlet: "wire", url: `https://example.invalid/${s._id}` }]).map((x: any) => ({ outlet: x.outlet ?? "wire", url: x.url, feedText: feed, title: s.headline }));
  const r: any = await v3WireStory({ clusterKey: `cleanup-${s._id.slice(-24)}`, teams: s.teams ?? [], refs, mode: "shadow", gate: false, tier: "economy" });
  cost += (r.run?.calls ?? []).reduce((a: number, c: any) => a + (c.costUsd ?? 0), 0);
  if (!r.ok) { console.log(`kept old (${r.reason.slice(0, 70)}) · ${s.headline}`); keptOld++; continue; }
  appendFileSync(".superpowers/wire-2day-backup.jsonl", JSON.stringify({ at: new Date().toISOString(), doc: s }) + "\n");
  await writeClient.patch(s._id).set({ headline: r.fields.headline, deck: r.fields.deck, bodyMarkdown: r.fields.bodyMarkdown, whatHappened: r.fields.whatHappened, v3Depth: r.fields.v3Depth, v3RunId: r.fields.v3RunId }).commit();
  console.log(`REWROTE ${s._id}\n  ${s.headline}  →  ${r.fields.headline}`);
  rewritten++;
}
console.log(`PHASE C done: ${rewritten} rewritten, ${keptOld} kept old · TOTAL $${cost.toFixed(2)}`);
