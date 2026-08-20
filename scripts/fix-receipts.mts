// One-off (2026-08-20): receipts and callouts for the existing wire-story
// archive. Per story, one Sonnet call answers both questions:
//   1. Is the attached Josh's Receipt genuinely about THIS news? Team-only
//      matching attached Heisman takes to recruiting notes — irrelevant
//      receipts get unset.
//   2. Which verbatim sentence of the story's own text is the callout?
//      (selectCallout scores the story's own sentences — see lib/wire.ts.)
//
// Run:  npx tsx scripts/fix-receipts.mts [--dry-run]
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
const { selectCallout } = await import("../lib/wire.ts");

const DRY_RUN = process.argv.includes("--dry-run");
const anthropic = new Anthropic();
const logPath = join(process.cwd(), ".superpowers", "receipt-fixes.log");

interface Row {
  _id: string;
  headline: string;
  whatHappened?: string;
  whyItMatters?: string[];
  readBody?: string;
  callout?: string;
  joshReceipt?: { quote?: string } | null;
}
const rows = await writeClient.fetch<Row[]>(
  `*[_type == "wireStory"]{ _id, headline, whatHappened, whyItMatters, readBody, callout, joshReceipt }`
);
const targets = rows.filter((r) => !r.callout || r.joshReceipt?.quote);
console.log(`${rows.length} stories; ${targets.length} need callout and/or receipt review${DRY_RUN ? " (DRY RUN)" : ""}\n`);

let receiptsDropped = 0, receiptsKept = 0, callouts = 0, failed = 0;

for (const r of targets) {
  try {
    const combined = `${r.whatHappened ?? ""}\n${(r.whyItMatters ?? []).join("\n")}\n${r.readBody ?? ""}`;
    const res = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              receiptRelevant: { type: "boolean" },
              callout: { type: "string" },
            },
            required: ["receiptRelevant", "callout"],
            additionalProperties: false,
          },
        },
      },
      system: `Two jobs on one news story:
1. receiptRelevant — an archived spoken quote is attached to this story as "Josh said it first." True ONLY if the quote is clearly about the same specific subject as the story (same player, hire, game, ranking argument, storyline). Same team but different topic is false. No quote supplied → false.
2. callout — copy the story's single sharpest line VERBATIM from the story text below: the standalone, claim-carrying sentence a reader would screenshot (prefer the read/analysis over fact recitation; no outlet names). Exact substring, character-for-character.
Output valid JSON matching the schema, nothing else.`,
      messages: [{
        role: "user",
        content: `HEADLINE: ${r.headline}\n\nSTORY TEXT:\n${combined}\n\nATTACHED QUOTE:\n${r.joshReceipt?.quote ? `"${r.joshReceipt.quote}"` : "(none)"}`,
      }],
    });
    const block = res.content.find((b) => b.type === "text");
    const out = JSON.parse(block && block.type === "text" ? block.text : "{}") as { receiptRelevant: boolean; callout: string };

    const patch: Record<string, unknown> = {};
    const unset: string[] = [];
    if (r.joshReceipt?.quote) {
      if (out.receiptRelevant === true) receiptsKept++;
      else { unset.push("joshReceipt"); receiptsDropped++; }
    }
    if (!r.callout) {
      const c = selectCallout(r);
      if (c) { patch.callout = c; callouts++; }
    }
    if (Object.keys(patch).length === 0 && unset.length === 0) continue;
    if (!DRY_RUN) {
      let p = writeClient.patch(r._id);
      if (Object.keys(patch).length) p = p.set(patch);
      if (unset.length) p = p.unset(unset);
      await p.commit();
      appendFileSync(logPath, JSON.stringify({ id: r._id, unset, callout: patch.callout ?? null }) + "\n");
    }
    console.log(`${unset.length ? "DROP-RECEIPT" : "KEEP        "} ${patch.callout ? "+callout" : ""}  ${r._id.slice(0, 60)}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${r._id}`, err instanceof Error ? err.message.slice(0, 120) : err);
  }
}
console.log(`\ndone: receipts kept ${receiptsKept}, dropped ${receiptsDropped}; callouts added ${callouts}; failed ${failed}`);
