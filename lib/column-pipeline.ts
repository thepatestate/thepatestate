// Josh's Read, the way the voice lab produced the columns Josh signed off
// (scripts/voice-lab.mts, 2026-08-26/27; kit v4.2 ships the Miami column
// it wrote as the second approved build). Moved into production so the site
// does this on its own (Josh, 2026-08-27: "Is it doing this on the site
// now?"):
//
//   1. THINK  — Opus plans the argument before a word is written: ONE take,
//               three mechanisms, the surprise, the text-a-friend line, what
//               to watch, what to cut.
//   2. WRITE  — best of N writers from the same notes and the same kit
//               prompt (COLUMN_WRITERS; default terra, luna, Opus). Every
//               candidate runs the caller's gates; the fan judge and the
//               voice judge pick the winner among the clean ones.
//   3. EDIT   — Opus line-edits the winner: cuts restatements and the v4.2
//               violations, adds nothing. Adopted only when it still clears
//               the gates and the fan judge does not score it lower.
//
// The caller owns parsing, gates, floors and the JSON contract; this file
// only decides who thinks, who writes, who edits, and which draft wins.
// Under vitest everything collapses to the single default writer call the
// unit tests mock.
import Anthropic from "@anthropic-ai/sdk";
import { writeJSON } from "@/lib/writer";
import { judgeJSON } from "@/lib/judge";
import { fanScore, voiceMatch, restatements, abstractParagraphs, renderedForJudge, type FanVerdict, type VoiceVerdict } from "@/lib/editorial";
import { exemplarOverlap, type EXEMPLAR_FOR_LANE } from "@/lib/exemplars";

type Lane = keyof typeof EXEMPLAR_FOR_LANE;

const PLANNER_MODEL = process.env.COLUMN_PLANNER_MODEL ?? "claude-opus-5";
const EDITOR_MODEL = process.env.COLUMN_EDITOR_MODEL ?? "claude-opus-5";

export interface ArgumentNotes {
  focus: { topic: string; span: string; why: string };
  take: string;
  mechanisms: { claim: string; football: string; source: string }[];
  surprise: string;
  textLine: string;
  watch: string[];
  cut: string[];
}

export const NOTES_SCHEMA = {
  type: "object",
  properties: {
    focus: {
      type: "object",
      properties: { topic: { type: "string" }, span: { type: "string" }, why: { type: "string" } },
      required: ["topic", "span", "why"],
      additionalProperties: false,
    },
    take: { type: "string" },
    mechanisms: {
      type: "array",
      items: {
        type: "object",
        properties: { claim: { type: "string" }, football: { type: "string" }, source: { type: "string" } },
        required: ["claim", "football", "source"],
        additionalProperties: false,
      },
    },
    surprise: { type: "string" },
    textLine: { type: "string" },
    watch: { type: "array", items: { type: "string" } },
    cut: { type: "array", items: { type: "string" } },
  },
  required: ["focus", "take", "mechanisms", "surprise", "textLine", "watch", "cut"],
  additionalProperties: false,
} as const;

const PLANNER_SYSTEM = (kind: "show" | "assignment") => `You are Josh Pate's editor, planning his column before a word is written. ${
  kind === "show"
    ? "Read the transcript and the verified team facts. FIRST, choose ONE segment: the single take in the episode with the most football reasoning behind it and the clearest thing for a fan to argue with. The column will be about that one thing only; the rest of the episode is out of scope (the video embed carries it). A column that tours every take in the episode reads as a listicle and fails."
    : "Read the assignment, the source pack (the Wire's verified facts, Josh's archived verbatim quotes, the on-record site positions) and the verified team facts. The column is about the ONE claim the assignment names, argued with the football in the pack; anything the pack cannot support is out of scope."
} Then produce the ARGUMENT NOTES:
focus: topic; span (${kind === "show" ? "start and end timestamps of the segment" : "which sources carry it"}); why this one.
take: the one sentence a fan would argue with at a bar, in Josh's own position (never invent one; ${kind === "show" ? "it must be on the tape" : "it must be his on-record position or the house's case argued as the house's, never as something he said"}).
mechanisms: exactly 3. Each: the claim; the football that proves it (a player, a matchup, a number, a game, a date, from the material or the team facts, never invented); where it comes from.
surprise: the angle a fan hasn't considered, grounded in the material: the second-order point, the thing the obvious reaction misses. Never manufactured contrarianism.
textLine: the single line a fan would text a friend: true, plain, quotable on its own. Josh's actual words if the material has one; otherwise a line that only uses what is there.
watch: 2-3 specific things to watch, each with a player or a game and a date from the team facts.
cut: 3-5 things the column must NOT spend words on. Always include, per the Voice Bible v4.2: any contingency true of every team ("if the quarterback gets hurt," "if they stay healthy") unless a documented particular fact makes it this team's; any sentence that narrates the analysis instead of making it; the Ledger timestamp as a prose sentence; "card" for a schedule.
Output JSON only.`;

/** Step 1: the argument notes. Opus first, the judge fallback if Anthropic
 * is down. Returns null on any failure so the writers still run. */
export async function planColumn(
  anthropic: Anthropic | null,
  input: { kind: "show" | "assignment"; material: string; factSheet?: string },
): Promise<ArgumentNotes | null> {
  if (process.env.VITEST) return null;
  try {
    const { text, via } = await judgeJSON(anthropic, {
      model: PLANNER_MODEL,
      maxTokens: 6000,
      effort: "high",
      schemaName: "argument_notes",
      schema: NOTES_SCHEMA as unknown as Record<string, unknown>,
      system: PLANNER_SYSTEM(input.kind),
      user: `${input.material}${input.factSheet ? `\n\n${input.factSheet}` : ""}`,
    });
    const notes = JSON.parse(text || "{}") as ArgumentNotes;
    if (!notes.take || !Array.isArray(notes.mechanisms)) return null;
    console.log(`[column] plan via ${via}: ${notes.focus?.topic ?? ""} — ${notes.take.slice(0, 120)}`);
    return notes;
  } catch (err) {
    console.warn("[column] planning failed; writing without notes", err instanceof Error ? err.message.slice(0, 120) : err);
    return null;
  }
}

/** The notes as the writer sees them, prepended to the task material. */
export function notesBlock(notes: ArgumentNotes | null, floor: number): string {
  const laws = `Voice Bible §3: ${floor}–1,200 words (the floor is law, so the depth comes from the football in the material, never filler); cold open → claim early → two to four blended case sections → brisk sweep → unhedged flag plant → porch close signed — JP. Section headers only where the argument turns. Say the take once, prove it once, tell the reader what to watch once. Name the realistic alternative and say plainly why it falls short. Voice Bible §0B (v4.2): no contingency that is true of every team; no sentence that narrates the analysis instead of making it; the Ledger's timestamp lives in the module the site renders, so the prose says when the call gets graded in human words and never "I logged this on [date]"; never "card" for a schedule.`;
  if (!notes) return laws;
  return `THIS COLUMN IS ABOUT ONE THING: ${notes.focus.topic} (${notes.focus.span}). Everything else in the material is out of scope. ${laws}

THE ARGUMENT NOTES (your editor's plan; the column argues this and only this):
THE TAKE: ${notes.take}
THE MECHANISMS (each gets its own passage with its football):
${notes.mechanisms.map((m, i) => `${i + 1}. ${m.claim} — ${m.football} (${m.source})`).join("\n")}
THE SURPRISE: ${notes.surprise}
THE LINE A FAN WOULD TEXT: ${notes.textLine}
WHAT TO WATCH: ${notes.watch.join("; ")}
DO NOT SPEND WORDS ON: ${notes.cut.join("; ")}`;
}

export interface ColumnWriter { name: string; provider: "openai" | "anthropic"; model: string }

/** The best-of-N roster. COLUMN_WRITERS="gpt-5.6-terra,gpt-5.6-luna,claude-opus-5"
 * by default; a writer whose vendor key is missing is skipped. Empty under
 * vitest and when neither key is set (the default single writer runs). */
export function columnWriters(): ColumnWriter[] {
  if (process.env.VITEST) return [];
  const spec = process.env.COLUMN_WRITERS ?? "gpt-5.6-terra,gpt-5.6-luna,claude-opus-5";
  return spec
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((model): ColumnWriter => ({ name: model, provider: model.startsWith("claude") ? "anthropic" : "openai", model }))
    .filter((w) => (w.provider === "openai" ? !!process.env.OPENAI_API_KEY : !!process.env.ANTHROPIC_API_KEY));
}

export interface Candidate<T> {
  writer: string;
  draft: T;
  problems: string[];
  fan: FanVerdict | null;
  voice: VoiceVerdict | null;
}

export interface BestOfOptions<T> {
  anthropic: Anthropic | null;
  lane: Lane;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  schemaName: string;
  maxTokens: number;
  /** Raw JSON → the caller's validated draft (null when invalid). */
  parse: (raw: string) => T | null;
  /** The caller's gates: the names of what the draft violates ([] = clean). */
  gate: (draft: T) => string[];
  /** What the judges read. */
  text: (draft: T) => { headline: string; dek?: string; body: string };
}

async function judge<T>(o: BestOfOptions<T>, draft: T): Promise<{ fan: FanVerdict | null; voice: VoiceVerdict | null }> {
  if (process.env.VITEST) return { fan: null, voice: null };
  const t = o.text(draft);
  const [fan, voice] = await Promise.all([
    fanScore(o.anthropic as Anthropic, { headline: t.headline, dek: t.dek, body: t.body }),
    voiceMatch(o.anthropic as Anthropic, { lane: o.lane, draft: t.body }),
  ]);
  return { fan, voice };
}

/** Best-reading first: the fan score decides, then fewer gate problems,
 * then the voice judge. A gated draft that reads best goes to the editor
 * (the 08-27 proof run threw away a 7.5 for a clean 5.5). */
function rank<T>(a: Candidate<T>, b: Candidate<T>): number {
  return (b.fan?.score ?? 0) - (a.fan?.score ?? 0) || a.problems.length - b.problems.length || (b.voice?.score ?? 0) - (a.voice?.score ?? 0);
}

/** The caller's gates plus the lane's own: no lifted exemplar lines. */
function gateAll<T>(o: BestOfOptions<T>, draft: T): string[] {
  const problems = o.gate(draft);
  if (!process.env.VITEST) {
    const lifted = exemplarOverlap(o.text(draft).body, o.lane);
    if (lifted.length) problems.push(`lines lifted from the approved builds (their sentences are not material; write your own): "${lifted.slice(0, 3).map((l) => l.slice(0, 90)).join('" | "')}"`);
  }
  return problems;
}

/** Step 2: every writer drafts from the same prompt; the clean candidate
 * the fan judge likes most wins (ties to the voice judge). With no roster
 * (vitest, or no keys) it is one default writer call, ungated by judges.
 * Returns null when no writer produced a parseable draft. */
export async function bestOfWriters<T>(o: BestOfOptions<T>): Promise<{ best: Candidate<T>; pool: Candidate<T>[] } | null> {
  const roster = columnWriters();
  const runs: (ColumnWriter | null)[] = roster.length ? roster : [null];
  const pool: Candidate<T>[] = [];
  await Promise.all(runs.map(async (w) => {
    try {
      const raw = await writeJSON({
        system: o.system, user: o.user, schema: o.schema, schemaName: o.schemaName, maxTokens: o.maxTokens,
        ...(w ? { provider: w.provider, model: w.model } : {}),
      });
      const draft = o.parse(raw);
      if (!draft) { console.warn(`[column] ${w?.name ?? "writer"}: invalid draft: ${raw.slice(0, 160).replace(/\n/g, " ")}`); return; }
      const problems = gateAll(o, draft);
      // Every candidate is judged: when all of them trip a gate, the ranking
      // still has to know which one reads best (the 08-27 proof run picked
      // by problem count alone and shipped a fan-4 column).
      const { fan, voice } = await judge(o, draft);
      console.log(`[column] ${w?.name ?? "writer"}: fan ${fan?.score ?? "-"} · voice ${voice?.score ?? "-"}${problems.length ? ` · gates: ${problems.join("; ")}` : ""}`);
      pool.push({ writer: w?.name ?? "writer", draft, problems, fan, voice });
    } catch (err) {
      console.warn(`[column] ${w?.name ?? "writer"} failed`, err instanceof Error ? err.message.slice(0, 120) : err);
    }
  }));
  if (pool.length === 0) return null;
  pool.sort(rank);
  return { best: pool[0], pool };
}

const EDITOR_SYSTEM = (floor: number) => `You are a line editor working on Josh Pate's column. You do not rewrite; you edit. Keep his argument, his order, his first person and his voice. Cut every sentence that restates an earlier one. Replace any abstract sentence with the specific from the notes or the material (a name, a number, a game, a date) or cut it. Make sure the line a fan would text a friend is in the piece and lands hard. Add NO facts, NO claims, NO quotes; keep every [EMBED] and [PULLQUOTE] marker exactly; keep the "— JP" sign-off as the last line. Never lengthen with filler and never drop below ${floor} words of prose; the length otherwise stays within a few percent of what you were given. No em dashes outside the sign-off, no exclamation points.

The Voice Bible v4.2 corrections (Josh, Aug 27) are the reason you are here; enforce all four: (1) cut any contingency that is true of every team in America ("if he stays healthy," "if the quarterback gets hurt," "turnovers will matter") unless a documented particular fact is right there in the material; a flag plant's conditions attach to results and dates, never to generic health. (2) Cut any sentence that narrates the analysis instead of making it ("the calendar is doing more work than the roster gap," "that number deserves an honest footnote," "here's the part that gets missed"); state the fact and let it stand. (3) The Ledger is furniture: no "I logged this on [date]" sentence; the accountability line reads human ("this one gets graded the night the ACC championship is decided"). (4) Never "card" for a schedule; say the year, the schedule, the slate. Return the edited column in the same JSON shape.`;

/** Step 3: the Opus line edit, adopted only when it clears the caller's
 * gates and the fan judge scores it no lower than the winner. Returns the
 * candidate to use (the edit or the original). */
export async function lineEdit<T extends object>(
  o: BestOfOptions<T> & { winner: Candidate<T>; notes: ArgumentNotes | null; floor: number; body: (draft: T) => string },
): Promise<Candidate<T>> {
  if (process.env.VITEST) return o.winner;
  try {
    const body = o.body(o.winner.draft);
    const { text, via } = await judgeJSON(o.anthropic, {
      model: EDITOR_MODEL,
      maxTokens: o.maxTokens,
      effort: "medium",
      schemaName: o.schemaName,
      schema: o.schema,
      system: `${EDITOR_SYSTEM(o.floor)}${o.winner.problems.length ? `\n\nTHE GATES THIS DRAFT FAILS (clear every one; a draft that still fails them is discarded):\n- ${o.winner.problems.join("\n- ")}\nAn "isolated one-liner" is a paragraph of twelve words or fewer standing alone; fold it into the paragraph before or after it, keeping the sentence.` : ""}${o.notes ? `\n\nTHE ARGUMENT NOTES:\n${JSON.stringify(o.notes)}` : ""}${o.winner.fan?.notes ? `\n\nA FAN'S NOTES ON THE DRAFT (fix these):\n${o.winner.fan.notes}` : ""}${o.winner.voice && !o.winner.voice.pass ? `\n\nTHE VOICE JUDGE (scored ${o.winner.voice.score}/10 against the gold standard):\n${o.winner.voice.notes}` : ""}\n\nRESTATED SENTENCES (cut or make new): ${restatements(body).slice(0, 5).join(" | ") || "none"}\nABSTRACT PARAGRAPHS (put the football in or cut): ${abstractParagraphs(body).slice(0, 3).map((p) => p.slice(0, 80)).join(" | ") || "none"}`,
      user: JSON.stringify(o.winner.draft),
    });
    const draft = o.parse(text);
    if (!draft) { console.warn("[column] edit: invalid JSON; keeping the winner"); return o.winner; }
    const problems = gateAll(o, draft);
    // A gated winner is what the edit is for: adopt the edit when it clears
    // more gates, or clears the same and reads no worse.
    if (problems.length > o.winner.problems.length) { console.warn(`[column] edit rejected by gates: ${problems.join("; ")}`); return o.winner; }
    const { fan, voice } = await judge(o, draft);
    const better = problems.length < o.winner.problems.length || (fan?.score ?? 0) >= (o.winner.fan?.score ?? 0);
    console.log(`[column] edit via ${via}: fan ${fan?.score ?? "-"} · voice ${voice?.score ?? "-"} → ${better ? "adopted" : "kept the winner"}`);
    return better ? { writer: `${o.winner.writer}+edit`, draft, problems, fan, voice } : o.winner;
  } catch (err) {
    console.warn("[column] edit failed; keeping the winner", err instanceof Error ? err.message.slice(0, 120) : err);
    return o.winner;
  }
}

/** The whole pipeline for one column, shared by the show and assignment
 * callers: up to two rounds of best-of-N; each round the best-reading
 * draft goes to the editor; the first clean draft (edit or candidate) with
 * the top fan score wins. Returns null when nothing parsed; a result with
 * problems when two rounds never produced a clean draft. */
export async function produceColumn<T extends object>(
  o: BestOfOptions<T> & { notes: ArgumentNotes | null; floor: number; body: (draft: T) => string },
): Promise<Candidate<T> | null> {
  let user = o.user;
  let last: Candidate<T> | null = null;
  for (let round = 0; round < 2; round++) {
    const r = await bestOfWriters<T>({ ...o, user });
    if (!r) break;
    const top = r.pool[0];
    const edited = await lineEdit<T>({ ...o, user, winner: top });
    const clean = [edited, ...r.pool].filter((c) => c.problems.length === 0).sort(rank);
    if (clean.length) return clean[0];
    last = edited.problems.length <= top.problems.length ? edited : top;
    console.warn(`[column] round ${round + 1}: no clean draft; best (${last.writer}) fails: ${last.problems.join(" | ").slice(0, 400)}`);
    user = `${o.user}\n\nYour previous draft violated the kit's laws — ${last.problems.join(" — ")}. Fix these precisely and keep what works.\n\nPrevious draft:\n${o.body(last.draft)}`;
  }
  return last;
}

/** For logs: what a reader would see, trimmed. */
export function preview(body: string): string {
  return renderedForJudge(body).slice(0, 160).replace(/\n/g, " ");
}
