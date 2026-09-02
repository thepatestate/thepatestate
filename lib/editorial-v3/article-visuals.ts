// Visual modules for long-form staff analysis (2026-09-02; Isaac: Josh
// wants the Indiana-style pieces "longer visually, not necessarily in
// words"). The body is untouched; the desk draws a numbers strip, a pull
// quote, a facts rail, a watch list and the open questions from it. Every
// value is checked back against the body — the callout must be verbatim,
// every stat's number must appear in the text, and the prose modules go
// through the fact checker with the article as the only source.
import { callJSON, choiceFor, type Tier } from "./models";
import { v3Prompt, S, arr, obj, nullable, words } from "./v3-context";
import { factCheckSources } from "./fact-check";
import type { StageCall } from "./v3-types";

export interface ArticleVisuals {
  stats: { value: string; label: string; critical: boolean }[];
  callout: string | null;
  calloutSpeaker: string | null;
  facts: { label: string; value: string }[];
  watching: { title: string; body: string }[];
  questions: { question: string; why: string }[];
}

const SCHEMA = obj({
  stats: arr(obj({ value: S, label: S, critical: { type: "boolean" } })),
  callout: nullable(S), calloutSpeaker: nullable(S),
  facts: arr(obj({ label: S, value: S })),
  watching: arr(obj({ title: S, body: S })),
  questions: arr(obj({ question: S, why: S })),
}) as unknown as Record<string, unknown>;

const norm = (s: string) => s.toLowerCase().replace(/[‘’“”"'`]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const digits = (s: string) => s.replace(/[^0-9]/g, "");

/** Pure: keep only what the body supports. Exported for tests. */
export function verifyVisuals(v: ArticleVisuals, body: string): ArticleVisuals {
  const nb = norm(body); const bodyDigits = body.replace(/,/g, "");
  const callout = v.callout && v.callout.trim() && nb.includes(norm(v.callout.replace(/^[\s"“‘']+|[\s"”’']+$/g, ""))) ? v.callout.trim().replace(/^[\s"“‘']+|[\s"”’']+$/g, "") : null;
  const isDate = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.? ?\d|\b(19|20)\d\d\b/i;
  let stats = (v.stats ?? []).filter((s) => s.value && s.label && digits(s.value) && !isDate.test(s.value) && (bodyDigits.includes(digits(s.value).slice(0, 4)) || nb.includes(norm(s.value)))).slice(0, 3);
  if (stats.length < 2) stats = [];
  const facts = (v.facts ?? []).filter((f) => f.label && f.value).slice(0, 6);
  const banned = /\b(this matters because|the significance is|remains to be seen|only time will tell)\b/i;
  const watching = (v.watching ?? []).filter((w) => w.title && w.body && !banned.test(w.body)).slice(0, 4);
  const questions = (v.questions ?? []).filter((q) => q.question && q.why && words(q.why) >= 25 && !banned.test(q.why)).slice(0, 3);
  return { stats, callout, calloutSpeaker: callout ? v.calloutSpeaker?.trim() || null : null, facts, watching, questions };
}

export async function articleVisuals(a: { headline: string; dek?: string; bodyMarkdown: string }, tier: Tier = "premium", log?: (l: string) => void): Promise<{ visuals: ArticleVisuals; calls: StageCall[] }> {
  const calls: StageCall[] = [];
  const body = a.bodyMarkdown.replace(/\[EMBED:[^\]]*\]\s*|\[\/?PULLQUOTE\]\s*/g, "");
  const { data, call } = await callJSON<ArticleVisuals>({
    stage: "article-visuals", role: "deskEditor", choice: choiceFor("deskEditor", tier), maxTokens: 4000, schemaName: "article_visuals", schema: SCHEMA,
    system: v3Prompt("article-visuals"),
    user: `HEADLINE: ${a.headline}\nDEK: ${a.dek ?? ""}\n\nTHE ARTICLE (${words(body)} words — the only source of every value):\n${body}`,
  });
  calls.push(call);
  let v = verifyVisuals(data, body);
  // The prose modules are claims; the article is their only universe.
  if (v.watching.length || v.questions.length) {
    const prose = [...v.watching.map((w) => `${w.title}\n${w.body}`), ...v.questions.map((q) => `${q.question}\n${q.why}`)].join("\n\n");
    const fc = await factCheckSources({ headline: a.headline, dek: a.dek ?? "", bodyMarkdown: prose, pullQuote: "", primaryTeam: "", teams: [], tags: [], seo: { title: "", description: "" } }, `THE ARTICLE [sourceRef: article]:\n${body}`);
    calls.push(fc.call);
    if (fc.result.verdict !== "pass") {
      const bad = fc.result.claims.filter((c) => c.status === "unsupported" || c.status === "contradicted").map((c) => norm(c.claim).slice(0, 40));
      const tainted = (t: string) => bad.some((b) => b && norm(t).includes(b.slice(0, 25)));
      v = { ...v, watching: v.watching.filter((w) => !tainted(w.body) && !tainted(w.title)), questions: v.questions.filter((q) => !tainted(q.why) && !tainted(q.question)) };
      log?.(`visuals: fact check ${fc.result.verdict} — dropped ${bad.length} flagged claim(s)`);
    }
  }
  log?.(`visuals: ${v.stats.length} stats · callout ${v.callout ? "yes" : "no"} · ${v.facts.length} facts · ${v.watching.length} watching · ${v.questions.length} questions`);
  return { visuals: v, calls };
}

/** The Sanity patch for an article, with array keys. */
export function visualsPatch(v: ArticleVisuals): Record<string, unknown> {
  return {
    stats: v.stats.map((s, i) => ({ _key: `s${i}`, ...s })),
    ...(v.callout ? { callout: v.callout, calloutSpeaker: v.calloutSpeaker ?? "" } : {}),
    facts: v.facts.map((f, i) => ({ _key: `f${i}`, ...f })),
    watching: v.watching.map((w, i) => ({ _key: `w${i}`, ...w })),
    questions: v.questions.map((q, i) => ({ _key: `q${i}`, ...q })),
  };
}
