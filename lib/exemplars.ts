// The voice targets (Josh, 2026-08-26: "make sure it's written in the exact
// same voice as those articles"). The approved reference builds ARE the
// voice, so each lane's writer sees the approved article verbatim as the
// register to match, and a judge scores every draft against it.
//
// Kit v4.2 (Josh, 2026-08-27):
//   feature-three-boards-v3_1.html → the gold standard for Josh's Read and
//     show-derived columns, and the ceiling (Voice Bible §12).
//   article-miami-acc-favorite-v2.html → the second approved column: the
//     v4.2 corrections in practice (no banal contingencies, no meta-framing,
//     Ledger machinery in furniture with human accountability in prose).
//   wire-ohio-state-rowe-safety.html → the Wire: desk voice, zero opinions,
//     approved as the injury-story standard (spec 04).
import { readFileSync } from "node:fs";
import { join } from "node:path";

const cache = new Map<string, string>();

const ENTITIES: [RegExp, string][] = [
  [/&amp;/g, "&"], [/&lt;/g, "<"], [/&gt;/g, ">"], [/&quot;/g, '"'], [/&#39;|&apos;/g, "'"],
  [/&nbsp;/g, " "], [/&rsquo;/g, "’"], [/&lsquo;/g, "‘"], [/&rdquo;/g, "”"], [/&ldquo;/g, "“"],
  [/&mdash;/g, "—"], [/&hellip;/g, "…"],
];

/** Strips every element carrying one of the given classes, nested divs and all. */
function stripByClass(html: string, classes: string[]): string {
  const re = new RegExp(`<(div|p|a|section)\\s+class="(?:${classes.join("|")})"[^>]*>`, "g");
  let out = "";
  let i = 0;
  for (;;) {
    re.lastIndex = i;
    const m = re.exec(html);
    if (!m) { out += html.slice(i); break; }
    out += html.slice(i, m.index);
    const tag = m[1];
    // Walk to the matching close tag, counting nesting of the same tag.
    const open = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, "g");
    open.lastIndex = m.index + m[0].length;
    let depth = 1;
    let end = html.length;
    let t: RegExpExecArray | null;
    while ((t = open.exec(html))) {
      depth += t[0].startsWith("</") ? -1 : 1;
      if (depth === 0) { end = t.index + t[0].length; break; }
    }
    i = end;
  }
  return out;
}

/** The article prose of a reference build, tags stripped, headers kept:
 * headline, dek, and the body — none of the chrome (crumb, byline row,
 * photo slot, receipt module, companion card, Pulse, Sourcing, tags,
 * author card, porch). */
export function exemplarProse(name: string): string {
  const hit = cache.get(name);
  if (hit) return hit;
  const html = readFileSync(join(process.cwd(), "prompts", "pate-state-kit", "reference-builds", `${name}.html`), "utf8");
  const m = html.match(/<article[^>]*class="article"[^>]*>([\s\S]*?)<\/article>/) ?? html.match(/<main[^>]*>([\s\S]*?)<\/main>/);
  let body = m ? m[1] : html;
  body = body.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "");
  body = body.replace(/<(aside|nav|footer)[\s\S]*?<\/\1>/g, "");
  body = stripByClass(body, [
    "a-crumb", "a-kick", "a-by", "a-hero", "a-cap", "a-ep", "a-src", "a-tags", "a-share", "a-author", "a-porch", "a-pb",
    "receipt", "pulse", "yt", "krc", "proof",
  ]);
  body = body.replace(/<h([1-4])[^>]*>/g, "\n\n## ").replace(/<\/h[1-4]>/g, "\n");
  body = body.replace(/<(p|li|blockquote|div|tr)[^>]*>/g, "\n").replace(/<br\s*\/?>/g, "\n");
  body = body.replace(/<[^>]+>/g, "");
  for (const [re, to] of ENTITIES) body = body.replace(re, to);
  body = body.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
  cache.set(name, body);
  return body;
}

export const EXEMPLAR_FOR_LANE = {
  // Kit v4.2: the corrected hybrid Three Boards build is the gold standard and the ceiling.
  feature: "feature-three-boards-v3_1",
  wire: "wire-ohio-state-rowe-safety",
} as const;

/** The second approved build per lane, shown after the gold standard
 * (kit 07: "use it alongside the gold standard as the pattern for
 * single-conference/single-team columns"). */
export const SECOND_EXEMPLAR_FOR_LANE: Partial<Record<keyof typeof EXEMPLAR_FOR_LANE, string>> = {
  feature: "article-miami-acc-favorite-v2",
};

/** The prompt block: the approved article(s) as the register to match, with
 * the anti-parroting rail (their facts, picks and lines are not material). */
export function voiceExemplarBlock(lane: keyof typeof EXEMPLAR_FOR_LANE): string {
  const name = EXEMPLAR_FOR_LANE[lane];
  const second = SECOND_EXEMPLAR_FOR_LANE[lane];
  const who = lane === "feature"
    ? "the gold standard for Josh's Read and show-derived columns (Voice Bible §12): the best voice yet and the ceiling — calibrate to it, not past it"
    : "the approved Wire build (spec 04): the Wire register, attribution in sentence one, zero Josh opinion, Josh only in verbatim archive quotes";
  const secondBlock = second
    ? `\n\n=== ${second}.html === (the second approved column, kit v4.2: the same writer on a single-conference call — the v4.2 laws in practice: no banal contingencies, no meta-analytical framing, the Ledger's timestamps in the module and human accountability in the prose, flag-plant conditions attached to results and dates)\n${exemplarProse(second)}\n=== end of second exemplar ===`
    : "";
  return `THE GOLD STANDARD — ${who}. The kit's rule is that you open the approved build before writing and calibrate to it; here it is. Match how its sentences are built and how long they run, where its rare isolated kicker lands and how the rest fold into their paragraphs, how a fact and a verdict share a paragraph, how the numbers sit where a vague quantifier could have lived, how the humor is placed and how rare it is. A reader should believe the same person wrote both.

Its facts, picks, numbers, names, and lines are NOT material for your piece: never reuse its claims, its sentences, or its constructions with the nouns swapped. Match the register; write your own story.

=== ${name}.html ===
${exemplarProse(name)}
=== end of exemplar ===${secondBlock}`;
}
