// Batch re-voice of the article archive (Josh's sign-off, 2026-08-19):
// re-drafts every episode-backed article through the live pipeline —
// fresh transcript, fresh quote extraction, draftCompanion under the
// current prompts (Voice Manual v2.2) and the current writer (luna) —
// then patches ONLY the voice fields: headline, dek, bodyMarkdown,
// pullQuote, seoTitle, seoDescription. Slug (the URL), hero image,
// teams/tags, byline, workflowState, and publishedAt are never touched.
//
// An article is SKIPPED (old version kept) when its transcript can't be
// fetched or the new draft fails the verbatim-quote gate — a re-voice
// never replaces a grounded article with a low-confidence one.
//
// Originals are appended to a JSONL backup before each patch; Sanity's
// own revision history is the second undo path.
//
// Run:  npx tsx scripts/revoice-archive.mts --dry-run
//       npx tsx scripts/revoice-archive.mts [--limit N] [--only <articleId>]
import { readFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

function loadDotEnvLocal() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
}
loadDotEnvLocal();

const { writeClient } = await import("../lib/sanity.ts");
const { fetchTranscript, transcriptToPromptText } = await import("../lib/transcript.ts");
const { draftCompanion, extractQuotes } = await import("../lib/generate.ts");
const { storeQuotes } = await import("../lib/quotes.ts");
const { WRITER_PROVIDER } = await import("../lib/writer.ts");

const DRY_RUN = process.argv.includes("--dry-run");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : Infinity;
const onlyArg = process.argv.indexOf("--only");
const ONLY = onlyArg !== -1 ? process.argv[onlyArg + 1] : null;

interface Row {
  _id: string;
  headline: string;
  slug: string;
  workflowState: string;
  byline?: string;
  episode: {
    ytId: string;
    title: string;
    description?: string;
    publishedAt: string;
    series?: string;
    transcriptStatus?: string;
  } | null;
}

const rows = await writeClient.fetch<Row[]>(
  `*[_type == "article" && defined(episode._ref)] | order(publishedAt asc) {
    _id, headline, "slug": slug.current, workflowState, byline,
    episode->{ ytId, title, description, publishedAt, series, transcriptStatus }
  }`
);

const targets = rows
  .filter((r) => r.episode?.ytId)
  // Josh-byline articles are hand-approved pieces (e.g. the bracket) — the
  // pipeline never rewrites what Josh signed. Staff/AI drafts only.
  .filter((r) => r.byline !== "Josh Pate")
  .filter((r) => (ONLY ? r._id === ONLY : true))
  .slice(0, LIMIT);

console.log(`writer provider: ${WRITER_PROVIDER} (${process.env.OPENAI_WRITER_MODEL ?? "default model"})`);
console.log(`${rows.length} episode-backed articles found; processing ${targets.length}${DRY_RUN ? " (DRY RUN)" : ""}\n`);

if (DRY_RUN) {
  for (const r of targets) {
    console.log(`- [${r.workflowState}] ${r._id}  "${r.headline}"  (transcript: ${r.episode?.transcriptStatus ?? "?"})`);
  }
  process.exit(0);
}

const backupDir = join(process.cwd(), ".superpowers");
mkdirSync(backupDir, { recursive: true });
const backupPath = join(backupDir, `revoice-backup-${new Date().toISOString().slice(0, 10)}.jsonl`);

let patched = 0, skippedNoTranscript = 0, skippedLowConfidence = 0, failed = 0;

for (const r of targets) {
  const ep = r.episode!;
  const label = `${r._id} "${r.headline.slice(0, 60)}"`;
  try {
    const segs = await fetchTranscript(ep.ytId);
    const transcriptText = segs ? transcriptToPromptText(segs) : null;
    if (!transcriptText) {
      console.log(`SKIP (no transcript)  ${label}`);
      skippedNoTranscript++;
      continue;
    }

    const quotes = await extractQuotes(transcriptText);
    if (quotes.length > 0) await storeQuotes(ep.ytId, quotes); // idempotent upsert

    const draft = await draftCompanion({
      title: ep.title,
      description: ep.description ?? "",
      publishedAt: ep.publishedAt,
      series: ep.series ?? "general",
      transcriptText,
      extractedQuotes: quotes,
    });

    if (!draft || draft.lowConfidence === true) {
      console.log(`SKIP (low confidence) ${label}`);
      skippedLowConfidence++;
      continue;
    }

    const original = await writeClient.fetch(`*[_id == $id][0]`, { id: r._id });
    appendFileSync(backupPath, JSON.stringify(original) + "\n");

    await writeClient
      .patch(r._id)
      .set({
        headline: draft.headline,
        dek: draft.dek,
        bodyMarkdown: draft.bodyMarkdown,
        pullQuote: draft.pullQuote,
        seoTitle: draft.seo.title,
        seoDescription: draft.seo.description,
      })
      .commit();

    patched++;
    console.log(`OK  ${r._id}\n    old: ${r.headline}\n    new: ${draft.headline}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${label}`, err);
  }
}

console.log(
  `\ndone: ${patched} re-voiced, ${skippedNoTranscript} skipped (no transcript), ` +
  `${skippedLowConfidence} skipped (low confidence), ${failed} failed`
);
console.log(`originals backed up to ${backupPath}`);
