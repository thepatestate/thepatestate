// One-off (2026-08-20): outlet names out of every wire headline. Two lanes:
//   1. cleanHeadline's deterministic strip fixes "Outlet reports/ranks …"
//      openers and trailing "…, per X" leans.
//   2. Headlines still naming an outlet after that (outlet woven in as
//      grammar — "Miami's New QB Headlines Yahoo Sports' ACC Transfer
//      List") get a Sonnet rewrite, batched, with hard guards: no outlet
//      names in the output, ≤14 words, non-empty.
// Slugs/URLs are untouched — only display headlines change.
//
// Run:  npx tsx scripts/fix-outlet-headlines.mts [--dry-run]
import { readFileSync, existsSync, appendFileSync } from "node:fs";
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

const { default: Anthropic } = await import("@anthropic-ai/sdk");
const { writeClient } = await import("../lib/sanity.ts");
const { cleanHeadline, headlineNamesOutlet } = await import("../lib/wire.ts");

const DRY_RUN = process.argv.includes("--dry-run");
const anthropic = new Anthropic();
const logPath = join(process.cwd(), ".superpowers", "outlet-headline-fixes.log");

async function rewriteBatch(rows: { id: string; headline: string; sub?: string }[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < rows.length; i += 20) {
    const batch = rows.slice(i, i + 20);
    const res = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              rewrites: {
                type: "array",
                items: {
                  type: "object",
                  properties: { index: { type: "number" }, headline: { type: "string" } },
                  required: ["index", "headline"],
                  additionalProperties: false,
                },
              },
            },
            required: ["rewrites"],
            additionalProperties: false,
          },
        },
      },
      system: `You rewrite news headlines to remove media-outlet names (On3, ESPN, Yahoo, Yahoo Sports, CBS Sports, 247Sports, Athlon, Rivals). The news claim is the subject, never who reported or ranked it. Keep every factual element, keep the register (bold declarative, ≤ 12 words, no exclamation points, no clickbait), and invent nothing — if the headline is about an outlet's list or ranking, lead with the claim the list makes ("Miami's transfer QB tops the ACC portal class"), attributing to no one. Return one rewrite per input index. Output valid JSON matching the schema, nothing else.`,
      messages: [{
        role: "user",
        content: batch.map((r, j) => `${j}: ${r.headline}${r.sub ? `\n   context: ${r.sub}` : ""}`).join("\n"),
      }],
    });
    const block = res.content.find((b) => b.type === "text");
    const rewrites: { index: number; headline: string }[] =
      JSON.parse(block && block.type === "text" ? block.text : "{}").rewrites ?? [];
    for (const rw of rewrites) {
      const row = batch[rw.index];
      const h = (rw.headline ?? "").trim();
      if (!row || !h || headlineNamesOutlet(h) || h.split(/\s+/).length > 14) continue;
      out.set(row.id, h);
    }
    console.log(`  model batch ${i / 20 + 1}: ${rewrites.length} returned`);
  }
  return out;
}

for (const type of ["wireItem", "wireStory"]) {
  const rows: { _id: string; headline?: string; sub?: string }[] = await writeClient.fetch(
    `*[_type == $t]{ _id, headline, sub }`, { t: type },
  );
  const stripped: { id: string; headline: string }[] = [];
  const needModel: { id: string; headline: string; sub?: string }[] = [];
  for (const r of rows) {
    const h = r.headline ?? "";
    if (!headlineNamesOutlet(h)) continue;
    const cleaned = cleanHeadline(h);
    if (cleaned && !headlineNamesOutlet(cleaned)) stripped.push({ id: r._id, headline: cleaned });
    else needModel.push({ id: r._id, headline: h, sub: r.sub });
  }
  console.log(`${type}: ${stripped.length} strip-fixable, ${needModel.length} need rewrite`);

  const rewrites = needModel.length ? await rewriteBatch(needModel) : new Map<string, string>();
  const patches = [...stripped, ...[...rewrites].map(([id, headline]) => ({ id, headline }))];
  if (!DRY_RUN) {
    for (let i = 0; i < patches.length; i += 50) {
      let tx = writeClient.transaction();
      for (const p of patches.slice(i, i + 50)) tx = tx.patch(p.id, (t) => t.set({ headline: p.headline }));
      await tx.commit();
    }
    for (const p of patches) appendFileSync(logPath, JSON.stringify({ type, ...p }) + "\n");
  }
  console.log(`${type}: patched ${patches.length} (${needModel.length - rewrites.size} unresolved)`);
}
console.log("OUTLET HEADLINES DONE");
