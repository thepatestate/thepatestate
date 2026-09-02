// The floor is what the page prints (2026-09-02; Josh: the short articles
// are still too short; Isaac: every Wire story renders at least 350 words
// across its sections, reached through "What Most People Are Missing" and a
// "Questions to Be Answered" module — one to three of the questions a fan is
// asking and why each matters). The additions are written by the Wire's own
// writer (Sol; never an Anthropic model in the writing path) from the
// sources and verified team facts, then fact-checked like the story itself.
import { callJSON, choiceFor, type Tier } from "./models";
import { v3Prompt, S, arr, obj, nullable, dateLine, words } from "./v3-context";
import { factCheckSources } from "./fact-check";
import { sourcesBlock, type ReportedMaterial } from "./reported-engine";
import type { ArticleDraft, FanBrief, ReportingPack, StageCall, FactCheckResult } from "./v3-types";

export interface WireQuestion { question: string; why: string }
export interface Expansion { missing: string | null; questions: WireQuestion[] }

const EXPAND_SCHEMA = obj({ missing: nullable(S), questions: arr(obj({ question: S, why: S })) }) as unknown as Record<string, unknown>;

const BANNED = /\b(this matters because|the significance is|it remains to be seen|only time will tell|the question is whether)\b/i;

/** The expansion's text as one body, for the fact checker and word counts. */
export function expansionText(e: Expansion): string {
  return [e.missing ?? "", ...e.questions.map((q) => `${q.question}\n\n${q.why}`)].filter((s) => s.trim()).join("\n\n");
}

/** Strip anything that would ship as a stub: empty questions, banned phrasing, list bullets. */
export function cleanExpansion(e: Expansion): Expansion {
  const tidy = (s: string) => s.replace(/^\s*[-*•]\s+/gm, "").replace(/\*\*/g, "").trim();
  const questions = (e.questions ?? [])
    .map((q) => ({ question: tidy(q.question ?? "").replace(/^(q(uestion)?\s*\d*[:.)]\s*)/i, ""), why: tidy(q.why ?? "") }))
    .filter((q) => q.question && q.why && words(q.why) >= 25 && !BANNED.test(q.why) && !BANNED.test(q.question))
    .slice(0, 3);
  const missing = e.missing && tidy(e.missing) && words(e.missing) >= 40 && !BANNED.test(e.missing) ? tidy(e.missing) : null;
  return { missing, questions };
}

export interface ExpandOptions {
  /** Words the page still needs to reach the floor. */
  need: number;
  /** The story already carries a What Most People Are Missing module. */
  hasMissing: boolean;
  tier?: Tier;
  log?: (l: string) => void;
}

/** Write, fact-check (one retry with the flagged claims named), and return
 * only what passed. An empty expansion is a valid result: the story ships
 * at its own length rather than with unsupported sections. */
export async function expandStory(draft: ArticleDraft, pack: ReportingPack, brief: FanBrief, m: ReportedMaterial, opts: ExpandOptions): Promise<{ expansion: Expansion; calls: StageCall[]; fact?: FactCheckResult }> {
  const calls: StageCall[] = [];
  const log = opts.log ?? (() => {});
  const tier = opts.tier ?? "economy";
  const source = sourcesBlock(m);
  const ask = async (note?: string) => {
    const { data, call } = await callJSON<Expansion>({
      stage: "wire-expand", role: "reportedWriter", choice: choiceFor("reportedWriter", tier), maxTokens: 3000, schemaName: "wire_expansion", schema: EXPAND_SCHEMA,
      system: `${v3Prompt("wire-expand")}\n\n${v3Prompt("desk-voice")}`,
      user: `${dateLine()}\n\n${note ? `EDITOR'S NOTE ON YOUR LAST PASS: ${note}\n\n` : ""}THE PAGE NEEDS ABOUT ${Math.max(120, opts.need + 40)} MORE WORDS across the two sections.${opts.hasMissing ? " The story ALREADY has a What Most People Are Missing section: return missing as null and write only the questions." : ""}\n\nFAN BRIEF:\nTHE NEWS: ${brief.theNews}\nWHY A FAN CARES: ${brief.whyAFanCares}\nTHE STAKES: ${brief.stakes}${brief.joshAngle ? `\nTHE SITE'S ANGLE (on record): ${brief.joshAngle}` : ""}${brief.importantUnknown ? `\nWHAT WE DON'T KNOW: ${brief.importantUnknown}` : ""}\n\nTHE STORY AS PUBLISHED (its facts are checked; add to it, never repeat it):\nHEADLINE: ${draft.headline}\nDEK: ${draft.dek}\n\n${draft.bodyMarkdown}\n\nTHE SOURCES AND VERIFIED TEAM FACTS (the universe of what you may state):\n${source.slice(0, 16000)}\n\nREPORTING PACK:\n${JSON.stringify({ facts: pack.facts, numbers: pack.numbers, unknowns: pack.unknowns, relevantTeamContext: pack.relevantTeamContext }, null, 1).slice(0, 5000)}`,
    });
    calls.push(call);
    return cleanExpansion(data);
  };
  // The story's own text is part of the checker's universe: the expansion
  // may lean on facts the story already carries.
  const universe = `${source}\n\nTHE PUBLISHED STORY [sourceRef: story]:\n${draft.bodyMarkdown}`;
  const check = async (e: Expansion) => {
    const fc = await factCheckSources({ ...draft, bodyMarkdown: expansionText(e), pullQuote: "" }, universe); calls.push(fc.call);
    return fc.result;
  };
  let e = await ask();
  if (!e.missing && e.questions.length === 0) { log("expansion: nothing written"); return { expansion: e, calls }; }
  let fc = await check(e);
  log(`expansion (${calls[0].model}): ${words(expansionText(e))} words · missing ${e.missing ? "yes" : "no"} · ${e.questions.length} question(s) · fact ${fc.verdict}`);
  if (fc.verdict !== "pass") {
    const flagged = fc.claims.filter((c) => c.status === "unsupported" || c.status === "contradicted").map((c) => `${c.status.toUpperCase()}: ${c.claim}`);
    e = await ask(`The fact checker rejected these claims from your last pass — the sources do not carry them. Do not state them or anything like them; build from what the sources and verified team facts do say:\n- ${flagged.join("\n- ")}`);
    if (!e.missing && e.questions.length === 0) return { expansion: e, calls, fact: fc };
    fc = await check(e);
    log(`expansion retry: ${words(expansionText(e))} words · fact ${fc.verdict}`);
    if (fc.verdict !== "pass") { log("expansion dropped: did not pass the fact check twice"); return { expansion: { missing: null, questions: [] }, calls, fact: fc }; }
  }
  return { expansion: e, calls, fact: fc };
}
