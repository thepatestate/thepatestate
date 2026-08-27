// Stage 11 — audience + voice edit (brief §15). One pass that answers the
// reader's questions and touches only what they caught.
import { callJSON } from "./models";
import { v2Prompt, hardPolicyForLane, voiceCardForLane, outputContractForProduct } from "./context-pack";
import { ARTICLE_SCHEMA, cleanDraft } from "./writers";
import { fragmentsBlock } from "./voice-retrieval";
import { diagnosticsBlock } from "./diagnostics";
import type { ArticleDraft, AudienceEdit, Lane, Product, StageCall, VoiceFragment } from "./types";

const S = { type: "string" } as const;
export const AUDIENCE_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["pass-with-micro-edits", "revised"] },
    findings: { type: "array", items: S },
    draft: ARTICLE_SCHEMA,
  },
  required: ["verdict", "findings", "draft"],
  additionalProperties: false,
} as const;

export async function audienceEdit(draft: ArticleDraft, opts: { lane: Lane; product: Product; fragments: VoiceFragment[]; fanBaseNote?: string; diagnostics?: import("./types").StyleDiagnostics }): Promise<{ edit: AudienceEdit; call: StageCall }> {
  const { data, call } = await callJSON<AudienceEdit>({
    stage: "audience-edit", role: "audienceEditor", maxTokens: 9000,
    schemaName: "audience_edit", schema: AUDIENCE_SCHEMA as unknown as Record<string, unknown>,
    system: v2Prompt("audience-editor"),
    user: [hardPolicyForLane(opts.lane), voiceCardForLane(opts.lane), opts.fanBaseNote ?? "", opts.diagnostics ? diagnosticsBlock(opts.diagnostics) : "", fragmentsBlock(opts.fragments), `THE ARTICLE:\n${JSON.stringify(draft, null, 1)}`, outputContractForProduct(opts.product)].filter(Boolean).join("\n\n"),
  });
  data.draft = cleanDraft(data.draft);
  return { edit: data, call };
}
