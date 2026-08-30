// Josh's Read reset (2026-08-30, Isaac: "get rid of all of the old Josh
// articles that weren't written by Sol and only keep the 5 most recent ones —
// BUT have Sol re-write them from scratch from our latest update. Anything
// else needs to go.")
//
//   npx tsx scripts/josh-rebuild.mts --prune [--dry-run]
//     Snapshots EVERY Josh-bylined article doc to .superpowers/josh-pruned/,
//     then deletes: published articles outside the newest five, and
//     unpublished drafts not written by the V3 (Sol) lane.
//   npx tsx scripts/josh-rebuild.mts --rebuild [--only <articleId>] [--dry-run]
//     For each kept article: fresh transcript → v3JoshColumn (Sol writes,
//     Terra edits, fact check) → patch the voice fields. Slug, publishedAt,
//     byline, hero image and the episode reference never change. Originals
//     go to .superpowers/josh-rebuild-backup.jsonl before each patch.
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim().replace(/^"|"$/g, ""); }
const { writeClient } = await import("../lib/sanity.ts");
const { fetchTranscript, transcriptToPromptText } = await import("../lib/transcript.ts");
const { v3JoshColumn } = await import("../lib/editorial-v3/production.ts");
const { JOSH_BRACKET_LABEL, JOSH_BRACKET_FIELD, JOSH_BRACKET_FINAL } = await import("../lib/josh-bracket.ts");

const DRY = process.argv.includes("--dry-run");
const KEEP_N = 5;
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const V3_TAG = "engine:v3-additive";
// Teams per kept article (the old docs' team lists were noisy — the Heisman
// piece listed Alabama and Sol moved Miami's quarterback there).
const TEAMS: Record<string, string[]> = { "article-seRM0BbQgVM": ["miami", "notre-dame", "texas", "ohio-state", "oklahoma"], "article-aP34rxVUNzI": ["miami"], "article-7IqX8dOuRc0": ["texas", "lsu", "alabama", "ohio-state", "ole-miss", "georgia"], "article-LwE_lSoXwEE": ["penn-state", "oklahoma", "clemson", "lsu"], "article-9YqTl340irg": ["georgia", "alabama", "oregon", "ohio-state"] };

type Doc = { _id: string; workflowState: string; publishedAt?: string; headline?: string; tags?: string[]; teams?: string[]; primaryTeam?: string; episode?: { _ref: string } };
const all: Doc[] = await writeClient.fetch(`*[_type == "article" && byline == "Josh Pate"] | order(publishedAt desc)`);
const published = all.filter((d) => d.workflowState === "published" && !d._id.startsWith("drafts.")).sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
const keep = published.slice(0, KEEP_N);
console.log(`Josh-bylined docs: ${all.length} (published ${published.length}). Keeping ${keep.length}:`);
for (const k of keep) console.log(`  KEEP ${k._id} ${k.publishedAt?.slice(0, 10)} ${k.headline?.slice(0, 80)}`);

if (process.argv.includes("--prune")) {
  const dir = ".superpowers/josh-pruned"; mkdirSync(dir, { recursive: true });
  const keepIds = new Set(keep.map((k) => k._id));
  const victims = all.filter((d) => !keepIds.has(d._id) && !(d.workflowState !== "published" && (d.tags ?? []).includes(V3_TAG)));
  const spared = all.filter((d) => !keepIds.has(d._id) && !victims.includes(d));
  for (const s of spared) console.log(`  SPARE (Sol draft) ${s._id} ${s.workflowState} ${s.headline?.slice(0, 70)}`);
  console.log(`${DRY ? "Would delete" : "Deleting"} ${victims.length}: published ${victims.filter((v) => v.workflowState === "published").length}, drafts ${victims.filter((v) => v.workflowState !== "published").length}`);
  for (const d of all) writeFileSync(`${dir}/${d._id}.json`, JSON.stringify(d, null, 1));
  console.log(`snapshot: ${all.length} docs → ${dir}/`);
  if (!DRY) { let n = 0; for (const v of victims) { await writeClient.delete(v._id); n++; } console.log(`deleted ${n}`); }
}

if (process.argv.includes("--rebuild")) {
  const onRecord = `CONSISTENCY LEDGER — the site's on-record positions, supplied so the column never contradicts them. Cite at most one, and only if the segment itself is about rankings, the bracket, the playoff field or the champion pick; otherwise do not mention it. ${JOSH_BRACKET_LABEL} — field: ${JOSH_BRACKET_FIELD.map((t) => `${t.seed} ${t.name}`).join(", ")}; final on record: ${JOSH_BRACKET_FINAL}.`;
  let totalCost = 0;
  for (const a of keep) {
    if (only && a._id !== only) continue;
    const full = await writeClient.fetch(`*[_id == $id][0]{..., "ep": episode->{ytId, title, description, publishedAt}}`, { id: a._id });
    if (!full?.ep?.ytId) { console.log(`${a._id}: NO EPISODE — left as is`); continue; }
    const segs = await fetchTranscript(full.ep.ytId);
    if (!segs) { console.log(`${a._id}: NO TRANSCRIPT for ${full.ep.ytId} — left as is (flag for Isaac)`); continue; }
    const transcriptText = transcriptToPromptText(segs);
    const base = { ytId: full.ep.ytId, title: full.ep.title, description: full.ep.description ?? "", publishedAt: full.ep.publishedAt, transcriptText, teams: TEAMS[a._id] ?? full.teams ?? [], onRecord, mode: "live" as const };
    console.log(`${a._id}: transcript ${transcriptText.length} chars · running the desk (Sol → Terra)…`);
    let v3 = await v3JoshColumn(base);
    if (!v3.ok) { console.log(`   first pass: ${v3.reason} — retrying with the original column's assignment`); v3 = await v3JoshColumn({ ...base, assignment: `The column is about: ${full.headline}. ${full.dek ?? ""}` }); }
    const cost = ((v3 as any).run?.calls ?? []).reduce((s: number, c: any) => s + (c.costUsd ?? 0), 0); totalCost += cost;
    if (!v3.ok) { console.log(`   FAILED twice: ${v3.reason} — old text left in place (flag for Isaac) · $${cost.toFixed(2)}`); continue; }
    const f = v3.fields as Record<string, unknown> & { headline: string; tags: string[] };
    console.log(`   new: "${f.headline}" · lowConfidence ${v3.lowConfidence} · $${cost.toFixed(2)}`);
    if (DRY) continue;
    appendFileSync(".superpowers/josh-rebuild-backup.jsonl", JSON.stringify({ at: new Date().toISOString(), doc: full }) + "\n");
    await writeClient.patch(a._id).set({ headline: f.headline, dek: f.dek, bodyMarkdown: f.bodyMarkdown, pullQuote: f.pullQuote, primaryTeam: f.primaryTeam, teams: f.teams, tags: f.tags, seoTitle: f.seoTitle, seoDescription: f.seoDescription, lowConfidence: Boolean(v3.lowConfidence) }).commit();
    console.log(`   patched ${a._id} (slug/publishedAt/hero unchanged)`);
  }
  console.log(`REBUILD ${DRY ? "(dry run) " : ""}total $${totalCost.toFixed(2)}`);
}
