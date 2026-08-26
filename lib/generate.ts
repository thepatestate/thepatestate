import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { writeJSON } from "@/lib/writer";
import { boilerplateViolations, BOILERPLATE_PROMPT, editorialSystem, type Architecture } from "@/lib/editorial";

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

export function validateDraft(raw: unknown): CompanionDraft | null {
  if (typeof raw !== "object" || raw === null) return null;
  const d = raw as Record<string, unknown>;
  const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
  const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
  const seo = d.seo as Record<string, unknown> | undefined;
  if (
    !isStr(d.headline) || !isStr(d.dek) || !isStr(d.bodyMarkdown) || typeof d.pullQuote !== "string" ||
    typeof d.primaryTeam !== "string" || !isStrArr(d.teams) || !isStrArr(d.tags) ||
    !seo || !isStr(seo.title) || !isStr(seo.description)
  ) return null;
  // Voice Bible §5: no pull quote manufactured for the slot. A pull quote
  // needs its marker in the body; an empty pull quote needs no marker.
  const hasMarker = d.bodyMarkdown.includes("[PULLQUOTE]");
  if (d.pullQuote.trim() ? !hasMarker : hasMarker) return null;
  return {
    headline: d.headline, dek: d.dek, bodyMarkdown: d.bodyMarkdown, pullQuote: d.pullQuote,
    primaryTeam: d.primaryTeam, teams: d.teams, tags: d.tags,
    seo: { title: seo.title, description: seo.description },
  };
}

const DRAFT_SCHEMA = {
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
    const res = await c.messages.create({
      model: MODEL,
      max_tokens: 256,
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: { series: { type: "string", enum: [...SERIES_VALUES] } },
            required: ["series"],
            additionalProperties: false,
          },
        },
      },
      system: prompt("series-classifier.md"),
      messages: [{
        role: "user",
        content: `Title: ${input.title}\nWeekday (ET): ${weekday}\nDescription:\n${input.description.slice(0, 1500)}`,
      }],
    });
    const parsed = JSON.parse(textOf(res)) as { series?: string };
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
    const res = await c.messages.create({
      model: MODEL,
      // Reasoning shares this budget with the JSON; 4096 truncated mid-array
      // on long transcripts (2026-08-26).
      max_tokens: 8192,
      output_config: { format: { type: "json_schema", schema: QUOTES_SCHEMA } },
      system: prompt("quote-extractor.md"),
      messages: [{ role: "user", content: `Transcript (timestamped):\n${transcriptText}` }],
    });
    const parsed = JSON.parse(textOf(res)) as { quotes?: ExtractedQuote[] };
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
}): Promise<CompanionDraft | null> {
  const c = client();
  if (!c) return null;
  // Kit: a show-derived column in the autonomous lane — staff byline, third
  // person, Josh present only through verbatim timestamped quotes
  // (Constitution §3, Voice Bible §10, features spec §1).
  const system = editorialSystem("show-adaptation", prompt("companion-article.md"));
  // 1–2 quotes, not 2–4 (Isaac, 2026-08-20: scattered quotes with ramp at
  // the edges read disjointed) — each must anchor one of the article's
  // highest-value passages and sit beside the prose arguing the same point.
  const quotesBlock = input.extractedQuotes?.length
    ? `Extracted verbatim quotes (Voice Bible §10: third-person pieces weave 2–4 verbatim Josh takes, attributed naturally, each deep-linked to its timestamp; the strongest renders as the pull quote). Use 2–4 as [QUOTE:timestamp]…[/QUOTE] blocks, each placed immediately beside the paragraph making the same point (a quote whose neighbors argue something else is a defect). Blockquotes are exact: trim only at the edges (no ramp opener, no trailing fragment), interior cuts use " … ", never change a word inside. The pullQuote follows its own rail.\n${input.extractedQuotes
        .map((q, i) => `${i + 1}. [${q.timestamp}] "${q.quote}" (${q.topic}, heat ${q.heat})`)
        .join("\n")}`
    : null;
  const baseUser = [
    ...(input.architecture
      ? [`ARCHITECTURE FOR THIS PIECE (Brief v2 Rule 2 — the structure was chosen for this story; commit to it fully): ${input.architecture.name} — ${input.architecture.brief}`]
      : []),
    BOILERPLATE_PROMPT,
    `Episode title: ${input.title}`,
    `Series: ${input.series}`,
    `Published: ${input.publishedAt}`,
    `Description:\n${input.description.slice(0, 3000)}`,
    input.transcriptText
      ? `Transcript (timestamped):\n${input.transcriptText}`
      : `NO TRANSCRIPT AVAILABLE — draft from the title and description only, per your instructions.`,
    ...(quotesBlock ? [quotesBlock] : []),
  ].join("\n\n");

  // Two attempts total. A schema/parse miss just retries with the same prompt (loop
  // continues below). A schema-valid draft whose quoted spans aren't verbatim in the
  // transcript gets ONE retry with the offending quotes named; if that retry still
  // fails (or errors), the last schema-valid draft is accepted with lowConfidence: true
  // rather than discarded outright.
  let user = baseUser;
  let lastDraft: CompanionDraft | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await writeJSON({
        system,
        user,
        schema: DRAFT_SCHEMA,
        schemaName: "companion_draft",
        maxTokens: 8192,
      });
      const draft = validateDraft(JSON.parse(raw));
      if (!draft) continue; // schema/parse miss — retry with the same prompt
      // Stray JSON escapes in prose render as literal backslashes.
      draft.bodyMarkdown = draft.bodyMarkdown.replace(/\\(["'])/g, "$1");
      draft.pullQuote = draft.pullQuote.replace(/\\(["'])/g, "$1");

      if (!input.transcriptText) return draft; // nothing to verify quotes against

      const boiler = boilerplateViolations(draft.bodyMarkdown);
      const firstPerson = /(?:^|[\s“"(])(I|I'm|I've|I'd|I'll|my)(?=[\s,.!?'’])/.test(draft.bodyMarkdown.replace(/\[QUOTE:[\d:]+\][\s\S]*?\[\/QUOTE\]/g, ""));
      if ((boiler.length > 0 || firstPerson) && attempt === 0) {
        lastDraft = draft;
        user = `${baseUser}\n\nYour previous draft violated house style${firstPerson ? " — it used first person outside a verbatim quote block; this is a staff-byline piece, Josh is \"Pate\" in third person and speaks only inside [QUOTE] blocks" : ""}${boiler.length ? ` — banned language: ${boiler.join("; ")}` : ""}. Keep the analysis, rewrite the offending passages in fresh concrete prose.`;
        continue;
      }
      const badQuotes = findNonVerbatimQuotes(draft.bodyMarkdown, input.transcriptText);
      // v1.2: the pull quote itself must also be verbatim from the transcript.
      if (
        draft.pullQuote.trim().split(/\s+/).length >= 5 &&
        findNonVerbatimQuotes(`"${draft.pullQuote}"`, input.transcriptText).length > 0
      ) {
        badQuotes.push(draft.pullQuote.trim());
      }
      if (badQuotes.length === 0) return draft;
      console.warn(`[generate:draftCompanion] attempt ${attempt}: ${badQuotes.length} non-verbatim span(s):`, badQuotes.map((q) => q.slice(0, 120)));

      lastDraft = draft;
      user = `${baseUser}\n\nYour previous draft put quotation marks around text that is not a verbatim match to the transcript. Every quotation-marked phrase must be an exact substring of the transcript text. Fix this by quoting the exact transcript wording, or by removing the quotation marks and paraphrasing instead. Non-verbatim quoted spans from your last draft: ${badQuotes.map((q) => `"${q}"`).join("; ")}`;
    } catch (err) {
      // SDK already retried 429/5xx internally; loop covers schema/parse misses
      console.error("[generate:draftCompanion]", attempt, err);
    }
  }
  return lastDraft ? { ...lastDraft, lowConfidence: true } : null;
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
