// Pull-quote repair pass (Isaac, 2026-08-19: bold quotes "don't really match
// up to the article itself" and "include things at the beginning or end that
// don't need to be there"). For every published episode-backed article:
// re-select the pull quote against the article's central claim, trim it to
// the take (edge trims free, interior cuts by ellipsis, first letter may be
// capitalized), verify it's still a verbatim transcript span, and move the
// [PULLQUOTE] marker beside the paragraph making the same argument.
//
// Selection runs on Anthropic (the verification side) — the writer keeps
// writing; the checker picks the receipt. Body prose is never touched except
// the marker's position.
//
// Run:  npx tsx scripts/fix-pullquotes.mts [--dry-run] [--only <articleId>]
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
const { fetchTranscript, transcriptToPromptText } = await import("../lib/transcript.ts");
const { findNonVerbatimQuotes } = await import("../lib/generate.ts");

const DRY_RUN = process.argv.includes("--dry-run");
const onlyArg = process.argv.indexOf("--only");
const ONLY = onlyArg !== -1 ? process.argv[onlyArg + 1] : null;
const anthropic = new Anthropic();

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

function relocateMarker(body: string, quote: string): string {
  const stripped = body.replace(/\[PULLQUOTE\]\s*/g, "");
  const qWords = new Set(norm(quote).split(" ").filter((w) => w.length >= 4));
  const paras = stripped.split(/\n\n+/);
  let best = 0, bestScore = -1;
  paras.forEach((p, i) => {
    if (p.startsWith("#") || p.trim().length < 60) return; // skip headings/short lines
    const pWords = new Set(norm(p).split(" "));
    let hit = 0;
    for (const w of qWords) if (pWords.has(w)) hit++;
    const score = qWords.size ? hit / qWords.size : 0;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  paras[best] = `[PULLQUOTE] ${paras[best]}`;
  return paras.join("\n\n");
}

interface Row {
  _id: string;
  headline: string;
  dek?: string;
  pullQuote?: string;
  bodyMarkdown: string;
  episode: { ytId: string } | null;
}

const rows = await writeClient.fetch<Row[]>(
  `*[_type == "article" && defined(episode._ref) && byline != "Josh Pate"]{
    _id, headline, dek, pullQuote, bodyMarkdown, episode->{ytId}
  }`
);
const targets = rows.filter((r) => r.episode?.ytId).filter((r) => (ONLY ? r._id === ONLY : true));
console.log(`${targets.length} articles to check${DRY_RUN ? " (DRY RUN)" : ""}\n`);

const logPath = join(process.cwd(), ".superpowers", "pullquote-fixes.log");
let fixed = 0, kept = 0, failed = 0;

for (const r of targets) {
  try {
    const segs = await fetchTranscript(r.episode!.ytId);
    const transcript = segs ? transcriptToPromptText(segs) : null;
    if (!transcript) { console.log(`KEEP (no transcript)  ${r._id}`); kept++; continue; }

    const res = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 512,
      output_config: {
        effort: "high",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              verdict: { type: "string", enum: ["keep", "replace"] },
              pullQuote: { type: "string" },
            },
            required: ["verdict", "pullQuote"],
            additionalProperties: false,
          },
        },
      },
      system: `You are a print editor auditing the pull quote of a published article. The test: would a magazine editor set this EXACT text in 24-point type? Judge the CURRENT pull quote:

verdict "replace" when ANY of these defects is present:
- Off-thesis: the quote isn't about the headline's central argument.
- Spoken windup inside or at the open: "has been and continues to be", "is going to be", "what I would say is", "I mean", "kind of", "sort of", "you know" — print cuts these.
- Starts lowercase mid-sentence, opens on connective ramp (And/So/But/Look/Now), or ends on a trailing fragment.
- Doubled or redundant phrasing a print editor would tighten.

verdict "keep" only when the quote argues the central claim AND reads like set type as-is. When keeping, return the current quote unchanged in pullQuote.

When replacing, the fix is often the SAME quote tightened — a shorter span, an interior cut, a capitalized first letter — not necessarily a different line. Rules for the replacement:
- Exact contiguous span from the transcript, or two spans joined with " … " for an interior cut (ignore [MM:SS] markers; never include them). Never change a word inside a span; capitalizing the first letter is allowed.
- Start at the first word of the claim, end at the last word that carries it. Never open on ramp; never end mid-thought.
- 8–35 words, self-contained, screenshot-worthy. If nothing meets ALL of these, verdict "keep".

Examples:
- CURRENT: "the first and biggest lie in college football has been and continues to be you are what your record says you are." → replace → "The first and biggest lie in college football … you are what your record says you are."
- CURRENT: "Rivalries should be more secure than Fort Knox." → keep.

Output valid JSON matching the schema, nothing else.`,
      messages: [{
        role: "user",
        content: `ARTICLE HEADLINE: ${r.headline}\nDEK: ${r.dek ?? ""}\nARTICLE OPENING:\n${r.bodyMarkdown.replace(/\[PULLQUOTE\]\s*/g, "").slice(0, 1200)}\n\nCURRENT PULL QUOTE (replace if off-thesis or badly trimmed): "${r.pullQuote ?? ""}"\n\nTRANSCRIPT:\n${transcript}`,
      }],
    });
    const block = res.content.find((b) => b.type === "text");
    const parsed = JSON.parse(block && block.type === "text" ? block.text : "{}");
    const q: string = (parsed.pullQuote ?? "").trim();
    if (parsed.verdict !== "replace") { console.log(`KEEP (verdict)        ${r._id}`); kept++; continue; }
    const words = q.split(/\s+/).filter(Boolean).length;
    if (!q || words < 5 || words > 45) { console.log(`KEEP (no valid pick)  ${r._id}`); kept++; continue; }
    // Hard local guards — a "fix" must never be worse than what it replaces.
    if (/^(and|so|but|look|i mean|you know|now|that means|because|also)\b/i.test(q)) {
      console.log(`KEEP (ramp opener)    ${r._id}  candidate: "${q.slice(0, 70)}…"`);
      kept++; continue;
    }
    if (!/[.!?…"']$/.test(q) && !/[a-z]$/i.test(q.split(/\s+/).pop() ?? "")) {
      console.log(`KEEP (ragged end)     ${r._id}`); kept++; continue;
    }
    if (findNonVerbatimQuotes(`"${q}"`, transcript).length > 0) {
      console.log(`KEEP (not verbatim)   ${r._id}  candidate: "${q.slice(0, 70)}…"`);
      kept++; continue;
    }
    if (q === (r.pullQuote ?? "").trim()) { console.log(`KEEP (unchanged)      ${r._id}`); kept++; continue; }

    if (!DRY_RUN) {
      await writeClient.patch(r._id).set({
        pullQuote: q,
        bodyMarkdown: relocateMarker(r.bodyMarkdown, q),
      }).commit();
      appendFileSync(logPath, JSON.stringify({ id: r._id, old: r.pullQuote, new: q }) + "\n");
    }
    fixed++;
    console.log(`FIX ${r._id}\n    old: "${(r.pullQuote ?? "").slice(0, 90)}"\n    new: "${q.slice(0, 90)}"`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${r._id}`, err instanceof Error ? err.message.slice(0, 200) : err);
  }
}
console.log(`\ndone: ${fixed} fixed, ${kept} kept, ${failed} failed`);
