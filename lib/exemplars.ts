// The voice targets (Josh, 2026-08-26: "make sure it's written in the exact
// same voice as those articles"). The approved reference builds ARE the
// voice, so each lane's writer sees the approved article verbatim as the
// register to match, and a judge scores every draft against it.
//
// feature-three-boards-josh.html → Josh's Read: first person, his byline,
//   frozen at his 9.7 sign-off (the ceiling for "Josh-like").
// wire-ohio-state-rowe-safety.html → the Wire: desk voice, zero opinions,
//   approved as the injury-story standard.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const cache = new Map<string, string>();

/** The article prose of a reference build, tags stripped, headers kept. */
export function exemplarProse(name: string): string {
  const hit = cache.get(name);
  if (hit) return hit;
  const html = readFileSync(join(process.cwd(), "prompts", "pate-state-kit", "reference-builds", `${name}.html`), "utf8");
  const m = html.match(/<article[^>]*class="article"[^>]*>([\s\S]*?)<\/article>/) ?? html.match(/<main[^>]*>([\s\S]*?)<\/main>/);
  let body = m ? m[1] : html;
  body = body.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "");
  // Chrome that isn't prose: rail, source box, tags, share row, pulse.
  body = body.replace(/<(aside|nav|footer)[\s\S]*?<\/\1>/g, "");
  body = body.replace(/<div class="(a-src|a-tags|a-share|pulse|yt|a-pb|a-quad|a-porch|a-author)"[\s\S]*?<\/div>\s*<\/div>/g, "");
  body = body.replace(/<h([1-4])[^>]*>/g, "\n\n## ").replace(/<\/h[1-4]>/g, "\n");
  body = body.replace(/<(p|li|blockquote|div|tr)[^>]*>/g, "\n").replace(/<br\s*\/?>/g, "\n");
  body = body.replace(/<[^>]+>/g, "");
  body = body
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&rsquo;/g, "’").replace(/&lsquo;/g, "‘")
    .replace(/&rdquo;/g, "”").replace(/&ldquo;/g, "“").replace(/&mdash;/g, "—").replace(/&hellip;/g, "…");
  body = body.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
  cache.set(name, body);
  return body;
}

export const EXEMPLAR_FOR_LANE = {
  // Kit v4.0: the hybrid Three Boards build is the gold standard and the ceiling.
  feature: "feature-three-boards-v3",
  wire: "wire-ohio-state-rowe-safety",
} as const;

/** The prompt block: the approved article as the register to match, with
 * the anti-parroting rail (its facts, picks and lines are not material). */
export function voiceExemplarBlock(lane: keyof typeof EXEMPLAR_FOR_LANE): string {
  const name = EXEMPLAR_FOR_LANE[lane];
  const who = lane === "feature"
    ? "the gold standard for Josh's Read and show-derived columns (Voice Bible §12): the best voice yet and the ceiling — calibrate to it, not past it"
    : "the approved Wire build (spec 04): the Wire register, attribution in sentence one, zero Josh opinion, Josh only in verbatim archive quotes";
  return `THE GOLD STANDARD — ${who}. The kit's rule is that you open the approved build before writing and calibrate to it; here it is. Match how its sentences are built and how long they run, where its rare isolated kicker lands and how the rest fold into their paragraphs, how a fact and a verdict share a paragraph, how the numbers sit where a vague quantifier could have lived, how the humor is placed and how rare it is. A reader should believe the same person wrote both.

Its facts, picks, numbers, names, and lines are NOT material for your piece: never reuse its claims, its sentences, or its constructions with the nouns swapped. Match the register; write your own story.

=== ${name}.html ===
${exemplarProse(name)}
=== end of exemplar ===`;
}
