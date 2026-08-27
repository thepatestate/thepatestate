// Stages 3–4 — the angle tournament (brief §7). Two blind judges from
// different model families score every angle; an editor-in-chief that is
// not the miner selects, remines, or kills.
import { callJSON } from "./models";
import { v2Prompt } from "./context-pack";
import { dossierBlock } from "./dossier";
import type { AngleDecision, AngleJudgement, AngleScore, EditorialDossier, StageCall, StoryAngle } from "./types";

const S = { type: "string" } as const;
const N = { type: "number" } as const;
const arr = (items: unknown) => ({ type: "array", items });
const obj = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });

export const ANGLE_SCORES_SCHEMA = obj({
  scores: arr(obj({
    angleId: S, novelty: N, stakes: N, evidence: N, fanTension: N, specificity: N, brandFit: N, curiosity: N, valueAdded: N,
    fatalProblem: { type: ["string", "null"] }, strongestReasonToRun: S, strongestReasonNotToRun: S,
  })),
});

export const ANGLE_DECISION_SCHEMA = obj({
  decision: { type: "string", enum: ["select", "remine", "kill"] },
  selectedAngleId: { type: ["string", "null"] },
  finalThesis: { type: ["string", "null"] },
  reason: S,
  requiredEvidence: arr(S),
  mustAvoid: arr(S),
});

function anglesBlock(angles: StoryAngle[]): string {
  return `CANDIDATE ANGLES:\n${JSON.stringify(angles, null, 1)}`;
}

export async function judgeAngles(dossier: EditorialDossier, angles: StoryAngle[], opts: { lane: string; recentHeadlines?: string[] }): Promise<{ judgements: AngleJudgement[]; calls: StageCall[] }> {
  const user = `LANE: ${opts.lane}. READER: a serious college-football fan.\n${opts.recentHeadlines?.length ? `RECENT PATE STATE HEADLINES:\n${opts.recentHeadlines.map((h) => `- ${h}`).join("\n")}\n\n` : ""}${dossierBlock(dossier)}\n\n${anglesBlock(angles)}`;
  const [a, b] = await Promise.all([
    callJSON<{ scores: AngleScore[] }>({ stage: "angle-judge-A", role: "angleJudgeA", maxTokens: 8000, schemaName: "angle_scores", schema: ANGLE_SCORES_SCHEMA as unknown as Record<string, unknown>, system: v2Prompt("angle-judge"), user }),
    callJSON<{ scores: AngleScore[] }>({ stage: "angle-judge-B", role: "angleJudgeB", maxTokens: 8000, schemaName: "angle_scores", schema: ANGLE_SCORES_SCHEMA as unknown as Record<string, unknown>, system: v2Prompt("angle-judge"), user }),
  ]);
  return {
    judgements: [{ judge: `A:${a.call.model}`, scores: a.data.scores }, { judge: `B:${b.call.model}`, scores: b.data.scores }],
    calls: [a.call, b.call],
  };
}

export async function selectAngle(dossier: EditorialDossier, angles: StoryAngle[], judgements: AngleJudgement[], opts: { lane: string; minerNote: string; premiumWarranted: boolean; assignment?: string }): Promise<{ decision: AngleDecision; call: StageCall }> {
  const { data, call } = await callJSON<AngleDecision>({
    stage: "eic-angle", role: "eicAngle", maxTokens: 4000,
    schemaName: "angle_decision", schema: ANGLE_DECISION_SCHEMA as unknown as Record<string, unknown>,
    system: v2Prompt("eic-angle"),
    user: `LANE: ${opts.lane}\n${opts.assignment ? `THE ASSIGNMENT (the column is about this; select only within it): ${opts.assignment}\n` : ""}STORY MINER'S VERDICT ON THE SOURCE: premiumWarranted=${opts.premiumWarranted}; ${opts.minerNote}\n\n${dossierBlock(dossier)}\n\n${anglesBlock(angles)}\n\nJUDGE SCORECARDS (independent; neither saw the other):\n${JSON.stringify(judgements, null, 1)}`,
  });
  if (data.decision === "select" && !angles.some((a) => a.id === data.selectedAngleId)) {
    data.selectedAngleId = angles[0]?.id;
  }
  return { decision: data, call };
}

/** Mean of both judges' mean category scores per angle, for the record. */
export function consensus(judgements: AngleJudgement[]): Record<string, number> {
  const out: Record<string, number[]> = {};
  for (const j of judgements) for (const s of j.scores) {
    const m = (s.novelty + s.stakes + s.evidence + s.fanTension + s.specificity + s.brandFit + s.curiosity + s.valueAdded) / 8;
    (out[s.angleId] ??= []).push(m);
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10]));
}
