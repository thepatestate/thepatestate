// Archive audit against the CURRENT editorial gates (read-only). Counts how
// many published wire stories and articles trip each lint in
// lib/editorial.ts (+ the wire prose gates), with one example headline per
// violation, so a retro pass can be sized before it is paid for.
//
// Run:  npx tsx scripts/audit-voice.mts
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
    if (key && !(key in process.env)) process.env[key] = line.slice(eq + 1).trim();
  }
}
loadDotEnvLocal();

const { writeClient } = await import("../lib/sanity.ts");
const { boilerplateViolations } = await import("../lib/editorial.ts");
const { hasFirstPersonProse, narratesSourcing } = await import("../lib/wire.ts");

interface Story { _id: string; headline: string; deck?: string; whatHappened?: string; whyBody?: string; missing?: string; section04Body?: string; chessboard?: string; readBody?: string }
interface Article { _id: string; headline: string; bodyMarkdown?: string; byline?: string }

const stories = await writeClient.fetch<Story[]>(
  `*[_type == "wireStory" && defined(deck)]{ _id, headline, deck, whatHappened, whyBody, missing, section04Body, chessboard, readBody }`,
);
const articles = await writeClient.fetch<Article[]>(
  `*[_type == "article" && workflowState == "published"]{ _id, headline, bodyMarkdown, byline }`,
);

function tally<T extends { headline: string }>(rows: T[], prose: (r: T) => string, label: string, wire: boolean) {
  const counts: Record<string, number> = {};
  const examples: Record<string, string> = {};
  let flagged = 0;
  for (const r of rows) {
    const p = prose(r);
    const v = boilerplateViolations(p);
    if (wire && hasFirstPersonProse(p)) v.push("first person");
    if (narratesSourcing(p)) v.push("source narration");
    if (v.length) flagged++;
    for (const n of new Set(v)) {
      counts[n] = (counts[n] ?? 0) + 1;
      examples[n] ??= r.headline.slice(0, 70);
    }
  }
  console.log(`\n${label}: ${flagged} flagged of ${rows.length}`);
  for (const [n, c] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(c).padStart(4)}  ${n}  e.g. "${examples[n]}"`);
  }
}

tally(stories, (s) => [s.deck, s.whatHappened, s.whyBody, s.missing, s.section04Body, s.chessboard, s.readBody].filter(Boolean).join("\n"), "wire stories", true);
tally(articles, (a) => a.bodyMarkdown ?? "", "articles (show adaptations + long-form)", false);
