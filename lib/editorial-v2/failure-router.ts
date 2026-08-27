// Stage 15 — the final editor-in-chief and the failure router (brief §19).
// Diagnoses the LEVEL of the failure and routes the piece back to the stage
// that made the bad decision. Loop budgets stop it from running forever;
// when they run out the piece is held for a human with the diagnostic.
import { callJSON } from "./models";
import { v2Prompt, judgeReferenceForLane } from "./context-pack";
import { diagnosticsBlock, lengthNote } from "./diagnostics";
import type { ArticleDraft, EditorialDecision, FactCheckResult, FailureClass, FinalEvaluation, Lane, PolicyResult, Product, RouteTarget, StageCall, StyleDiagnostics } from "./types";

const S = { type: "string" } as const;
export const DECISION_SCHEMA = {
  type: "object",
  properties: {
    decision: { type: "string", enum: ["accept", "revise", "hold", "kill"] },
    failureClass: { type: "string", enum: ["none", "evidence", "angle", "structure", "prose", "voice", "audience", "fact", "policy"] },
    reason: S,
    routeTo: { type: "string", enum: ["reporting", "story-miner", "blueprint", "developmental-rewrite", "voice-edit", "fact-repair", "human"] },
    instructions: { type: "array", items: S },
  },
  required: ["decision", "failureClass", "reason", "routeTo", "instructions"],
  additionalProperties: false,
} as const;

export const ROUTE_FOR_CLASS: Record<FailureClass, RouteTarget> = {
  none: "human", evidence: "reporting", angle: "story-miner", structure: "blueprint", prose: "developmental-rewrite",
  voice: "voice-edit", audience: "voice-edit", fact: "fact-repair", policy: "developmental-rewrite",
};

export interface LoopBudget { remine: number; blueprint: number; rewrite: number; factRepair: number; total: number }
// rewrite counts the first developmental rewrite, so "max 2 rewrite cycles" = 3.
export const DEFAULT_BUDGET: LoopBudget = { remine: 2, blueprint: 2, rewrite: 3, factRepair: 1, total: 3 };

export interface Spent { remine: number; blueprint: number; rewrite: number; factRepair: number; cycles: number }

/** Deterministic pre-decision: facts and policy are decided by code before
 * any model is asked. Returns null when the piece may go to the EIC. */
export function hardDecision(fact: FactCheckResult, policy: PolicyResult, spent: Spent, budget: LoopBudget): EditorialDecision | null {
  if (fact.verdict !== "pass") {
    if (spent.factRepair < budget.factRepair) return { decision: "revise", failureClass: "fact", reason: `fact check: ${fact.verdict}`, routeTo: "fact-repair", instructions: [...fact.claims.filter((c) => c.status === "unsupported" || c.status === "contradicted").map((c) => `${c.status}: ${c.claim}`), ...fact.joshMisattribution.map((m) => `Josh misattributed: ${m}`)] };
    return { decision: "hold", failureClass: "fact", reason: `fact check still ${fact.verdict} after repair`, routeTo: "human", instructions: fact.claims.filter((c) => c.status !== "supported" && c.status !== "analysis").map((c) => c.claim) };
  }
  if (!policy.pass) {
    if (spent.rewrite < budget.rewrite) return { decision: "revise", failureClass: "policy", reason: policy.violations.join("; "), routeTo: "developmental-rewrite", instructions: policy.violations.map((v) => `Remove the policy violation: ${v}`) };
    return { decision: "hold", failureClass: "policy", reason: policy.violations.join("; "), routeTo: "human", instructions: policy.violations };
  }
  return null;
}

/** The budget's answer to a model's "revise": the same route if it is still
 * affordable, otherwise hold for a human with the diagnostic intact. */
export function enforceBudget(d: EditorialDecision, spent: Spent, budget: LoopBudget): EditorialDecision {
  if (d.decision !== "revise") return d;
  if (spent.cycles >= budget.total) return { ...d, decision: "hold", routeTo: "human", reason: `${d.reason} (cycle budget exhausted)` };
  const left: Record<RouteTarget, boolean> = {
    reporting: spent.remine < budget.remine, "story-miner": spent.remine < budget.remine, blueprint: spent.blueprint < budget.blueprint,
    "developmental-rewrite": spent.rewrite < budget.rewrite, "voice-edit": spent.rewrite < budget.rewrite, "fact-repair": spent.factRepair < budget.factRepair, human: true,
  };
  if (!left[d.routeTo]) return { ...d, decision: "hold", routeTo: "human", reason: `${d.reason} (no ${d.routeTo} cycles left)` };
  return d;
}

export async function finalDecision(input: { draft: ArticleDraft; lane: Lane; product: Product; evaluation: FinalEvaluation; fact: FactCheckResult; policy: PolicyResult; diagnostics: StyleDiagnostics; spent: Spent; budget: LoopBudget }): Promise<{ decision: EditorialDecision; call: StageCall | null }> {
  const hard = hardDecision(input.fact, input.policy, input.spent, input.budget);
  if (hard) return { decision: hard, call: null };
  if (input.evaluation.meets.all) return { decision: { decision: "accept", failureClass: "none", reason: "every threshold met; facts and policy pass", routeTo: "human", instructions: [] }, call: null };
  const e = input.evaluation;
  const { data, call } = await callJSON<EditorialDecision>({
    stage: "final-eic", role: "finalEic", maxTokens: 4000,
    schemaName: "editorial_decision", schema: DECISION_SCHEMA as unknown as Record<string, unknown>,
    system: v2Prompt("final-eic"),
    user: [
      `PRODUCT: ${input.product} · cycles used ${input.spent.cycles}/${input.budget.total} (remine ${input.spent.remine}/${input.budget.remine}, blueprint ${input.spent.blueprint}/${input.budget.blueprint}, rewrite ${input.spent.rewrite}/${input.budget.rewrite})`,
      `THRESHOLDS: fan mean ≥ ${e.thresholds.fanMean} (got ${((e.fanA.overall + e.fanB.overall) / 2).toFixed(1)}), min legibility ≥ ${e.thresholds.legibilityMin} (got ${Math.min(e.fanA.legibility, e.fanB.legibility)}), sendability mean ≥ ${e.thresholds.sendabilityMean} (got ${((e.fanA.sendability + e.fanB.sendability) / 2).toFixed(1)}), voice ≥ ${e.thresholds.voice} (got ${e.voice.score}), humanity ≥ ${e.thresholds.humanity} (got ${e.humanity.humanity})`,
      `FACT CHECK: pass. HARD POLICY: pass.`,
      diagnosticsBlock(input.diagnostics) + (lengthNote(input.diagnostics.words, input.product) ? `\nLENGTH NOTE: ${lengthNote(input.diagnostics.words, input.product)}` : ""),
      `FAN JUDGE A (${e.fanA.judge}): ${JSON.stringify(e.fanA)}`,
      `FAN JUDGE B (${e.fanB.judge}): ${JSON.stringify(e.fanB)}`,
      `HUMANITY JUDGE: ${JSON.stringify(e.humanity)}`,
      `VOICE JUDGE (register vs the gold standard): ${e.voice.score}/10 — ${e.voice.notes}`,
      `THE ARTICLE:\nHEADLINE: ${input.draft.headline}\nDEK: ${input.draft.dek}\n\n${input.draft.bodyMarkdown}`,
      `THE GOLD STANDARD, for your calibration only:\n${judgeReferenceForLane(input.lane).slice(0, 6000)}`,
    ].join("\n\n"),
  });
  if (data.decision === "accept") data.decision = "hold"; // thresholds were not met; a model cannot overrule them
  if (data.decision === "revise") data.routeTo = ROUTE_FOR_CLASS[data.failureClass] ?? data.routeTo;
  return { decision: enforceBudget(data, input.spent, input.budget), call };
}
