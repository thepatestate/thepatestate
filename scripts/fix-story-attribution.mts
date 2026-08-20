// One-off (2026-08-20): strip in-prose source attribution from existing
// wire stories — "Per On3's report, …" openers and "The report examines…"
// narration — per Josh's directive that source credit lives only in the
// cited-sources footer. Facts must survive untouched: the rewrite may
// remove/reflow attribution phrasing only, never add or drop a fact.
// Runs on Anthropic (the verification side). Guards: output must clear the
// flipped attribution gate and stay within sane length of the original.
//
// Run:  npx tsx scripts/fix-story-attribution.mts [--dry-run]
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
const { hasAttributionOpener } = await import("../lib/wire.ts");

const DRY_RUN = process.argv.includes("--dry-run");
const anthropic = new Anthropic();

interface Row { _id: string; headline: string; whatHappened?: string; readBody?: string }
const rows = await writeClient.fetch<Row[]>(`*[_type == "wireStory"]{ _id, headline, whatHappened, readBody }`);
console.log(`${rows.length} wire stories${DRY_RUN ? " (DRY RUN)" : ""}\n`);

const logPath = join(process.cwd(), ".superpowers", "story-attribution-fixes.log");
let fixed = 0, clean = 0, failed = 0;

for (const r of rows) {
  try {
    const fields: { name: "whatHappened" | "readBody"; text: string }[] = [];
    for (const name of ["whatHappened", "readBody"] as const) {
      const text = r[name];
      if (text && hasAttributionOpener(text)) fields.push({ name, text });
    }
    if (fields.length === 0) { clean++; continue; }

    const patch: Record<string, string> = {};
    for (const f of fields) {
      const res = await anthropic.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 2048,
        output_config: {
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: { text: { type: "string" } },
              required: ["text"],
              additionalProperties: false,
            },
          },
        },
        system: `You edit one passage from a published news story. Remove ALL in-prose source attribution — "Per X's report," / "According to X," openers, and any narration of the report itself ("The report examines/says/notes/includes…") — and reflow so the facts are stated directly. Hard rules:
- Keep every fact. Add nothing. Remove only attribution phrasing and its connective tissue.
- Official actions keep natural phrasing ("Tennessee announced…", "unveiled…").
- Where a sentence only narrated the report ("The report examines his comments on X"), restate its factual content directly if it has any; drop it if it carried no fact.
- Keep the original length within ±20% and the same register. No exclamation points.
Output valid JSON matching the schema, nothing else.`,
        messages: [{ role: "user", content: `STORY HEADLINE: ${r.headline}\n\nPASSAGE:\n${f.text}` }],
      });
      const block = res.content.find((b) => b.type === "text");
      const out: string = (JSON.parse(block && block.type === "text" ? block.text : "{}").text ?? "").trim();
      const ratio = out.length / f.text.length;
      if (!out || hasAttributionOpener(out) || ratio < 0.5 || ratio > 1.4) {
        console.log(`SKIP (${f.name} guard)  ${r._id}`);
        continue;
      }
      patch[f.name] = out;
    }
    if (Object.keys(patch).length === 0) { failed++; continue; }
    if (!DRY_RUN) {
      await writeClient.patch(r._id).set(patch).commit();
      appendFileSync(logPath, JSON.stringify({ id: r._id, fields }) + "\n");
    }
    fixed++;
    console.log(`FIX ${r._id} (${Object.keys(patch).join(", ")})\n    was: ${fields[0].text.slice(0, 90)}\n    now: ${(patch[fields[0].name] ?? "").slice(0, 90)}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${r._id}`, err instanceof Error ? err.message.slice(0, 150) : err);
  }
}
console.log(`\ndone: ${fixed} fixed, ${clean} already clean, ${failed} failed/skipped`);
