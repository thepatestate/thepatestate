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

export const ARTICLE_SCHEMA = obj({
  headline: S, dek: S, bodyMarkdown: S, pullQuote: S, primaryTeam: S,
  teams: arr(S), tags: arr(S),
  seo: obj({ title: S, description: S }),
});

export const OUTPUT_CONTRACT = `OUTPUT CONTRACT (JSON only): headline; dek; bodyMarkdown (plain paragraphs; **bold** only; no lists, links, tables, blockquotes); pullQuote (verbatim from the supplied material or ""); primaryTeam / teams as lowercase-hyphenated slugs; tags 3–6; seo { title, description }.`;

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
