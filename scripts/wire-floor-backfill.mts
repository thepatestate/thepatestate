// Floor backfill (2026-09-02; Josh: the short articles are still too short;
// Isaac: every Wire story renders at least 350 words across its sections).
// For every live story under the floor: re-lay the modules under the
// coverage rule (the old layout dropped ~40% of the desk's words), then add
// What Most People Are Missing + Questions to Be Answered from the story's
// own sources and the verified team facts, fact-checked. Nothing is deleted;
// every doc is snapshotted before its patch.
//   npx tsx scripts/wire-floor-backfill.mts [--dry] [--limit N] [--only <id>] [--pool 3]
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim().replace(/^"|"$/g, ""); }
const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const DRY = flag("--dry"); const LIMIT = Number(opt("--limit") ?? 0); const ONLY = opt("--only"); const POOL = Number(opt("--pool") ?? 3);

const { writeClient } = await import("../lib/sanity.ts");
const { gatherSources } = await import("../lib/editorial-v3/production.ts");
const { extractPack } = await import("../lib/editorial-v3/reported-engine.ts");
const { modulateStory } = await import("../lib/editorial-v3/modulate.ts");
const { expandStory } = await import("../lib/editorial-v3/expand.ts");
const { renderedWords, shortfall, moduleCoverage, rendersFlat, RENDER_FLOOR } = await import("../lib/editorial-v3/render-length.ts");
const { teamFactSheet } = await import("../lib/fact-sheet.ts");
const { JOSH_BRACKET_FIELD, JOSH_BRACKET_FINAL, JOSH_BRACKET_LABEL } = await import("../lib/josh-bracket.ts");

const DIR = ".superpowers/floor-backfill"; mkdirSync(DIR, { recursive: true });
const LOG = `${DIR}/run.log`;
const log = (l: string) => { console.log(l); appendFileSync(LOG, `${new Date().toISOString()} ${l}\n`); };

let rows: any[] = await writeClient.fetch(`*[_type=="wireStory"${ONLY ? ` && _id==$only` : ""}] | order(publishedAt desc)`, { only: ONLY ?? "" });
rows = rows.filter((s) => renderedWords(s) < RENDER_FLOOR);
if (LIMIT) rows = rows.slice(0, LIMIT);
log(`under the floor: ${rows.length} stories${DRY ? " (dry run)" : ""}`);
const onRecord = `SITE POSITIONS ON RECORD (a consistency ledger: cite at most one, only where it bears directly on this news, attributed to Josh Pate or the site's bracket by name; never contradict silently, never pad with it): ${JOSH_BRACKET_LABEL} — field: ${JOSH_BRACKET_FIELD.map((t: any) => `${t.seed} ${t.name}`).join(", ")}; final on record: ${JOSH_BRACKET_FINAL}.`;

let cost = 0, done = 0, reached = 0, failed = 0;
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
async function one(s: any) {
  const before = renderedWords(s);
  const tag = `${s._id.slice(-12)} "${s.headline.slice(0, 44)}"`;
  try {
    writeFileSync(`${DIR}/${s._id}.json`, JSON.stringify(s, null, 1));
    const refs = (s.sources ?? []).filter((x: any) => x?.url).map((x: any) => ({ outlet: x.outlet ?? "source", url: x.url }));
    let sources = refs.length ? await gatherSources(refs) : [];
    const factSheet = await teamFactSheet((s.teams ?? []).slice(0, 4), { games: 8 }).catch(() => "");
    // The story's own text is always part of the universe — its facts are
    // checked — so a story whose sources no longer fetch can still gain the
    // comparisons the fact sheet carries.
    sources = [...sources, { key: "story", title: s.headline, outlets: ["The Pate State Wire Desk"], urls: [], text: `${s.headline}\n\n${s.deck ?? ""}\n\n${s.bodyMarkdown ?? s.whatHappened ?? ""}` }];
    const material = { sourceId: s._id, sources, factSheet, onRecord };
    const p = await extractPack(material, "economy"); cost += p.call.costUsd ?? 0;
    const wc = words(s.bodyMarkdown ?? "");
    const depth = s.v3Depth ?? (wc > 450 ? "story" : wc > 220 ? "brief" : "item");
    const draft = { headline: s.headline, dek: s.deck ?? "", bodyMarkdown: s.bodyMarkdown ?? s.whatHappened ?? "", pullQuote: "", primaryTeam: s.teams?.[0] ?? "", teams: s.teams ?? [], tags: [], seo: { title: "", description: "" } } as any;
    const brief = { theNews: s.headline, whyAFanCares: s.deck ?? "", stakes: s.impactRationale || s.deck || s.headline, depth, depthReason: "", nationalDeskWouldRun: true } as any;
    const patch: Record<string, unknown> = {};
    let cur: any = { ...s };
    // 1. Re-lay a lossy module set under the coverage rule.
    if (!rendersFlat(s) && s.bodyMarkdown && moduleCoverage(s, s.bodyMarkdown) < 0.9) {
      try {
        const m = await modulateStory(draft, p.pack, brief, "economy"); for (const c of m.calls) cost += c.costUsd ?? 0;
        const mods = m.modules;
        Object.assign(patch, {
          openTitle: mods.openTitle, whatHappened: mods.whatHappened,
          ...(mods.whyTitle ? { whyTitle: mods.whyTitle } : {}), ...(mods.whyBody ? { whyBody: mods.whyBody } : {}),
          ...(mods.missing ? { missing: mods.missing } : {}), ...(mods.callout ? { callout: mods.callout, calloutSpeaker: mods.calloutSpeaker ?? "" } : {}),
          ...(mods.section04Title ? { section04Title: mods.section04Title } : {}), ...(mods.section04Body ? { section04Body: mods.section04Body } : {}),
          ...(mods.chessboard ? { chessboard: mods.chessboard } : {}), ...(mods.readBody ? { readBody: mods.readBody } : {}),
          watching: (mods.watching ?? []).map((w, j) => ({ _key: `w${j}`, ...w })),
          stats: (mods.stats ?? []).map((x, j) => ({ _key: `s${j}`, ...x })),
          facts: (mods.facts ?? []).map((f, j) => ({ _key: `f${j}`, ...f })),
        });
        cur = { ...cur, ...patch };
        log(`  ${tag}: re-laid modules, coverage ${Math.round(moduleCoverage(s, s.bodyMarkdown) * 100)}% → ${Math.round(m.coverage * 100)}%`);
      } catch (err) { log(`  ${tag}: re-lay failed (${err instanceof Error ? err.message.slice(0, 80) : err}); keeping current modules`); }
    }
    // 2. The additions.
    const need = shortfall(cur);
    if (need > 0) {
      const x = await expandStory(draft, p.pack, brief, material, { need, hasMissing: Boolean(cur.missing), tier: "economy", log: (l) => log(`  ${tag}: ${l}`) });
      for (const c of x.calls) cost += c.costUsd ?? 0;
      if (!cur.missing && x.expansion.missing) { patch.missing = x.expansion.missing; cur.missing = x.expansion.missing; }
      if (x.expansion.questions.length) { patch.questions = x.expansion.questions.map((q, i) => ({ _key: `q${i}`, ...q })); cur.questions = x.expansion.questions; }
    }
    const after = renderedWords(cur);
    if (after >= RENDER_FLOOR) reached++;
    if (Object.keys(patch).length && !DRY) { patch.updatedAt = new Date().toISOString(); await writeClient.patch(s._id).set(patch).commit(); }
    done++;
    log(`OK ${tag}: ${before} → ${after} rendered words${after < RENDER_FLOOR ? " (STILL UNDER)" : ""} · ${Object.keys(patch).filter((k) => k !== "updatedAt").join(",") || "no change"}`);
  } catch (err) { failed++; log(`FAILED ${tag}: ${err instanceof Error ? err.message.slice(0, 160) : err}`); }
}
const queue = [...rows];
await Promise.all(Array.from({ length: Math.min(POOL, queue.length) }, async () => { while (queue.length) await one(queue.shift()!); }));
log(`DONE: ${done} processed · ${reached} at/above ${RENDER_FLOOR} · ${failed} failed · $${cost.toFixed(2)}`);
