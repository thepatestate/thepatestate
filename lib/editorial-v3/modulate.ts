// Production modules (2026-09-01, Isaac approved Josh's wire mockup: "update
// all of today's articles to this format... only use this format or a variant
// of it moving forward"): decompose the desk's finished story into the wire
// page's module fields. Adds nothing — the fact-checked text is the universe.
import { callJSON, choiceFor, type Tier } from "./models";
import { v3Prompt, S } from "./v3-context";
import type { ArticleDraft, FanBrief, ReportingPack, StageCall } from "./v3-types";

const N = { anyOf: [{ type: "string" }, { type: "null" }] };
const MOD_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["openTitle", "whatHappened", "whyTitle", "whyBody", "missing", "callout", "section04Title", "section04Body", "chessboard", "readBody", "watching", "stats", "facts"],
  properties: {
    openTitle: S, whatHappened: S, whyTitle: N, whyBody: N, missing: N, callout: N,
    section04Title: N, section04Body: N, chessboard: N, readBody: N,
    watching: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, required: ["title", "body"], properties: { title: S, body: S } } },
    stats: { type: "array", maxItems: 3, items: { type: "object", additionalProperties: false, required: ["value", "label", "critical"], properties: { value: S, label: S, critical: { type: "boolean" } } } },
    facts: { type: "array", maxItems: 6, items: { type: "object", additionalProperties: false, required: ["label", "value"], properties: { label: S, value: S } } },
  },
} as Record<string, unknown>;

export interface WireModules {
  openTitle: string; whatHappened: string; whyTitle: string | null; whyBody: string | null;
  missing: string | null; callout: string | null; section04Title: string | null; section04Body: string | null;
  chessboard: string | null; readBody: string | null;
  watching: { title: string; body: string }[];
  stats: { value: string; label: string; critical: boolean }[];
  facts: { label: string; value: string }[];
}

export async function modulateStory(draft: ArticleDraft, pack: ReportingPack, brief: FanBrief, tier: Tier = "economy"): Promise<{ modules: WireModules; call: StageCall }> {
  const { data, call } = await callJSON<WireModules>({
    stage: "wire-modules", role: "deskEditor", choice: choiceFor("deskEditor", tier), maxTokens: 5000,
    schemaName: "wire_modules", schema: MOD_SCHEMA,
    system: v3Prompt("wire-modules"),
    user: `DEPTH: ${brief.depth.toUpperCase()}\nTHE STAKES (from the brief): ${brief.stakes}\n\nTHE FINISHED STORY:\nHEADLINE: ${draft.headline}\nDEK: ${draft.dek}\n\n${draft.bodyMarkdown}\n\nREPORTING PACK (for facts-rail values only; never introduce a fact the story does not carry):\n${JSON.stringify({ facts: pack.facts, numbers: pack.numbers, unknowns: pack.unknowns }, null, 1).slice(0, 4000)}`,
  });
  return { modules: data, call };
}
