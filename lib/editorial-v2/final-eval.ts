// Stages 14A/B/C — the final quality system (brief §18). Two fan judges
// from different families, a humanity judge, and the existing voice judge
// (which is the one place the full gold standard is still read).
import Anthropic from "@anthropic-ai/sdk";
import { callJSON } from "./models";
import { v2Prompt } from "./context-pack";
import { fanScore, voiceMatch, renderedForJudge } from "@/lib/editorial";
import type { ArticleDraft, FanJudgement, FinalEvaluation, HumanityJudgement, Lane, Product, StageCall } from "./types";

const S = { type: "string" } as const;
const N = { type: "number" } as const;
const obj = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });

export const FAN_SCHEMA = obj({
  interested: S, bored: S, learned: S, arguedWith: S, wouldText: S, obvious: S, machine: S,
  finished: { type: "boolean" }, wouldSend: { type: "boolean" },
  legibility: N, enjoyment: N, valueAdded: N, fanConnection: N, sendability: N,
  joshVoice: { type: ["number", "null"] }, overall: N,
});

export const HUMANITY_SCHEMA = obj({ humanity: N, tells: { type: "array", items: S }, strongestHumanPassage: S, notes: S });

export const THRESHOLDS = { fanMean: 8.5, legibilityMin: 8.0, sendabilityMean: 8.0, voice: 8.5, humanity: 8.5 };

function readerText(d: ArticleDraft): string {
  return `HEADLINE: ${d.headline}\nDEK: ${d.dek}\n\n${renderedForJudge(d.bodyMarkdown)}`;
}

export async function finalEvaluation(draft: ArticleDraft, opts: { lane: Lane; product: Product; includeLegacy?: boolean }): Promise<{ evaluation: FinalEvaluation; calls: StageCall[] }> {
  const user = `${opts.product === "josh-column" ? "This is a Josh-lane piece: score joshVoice." : "Staff piece: joshVoice is null."}\n\n${readerText(draft)}`;
  const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  const [a, b, h, v, legacy] = await Promise.all([
    callJSON<Omit<FanJudgement, "judge">>({ stage: "fan-judge-A", role: "fanJudgeA", maxTokens: 3000, schemaName: "fan_judgement", schema: FAN_SCHEMA as unknown as Record<string, unknown>, system: v2Prompt("fan-judge"), user }),
    callJSON<Omit<FanJudgement, "judge">>({ stage: "fan-judge-B", role: "fanJudgeB", maxTokens: 3000, schemaName: "fan_judgement", schema: FAN_SCHEMA as unknown as Record<string, unknown>, system: v2Prompt("fan-judge"), user }),
    callJSON<Omit<HumanityJudgement, "judge">>({ stage: "humanity-judge", role: "humanityJudge", maxTokens: 3000, schemaName: "humanity_judgement", schema: HUMANITY_SCHEMA as unknown as Record<string, unknown>, system: v2Prompt("humanity-judge"), user }),
    process.env.VITEST ? Promise.resolve({ score: 10, notes: "", pass: true }) : voiceMatch(anthropic as Anthropic, { lane: opts.lane === "wire" ? "wire" : "feature", draft: draft.bodyMarkdown }),
    opts.includeLegacy && !process.env.VITEST ? fanScore(anthropic as Anthropic, { headline: draft.headline, dek: draft.dek, body: draft.bodyMarkdown }) : Promise.resolve(null),
  ]);
  const fanA: FanJudgement = { judge: `A:${a.call.model}`, ...a.data, joshVoice: a.data.joshVoice ?? undefined };
  const fanB: FanJudgement = { judge: `B:${b.call.model}`, ...b.data, joshVoice: b.data.joshVoice ?? undefined };
  const humanity: HumanityJudgement = { judge: h.call.model, ...h.data };
  const fanMean = (fanA.overall + fanB.overall) / 2;
  const meets = {
    fanMean: fanMean >= THRESHOLDS.fanMean,
    legibilityMin: Math.min(fanA.legibility, fanB.legibility) >= THRESHOLDS.legibilityMin,
    sendabilityMean: (fanA.sendability + fanB.sendability) / 2 >= THRESHOLDS.sendabilityMean,
    voice: v.score >= THRESHOLDS.voice,
    humanity: humanity.humanity >= THRESHOLDS.humanity,
    all: false,
  };
  meets.all = meets.fanMean && meets.legibilityMin && meets.sendabilityMean && meets.voice && meets.humanity;
  const evaluation: FinalEvaluation = {
    fanA, fanB, humanity, voice: { score: v.score, notes: v.notes, pass: v.pass },
    legacyFan: legacy ? { score: legacy.score, legibility: legacy.legibility, enjoyment: legacy.enjoyment, joshVoice: legacy.joshVoice, notes: legacy.notes } : undefined,
    thresholds: THRESHOLDS, meets,
  };
  return { evaluation, calls: [a.call, b.call, h.call] };
}

export function fanMean(e: FinalEvaluation): number {
  return Math.round(((e.fanA.overall + e.fanB.overall) / 2) * 10) / 10;
}
