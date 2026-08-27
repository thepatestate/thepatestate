// Stage 7 — voice retrieval (brief §9.2). A small curated library of exact
// passages from Josh-approved and Josh-edited columns, tagged by the
// rhetorical job they do. For a blueprint we pick 4–8 that match the jobs
// the article needs, preferring the same team or topic. Fragments from a
// fixture's hidden benchmark are excluded so a replay never sees Josh's
// answer key.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BeatJob, FragmentFunction, StoryBlueprint, VoiceFragment } from "./types";

let cache: VoiceFragment[] | null = null;
export function loadFragments(): VoiceFragment[] {
  if (cache) return cache;
  cache = JSON.parse(readFileSync(join(process.cwd(), "prompts", "editorial-v2", "voice-fragments.json"), "utf8")) as VoiceFragment[];
  return cache.filter((f) => f.approved);
}

const JOB_TO_FUNCTION: Record<BeatJob, FragmentFunction[]> = {
  hook: ["open"],
  claim: ["claim", "flag-plant"],
  evidence: ["football-explanation"],
  football: ["football-explanation"],
  "fan-objection": ["fan-objection"],
  counter: ["concession", "distinction"],
  turn: ["distinction"],
  consequence: ["distinction", "transition"],
  watch: ["transition"],
  close: ["close", "flag-plant"],
};

export interface RetrievalOptions { teams: string[]; topics?: string[]; excludeSourceIds?: string[]; min?: number; max?: number }

/** Picks fragments for the blueprint's beats: one per distinct job the
 * blueprint uses, best match first (team overlap, then topic overlap), then
 * fills to `min` with the next-best unused fragments. */
export function retrieveFragments(blueprint: StoryBlueprint, opts: RetrievalOptions): VoiceFragment[] {
  const min = opts.min ?? 4, max = opts.max ?? 8;
  const exclude = new Set(opts.excludeSourceIds ?? []);
  const pool = loadFragments().filter((f) => !exclude.has(f.sourceId));
  const teams = new Set(opts.teams.map((t) => t.toLowerCase()));
  const topics = new Set((opts.topics ?? []).map((t) => t.toLowerCase()));
  const score = (f: VoiceFragment) => f.teams.filter((t) => teams.has(t)).length * 3 + f.topics.filter((t) => topics.has(t)).length;
  const wanted = [...new Set(blueprint.beats.map((b) => b.job))];
  const chosen: VoiceFragment[] = [];
  const used = new Set<string>();
  for (const job of wanted) {
    const fns = JOB_TO_FUNCTION[job] ?? [];
    const best = pool.filter((f) => fns.includes(f.function) && !used.has(f.id)).sort((a, b) => score(b) - score(a))[0];
    if (best) { chosen.push(best); used.add(best.id); }
    if (chosen.length >= max) break;
  }
  if (chosen.length < min) {
    for (const f of pool.filter((f) => !used.has(f.id)).sort((a, b) => score(b) - score(a))) {
      chosen.push(f); used.add(f.id);
      if (chosen.length >= min) break;
    }
  }
  return chosen.slice(0, max);
}

/** The block the writer sees. */
export function fragmentsBlock(fragments: VoiceFragment[]): string {
  if (fragments.length === 0) return "";
  return `VOICE CALIBRATION — passages from columns Josh approved or edited himself, chosen for the jobs this article has to do. Use them to calibrate judgment and cadence: how a verdict is stated, how an objection is respected, how a concession is made, how a close lands. Do not copy phrases, do not reuse their facts, and do not reproduce their structure mechanically.\n\n${fragments.map((f) => `[${f.function}] ${f.exactText}`).join("\n\n")}`;
}
