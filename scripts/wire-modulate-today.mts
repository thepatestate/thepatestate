// Backfill 2026-09-01 (Isaac: "update all of today (september 1st) articles to
// this format"): dedupe today's file, then decompose every survivor's finished
// body into the wire page's modules. Nothing is rewritten — layout only.
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim().replace(/^"|"$/g, ""); }
const { writeClient } = await import("../lib/sanity.ts");
const { callJSON, modelForRole } = await import("../lib/editorial-v3/models.ts");
const { modulateStory } = await import("../lib/editorial-v3/modulate.ts");
const DIR = ".superpowers/wire-gate4"; mkdirSync(DIR, { recursive: true });
const rows: any[] = await writeClient.fetch(`*[_type=="wireStory" && publishedAt >= "2026-09-01T04:00:00Z"] | order(publishedAt asc)`);
console.log(`in scope: ${rows.length}`);
let cost = 0;
// dedupe
const listing = rows.map((s, i) => `${i}: [${(s.teams ?? []).join(",")}] ${s.headline} — ${(s.deck ?? s.whatHappened ?? "").slice(0, 110)}`).join("\n");
const d = await callJSON<{ groups: number[][] }>({ stage: "wire-dedupe", role: "deskGate", choice: modelForRole("deskGate"), maxTokens: 1500, schemaName: "dupe_groups", schema: { type: "object", additionalProperties: false, required: ["groups"], properties: { groups: { type: "array", items: { type: "array", items: { type: "integer" } } } } }, system: "You are a wire editor de-duplicating a day's file. Two stories are duplicates ONLY if they cover the same single event or development (same teams, same news) — not merely the same team or the same saga on different days with different developments. Return groups of indexes that are duplicates (each 2+); omit singletons. JSON only.", user: listing });
cost += d.call.costUsd ?? 0;
const dropped = new Set<number>();
for (const grp of d.data.groups ?? []) {
  const real = grp.filter((i) => rows[i]); if (real.length < 2) continue;
  const keep = real.reduce((a, b) => ((rows[a].bodyMarkdown ?? "").length >= (rows[b].bodyMarkdown ?? "").length ? a : b));
  console.log(`dupe [${real.map((i) => rows[i].headline.slice(0, 50)).join(" || ")}] → keep "${rows[keep].headline.slice(0, 50)}"`);
  for (const i of real) if (i !== keep) {
    const s = rows[i]; writeFileSync(`${DIR}/${s._id}.json`, JSON.stringify(s, null, 1));
    const refs: any[] = await writeClient.fetch(`*[references($id)]`, { id: s._id });
    for (const r of refs) { writeFileSync(`${DIR}/${r._id}.json`, JSON.stringify(r, null, 1)); await writeClient.delete(r._id); }
    await writeClient.delete(s._id); dropped.add(i); console.log(`  DELETED ${s._id}`);
  }
}
// modulate survivors
let done = 0;
for (let i = 0; i < rows.length; i++) {
  if (dropped.has(i)) continue;
  const s = rows[i];
  const wc = (s.bodyMarkdown ?? "").split(/\s+/).filter(Boolean).length;
  const depth = s.v3Depth ?? (wc > 450 ? "story" : wc > 220 ? "brief" : "item");
  const draft = { headline: s.headline, dek: s.deck ?? "", bodyMarkdown: s.bodyMarkdown ?? s.whatHappened ?? "", pullQuote: "", primaryTeam: s.teams?.[0] ?? "", teams: s.teams ?? [], tags: [], seo: { title: "", description: "" } };
  const brief = { theNews: s.headline, whyAFanCares: s.deck ?? "", stakes: s.deck ?? s.headline, depth, depthReason: "", nationalDeskWouldRun: true } as any;
  try {
    const m = await modulateStory(draft as any, { development: "", facts: [], quotes: [], numbers: [], unknowns: [], relevantTeamContext: [] } as any, brief, "economy");
    cost += m.call.costUsd ?? 0;
    appendFileSync(".superpowers/wire-modulate-backup.jsonl", JSON.stringify({ at: new Date().toISOString(), doc: s }) + "\n");
    const mods = m.modules;
    await writeClient.patch(s._id).set({
      openTitle: mods.openTitle, whatHappened: mods.whatHappened,
      ...(mods.whyTitle ? { whyTitle: mods.whyTitle } : {}), ...(mods.whyBody ? { whyBody: mods.whyBody } : {}),
      ...(mods.missing ? { missing: mods.missing } : {}), ...(mods.callout ? { callout: mods.callout } : {}),
      ...(mods.section04Title ? { section04Title: mods.section04Title } : {}), ...(mods.section04Body ? { section04Body: mods.section04Body } : {}),
      ...(mods.chessboard ? { chessboard: mods.chessboard } : {}), ...(mods.readBody ? { readBody: mods.readBody } : {}),
      watching: (mods.watching ?? []).map((w, j) => ({ _key: `w${j}`, ...w })),
      stats: (mods.stats ?? []).map((x, j) => ({ _key: `s${j}`, ...x })),
      facts: (mods.facts ?? []).map((f, j) => ({ _key: `f${j}`, ...f })),
    }).commit();
    console.log(`MODULATED ${s._id} (${depth}: why=${!!mods.whyBody} miss=${!!mods.missing} watch=${mods.watching?.length ?? 0} stats=${mods.stats?.length ?? 0} facts=${mods.facts?.length ?? 0})`);
    done++;
  } catch (err) { console.log(`FAILED ${s._id}: ${err instanceof Error ? err.message.slice(0, 120) : err}`); }
}
console.log(`DONE: ${done} modulated, ${dropped.size} deleted as dupes · $${cost.toFixed(2)}`);
