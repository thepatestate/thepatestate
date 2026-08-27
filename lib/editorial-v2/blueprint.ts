// Stages 5–6 — the story blueprint and its editor (brief §8). The
// argument's movement, built and challenged before any prose exists.
import { callJSON } from "./models";
import { v2Prompt } from "./context-pack";
import { dossierBlock } from "./dossier";
import type { AngleDecision, BlueprintReview, EditorialDossier, StageCall, StoryAngle, StoryBlueprint } from "./types";

const S = { type: "string" } as const;
const N = { type: "number" } as const;
const arr = (items: unknown) => ({ type: "array", items });
const obj = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });

const BEAT_SCHEMA = obj({
  id: S,
  job: { type: "string", enum: ["hook", "claim", "evidence", "football", "fan-objection", "counter", "turn", "consequence", "watch", "close"] },
  point: S,
  sourceRefs: arr(S),
  joshRefs: arr(S),
  newInformation: S,
  readerReactionTarget: { type: "string", enum: ["didnt-know", "hadnt-thought", "want-to-watch", "argument", "emotion", "none"] },
  mandatory: { type: "boolean" },
});

export const BLUEPRINT_SCHEMA = obj({
  thesis: S,
  targetLength: obj({ minGuidance: N, ideal: N, maxGuidance: N }),
  beats: arr(BEAT_SCHEMA),
  openingStrategy: S, centralDistinction: S, strongestProof: S, fanObjection: S, honestConcession: S, saturdayTest: S, endingJob: S,
  cutIfThin: arr(S),
});

export const BLUEPRINT_REVIEW_SCHEMA = obj({
  verdict: { type: "string", enum: ["pass", "revise-blueprint", "return-to-angle", "return-to-reporting", "kill"] },
  problems: arr(S),
  cutBeats: arr(S),
  revisedBlueprint: { anyOf: [BLUEPRINT_SCHEMA, { type: "null" }] },
  reason: S,
});

export function angleBlock(angle: StoryAngle, decision: AngleDecision): string {
  return `SELECTED ANGLE:\n${JSON.stringify(angle, null, 1)}\n\nEDITOR-IN-CHIEF: thesis = ${decision.finalThesis ?? angle.thesis}\nrequiredEvidence: ${decision.requiredEvidence.join("; ") || "none named"}\nmustAvoid: ${decision.mustAvoid.join("; ") || "none named"}`;
}

export async function buildBlueprint(dossier: EditorialDossier, angle: StoryAngle, decision: AngleDecision, opts: { product: string; guidance?: string; factSheet?: string }): Promise<{ blueprint: StoryBlueprint; call: StageCall }> {
  const { data, call } = await callJSON<StoryBlueprint>({
    stage: "blueprint", role: "blueprint", maxTokens: 8000,
    schemaName: "story_blueprint", schema: BLUEPRINT_SCHEMA as unknown as Record<string, unknown>,
    system: v2Prompt("blueprint"),
    user: `PRODUCT: ${opts.product}${opts.product === "josh-column" ? " (first person; length guidance 750–1,150 ideal, 550–1,400 acceptable; never padded)" : ""}\n${opts.guidance ? `\nGUIDANCE FROM THE PREVIOUS REVIEW:\n${opts.guidance}\n` : ""}\n${angleBlock(angle, decision)}\n\n${dossierBlock(dossier)}${opts.factSheet ? `\n\nVERIFIED TEAM FACTS [sourceRef: fact-sheet] (records, polls, full schedules; every date here is evidence):\n${opts.factSheet}` : ""}`,
  });
  return { blueprint: data, call };
}

export async function reviewBlueprint(dossier: EditorialDossier, blueprint: StoryBlueprint, angle: StoryAngle, factSheet?: string): Promise<{ review: BlueprintReview; call: StageCall }> {
  const { data, call } = await callJSON<BlueprintReview>({
    stage: "blueprint-editor", role: "blueprintEditor", maxTokens: 16000,
    schemaName: "blueprint_review", schema: BLUEPRINT_REVIEW_SCHEMA as unknown as Record<string, unknown>,
    system: v2Prompt("blueprint-editor"),
    user: `THESIS UNDER REVIEW: ${angle.thesis}\n\nBLUEPRINT:\n${JSON.stringify(blueprint, null, 1)}\n\n${dossierBlock(dossier)}${factSheet ? `\n\nVERIFIED TEAM FACTS [sourceRef: fact-sheet] (every date here is evidence the blueprint may rest on):\n${factSheet}` : ""}`,
  });
  if (data.revisedBlueprint === null) delete (data as { revisedBlueprint?: unknown }).revisedBlueprint;
  return { review: data, call };
}

export function blueprintBlock(b: StoryBlueprint): string {
  return `APPROVED BLUEPRINT (the required thought sequence; make it read naturally, not as a template):\nTHESIS: ${b.thesis}\nOPENING: ${b.openingStrategy}\nCENTRAL DISTINCTION: ${b.centralDistinction}\nSTRONGEST PROOF: ${b.strongestProof}\nTHE FAN'S OBJECTION: ${b.fanObjection}\nHONEST CONCESSION: ${b.honestConcession}\nSATURDAY TEST: ${b.saturdayTest}\nENDING: ${b.endingJob}\nLENGTH GUIDANCE: about ${b.targetLength.ideal} words (${b.targetLength.minGuidance}–${b.targetLength.maxGuidance}); the argument sets the length, never the range.\nBEATS:\n${b.beats.map((x, i) => `${i + 1}. [${x.job}${x.mandatory ? ", mandatory" : ""}] ${x.point} — new information: ${x.newInformation} (refs: ${x.sourceRefs.join(", ") || "—"})`).join("\n")}\nCUT FIRST IF THIN: ${b.cutIfThin.join("; ") || "—"}`;
}
