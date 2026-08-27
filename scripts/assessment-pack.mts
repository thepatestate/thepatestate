// Assembles the outside-assessment pack: everything the pipeline "knows",
// verbatim from source, in one markdown file ChatGPT can take as an upload.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
function loadDotEnvLocal() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim(); if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("="); if (eq === -1) continue;
    const key = line.slice(0, eq).trim(); if (key && !(key in process.env)) process.env[key] = line.slice(eq + 1).trim();
  }
}
loadDotEnvLocal();
const { exemplarProse } = await import("../lib/exemplars.ts");
const { writeClient } = await import("../lib/sanity.ts");

const R = (p: string) => readFileSync(p, "utf8");
const out: string[] = [];
const H = (s: string) => out.push(`\n\n${s}\n`);

// --- 0. cover + prompt for ChatGPT ---------------------------------------
H(`# The Pate State — editorial system assessment pack
*Assembled ${new Date().toISOString().slice(0, 10)} from the deployed code (main @ 2662db0). Everything below is verbatim from the repository unless marked as a summary.*

## How to use this with ChatGPT
Upload this file (it is too long to paste) and start with a prompt like:

> You are assessing an automated college-football editorial system. The attached pack contains (1) the complete writing rulebook the AI writer receives, (2) the JSON contracts for each article type, (3) every deterministic code gate and its regex, (4) the verbatim prompts of the AI judges that score drafts, (5) the three approved "gold standard" articles the writer is told to match, (6) real outputs the system produced with the scores the judges gave them, and (7) a description of the pipeline. The owner's goal: articles that read like they were written by a specific person (Josh Pate), scoring 8.5/10 on a fan's legibility-and-enjoyment scale; the system plateaus around 7. Assess: where the rules contradict each other or the exemplars; which rules are doing harm; what the gates cannot catch that the fan judge is docking; what the pipeline shape (one writer, one pass, judge notes back to the same writer) makes impossible; and what you would change first, with reasons tied to specific sections of the pack.

## Contents
1. The pipeline (summary)
2. The kit — the complete writing rulebook (verbatim, as deployed)
3. The task contracts (verbatim)
4. Code gates — every deterministic check and its regex (verbatim from lib/editorial.ts and lib/wire.ts)
5. The AI judges — their prompts verbatim
6. The gold-standard articles the writer must match (prose only)
7. Real outputs with the scores they received
8. Appendix — Josh's Aug 27 kit v4.2 update (received, deployed for a day, rolled back at Josh and Isaac's request)`);

// --- 1. pipeline summary -------------------------------------------------
H(`## 1. The pipeline (summary; the full diagram is a separate HTML)

**Models.** Writer: OpenAI gpt-5.6-luna, one shot per draft, one corrective retry when a code gate fails (the failure is named in the retry prompt). Verifier/judges: Anthropic claude-sonnet-5 (falls back to OpenAI when credits run out). Facts: CFBD + ESPN team fact sheets, an archive of Josh's verbatim show quotes, the site's on-record positions.

**System prompt every writer receives**, in this order: 01 Constitution → 02 Voice Bible → one product spec (04 Wire, or 06 Features) → 07 Current State → the lane's gold-standard article verbatim with a "match the register, never the content" rail → site-mechanics notes → the JSON task contract. Nothing outside the kit folder is loaded as writing instruction.

**Three lanes.**
- *The Wire* (autonomous, every 10 minutes): outlet feeds → off-topic + dedup → wire item (headline) → source page fetched → thin-source kill (<2,200 chars = no story) → seven-part story (600-word floor) → code gates → fact-check against sources (hard stop) → quality judge + voice judge (up to 2 rewrites, adopted only if gates still pass) → pure-code callout selection → published under the desk byline.
- *Show column* (≤1/day, ≤5/week): new episode → series classify → transcript → verbatim quote extraction → team fact sheet → first-person column (800–1,200 words, "— JP") → code gates (banned language, first person present, circling, abstract paragraphs, floor, hammer budget, every quoted span verbatim) → voice judge (≤2 rewrites) → saved as "ai-drafted" under Josh's byline; a human publishes.
- *Daily standalone* (14:00 and 20:00 UTC): 72h of Wire coverage → Sonnet picks type/topic/angle from the Playbook menu → source pack (story text, ≤6 archived Josh quotes, fact sheet, on-record positions) → routed to house reaction (third person, publishes) or Josh's Read (first person, held) → draft → gates → fact-check → quality + voice judges → published or held.

**Where it plateaus (the maintainer's read).** One writer writes in a single pass with the whole rulebook and the whole transcript; every later step only sends notes back to that same writer; rewrite rounds with "you restate the same point four ways" produce three ways; word floors on thin material manufacture the restating the gates then bounce; argument-shaped sources reach 7–7.5 on the fan judge, list-shaped sources 5–6. The 9.7 gold standard was produced with Josh editing a draft by hand.`);

// --- 2. kit ---------------------------------------------------------------
H(`## 2. The kit — the complete writing rulebook (verbatim, as deployed)`);
for (const f of ["00-START-HERE.md", "01-constitution.md", "02-voice-bible.md", "03-article-playbook.md", "04-spec-wire.md", "05-spec-annual.md", "06-spec-features.md", "07-current-state.md", "08-design-system.md", "ISAAC-README.md"]) {
  H(`### kit/${f}\n\n${R(`prompts/pate-state-kit/${f}`)}`);
}

// --- 3. contracts ---------------------------------------------------------
H(`## 3. The task contracts (verbatim; appended after the kit as the last block of the system prompt)`);
for (const f of ["wire-story.md", "news-reaction.md", "josh-column.md", "companion-article.md", "wire-item.md", "quote-extractor.md", "series-classifier.md"]) {
  H(`### prompts/${f}\n\n${R(`prompts/${f}`)}`);
}

// --- 4. code gates --------------------------------------------------------
const ed = R("lib/editorial.ts");
const lints = [...ed.matchAll(/\{ name: "([^"]+)", re: (\/.*?\/[a-z]*) \}/g)].map((m) => `- **${m[1]}** — \`${m[2]}\``);
const extra = (name: string, src: string, re: RegExp) => { const m = src.match(re); return m ? `\n**${name}**\n\`\`\`ts\n${m[0].trim()}\n\`\`\`` : ""; };
H(`## 4. Code gates — every deterministic check (verbatim regexes from lib/editorial.ts)

A draft that matches any of these is sent back once with the violation named; a retry that still fails is either accepted with a low-confidence flag (show columns) or dropped (Wire, standalone).

### Banned-language lint (\`boilerplateViolations\`)
${lints.join("\n")}

Plus: more than one counterpoint framing (\`${(ed.match(/const COUNTERPOINT_RE = (.*);/) ?? ["", ""])[1]}\`), two or more thesis-announcing paragraph openers (\`${(ed.match(/const THESIS_OPENERS = (.*);/) ?? ["", ""])[1]}\`), two or more podcast devices (\`${(ed.match(/const PODCAST_PHRASES = (.*);/) ?? ["", ""])[1]}\` / \`${(ed.match(/const PODCAST_ADDRESS = (.*);/) ?? ["", ""])[1]}\`), five or more question marks, and any of the documents' own example sentences (exemplar parroting).

### Structural validators
${extra("kickerBudget — isolated one-liners", ed, /export function kickerBudget[\s\S]*?\n\}/)}
${extra("restatements / circles — the repetition detector", ed, /export function restatements[\s\S]*?\n\}\n[\s\S]*?export function circles[\s\S]*?\n\}/)}
${extra("abstractParagraphs — no name, no number", ed, /export function abstractParagraphs[\s\S]*?\n\}/)}
${extra("attributedInSentenceOne (Wire)", ed, /export function attributedInSentenceOne[\s\S]*?\n\}/)}
${extra("proseWords / ensureSignOff", ed, /export function ensureSignOff[\s\S]*?\n\}\n[\s\S]*?export function proseWords[\s\S]*?\n\}/)}

### Wire-only gates (lib/wire.ts)
${(() => { const w = R("lib/wire.ts"); return [
  extra("narratesSourcing", w, /export function narratesSourcing[\s\S]*?\n\}/),
  extra("headlineNamesOutlet", w, /export function headlineNamesOutlet[\s\S]*?\n\}/),
  extra("hasAttributionOpener", w, /export function hasAttributionOpener[\s\S]*?\n\}/),
  extra("hasFirstPersonProse", w, /export function hasFirstPersonProse[\s\S]*?\n\}/),
  extra("isThinSource", w, /export function isThinSource[\s\S]*?\n\}/),
  extra("isOffTopic", w, /const OFF_TOPIC = [\s\S]*?export function isOffTopic[\s\S]*?\n\}/),
  extra("selectCallout — the pure-code pull-line scorer", w, /export function selectCallout[\s\S]*?\n\}/),
  extra("proseGateFailure — the retry gate", w, /const proseGateFailure = [\s\S]*?\n  \};/),
].join("\n"); })()}
`);

// --- 5. judges ------------------------------------------------------------
const sys = (src: string, anchor: string) => { const i = src.indexOf(anchor); if (i < 0) return "(not found)"; const s = src.indexOf("`", i); const e = src.indexOf("`,", s + 1); return src.slice(s + 1, e); };
const wire = R("lib/wire.ts"); const lf = R("lib/longform.ts");
H(`## 5. The AI judges — prompts verbatim

### fanScore (the reader's judge; the 8.5 target lives here; used by review tooling, not a production gate)
\`\`\`
${sys(ed, "export async function fanScore")}
\`\`\`
Score = mean of legibility and enjoyment; pass at 8.5.

### voiceMatch (register vs the gold standard; production gate, pass ≥ 8, up to two rewrites)
\`\`\`
${sys(ed, "export async function voiceMatch")}
\`\`\`

### scoreDraft (12-category quality judge; production gate, <8 in two categories = one rewrite)
\`\`\`
${sys(ed, "export async function scoreDraft")}
\`\`\`

### Fact-check gate (Wire)
\`\`\`
${(wire.match(/system:\s*"You are an independent fact-check gate[^"]*"/) ?? ["(not found)"])[0]}
\`\`\`

### Fact-check gate (standalone)
\`\`\`
${(lf.match(/"Fact-check gate for a house-analysis article[^"]*"/) ?? ["(not found)"])[0]}
\`\`\`

### Article selection (standalone lane)
\`\`\`
${sys(lf, "schemaName: \"article_selection\"")}
\`\`\`
`);

// --- 6. exemplars ---------------------------------------------------------
H(`## 6. The gold-standard articles the writer must match (prose extracted from the approved HTML builds)`);
for (const [n, label] of [["feature-three-boards-v3", "Josh's Read gold standard (the ceiling; Josh's 9.7 sign-off)"], ["wire-ohio-state-rowe-safety", "The Wire gold standard"], ["wire-kansas-state-pastore-v3", "Wire reference build"]] as const) {
  try { H(`### ${n}.html — ${label}\n\n${exemplarProse(n)}`); } catch { /* skip */ }
}

// --- 7. samples -----------------------------------------------------------
H(`## 7. Real outputs and the scores they received (fan score = legibility/enjoyment mean; voice = register vs gold standard)`);
const samples: [string, string, string][] = [
  [".superpowers/kit4-lab-a.json", "Voice-lab column, Miami/ACC, terra + Opus edit — the one Josh called \"close\" (fan 7.8). Josh then hand-edited it into the v4.2 second exemplar (appendix)", "lab"],
  [".superpowers/voice-lab-3.json", "Voice-lab column (fan ~7.5)", "lab"],
  [".superpowers/kit4-show.json", "Kit v4 plain production draft of a show column (fan ~5)", "prod"],
  [".superpowers/column-preview-v42-wrong2.json", "Aug 27 production proof run under the (rolled-back) pipeline: plan → 3 writers → edit (fan 5.5)", "prod"],
];
for (const [p, label] of samples) {
  if (!existsSync(p)) continue;
  const arr = JSON.parse(R(p)); const d = Array.isArray(arr) ? arr[0] : arr;
  if (!d?.bodyMarkdown) continue;
  H(`### ${label}\n*Episode: ${d.episode ?? ""} · writer: ${d.writer ?? ""} · fan ${d.fan?.score ?? "?"} (legibility ${d.fan?.legibility ?? "?"}, enjoyment ${d.fan?.enjoyment ?? "?"}, Josh-voice ${d.fan?.joshVoice ?? "?"}) · voice ${d.voice?.score ?? "?"}*\n\n**Fan judge's notes:** ${d.fan?.notes ?? ""}\n\n**${d.headline}**\n\n*${d.dek}*\n\n${d.bodyMarkdown}`);
}
// live site samples
try {
  const stories = await writeClient.fetch<any[]>(`*[_type == "wireStory" && defined(whyBody)] | order(publishedAt desc)[0...2]{ headline, deck, whatHappened, whyBody, missing, section04Title, section04Body, readBody, watching, publishedAt }`);
  for (const s of stories) H(`### Live Wire story (published ${String(s.publishedAt).slice(0, 10)})\n\n**${s.headline}**\n\n*${s.deck}*\n\n${s.whatHappened}\n\n**Why it matters**\n${s.whyBody}\n\n**What's missing**\n${s.missing ?? ""}\n\n**${s.section04Title ?? ""}**\n${s.section04Body ?? ""}\n\n**The Read**\n${s.readBody ?? ""}\n\n**Watching**\n${Array.isArray(s.watching) ? s.watching.map((w: any) => `- ${w.title}: ${w.body}`).join("\n") : ""}`);
  const arts = await writeClient.fetch<any[]>(`*[_type == "article" && defined(bodyMarkdown)] | order(coalesce(publishedAt, _createdAt) desc)[0...2]{ headline, dek, bodyMarkdown, byline, workflowState, tags }`);
  for (const a of arts) H(`### Live article (${a.byline} · ${a.workflowState} · ${(a.tags ?? []).join(", ")})\n\n**${a.headline}**\n\n*${a.dek}*\n\n${a.bodyMarkdown}`);
} catch (err) { H(`*(live samples unavailable: ${err instanceof Error ? err.message.slice(0, 80) : err})*`); }

// --- 8. appendix v4.2 -----------------------------------------------------
const drop = ".superpowers/drops/kit-v4.2-2026-08-27";
if (existsSync(drop)) {
  H(`## 8. Appendix — Josh's Aug 27 kit v4.2 update (deployed one day, then rolled back)

Josh hand-edited the fan-7.8 Miami column above and codified what he changed as four new laws. The system built from it was rolled back the same day at Josh and Isaac's request; the documents remain the most recent statement of what he wants. Only the files that changed from v4.0 are included.`);
  for (const f of ["02-voice-bible.md", "06-spec-features.md", "07-current-state.md", "reference-builds/README.md"]) H(`### v4.2 ${f}\n\n${R(`${drop}/${f}`)}`);
  // Josh's edited Miami column, prose only
  const html = R(`${drop}/reference-builds/article-miami-acc-favorite-v2.html`);
  const m = html.match(/<div class="a-body">([\s\S]*?)<div class="a-pb">/);
  const prose = (m ? m[1] : "").replace(/<a class="a-ep"[\s\S]*?<\/a>/g, "").replace(/<div class="(receipt|pulse)"[\s\S]*?<\/div>\s*<\/div>/g, "").replace(/<h2>/g, "\n\n## ").replace(/<\/h2>/g, "\n").replace(/<p>/g, "\n").replace(/<[^>]+>/g, "").replace(/&rsquo;/g, "’").replace(/&amp;/g, "&").replace(/\n{3,}/g, "\n\n").trim();
  H(`### Josh's own edit of the Miami column (v4.2 second approved build) — compare with the fan-7.8 draft in section 7\n\n${prose}`);
}

const dest = "docs/review/assessment-pack-2026-08-27.md";
writeFileSync(dest, out.join("\n"));
console.log(`wrote ${dest} (${Math.round(out.join("\n").length / 1024)} KB)`);
