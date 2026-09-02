// Production modules (2026-09-01, Isaac approved Josh's wire mockup: "update
// all of today's articles to this format... only use this format or a variant
// of it moving forward"): decompose the desk's finished story into the wire
// page's module fields. Adds nothing — the fact-checked text is the universe.
import { callJSON, choiceFor, type Tier } from "./models";
import { v3Prompt, S, words } from "./v3-context";
import type { ArticleDraft, FanBrief, ReportingPack, StageCall } from "./v3-types";
import { moduleCoverage } from "./render-length";

/** The modules are a LAYOUT of the story: below this share of the body's
 * words, paragraphs were dropped, not placed (2026-09-02 — the page was
 * printing ~40% less than the desk wrote). */
export const MIN_COVERAGE = 0.9;

const N = { anyOf: [{ type: "string" }, { type: "null" }] };
const MOD_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["openTitle", "whatHappened", "whyTitle", "whyBody", "missing", "callout", "calloutSpeaker", "section04Title", "section04Body", "chessboard", "readBody", "watching", "stats", "facts"],
  properties: {
    openTitle: S, whatHappened: S, whyTitle: N, whyBody: N, missing: N, callout: N, calloutSpeaker: N,
    section04Title: N, section04Body: N, chessboard: N, readBody: N,
    watching: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, required: ["title", "body"], properties: { title: S, body: S } } },
    stats: { type: "array", maxItems: 3, items: { type: "object", additionalProperties: false, required: ["value", "label", "critical"], properties: { value: S, label: S, critical: { type: "boolean" } } } },
    facts: { type: "array", maxItems: 6, items: { type: "object", additionalProperties: false, required: ["label", "value"], properties: { label: S, value: S } } },
  },
} as Record<string, unknown>;

export interface WireModules {
  openTitle: string; whatHappened: string; whyTitle: string | null; whyBody: string | null;
  missing: string | null; callout: string | null; calloutSpeaker: string | null; section04Title: string | null; section04Body: string | null;
  chessboard: string | null; readBody: string | null;
  watching: { title: string; body: string }[];
  stats: { value: string; label: string; critical: boolean }[];
  facts: { label: string; value: string }[];
}

export async function modulateStory(draft: ArticleDraft, pack: ReportingPack, brief: FanBrief, tier: Tier = "economy", log?: (l: string) => void): Promise<{ modules: WireModules; call: StageCall; calls: StageCall[]; coverage: number }> {
  const calls: StageCall[] = [];
  const ask = async (note?: string) => {
    const { data, call } = await callJSON<WireModules>({
      stage: "wire-modules", role: "deskEditor", choice: choiceFor("deskEditor", tier), maxTokens: 6000,
      schemaName: "wire_modules", schema: MOD_SCHEMA,
      system: v3Prompt("wire-modules"),
      user: `${note ? `EDITOR'S NOTE ON YOUR LAST PASS: ${note}\n\n` : ""}DEPTH: ${brief.depth.toUpperCase()}\nTHE STAKES (from the brief): ${brief.stakes}\n\nTHE FINISHED STORY (${words(draft.bodyMarkdown)} words — every one of them lands in a module):\nHEADLINE: ${draft.headline}\nDEK: ${draft.dek}\n\n${draft.bodyMarkdown}\n\nREPORTING PACK (for facts-rail values only; never introduce a fact the story does not carry):\n${JSON.stringify({ facts: pack.facts, numbers: pack.numbers, unknowns: pack.unknowns }, null, 1).slice(0, 4000)}`,
    });
    calls.push(call);
    // The page supplies the quotation marks around the callout.
    if (data.callout) data.callout = data.callout.replace(/^[\s"\u201C\u2018']+|[\s"\u201D\u2019']+$/g, "");
    return { data, call, coverage: moduleCoverage(data, draft.bodyMarkdown) };
  };
  let r = await ask();
  log?.(`modules: coverage ${Math.round(r.coverage * 100)}%`);
  if (r.coverage < MIN_COVERAGE) {
    const retry = await ask(`Your last layout kept only ${Math.round(r.coverage * 100)}% of the story's words — paragraphs were dropped, not placed. Every paragraph of the story must land in exactly one module; whatHappened carries, in order, every paragraph you do not place elsewhere. Lay out the whole story this time.`);
    log?.(`modules retry: coverage ${Math.round(r.coverage * 100)}% → ${Math.round(retry.coverage * 100)}%`);
    if (retry.coverage > r.coverage) r = retry;
  }
  if (r.coverage < MIN_COVERAGE) throw new Error(`modules kept ${Math.round(r.coverage * 100)}% of the story (floor ${MIN_COVERAGE * 100}%)`);
  return { modules: r.data, call: r.call, calls, coverage: r.coverage };
}
