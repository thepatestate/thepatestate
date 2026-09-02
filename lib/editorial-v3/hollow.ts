// A hollow story reports what its sources do not say (2026-09-02, Isaac:
// "drop the articles like 'West Virginia releases depth chart'" — 128 words,
// four sentences about what "the available details do not identify"). The
// desk may report ONE honest unknown; a story built from absences is not a
// story. Deterministic, so the gate cannot be argued with.
const ABSENCE = /\b(the )?(available|provided|published|released) (details|information|report|reporting|chart|material)\b|\b(do|does|did) not (identify|specify|name|list|include|detail|say (who|which|when|what|how))\b|\b(were|was|is|are) not (available|identified|specified|listed|named|provided)\b|\bno (further |additional |other )?details (were|are|have been)\b|\bwithout (naming|specifying|identifying|listing)\b|\b(not|un)(available|specified) in the (report|reporting|release)\b/gi;

export interface HollowVerdict { hollow: boolean; hits: number; phrases: string[]; reason: string }

/** One or two honest unknowns are reporting; a piece where absences run
 * denser than 1.5 per 100 words (three or more of them), or five anywhere,
 * is about the reporting, not the news. Measured 2026-09-02: the WV depth
 * chart item ran 4 in 128 words (3.1/100); legitimate briefs with two
 * unknowns run ~0.7/100. */
export function hollowReport(body: string, depth: "item" | "brief" | "story" | "analysis" = "item"): HollowVerdict {
  const found = body.match(ABSENCE) ?? [];
  const phrases = [...new Set(found.map((x) => x.toLowerCase().replace(/\s+/g, " ")))];
  const words = body.split(/\s+/).filter(Boolean).length || 1;
  const density = (found.length / words) * 100;
  const hollow = found.length >= 5 || (found.length >= 3 && density >= 1.5);
  return { hollow, hits: found.length, phrases, reason: hollow ? `hollow: ${found.length} absence phrases in ${words} words (${density.toFixed(1)}/100, ${depth}) — ${phrases.slice(0, 3).join(" · ")}` : "" };
}
