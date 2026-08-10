// One-off script: publishes Josh Pate's real, human-written playoff-bracket
// column (docs/content/josh-playoff-bracket-2026.md) straight to Sanity as a
// "published" article — bypassing the ai-drafted approval queue, since this
// piece was never AI-drafted in the first place. Byline "Josh Pate" is
// correct here (see AGENTS.md/task brief: human-authored, not AI).
//
// Run with: npx tsx scripts/publish-josh-bracket.mts
//
// Loads env vars from .env.local itself (this runs outside Next, which is
// the only thing that auto-loads .env.local) — must happen BEFORE importing
// lib/sanity.ts, since that module reads process.env at import time. Same
// pattern as scripts/backfill-heroes.mts.
import { readFileSync, existsSync } from "node:fs";
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

const { writeClient, uploadHeroImage, setArticleHeroImage } = await import("../lib/sanity.ts");
const { generateArticleHero } = await import("../lib/hero-image.ts");

const ARTICLE_ID = "article-josh-bracket-2026";
const SLUG = "my-2026-playoff-bracket-on-the-record";
const MD_PATH = join(process.cwd(), "docs/content/josh-playoff-bracket-2026.md");

// The article's strongest standalone line — picked by hand for the pull
// quote. Must match the source file verbatim (checked below).
const PULLQUOTE_LINE =
  "Ten-and-two teams don't fear road games. Grown-ups don't fear zip codes.";

// The source file's closing line pointing at a companion episode carries a
// specific timestamp ("the Indiana argument starts at 22:41") that belongs
// to a not-yet-published episode ("The Full 2026 Bracket Breakdown"). We
// only ever embed a REAL episode doc that already exists in Sanity, so that
// line is swapped for an [EMBED:00:00] marker referencing whichever real
// episode the GROQ lookup below finds — never the fabricated title/timestamp.
const COMPANION_LINE_RE = /^▶ Watch the companion episode:.*$/m;

interface EpisodeRef {
  _id: string;
  title: string;
  ytId: string;
}

function parseArticle(raw: string): { title: string; body: string } {
  const lines = raw.split("\n");
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  const title = lines[i]?.trim() ?? "";
  i++;
  while (i < lines.length && !lines[i].trim()) i++;
  if (lines[i]?.trim().startsWith("By ")) i++; // strip the byline/meta header line
  while (i < lines.length && !lines[i].trim()) i++;
  const body = lines.slice(i).join("\n").trim();
  return { title, body };
}

async function main() {
  if (!process.env.SANITY_WRITE_TOKEN) {
    console.error("SANITY_WRITE_TOKEN not set in .env.local — nothing to do.");
    process.exit(1);
  }
  if (!existsSync(MD_PATH)) {
    console.error(`Not found: ${MD_PATH}`);
    process.exit(1);
  }

  const raw = readFileSync(MD_PATH, "utf8");
  const { title, body: rawBody } = parseArticle(raw);
  if (title !== "My 2026 Playoff Bracket, On the Record") {
    console.error(`Unexpected title parsed from file: "${title}" — aborting rather than guessing.`);
    process.exit(1);
  }
  if (!rawBody.includes(PULLQUOTE_LINE)) {
    console.error("Pull-quote line not found verbatim in the source file — aborting rather than guessing.");
    process.exit(1);
  }

  // Idempotency: don't double-publish if this has already run.
  const existing = await writeClient.fetch<string | null>(`*[_id == $id][0]._id`, { id: ARTICLE_ID });
  if (existing) {
    console.log(`${ARTICLE_ID} already exists — nothing to do.`);
    return;
  }

  // Find the most relevant existing episode to reference — one whose title
  // mentions playoff/predictions (there's a real "Boldest CFB Predictions"
  // episode). Deterministic pick if more than one matches; null (and no
  // embed marker) if nothing matches.
  const episodeMatches = await writeClient.fetch<EpisodeRef[]>(
    `*[_type == "episode" && (title match "*playoff*" || title match "*predict*" || title match "*bracket*")] | order(publishedAt asc){ _id, title, ytId }`
  );
  const episode = episodeMatches[0] ?? null;
  console.log(episode ? `Referencing episode: ${episode._id} — "${episode.title}"` : "No matching episode found — publishing without an embed.");

  // Build the markdown body: swap the companion-episode line for a real
  // embed marker (or drop it entirely if no episode was found), then insert
  // exactly one [PULLQUOTE] marker right after the chosen standalone line.
  let body = rawBody;
  if (episode) {
    body = body.replace(COMPANION_LINE_RE, "[EMBED:00:00]");
  } else {
    body = body.replace(COMPANION_LINE_RE, "").replace(/\n{3,}/g, "\n\n").trim();
  }
  body = body.replace(PULLQUOTE_LINE, `${PULLQUOTE_LINE}\n\n[PULLQUOTE]`);

  const dek =
    "Twelve teams, four byes, and one very public Indiana pick — Josh locks his whole 2026 playoff bracket in writing before the season proves him right or makes him eat it.";

  const doc = {
    _id: ARTICLE_ID,
    _type: "article",
    headline: title,
    slug: { _type: "slug", current: SLUG },
    dek,
    bodyMarkdown: body,
    pullQuote: PULLQUOTE_LINE,
    ...(episode ? { episode: { _type: "reference", _ref: episode._id } } : {}),
    byline: "Josh Pate",
    workflowState: "published" as const,
    lowConfidence: false,
    primaryTeam: "Georgia Bulldogs",
    teams: [
      "Georgia Bulldogs", "Ohio State Buckeyes", "Texas Longhorns", "Indiana Hoosiers",
      "Clemson Tigers", "Boise State Broncos", "Oregon Ducks", "Penn State Nittany Lions",
      "LSU Tigers", "Notre Dame Fighting Irish", "Alabama Crimson Tide", "Miami Hurricanes",
    ],
    tags: ["Playoffs", "JP Poll", "Receipts", "Josh Pate"],
    seoTitle: "Josh Pate's 2026 Playoff Bracket, On the Record",
    seoDescription:
      "Josh Pate locks in his full 2026 playoff bracket — Georgia over Ohio State in the final, and an Indiana upset over Texas he's ready to defend.",
    publishedAt: new Date().toISOString(),
  };

  await writeClient.createIfNotExists(doc);
  console.log(`Created ${ARTICLE_ID} (workflowState: published, slug: ${SLUG}).`);

  // Hero image — best-effort, same as scripts/backfill-heroes.mts.
  if (!process.env.BFL_API_KEY) {
    console.log("BFL_API_KEY not set — skipping hero image generation.");
    return;
  }
  process.stdout.write("Generating hero image... ");
  try {
    const buffer = await generateArticleHero(doc.headline, doc.teams);
    if (!buffer) {
      console.log("FAIL (no image generated)");
      return;
    }
    const assetId = await uploadHeroImage(buffer);
    if (!assetId) {
      console.log("FAIL (upload failed)");
      return;
    }
    await setArticleHeroImage(ARTICLE_ID, assetId);
    console.log(`OK (${assetId})`);
  } catch (err) {
    console.log(`FAIL (${err instanceof Error ? err.message : String(err)})`);
  }
}

main().catch((err) => {
  console.error("[publish-josh-bracket] fatal", err);
  process.exit(1);
});
