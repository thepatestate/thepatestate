// V1's detectors as SIGNALS (brief §10.2): supplied to editors and the final
// EIC, never a verdict on their own. A 690-word finished column is not a
// failure; a 12-word paragraph is not a crime; a paragraph with no digit is
// not automatically abstract.
import { boilerplateViolations, restatements, abstractParagraphs, kickerBudget, proseWords } from "@/lib/editorial";
import type { StyleDiagnostics } from "./types";

export function styleDiagnostics(bodyMarkdown: string): StyleDiagnostics {
  const prose = bodyMarkdown.replace(/\[[^\]]*\]/g, " ");
  const sentences = prose.split(/(?<=[.!?])\s+/).filter((s) => s.split(/\s+/).length >= 6).length;
  const rest = restatements(prose);
  const paras = prose.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p && !p.startsWith("## ") && !/^—\s*JP$/.test(p));
  return {
    words: proseWords(bodyMarkdown),
    restatementPct: sentences ? Math.round((rest.length / sentences) * 1000) / 10 : 0,
    restatements: rest.slice(0, 6),
    abstractParagraphs: abstractParagraphs(prose).length,
    isolatedOneLiners: kickerBudget(bodyMarkdown).kickers.length,
    questionMarks: (prose.match(/\?/g) ?? []).length,
    styleFlags: boilerplateViolations(prose),
    paragraphLengths: paras.map((p) => p.split(/\s+/).length),
  };
}

/** The signals as the editor reads them. */
export function diagnosticsBlock(d: StyleDiagnostics): string {
  const sym = d.paragraphLengths.length >= 4 ? Math.round(stddev(d.paragraphLengths)) : null;
  return `STYLE DIAGNOSTICS (signals, not verdicts): ${d.words} words · ${d.restatementPct}% of sentences restate an earlier one${d.restatements.length ? ` (e.g. "${d.restatements[0].slice(0, 90)}")` : ""} · ${d.abstractParagraphs} paragraphs with no name or number · ${d.isolatedOneLiners} isolated one-liners · ${d.questionMarks} question marks${sym !== null ? ` · paragraph-length spread ${sym} words` : ""}${d.styleFlags.length ? ` · phrase flags: ${d.styleFlags.join(", ")}` : " · no phrase flags"}`;
}

function stddev(xs: number[]): number {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}

/** Brief §10.3: ranges, not quotas. Returns a note for the editor when the
 * length is outside the acceptable band; never a failure. */
export function lengthNote(words: number, product: "josh-column" | "staff-reaction" | "wire-story"): string | null {
  const band = product === "josh-column" ? [550, 1400] : product === "staff-reaction" ? [350, 1000] : [180, 700];
  if (words < band[0]) return `Short of the acceptable range (${words} < ${band[0]}): fine if the argument is finished; a problem only if a mandatory beat is missing.`;
  if (words > band[1]) return `Past the acceptable range (${words} > ${band[1]}): look for restated beats and schedule dumps.`;
  return null;
}
