// One-off backfill: generates + uploads + patches a heroImage for every
// published/drafted article that doesn't already have one. Run with:
//   npx tsx scripts/backfill-heroes.mts
// Loads env vars from .env.local itself (this runs outside Next, which is
// the only thing that auto-loads .env.local) — must happen BEFORE importing
// lib/sanity.ts, since that module reads process.env at import time.
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

interface ArticleStub {
  _id: string;
  headline: string;
  teams?: string[];
}

async function main() {
  if (!process.env.BFL_API_KEY) {
    console.error("BFL_API_KEY not set in .env.local — nothing to do.");
    process.exit(1);
  }
  if (!process.env.SANITY_WRITE_TOKEN) {
    console.error("SANITY_WRITE_TOKEN not set in .env.local — nothing to do.");
    process.exit(1);
  }

  const articles: ArticleStub[] = await writeClient.fetch(
    `*[_type == "article" && !defined(heroImage)]{ _id, headline, teams }`
  );

  console.log(`Found ${articles.length} article(s) missing heroImage.`);

  let ok = 0;
  let failed = 0;

  for (const article of articles) {
    process.stdout.write(`  ${article._id} — "${article.headline}" ... `);
    try {
      const buffer = await generateArticleHero(article.headline, article.teams ?? []);
      if (!buffer) {
        console.log("FAIL (no image generated)");
        failed++;
        continue;
      }
      const assetId = await uploadHeroImage(buffer);
      if (!assetId) {
        console.log("FAIL (upload failed)");
        failed++;
        continue;
      }
      await setArticleHeroImage(article._id, assetId);
      console.log(`OK (${assetId})`);
      ok++;
    } catch (err) {
      console.log(`FAIL (${err instanceof Error ? err.message : String(err)})`);
      failed++;
    }
  }

  console.log(`\nDone. ${ok} succeeded, ${failed} failed, out of ${articles.length}.`);
}

main().catch((err) => {
  console.error("[backfill-heroes] fatal", err);
  process.exit(1);
});
