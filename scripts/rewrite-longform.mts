// In-place edit pass for standalone long-form articles (article-lf-*), the
// one archive with no regeneration path: their source packs were the wire
// coverage of the day and are gone. The rewrite keeps every fact and
// changes only the writing, under the current editorial system (Josh's
// Editorial Core + Notebook document), then must clear the same gates a new
// article clears plus a fact-check of the rewrite AGAINST THE ORIGINAL.
// Anything that fails keeps its current text. Originals are backed up to
// .superpowers/rewrite-backup-<date>.jsonl; Sanity history is the second undo.
//
// Run:  npx tsx scripts/rewrite-longform.mts [--dry-run] [--only <articleId>] [--all]
//   default: only long-form articles whose body trips the gates; --all: every article-lf-*.
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
    if (key && !(key in process.env)) process.env[key] = line.slice(eq + 1).trim();
  }
}
loadDotEnvLocal();

const { default: Anthropic } = await import("@anthropic-ai/sdk");
const { writeClient } = await import("../lib/sanity.ts");
const { writeJSON } = await import("../lib/writer.ts");
const { editorialSystem, readPrompt, boilerplateViolations, scoreDraft } = await import("../lib/editorial.ts");
const { narratesSourcing, hasFirstPersonProse, scrubDashes } = await import("../lib/wire.ts");
const { productForType } = await import("../lib/longform.ts");

const DRY_RUN = process.argv.includes("--dry-run");
const ALL = process.argv.includes("--all");
const onlyArg = process.argv.indexOf("--only");
const ONLY = onlyArg !== -1 ? process.argv[onlyArg + 1] : null;
const anthropic = new Anthropic();

interface Row { _id: string; headline: string; dek?: string; bodyMarkdown?: string; pullQuote?: string; tags?: string[]; seoTitle?: string; seoDescription?: string; workflowState?: string }
const rows = await writeClient.fetch<Row[]>(
  `*[_type == "article" && _id match "article-lf-*"] | order(publishedAt asc){ _id, headline, dek, bodyMarkdown, pullQuote, tags, seoTitle, seoDescription, workflowState }`,
);
const targets = rows
  .filter((r) => (ONLY ? r._id === ONLY : true))
  .filter((r) => (ALL || ONLY ? true : boilerplateViolations(r.bodyMarkdown ?? "").length > 0));
console.log(`${rows.length} long-form articles; rewriting ${targets.length}${DRY_RUN ? " (DRY RUN)" : ""}\n`);
if (DRY_RUN) {
  for (const r of targets) console.log(`- [${r.workflowState}] ${r._id}  gates: ${boilerplateViolations(r.bodyMarkdown ?? "").join(", ")}`);
  process.exit(0);
}

const SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" }, dek: { type: "string" }, bodyMarkdown: { type: "string" }, pullQuote: { type: "string" },
    seo: { type: "object", properties: { title: { type: "string" }, description: { type: "string" } }, required: ["title", "description"], additionalProperties: false },
  },
  required: ["headline", "dek", "bodyMarkdown", "pullQuote", "seo"],
  additionalProperties: false,
} as const;

mkdirSync(join(process.cwd(), ".superpowers"), { recursive: true });
const backupPath = join(process.cwd(), ".superpowers", `rewrite-backup-${new Date().toISOString().slice(0, 10)}.jsonl`);
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

let fixed = 0, held = 0, failed = 0;
for (const r of targets) {
  const label = `${r._id} "${r.headline.slice(0, 60)}"`;
  try {
    const typeId = (r.tags ?? []).find((t) => /^[A-Z]{2}-\d{2}$/.test(t)) ?? "NR-01";
    const product = productForType(typeId);
    const system = editorialSystem(product, readPrompt(product === "feature" ? "josh-column.md" : "news-reaction.md"));
    const original = `HEADLINE: ${r.headline}\nDEK: ${r.dek ?? ""}\nPULL QUOTE: ${r.pullQuote ?? ""}\n\n${r.bodyMarkdown ?? ""}`;
    const baseUser = [
      `EDIT PASS, NOT A NEW ARTICLE. Below is a published Pate State article that predates the current editorial standard. Rewrite it to the standard: run the Voice Bible's six revision passes (§13) on it. KEEP EVERY FACT, NAME, NUMBER, DATE, RESULT, RANKING AND PREDICTION EXACTLY AS STATED; the article is its own only source, so add nothing that is not already in it. Change the writing: kill announced scaffolding ("the failure condition is," "the real question is," "the counterpoint is"), consulting language, thesis-announcing openers, fake profundity, symmetrical sections; put people before concepts; vary rhythm and temperature; hide the framework; end without a summary. Keep the [PULLQUOTE] marker where it is and keep pullQuote CHARACTER-FOR-CHARACTER identical (or "" if the original was empty); never write the quote's text into the body. Keep any [EMBED:…] marker exactly where it is. Headline may be sharpened per Notebook §49 but must make the same claims.`,
      `ORIGINAL ARTICLE:\n${original}`,
    ].join("\n\n");

    let draft: { headline: string; dek: string; bodyMarkdown: string; pullQuote: string; seo: { title: string; description: string } } | null = null;
    let user = baseUser;
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await writeJSON({ system, user, schema: SCHEMA, schemaName: "longform_rewrite", maxTokens: 8192 });
      const d = JSON.parse(raw) as typeof draft & object;
      d.bodyMarkdown = scrubDashes(d.bodyMarkdown).replace(/\[\/PULLQUOTE\]/g, "");
      d.dek = scrubDashes(d.dek);
      const problems = [
        ...boilerplateViolations(d.bodyMarkdown),
        ...(hasFirstPersonProse(d.bodyMarkdown) ? ["first person"] : []),
        ...(narratesSourcing(d.bodyMarkdown) ? ["source narration"] : []),
        ...(/!\s|\bguaranteed\b/i.test(d.bodyMarkdown) ? ["banned"] : []),
      ];
      // Pull quote integrity: identical to the original or dropped.
      if ((r.pullQuote ?? "").trim() && normalize(d.pullQuote) !== normalize(r.pullQuote ?? "")) { d.pullQuote = ""; d.bodyMarkdown = d.bodyMarkdown.replace(/\s*\[PULLQUOTE\]\s*/g, "\n\n"); }
      if (!d.pullQuote.trim()) d.bodyMarkdown = d.bodyMarkdown.replace(/\s*\[PULLQUOTE\]\s*/g, "\n\n");
      else if (!d.bodyMarkdown.includes("[PULLQUOTE]")) d.pullQuote = "";
      if (problems.length === 0) { draft = d; break; }
      user = `${baseUser}\n\nYOUR PREVIOUS REWRITE STILL TRIPPED the gates: ${problems.join("; ")}. Rewrite those passages in fresh concrete prose.`;
      draft = null;
    }
    if (!draft) { held++; console.log(`HOLD (gates)        ${label}`); continue; }

    // Fact-check the rewrite against the original article (its only source).
    const checkRes = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      output_config: { effort: "low", format: { type: "json_schema", schema: { type: "object", properties: { verdict: { type: "string", enum: ["pass", "unsupported", "contradicted"] }, detail: { type: "string" } }, required: ["verdict", "detail"], additionalProperties: false } } },
      system: "You are a fact-check gate for an EDIT PASS. SOURCE is the original article; DRAFT is a rewrite that may only rephrase. Verdict 'contradicted' if any fact, number, name, date, result, ranking or prediction in the DRAFT conflicts with the SOURCE; 'unsupported' if the DRAFT states a material fact the SOURCE does not contain; else 'pass'. Rephrasing, reordering, cutting and sharpening are allowed. Output JSON only.",
      messages: [{ role: "user", content: `SOURCE:\n${original}\n\nDRAFT:\nHEADLINE: ${draft.headline}\nDEK: ${draft.dek}\n\n${draft.bodyMarkdown}` }],
    });
    const block = checkRes.content.find((b) => b.type === "text");
    const check = JSON.parse(block && block.type === "text" ? block.text : "{}") as { verdict?: string; detail?: string };
    if (check.verdict !== "pass") { held++; console.log(`HOLD (factcheck-${check.verdict}: ${(check.detail ?? "").slice(0, 100)}) ${label}`); continue; }
    const verdict = await scoreDraft(anthropic, { headline: draft.headline, dek: draft.dek, body: draft.bodyMarkdown });
    const lowCats = Object.entries(verdict.scores).filter(([, v]) => v < 8).map(([k]) => k);

    appendFileSync(backupPath, JSON.stringify(r) + "\n");
    await writeClient.patch(r._id).set({
      headline: draft.headline, dek: draft.dek, bodyMarkdown: draft.bodyMarkdown,
      pullQuote: draft.pullQuote, seoTitle: draft.seo.title, seoDescription: draft.seo.description,
    }).commit();
    fixed++;
    console.log(`OK   ${label}\n     new: ${draft.headline}\n     judge: ${verdict.pass ? "pass" : "weak"}${lowCats.length ? ` (<8: ${lowCats.join(", ")})` : ""}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${label}`, err instanceof Error ? err.message.slice(0, 160) : err);
  }
}
console.log(`\ndone: ${fixed} rewritten, ${held} held (kept current text), ${failed} failed`);
