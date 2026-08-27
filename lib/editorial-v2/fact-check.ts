// Stage 12 — claim-level fact check on the existing independent verifier
// path, plus surgical fact repair (brief §17). Sources are the factual
// universe; analysis may extend from them; facts may not.
import Anthropic from "@anthropic-ai/sdk";
import { judgeJSON } from "@/lib/judge";
import { callJSON } from "./models";
import { v2Prompt } from "./context-pack";
import { ARTICLE_SCHEMA, cleanDraft } from "./writers";
import type { ArticleDraft, EditorialDossier, FactCheckResult, StageCall } from "./types";

const S = { type: "string" } as const;
const arr = (items: unknown) => ({ type: "array", items });
const obj = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });

export const FACTCHECK_SCHEMA = obj({
  verdict: { type: "string", enum: ["pass", "unsupported", "contradicted"] },
  claims: arr(obj({ claim: S, status: { type: "string", enum: ["supported", "unsupported", "contradicted", "analysis"] }, sourceRefs: arr(S) })),
  joshMisattribution: arr(S),
});

export const REPAIR_SCHEMA = obj({ removed: arr(S), draft: ARTICLE_SCHEMA });

/** Uses the V1 verifier path (judgeJSON: Sonnet, OpenAI fallback) so the
 * checker is never the writer. `rawMaterial` is the transcript / source
 * text; the dossier supplies refs. */
export async function factCheck(draft: ArticleDraft, dossier: EditorialDossier, rawMaterial: string): Promise<{ result: FactCheckResult; call: StageCall }> {
  const started = Date.now();
  const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  const { text, via } = await judgeJSON(anthropic, {
    maxTokens: 8000, effort: "low", schemaName: "fact_check", schema: FACTCHECK_SCHEMA as unknown as Record<string, unknown>,
    system: v2Prompt("fact-check"),
    user: `SOURCES — DOSSIER:\n${JSON.stringify(dossier, null, 1)}\n\nSOURCES — RAW MATERIAL:\n${rawMaterial.slice(0, 60000)}\n\nDRAFT:\nHEADLINE: ${draft.headline}\nDEK: ${draft.dek}\n\n${draft.bodyMarkdown}\n\nPULL QUOTE: ${draft.pullQuote}`,
  });
  let result: FactCheckResult;
  try { result = JSON.parse(text) as FactCheckResult; } catch { result = { verdict: "unsupported", claims: [], joshMisattribution: ["fact-check response unreadable"] }; }
  // Fail closed on the derived verdict, whatever the model's summary said.
  if (result.joshMisattribution.length || result.claims.some((c) => c.status === "contradicted")) result.verdict = "contradicted";
  else if (result.claims.some((c) => c.status === "unsupported")) result.verdict = "unsupported";
  const call: StageCall = { stage: "fact-check", role: "factCheck", vendor: via, model: via === "anthropic" ? "claude-sonnet-5" : (process.env.OPENAI_JUDGE_MODEL ?? "gpt-5.6-luna"), inputTokens: 0, outputTokens: 0, costUsd: 0, ms: Date.now() - started };
  return { result, call };
}

/** Brief §17: fact repair is a separate job from prose repair. */
export async function factRepair(draft: ArticleDraft, result: FactCheckResult, dossier: EditorialDossier): Promise<{ draft: ArticleDraft; removed: string[]; call: StageCall }> {
  const flagged = [...result.claims.filter((c) => c.status !== "supported" && c.status !== "analysis").map((c) => `${c.status.toUpperCase()}: ${c.claim}`), ...result.joshMisattribution.map((m) => `JOSH MISATTRIBUTED: ${m}`)];
  const { data, call } = await callJSON<{ removed: string[]; draft: ArticleDraft }>({
    stage: "fact-repair", role: "factRepair", maxTokens: 9000,
    schemaName: "fact_repair", schema: REPAIR_SCHEMA as unknown as Record<string, unknown>,
    system: v2Prompt("fact-repair"),
    user: `FLAGGED CLAIMS:\n${flagged.map((f) => `- ${f}`).join("\n")}\n\nWHAT THE SOURCES SUPPORT (dossier):\n${JSON.stringify({ confirmedFacts: dossier.confirmedFacts, numbers: dossier.numbers, joshOnRecord: dossier.joshOnRecord, quotes: dossier.quotes }, null, 1)}\n\nDRAFT:\n${JSON.stringify(draft, null, 1)}`,
  });
  return { draft: cleanDraft(data.draft), removed: data.removed, call };
}
