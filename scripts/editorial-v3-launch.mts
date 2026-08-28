// Editorial Engine V3 launch backfill (Isaac, 2026-08-28: "launch this on
// the site for all of today's articles and backdate yesterday's articles").
// Regenerates the last two days' college-football content in place with V3
// — same _id, slug and publishedAt (yesterday stays dated yesterday) — and
// keeps every replaced field in the run record for rollback. Off-sport Wire
// stories (the NFL/soccer leak) are listed, not regenerated. Josh's held
// drafts stay held.
//   npx tsx scripts/editorial-v3-launch.mts [--since 2026-08-27T04:00:00Z] [--dry]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
for (const l of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim(); }
process.env.EDITORIAL_V3_ENABLED = "true"; process.env.EDITORIAL_V3_REPORTED_ENABLED = "true"; process.env.EDITORIAL_V3_JOSH_ENABLED = "true"; process.env.EDITORIAL_V3_SHADOW_MODE = "false";
const arg = (k: string) => { const i = process.argv.indexOf(k); return i !== -1 ? process.argv[i + 1] : undefined; };
const SINCE = arg("--since") ?? "2026-08-27T04:00:00Z";
const DRY = process.argv.includes("--dry"); const ARTICLES_ONLY = process.argv.includes("--articles-only");
const { writeClient } = await import("../lib/sanity.ts");
const { isOffTopic } = await import("../lib/wire.ts");
const { v3WireStory, v3ReactionArticle } = await import("../lib/editorial-v3/production.ts");
mkdirSync(".superpowers/v3-launch", { recursive: true });
const report: string[] = [];
const say = (l: string) => { console.log(l); report.push(l); };

// --- Wire stories -----------------------------------------------------------
const stories = await writeClient.fetch<{ _id: string; headline: string; publishedAt: string; category?: string; teams?: string[]; whatHappened?: string; deck?: string; sources?: { outlet?: string; url?: string }[]; "item": { _id: string; sourceUrls?: string[]; sourceOutlets?: string[] } | null }[]>(
  `*[_type=="wireStory" && publishedAt >= $since] | order(publishedAt asc){ _id, headline, publishedAt, category, teams, whatHappened, deck, sources, "item": *[_type=="wireItem" && references(^._id)][0]{ _id, sourceUrls, sourceOutlets } }`, { since: SINCE });
say(`Wire stories since ${SINCE}: ${stories.length}${ARTICLES_ONLY ? " (skipped: --articles-only)" : ""}`);
const offSport: string[] = [];
for (const s of ARTICLES_ONLY ? [] : stories) {
  if (isOffTopic(s.headline, `${s.deck ?? ""} ${s.whatHappened ?? ""}`)) { offSport.push(`${s.publishedAt.slice(0, 16)} ${s.headline}`); continue; }
  const urls = s.item?.sourceUrls?.length ? s.item.sourceUrls : (s.sources ?? []).map((x) => x.url!).filter(Boolean);
  const outlets = s.item?.sourceOutlets ?? (s.sources ?? []).map((x) => x.outlet ?? "web");
  const refs = urls.map((u, i) => ({ outlet: outlets[i] ?? outlets[0] ?? "web", url: u, feedText: s.whatHappened }));
  say(`\n→ ${s.publishedAt.slice(0, 16)} ${s.headline}`);
  const v3 = await v3WireStory({ clusterKey: s._id.replace(/^wireStory-/, ""), teams: s.teams ?? [], refs, category: s.category, mode: "live" });
  if (!v3.ok) { say(`   skipped: ${v3.reason}`); continue; }
  const before = await writeClient.fetch<Record<string, unknown>>(`*[_id == $id][0]`, { id: s._id });
  writeFileSync(`.superpowers/v3-launch/${s._id}.before.json`, JSON.stringify(before, null, 2));
  say(`   V3: "${v3.fields.headline}" · ${(v3.fields.bodyMarkdown as string).split(/\s+/).length} words · depth ${v3.fields.v3Depth} · run ${v3.run.id}`);
  if (DRY) continue;
  await writeClient.patch(s._id).set({ ...v3.fields, updatedAt: new Date().toISOString(), corrections: [...((before.corrections as unknown[]) ?? []), { _key: `v3-${Date.now()}`, at: new Date().toISOString(), note: "Rewritten by the desk under Editorial Engine V3 from the same sources; original date kept." }] }).unset(["whyBody", "missing", "section04Title", "section04Body", "chessboard", "board", "readBody", "readLabel", "whatsNext", "whyItMatters", "callout"]).commit();
  if (s.item) await writeClient.patch(s.item._id).set({ headline: v3.fields.headline as string }).commit();
  say(`   written (publishedAt kept: ${s.publishedAt})`);
}
if (offSport.length) { say(`\nOFF-SPORT Wire stories left untouched (${offSport.length}) — the feed filter now catches these going forward:`); for (const o of offSport) say(`   · ${o}`); }

// --- staff articles (the daily house reaction) ------------------------------
const arts = await writeClient.fetch<{ _id: string; headline: string; byline: string; workflowState: string; publishedAt?: string; _createdAt: string; tags?: string[]; teams?: string[]; bodyMarkdown?: string; "ep": string | null }[]>(
  `*[_type=="article" && coalesce(publishedAt, _createdAt) >= $since] | order(coalesce(publishedAt, _createdAt) asc){ _id, headline, byline, workflowState, publishedAt, _createdAt, tags, teams, bodyMarkdown, "ep": episode->ytId }`, { since: SINCE });
say(`\nArticles since ${SINCE}: ${arts.length}`);
for (const a of arts) {
  if (a.ep) { say(`→ held Josh draft left as is (${a.workflowState}): ${a.headline} — Josh's Read is rebuilt from the show by the ingest path going forward`); continue; }
  say(`\n→ ${(a.publishedAt ?? a._createdAt).slice(0, 16)} ${a.byline}: ${a.headline}`);
  // The reaction's sources are the Wire stories it was built from: find them by shared teams in the window.
  const teams = a.teams ?? [];
  const srcStories = await writeClient.fetch<{ _id: string; headline: string; sources?: { outlet?: string; url?: string }[]; whatHappened?: string }[]>(`*[_type=="wireStory" && publishedAt >= $from && count((teams[])[@ in $teams]) > 0]{ _id, headline, sources, whatHappened }`, { from: new Date(new Date(a.publishedAt ?? a._createdAt).getTime() - 96 * 3600_000).toISOString(), teams });
  const refs = srcStories.flatMap((d) => (d.sources ?? []).filter((x) => x.url).map((x) => ({ outlet: x.outlet ?? "web", url: x.url!, feedText: d.whatHappened })));
  if (refs.length === 0) { say(`   skipped: no Wire sources found for teams ${teams.join(", ")}`); continue; }
  const v3 = await v3ReactionArticle({ sourceId: a._id, refs, teams, mode: "live" });
  if (!v3.ok) { say(`   skipped: ${v3.reason}`); continue; }
  const before = await writeClient.fetch<Record<string, unknown>>(`*[_id == $id][0]`, { id: a._id });
  writeFileSync(`.superpowers/v3-launch/${a._id}.before.json`, JSON.stringify(before, null, 2));
  say(`   V3: "${v3.fields.headline}" · ${(v3.fields.bodyMarkdown as string).split(/\s+/).length} words · run ${v3.run.id}`);
  if (DRY) continue;
  await writeClient.patch(a._id).set({ ...v3.fields, tags: [...(a.tags ?? []).filter((t) => !t.startsWith("engine:")), ...(v3.fields.tags as string[])], corrections: [...((before.corrections as unknown[]) ?? []), { _key: `v3-${Date.now()}`, at: new Date().toISOString(), note: "Rewritten by the desk under Editorial Engine V3 from the same sources; original date kept." }] }).commit();
  say(`   written (publishedAt kept: ${a.publishedAt ?? a._createdAt})`);
}
writeFileSync(".superpowers/v3-launch/report.txt", report.join("\n"));
console.log("\nreport: .superpowers/v3-launch/report.txt");
