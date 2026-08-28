// Stage 13 — hard policy gates (brief §10.1). Fail-closed and deterministic.
// Style is not here; facts and brand are.
import { findNonVerbatimQuotes } from "@/lib/generate";
import { hasFirstPersonProse, headlineNamesOutlet } from "@/lib/wire";
import type { ArticleDraft, Lane, PolicyResult } from "./types";

const TOUT = /\b(lock of the (week|year)|the play is|hammer (the|this)|cash (this|that|the) (ticket|bet)|\bunits?\b(?= on)|value bet|smash (the|this)|free money|to the window)\b/i;
const DUNK = /\b(bust(ed)?|fraud|overrated|soft|scared|choke(d|r)?|gutless|quit on)\b[^.!?]{0,40}\b(quarterback|qb|receiver|back|lineman|linebacker|corner|safety|kicker|punter|kid|freshman|sophomore|junior|senior)\b|\b(quarterback|qb|receiver|back|lineman|linebacker|corner|safety|kicker|punter|kid|freshman|sophomore|junior|senior)\b[^.!?]{0,40}\b(is a bust|is a fraud|is overrated|is soft|choked|has no heart)\b/i;
const MODEL_NICKNAME = /\b(the machine|the model says|the formula|the algorithm)\b/i;
const INJURY_JOKE = /\b(torn|tore|acl|achilles|fractur|broken|concuss|surgery|out for the season|season-ending)\b[^.!?]{0,80}\b(lol|haha|hilarious|comedy|clown|karma|deserved)\b/i;
const LEDGER_NARRATION = /\bI (logged|filed|am logging|'m logging|have logged) (this|it|the (pick|call))\b|\blogged (this |it )?on (January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}/i;

export interface PolicyInput { draft: ArticleDraft; lane: Lane; transcriptText?: string | null; suppliedQuotes?: string[] }

export function hardPolicyGates(input: PolicyInput): PolicyResult {
  const v: string[] = [];
  const body = input.draft.bodyMarkdown;
  const prose = body.replace(/\[QUOTE:[\d:]+\][\s\S]*?\[\/QUOTE\]/g, "");
  // Lane / person
  // Quoted speech is somebody else's first person; strip it before the lane check.
  const firstPerson = hasFirstPersonProse(prose.replace(/"[^"]{3,}"|“[^”]{3,}”/g, " "));
  if (input.lane === "show" && !firstPerson) v.push("lane: Josh's column must be first person");
  if (input.lane !== "show" && firstPerson) v.push("lane: staff/Wire prose carries no first person");
  if (input.lane === "show" && !/—\s*JP\s*$/.test(body.trimEnd())) v.push("lane: Josh's column signs off — JP");
  // Quote fidelity
  if (input.transcriptText) {
    const bad = findNonVerbatimQuotes(body, input.transcriptText);
    if (input.draft.pullQuote.trim().split(/\s+/).length >= 5 && findNonVerbatimQuotes(`"${input.draft.pullQuote}"`, input.transcriptText).length) bad.push(input.draft.pullQuote);
    if (bad.length) v.push(`quote fidelity: not verbatim in the transcript: ${bad.map((q) => `"${q.slice(0, 80)}"`).join("; ")}`);
  } else if (input.suppliedQuotes) {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    if (input.draft.pullQuote.trim() && !input.suppliedQuotes.some((q) => norm(q).includes(norm(input.draft.pullQuote)))) v.push("quote fidelity: pull quote is not one of the supplied archived quotes");
  }
  // Brand
  if (TOUT.test(prose)) v.push("tout language");
  if (DUNK.test(prose)) v.push("dunk framing on a player");
  if (MODEL_NICKNAME.test(prose)) v.push('the prediction model is "the AI Predictor"');
  if (INJURY_JOKE.test(prose)) v.push("injury treated as a joke");
  if (headlineNamesOutlet(input.draft.headline)) v.push("outlet name in the headline");
  if (LEDGER_NARRATION.test(prose)) v.push("Ledger timestamp narrated in prose (the site renders it)");
  if (/\bwhomst(ed)?\b/i.test(prose)) v.push("spoken bit carried into prose (whomst)");
  // Markers
  const embeds = (body.match(/\[EMBED:\d{2}:\d{2}:\d{2}\]/g) ?? []).length;
  if (input.lane === "show" && embeds !== 1) v.push(`markers: exactly one [EMBED:HH:MM:SS] required (found ${embeds})`);
  const pq = (body.match(/\[PULLQUOTE\]/g) ?? []).length;
  if (input.lane === "show" && (input.draft.pullQuote.trim() ? pq !== 1 : pq !== 0)) v.push(`markers: [PULLQUOTE] must appear once iff pullQuote is set (found ${pq})`);
  return { pass: v.length === 0, violations: v };
}
