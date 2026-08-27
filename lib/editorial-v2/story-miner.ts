// Stage 2 — the story miner (brief §6). Receives the dossier only; returns
// 6–10 materially different propositions and an honest verdict on the
// source's shape.
import { callJSON } from "./models";
import { v2Prompt } from "./context-pack";
import { dossierBlock } from "./dossier";
import type { EditorialDossier, StoryMinerResult, StageCall } from "./types";

const S = { type: "string" } as const;
const N = { type: "number" } as const;
const arr = (items: unknown) => ({ type: "array", items });
const obj = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });

export const ANGLE_SCHEMA = obj({
  id: S, thesis: S, readerPromise: S, whyNow: S,
  evidenceAvailable: arr(S), missingEvidence: arr(S),
  fanTension: S, likelyObjection: S, answerToObjection: S, saturdayPayoff: S,
  novelty: N, stakes: N, evidenceStrength: N, fanArgument: N, pateRelevance: N, specificity: N, curiosity: N,
  risk: S,
});

export const MINER_SCHEMA = obj({
  angles: arr(ANGLE_SCHEMA),
  sourceShape: { type: "string", enum: ["one-argument", "list", "weak"] },
  premiumWarranted: { type: "boolean" },
  note: S,
});

export async function mineStories(dossier: EditorialDossier, opts: { lane: string; recentHeadlines?: string[]; guidance?: string }): Promise<{ result: StoryMinerResult; call: StageCall }> {
  const { data, call } = await callJSON<StoryMinerResult>({
    stage: "story-miner", role: "storyMiner", maxTokens: 12000,
    schemaName: "story_miner", schema: MINER_SCHEMA as unknown as Record<string, unknown>,
    system: v2Prompt("story-miner"),
    user: `LANE: ${opts.lane === "show" ? "Josh's Read, a first-person column drawn from his own show; the reader is a serious college-football fan who may have watched the episode" : opts.lane}\n\n${opts.recentHeadlines?.length ? `RECENT PATE STATE HEADLINES (an angle that duplicates these is worth less):\n${opts.recentHeadlines.map((h) => `- ${h}`).join("\n")}\n\n` : ""}${opts.guidance ? `EDITOR'S GUIDANCE FOR THIS ROUND:\n${opts.guidance}\n\n` : ""}${dossierBlock(dossier)}`,
  });
  data.angles = data.angles.map((a, i) => ({ ...a, id: a.id || `angle-${i + 1}` }));
  return { result: data, call };
}
