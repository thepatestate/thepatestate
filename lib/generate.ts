import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { boilerplateViolations, editorialSystem, circles, restatements, abstractParagraphs, kickerBudget, ensureSignOff, proseWords, type Architecture } from "@/lib/editorial";
import { judgeJSON } from "@/lib/judge";
import { planColumn, notesBlock, bestOfWriters, lineEdit, preview } from "@/lib/column-pipeline";

export const BYLINE_STAFF = "The Pate State Staff";
export const SERIES_VALUES = [
  "weekend-truths", "poll-day", "sit-down", "picks-drop", "espn-friday", "mailbag", "general",
] as const;

const MODEL = "claude-sonnet-5";

function prompt(name: string): string {
  return readFileSync(join(process.cwd(), "prompts", name), "utf8");
}

function client(): Anthropic | null {
  return process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
}

export interface CompanionDraft {
  headline: string;
  dek: string;
  bodyMarkdown: string;
  pullQuote: string;
  primaryTeam: string;
  teams: string[];
  tags: string[];
  seo: { title: string; description: string };
  // Set by draftCompanion (never by the model / DRAFT_SCHEMA) when the verbatim-quote
  // check still fails after one retry — signals the article needs a closer editorial look.
  lowConfidence?: boolean;
}

/** Normalizes a string for verbatim-quote comparison: lowercase, curly quotes/apostrophes
 * folded to straight ones, commas/periods stripped, whitespace collapsed. Also strips any
 * bracketed transcript annotation — `[MM:SS]`/`[HH:MM:SS]` timestamp markers (one per caption
 * line from transcriptToPromptText()) and non-speech tags YouTube auto-captions insert inline
 * (`[music]`, `[applause]`, `[laughter]`, `[inaudible]`, etc). YouTube auto-captions run only
 * 2-4 words per line, so any quote spanning a caption boundary — or a beat where the captioner
 * dropped in one of those tags — would otherwise have a literal bracketed token landing mid-quote
 * in the transcript side and break an otherwise-genuine verbatim match. Quoted spans pulled from
 * bodyMarkdown never legitimately contain bracketed text, so stripping brackets from both sides
 * only ever affects (and only ever helps) the transcript side. */
function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    // Writers occasionally leave a JSON-escaped quote mark inside a quote
    // block ("…Notre Dame.\\"") — punctuation, not words; drop it from both sides.
    .replace(/\\+/g, " ")
    .replace(/["]/g, " ")
    .replace(/[,.]/g, "")
    // Quote hygiene (Brief v2 Part 6): ASR garble tolerance — "0 and2"
    // matches a cleaned "0 and 2"; ums/uhs removed from comparison so
    // journalistically cleaned quotes still verify as verbatim.
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/\b(um+|uh+|erm+)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STRAIGHT_QUOTE_RE = /"([^"]+)"/g;
const CURLY_QUOTE_RE = /“([^”]+)”/g;
const QUOTE_MARKER_RE = /\[QUOTE:[\d:]+\]([\s\S]+?)\[\/QUOTE\]/g;

function extractQuotedSpans(body: string): string[] {
  const spans: string[] = [];
  // [QUOTE:ts]…[/QUOTE] blocks are quoted spans too (v1.2 §2.4a) — validate their
  // contents, then strip them so quote-mark scanning doesn't double-count.
  QUOTE_MARKER_RE.lastIndex = 0;
  let qm: RegExpExecArray | null;
  while ((qm = QUOTE_MARKER_RE.exec(body))) spans.push(qm[1]);
  const withoutMarkers = body.replace(QUOTE_MARKER_RE, " ");
  for (const re of [STRAIGHT_QUOTE_RE, CURLY_QUOTE_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(withoutMarkers))) spans.push(m[1]);
  }
  return spans;
}

/** Pure, unit-testable check: returns every quoted span (straight or curly quotes, ≥5
 * words — short scare-quotes are exempt) in bodyMarkdown that is NOT a verbatim substring
 * of transcript, after normalizing both for punctuation/quote-style/whitespace differences.
 * Ellipses ("…" or "...") mark editorial interior cuts (voice manual: trims by ellipsis
 * only), so an ellipsized quote verifies as its parts — each part must be verbatim. */
export function findNonVerbatimQuotes(body: string, transcript: string): string[] {
  const normTranscript = normalizeForCompare(transcript);
  const bad: string[] = [];
  for (const raw of extractQuotedSpans(body)) {
    const wordCount = raw.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < 5) continue;
    const parts = raw
      .split(/(?:\.\.\.|…)/)
      .map((p) => p.trim())
      .filter((p) => p.split(/\s+/).filter(Boolean).length >= 2);
    if (parts.length === 0) continue;
    if (parts.some((p) => !normTranscript.includes(normalizeForCompare(p)))) bad.push(raw.trim());
  }
  return bad;
}

/** Why a draft fails validation ("" when it passes). Exported for the logs
 * and tests. */
export function draftProblem(raw: unknown): string {
  if (typeof raw !== "object" || raw === null) return "not an object";
  const d = raw as Record<string, unknown>;
  const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
  const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
  const seo = d.seo as Record<string, unknown> | undefined;
  if (!isStr(d.headline)) return "headline";
  if (!isStr(d.dek)) return "dek";
  if (!isStr(d.bodyMarkdown)) return "bodyMarkdown";
  if (typeof d.pullQuote !== "string") return "pullQuote";
  if (typeof d.primaryTeam !== "string" || !isStrArr(d.teams) || !isStrArr(d.tags)) return "teams/tags";
  if (!seo || !isStr(seo.title) || !isStr(seo.description)) return "seo";
  // Voice Bible §5: no pull quote manufactured for the slot. A pull quote
  // needs its marker in the body; an empty pull quote needs no marker.
  const hasMarker = d.bodyMarkdown.includes("[PULLQUOTE]");
  if (d.pullQuote.trim() && !hasMarker) return "pullQuote without [PULLQUOTE] marker";
  if (!d.pullQuote.trim() && hasMarker) return "[PULLQUOTE] marker with empty pullQuote";
  return "";
}

/** The writer often returns a pull quote without placing its marker. Put
 * the marker after the body paragraph that shares the most words with it,
 * so the draft passes instead of failing on furniture. Exported for tests. */
export function placePullQuoteMarker(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const d = raw as Record<string, unknown>;
  if (typeof d.pullQuote !== "string" || typeof d.bodyMarkdown !== "string") return raw;
  const body = d.bodyMarkdown;
  if (!d.pullQuote.trim()) return { ...d, bodyMarkdown: body.replace(/\s*\[PULLQUOTE\]\s*/g, "\n\n").trim() };
  if (body.includes("[PULLQUOTE]")) return raw;
  const words = new Set(d.pullQuote.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const paras = body.split(/\n{2,}/);
  let best = -1, bestScore = 0;
  paras.forEach((p, i) => {
    if (/^\[(EMBED|QUOTE)/.test(p.trim()) || p.trim().startsWith("## ")) return;
    const score = p.toLowerCase().split(/\W+/).filter((w) => words.has(w)).length;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  if (best === -1) best = Math.min(1, paras.length - 1);
  paras.splice(best + 1, 0, "[PULLQUOTE]");
  return { ...d, bodyMarkdown: paras.join("\n\n") };
}

export function validateDraft(raw: unknown): CompanionDraft | null {
  if (draftProblem(raw)) return null;
  const d = raw as Record<string, unknown> & { seo: { title: string; description: string } };
  return {
    headline: d.headline as string, dek: d.dek as string, bodyMarkdown: d.bodyMarkdown as string, pullQuote: d.pullQuote as string,
    primaryTeam: d.primaryTeam as string, teams: d.teams as string[], tags: d.tags as string[],
    seo: { title: d.seo.title, description: d.seo.description },
  };
}

export const DRAFT_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    dek: { type: "string" },
    bodyMarkdown: { type: "string" },
    pullQuote: { type: "string" },
    primaryTeam: { type: "string" },
    teams: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    seo: {
      type: "object",
      properties: { title: { type: "string" }, description: { type: "string" } },
      required: ["title", "description"],
      additionalProperties: false,
    },
  },
  required: ["headline", "dek", "bodyMarkdown", "pullQuote", "primaryTeam", "teams", "tags", "seo"],
  additionalProperties: false,
} as const;

function textOf(res: Anthropic.Message): string {
  const block = res.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

export async function classifySeries(input: {
  title: string; description: string; publishedAt: string;
}): Promise<string> {
  const c = client();
  if (!c) return "general";
  try {
    const weekday = new Date(input.publishedAt).toLocaleDateString("en-US", {
      weekday: "long", timeZone: "America/New_York",
    });
    const { text } = await judgeJSON(c, {
      maxTokens: 256,
      effort: "low",
      schemaName: "series",
      schema: {
        type: "object",
        properties: { series: { type: "string", enum: [...SERIES_VALUES] } },
        required: ["series"],
        additionalProperties: false,
      },
      system: prompt("series-classifier.md"),
      user: `Title: ${input.title}\nWeekday (ET): ${weekday}\nDescription:\n${input.description.slice(0, 1500)}`,
    });
    const parsed = JSON.parse(text) as { series?: string };
    return SERIES_VALUES.includes(parsed.series as never) ? (parsed.series as string) : "general";
  } catch (err) {
    console.error("[generate:classifySeries]", err);
    return "general";
  }
}

export interface ExtractedQuote {
  quote: string;
  timestamp: string;
  topic: string;
  teams: string[];
  heat: number;
}

const QUOTES_SCHEMA = {
  type: "object",
  properties: {
    quotes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          quote: { type: "string" },
          timestamp: { type: "string" },
          topic: { type: "string" },
          teams: { type: "array", items: { type: "string" } },
          heat: { type: "integer" },
        },
        required: ["quote", "timestamp", "topic", "teams", "heat"],
        additionalProperties: false,
      },
    },
  },
  required: ["quotes"],
  additionalProperties: false,
} as const;

/** §2.4a quote-extraction pass: Josh's 5–10 biggest takes, word-for-word with
 * timestamps. Verbatim-checked against the transcript; non-verbatim extractions
 * are dropped rather than repaired. Returns [] on any failure — never throws. */
export async function extractQuotes(transcriptText: string): Promise<ExtractedQuote[]> {
  const c = client();
  if (!c) return [];
  try {
    const { text } = await judgeJSON(c, {
      // Reasoning shares this budget with the JSON; 4096 truncated mid-array
      // on long transcripts (2026-08-26).
      maxTokens: 8192,
      schemaName: "quotes",
      schema: QUOTES_SCHEMA,
      system: prompt("quote-extractor.md"),
      user: `Transcript (timestamped):\n${transcriptText}`,
    });
    const parsed = JSON.parse(text) as { quotes?: ExtractedQuote[] };
    if (!Array.isArray(parsed.quotes)) return [];
    const normTranscript = normalizeForCompare(transcriptText);
    return parsed.quotes
      .filter((q) =>
        typeof q.quote === "string" && q.quote.trim().length > 0 &&
        typeof q.timestamp === "string" &&
        // verbatim gate: every extracted quote must exist in the transcript
        // (ellipsis trims are checked segment-by-segment)
        q.quote.split(/\s*(?:\.\.\.|…)\s*/).every(
          (seg) => !seg.trim() || normTranscript.includes(normalizeForCompare(seg))
        )
      )
      .slice(0, 10)
      .map((q) => ({
        quote: q.quote.trim(),
        timestamp: q.timestamp,
        topic: typeof q.topic === "string" ? q.topic : "",
        teams: Array.isArray(q.teams) ? q.teams.filter((t) => typeof t === "string") : [],
        heat: typeof q.heat === "number" && q.heat >= 1 && q.heat <= 5 ? q.heat : 3,
      }));
  } catch (err) {
    console.error("[generate:extractQuotes]", err);
    return [];
  }
}

export async function draftCompanion(input: {
  title: string; description: string; publishedAt: string; series: string; transcriptText: string | null;
  extractedQuotes?: ExtractedQuote[];
  /** Editorial Brief v2 Rule 2: the pre-selected architecture for this piece. */
  architecture?: Architecture;
  /** Verified team facts (lib/fact-sheet.ts) so claims can be cashed out. */
  factSheet?: string;
}): Promise<CompanionDraft | null> {
  const c = client();
  if (!c) return null;
  // Josh's own argument from his show, in his first person under his byline
  // (Josh, 2026-08-26: every column in his voice, matching the approved
  // Three Boards column supplied as the exemplar).
  const system = editorialSystem("show-adaptation", prompt("companion-article.md"));
  // 1–2 quotes, not 2–4 (Isaac, 2026-08-20: scattered quotes with ramp at
  // the edges read disjointed) — each must anchor one of the article's
  // highest-value passages and sit beside the prose arguing the same point.
  const quotesBlock = input.extractedQuotes?.length
    ? `Extracted verbatim lines from the tape (the only candidates for the pull quote; the column itself is first person and never quotes Josh back to the reader):\n${input.extractedQuotes
        .map((q, i) => `${i + 1}. [${q.timestamp}] "${q.quote}" (${q.topic}, heat ${q.heat})`)
        .join("\n")}`
    : null;
  void input.architecture; // structure is owned by Voice Bible §3 under kit v4
  const baseUser = [
    `Episode title: ${input.title}`,
    `Series: ${input.series}`,
    `Published: ${input.publishedAt}`,
    `Description:\n${input.description.slice(0, 3000)}`,
    input.transcriptText
      ? `Transcript (timestamped, AUTO-CAPTIONED: the captioner misspells names and sometimes garbles a word into nonsense. Cross-check every player and coach name against the episode title and description; where a name looks garbled and you cannot be certain of the real spelling, refer to the player by school and position instead. Never publish a garbled name and never guess a spelling; never carry a nonsense word into prose):\n${input.transcriptText}`
      : `NO TRANSCRIPT AVAILABLE — draft from the title and description only, per your instructions.`,
    ...(quotesBlock ? [quotesBlock] : []),
    ...(input.factSheet ? [input.factSheet] : []),
  ].join("\n\n");

  // The column pipeline (lib/column-pipeline.ts): Opus plans ONE segment's
  // argument → best-of-N writers draft from the notes → the fan and voice
  // judges pick the winner → Opus line-edits it. Two rounds at most: a
  // round whose best still violates the gates gets one corrective round
  // with the violations named; a draft that still fails after that is
  // accepted with lowConfidence: true rather than discarded.
  const floor = 800;
  const notes = input.transcriptText
    ? await planColumn(c, {
        kind: "show",
        material: `EPISODE: ${input.title}\n\nDESCRIPTION:\n${input.description.slice(0, 3000)}\n\nTRANSCRIPT:\n${input.transcriptText}`,
        factSheet: input.factSheet,
      })
    : null;
  const user0 = input.transcriptText ? `${notesBlock(notes, floor)}\n\n${baseUser}` : baseUser;
  const parse = (raw: string): CompanionDraft | null => {
    try {
      const parsed = placePullQuoteMarker(JSON.parse(raw));
      const draft = validateDraft(parsed);
      if (!draft) { console.warn(`[generate:draftCompanion] invalid draft (${draftProblem(parsed)})`); return null; }
      // Stray JSON escapes in prose render as literal backslashes.
      draft.bodyMarkdown = draft.bodyMarkdown.replace(/\\(["'])/g, "$1");
      if (!process.env.VITEST) draft.bodyMarkdown = ensureSignOff(draft.bodyMarkdown);
      draft.pullQuote = draft.pullQuote.replace(/\\(["'])/g, "$1");
      return draft;
    } catch { return null; }
  };
  const gate = (draft: CompanionDraft): string[] => {
    if (!input.transcriptText) return []; // nothing to verify against
    const problems: string[] = [];
    const boiler = boilerplateViolations(draft.bodyMarkdown);
    if (boiler.length) problems.push(`Voice Bible §2 gated language: ${boiler.join("; ")}`);
    const prose = draft.bodyMarkdown.replace(/\[QUOTE:[\d:]+\][\s\S]*?\[\/QUOTE\]/g, "");
    // The lane, floor and hammer budget are kit laws on real columns; the
    // unit tests feed three-sentence fixtures, so they run only outside vitest.
    if (!process.env.VITEST) {
      if (!/(?:^|[\s“"(])(I|I'm|I've|I'd|I'll|my)(?=[\s,.!?'’])/.test(prose)) problems.push("Constitution §3: this column drafts in Josh's first person, always");
      const words = proseWords(prose);
      if (words < floor) problems.push(`Voice Bible §3: columns are ${floor}–1,200 words (you wrote ${words}); the depth comes from the tape's football, never filler`);
      const budget = kickerBudget(draft.bodyMarkdown);
      if (!budget.ok) problems.push(`Voice Bible §0B hammer budget: ${budget.kickers.length} isolated one-liners, ${budget.allowed} allowed; fold the rest into their paragraphs`);
    }
    if (circles(prose)) problems.push(`the piece circles; these sentences restate earlier ones: ${restatements(prose).slice(0, 3).join(" | ")}`);
    const abstract = abstractParagraphs(prose);
    if (abstract.length >= 2) problems.push(`abstract paragraphs with no name or number in them: ${abstract.map((p) => p.slice(0, 60)).join(" | ")}`);
    const bad = findNonVerbatimQuotes(draft.bodyMarkdown, input.transcriptText);
    // v1.2: the pull quote itself must also be verbatim from the transcript.
    if (draft.pullQuote.trim().split(/\s+/).length >= 5 && findNonVerbatimQuotes(`"${draft.pullQuote}"`, input.transcriptText).length > 0) bad.push(draft.pullQuote.trim());
    if (bad.length) problems.push(`quotation marks around text that is not verbatim in the transcript (quote the exact wording or paraphrase without quotation marks): ${bad.map((q) => `"${q.slice(0, 100)}"`).join("; ")}`);
    return problems;
  };
  const bo = {
    anthropic: c, lane: "feature" as const, system,
    schema: DRAFT_SCHEMA as unknown as Record<string, unknown>, schemaName: "companion_draft", maxTokens: 8192,
    parse, gate, text: (d: CompanionDraft) => ({ headline: d.headline, dek: d.dek, body: d.bodyMarkdown }),
  };
  try {
    let user = user0;
    let round = await bestOfWriters<CompanionDraft>({ ...bo, user });
    if (!round) return null;
    if (round.best.problems.length) {
      console.warn(`[generate:draftCompanion] round 1 best (${round.best.writer}) violates: ${round.best.problems.join(" | ").slice(0, 400)}`);
      user = `${user0}\n\nYour previous draft violated the kit's laws — ${round.best.problems.join(" — ")}. Fix these precisely and keep what works.\n\nPrevious draft:\n${round.best.draft.bodyMarkdown}`;
      const again = await bestOfWriters<CompanionDraft>({ ...bo, user });
      if (again && again.best.problems.length <= round.best.problems.length) round = again;
    }
    if (round.best.problems.length) {
      console.warn(`[generate:draftCompanion] accepting with lowConfidence: ${round.best.problems.join(" | ").slice(0, 300)}`);
      return { ...round.best.draft, lowConfidence: true };
    }
    const best = await lineEdit<CompanionDraft>({ ...bo, user, winner: round.best, notes, floor, body: (d) => d.bodyMarkdown });
    console.log(`[generate:draftCompanion] ${best.writer} · fan ${best.fan?.score ?? "-"} · voice ${best.voice?.score ?? "-"} · ${preview(best.draft.bodyMarkdown)}`);
    return best.draft;
  } catch (err) {
    console.error("[generate:draftCompanion]", err);
    return null;
  }
}

export interface PlaybookIntro {
  subject: string;
  intro: string;
}

const PLAYBOOK_FALLBACK: PlaybookIntro = {
  subject: "The Playbook — The Pate State",
  intro: "Here's what's new on the porch.",
};

const PLAYBOOK_SCHEMA = {
  type: "object",
  properties: {
    subject: { type: "string" },
    intro: { type: "string" },
  },
  required: ["subject", "intro"],
  additionalProperties: false,
} as const;

export async function draftPlaybookIntro(input: {
  weekday: string; episodeTitle: string | null; articleHeadlines: string[];
}): Promise<PlaybookIntro> {
  // Everything — including the prompt-file reads — stays inside this try/catch
  // so this function can NEVER throw; any failure falls back to the constants.
  try {
    const c = client();
    if (!c) return PLAYBOOK_FALLBACK;
    const system = `${prompt("global-preamble.md")}\n\n${prompt("playbook.md")}`;
    const user = [
      `Weekday: ${input.weekday}`,
      `Episode title: ${input.episodeTitle ?? "(none today)"}`,
      `Article headlines:\n${input.articleHeadlines.length ? input.articleHeadlines.slice(0, 3).map((h) => `- ${h}`).join("\n").slice(0, 500) : "(none today)"}`,
    ].join("\n\n");

    const res = await c.messages.create({
      model: MODEL,
      max_tokens: 256,
      output_config: { effort: "low", format: { type: "json_schema", schema: PLAYBOOK_SCHEMA } },
      system,
      messages: [{ role: "user", content: user }],
    });
    const parsed = JSON.parse(textOf(res)) as { subject?: string; intro?: string };
    const subject = typeof parsed.subject === "string" ? parsed.subject.trim() : "";
    const intro = typeof parsed.intro === "string" ? parsed.intro.trim() : "";
    if (!subject || !intro) return PLAYBOOK_FALLBACK;
    const cut = subject.slice(0, 45);
    const truncatedSubject = cut.length < subject.length ? cut.replace(/\s+\S*$/, "") : cut;
    return { subject: truncatedSubject, intro };
  } catch (err) {
    console.error("[generate:draftPlaybookIntro]", err);
    return PLAYBOOK_FALLBACK;
  }
}
