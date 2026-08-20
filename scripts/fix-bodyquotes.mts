// Body-quote cleanup (Isaac, 2026-08-20: in-article quoted text is
// "disjointed from the article itself, and often includes front or backend
// copy that shouldn't be there. The quotes need to come from the highest
// value 1–2 segments of the article directly.")
//
// For every [QUOTE:ts]…[/QUOTE] block in every staff article, a Sonnet
// print-editor judge returns keep / trim / drop:
//   keep — the quote supports its adjacent prose and reads like set type.
//   trim — same quote, tightened. Enforced locally: the trimmed text must be
//          a contiguous normalized substring of the ORIGINAL quote (edge
//          trims only — no new words can enter, first-letter case aside).
//   drop — the quote doesn't serve the passage it sits in, or the article
//          already keeps 2 better ones. The whole block is removed.
// At most 2 quotes survive per article. Prose is never touched.
//
// Run:  npx tsx scripts/fix-bodyquotes.mts [--dry-run] [--only <articleId>]
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

const DRY_RUN = process.argv.includes("--dry-run");
const onlyArg = process.argv.indexOf("--only");
const ONLY = onlyArg !== -1 ? process.argv[onlyArg + 1] : null;
const anthropic = new Anthropic();

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const QUOTE_RE = /\[QUOTE:([\d:]+)\]([\s\S]*?)\[\/QUOTE\]/g;

interface Row { _id: string; headline: string; bodyMarkdown: string }
const rows = await writeClient.fetch<Row[]>(
  `*[_type == "article" && defined(episode._ref) && byline != "Josh Pate"]{ _id, headline, bodyMarkdown }`
);
const targets = rows.filter((r) => (ONLY ? r._id === ONLY : true)).filter((r) => QUOTE_RE.test(r.bodyMarkdown));
console.log(`${targets.length} articles with body quotes${DRY_RUN ? " (DRY RUN)" : ""}\n`);

const logPath = join(process.cwd(), ".superpowers", "bodyquote-fixes.log");
let changed = 0, untouched = 0, failed = 0;

for (const r of targets) {
  try {
    QUOTE_RE.lastIndex = 0;
    const quotes: { full: string; ts: string; text: string; context: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = QUOTE_RE.exec(r.bodyMarkdown))) {
      const start = Math.max(0, m.index - 350);
      quotes.push({
        full: m[0],
        ts: m[1],
        text: m[2].trim(),
        context: r.bodyMarkdown.slice(start, m.index).replace(/\[QUOTE:[\d:]+\]|\[\/QUOTE\]|\[PULLQUOTE\]/g, "").trim().slice(-300),
      });
    }
    if (quotes.length === 0) { untouched++; continue; }

    const res = await anthropic.messages.create({
      model: "claude-sonnet-5",
      // 2048 truncated two multi-quote verdicts mid-string — effort-high
      // reasoning shares this budget with the JSON answer.
      max_tokens: 4096,
      output_config: {
        effort: "high",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              verdicts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: { type: "number" },
                    verdict: { type: "string", enum: ["keep", "trim", "drop"] },
                    trimmed: { type: "string" },
                  },
                  required: ["index", "verdict", "trimmed"],
                  additionalProperties: false,
                },
              },
            },
            required: ["verdicts"],
            additionalProperties: false,
          },
        },
      },
      system: `You are a print editor auditing the spoken blockquotes inside an article. For EACH numbered quote, judge against its surrounding prose:
- "keep": the quote directly supports the passage it sits in AND reads like set type (no ramp opener, no trailing fragment). Return it unchanged in trimmed.
- "trim": right quote, wrong boundaries — return the tightened version in trimmed. A trim may ONLY remove words from the start and/or end of the quote (you may capitalize the new first letter); never reword, never cut interior words.
- "drop": the quote argues something the surrounding prose doesn't, or is redundant with a better quote. Return "" in trimmed.
An article keeps AT MOST its 2 highest-value quotes — the ones anchoring its strongest passages. If more than 2 exist, drop the weakest. One well-placed quote is fine; zero is acceptable if none serve their passages.
Output valid JSON matching the schema, nothing else.`,
      messages: [{
        role: "user",
        content: `ARTICLE HEADLINE: ${r.headline}\n\n${quotes
          .map((q, i) => `QUOTE ${i}:\nPRECEDING PROSE: …${q.context}\nQUOTE TEXT: "${q.text}"`)
          .join("\n\n")}`,
      }],
    });
    const block = res.content.find((b) => b.type === "text");
    const verdicts: { index: number; verdict: string; trimmed: string }[] =
      JSON.parse(block && block.type === "text" ? block.text : "{}").verdicts ?? [];

    let body = r.bodyMarkdown;
    let edits = 0;
    let keptCount = verdicts.filter((v) => v.verdict !== "drop").length;
    for (const v of verdicts) {
      const q = quotes[v.index];
      if (!q) continue;
      if (v.verdict === "drop") {
        body = body.replace(q.full, "").replace(/\n{3,}/g, "\n\n");
        edits++;
      } else if (v.verdict === "trim") {
        const t = v.trimmed.trim();
        // Edge-trim guarantee: normalized trimmed text must be a substring
        // of the normalized original — no new words can enter the quote.
        if (t && norm(q.text).includes(norm(t)) && t.length < q.text.length) {
          body = body.replace(q.full, `[QUOTE:${q.ts}]${t}[/QUOTE]`);
          edits++;
        }
      }
    }
    // Belt and braces on the 2-quote cap even if the judge kept more.
    if (keptCount > 2) {
      QUOTE_RE.lastIndex = 0;
      const remaining = [...body.matchAll(new RegExp(QUOTE_RE.source, "g"))];
      for (const extra of remaining.slice(2)) {
        body = body.replace(extra[0], "").replace(/\n{3,}/g, "\n\n");
        edits++;
      }
    }

    if (edits === 0 || body === r.bodyMarkdown) { untouched++; console.log(`OK   ${r._id} (${quotes.length} quotes fine)`); continue; }
    if (!DRY_RUN) {
      await writeClient.patch(r._id).set({ bodyMarkdown: body }).commit();
      appendFileSync(logPath, JSON.stringify({ id: r._id, verdicts, originals: quotes.map((q) => q.text) }) + "\n");
    }
    changed++;
    console.log(`EDIT ${r._id}: ${verdicts.map((v) => v.verdict).join(", ")}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${r._id}`, err instanceof Error ? err.message.slice(0, 150) : err);
  }
}
console.log(`\ndone: ${changed} edited, ${untouched} untouched, ${failed} failed`);
