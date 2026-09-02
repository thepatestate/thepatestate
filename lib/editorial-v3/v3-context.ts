// Shared helpers for both V3 engines: prompt loading, the article schema,
// the compact hard policy (from V2's context pack, unchanged), the desk
// voice page, and a strict-schema builder.
import { readFileSync } from "node:fs";
import { join } from "node:path";
export { hardPolicyForLane } from "./context-pack";

export function v3Prompt(name: string): string {
  return readFileSync(join(process.cwd(), "prompts", "editorial-v3", `${name}.md`), "utf8");
}

export const S = { type: "string" } as const;
export const N = { type: "number" } as const;
export const arr = (items: unknown) => ({ type: "array", items });
export const obj = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
export const nullable = (t: unknown) => ({ anyOf: [t, { type: "null" }] });

// bodyMarkdown comes first so the writer produces the body before it commits
// to a headline and dek (structured output follows the schema's key order).
export const ARTICLE_SCHEMA = obj({
  bodyMarkdown: S, headline: S, dek: S, pullQuote: S, primaryTeam: S,
  teams: arr(S), tags: arr(S),
  seo: obj({ title: S, description: S }),
});

export const OUTPUT_CONTRACT = `OUTPUT CONTRACT (JSON only): headline; dek; bodyMarkdown (plain paragraphs; **bold** only; no lists, links, tables, blockquotes); pullQuote (verbatim from the supplied material or ""); primaryTeam / teams as lowercase-hyphenated slugs; tags 3–6; seo { title, description }.`;

/** The clock the corpus writes by: every pro story tells the reader when it is. */
export function dateLine(d = new Date()): string {
  // THE CLOCK IS THE CALENDAR (2026-09-01, from Josh's own annual: 34 dated
  // events, zero countdowns). Today's date exists so the writer can compute
  // weekdays and dates — never so the prose can measure distance from it.
  return `TODAY: ${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" })} (Eastern) — for computing weekdays and dates only; the sources may be a day old. The story must read true a month from now: date events to the calendar ("Saturday, Sept. 5", "said Monday" for the past six days, month + day beyond that), measure distance event-to-event ("one week after the opener", "three road games in 22 days", "game two"), and let the season's structure carry urgency ("by October", "before the defense has met itself"). Never measure time from the moment of writing: no "X days before/until/away", "today", "tonight", "tomorrow", "this week", "next week", "currently", "right now", "as of".`;
}

export function words(text: string): number {
  return text.replace(/\[[^\]]*\]/g, " ").replace(/—\s*JP\s*$/, "").split(/\s+/).filter(Boolean).length;
}

export function paragraphs(body: string): string[] {
  return body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

export function cleanDraft<T extends { headline: string; dek: string; bodyMarkdown: string; pullQuote: string }>(d: T): T {
  const fix = (s: string) => s.replace(/\\(["'])/g, "$1");
  return { ...d, headline: fix(d.headline), dek: fix(d.dek), bodyMarkdown: fix(d.bodyMarkdown).trimEnd(), pullQuote: fix(d.pullQuote) };
}
