// Stage 9 — the draft editor / selector (brief §13). Blind labels; judged
// at paragraph level; produces a developmental plan, never a score.
import { callJSON, oppositeOf, modelForRole } from "./models";
import { v2Prompt } from "./context-pack";
import { blueprintBlock } from "./blueprint";
import type { DraftSelection, StageCall, StoryBlueprint, WriterOutput } from "./types";

const S = { type: "string" } as const;
const arr = (items: unknown) => ({ type: "array", items });
const obj = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const AB = { type: "string", enum: ["A", "B", "C", "neither"] };
const pick = obj({ winner: AB, reason: S });

export const SELECTION_SCHEMA = obj({
  winner: { type: "string", enum: ["A", "B", "C", "hybrid", "neither"] },
  opening: pick, argument: pick, football: pick, audienceConnection: pick,
  bestParagraphs: arr(obj({ draft: { type: "string", enum: ["A", "B", "C"] }, paragraphIndex: { type: "integer" }, reason: S })),
  cut: arr(obj({ draft: { type: "string", enum: ["A", "B", "C"] }, paragraphIndex: { type: "integer" }, reason: S })),
  structuralProblems: arr(S), voiceProblems: arr(S), generatedTells: arr(S),
  developmentalPlan: arr(S),
  route: { type: "string", enum: ["developmental-rewrite", "back-to-blueprint", "back-to-angle"] },
});

export function paragraphs(body: string): string[] {
  return body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

export function numbered(body: string): string {
  return paragraphs(body).map((p, i) => `[${i}] ${p}`).join("\n\n");
}

/** The editor never shares a family with BOTH authors; when the two drafts
 * come from different vendors it takes the default (strong Anthropic). */
export async function editDrafts(drafts: WriterOutput[], blueprint: StoryBlueprint, thesis: string): Promise<{ selection: DraftSelection; call: StageCall }> {
  const vendors = new Set(drafts.map((d) => (d.model.startsWith("claude") ? "anthropic" : "openai")));
  const choice = vendors.size === 1 ? oppositeOf([...vendors][0] as "openai" | "anthropic", "high") : modelForRole("draftEditor");
  const { data, call } = await callJSON<DraftSelection>({
    stage: "draft-editor", role: "draftEditor", choice, maxTokens: 9000,
    schemaName: "draft_selection", schema: SELECTION_SCHEMA as unknown as Record<string, unknown>,
    system: v2Prompt("draft-editor"),
    user: `THESIS: ${thesis}\n\n${blueprintBlock(blueprint)}\n\n${(['A', 'B', 'C'] as const).map((w) => { const d = drafts.find((x) => x.writer === w); return `DRAFT ${w}${d ? ` — ${d.draft.headline}\n${d.draft.dek}\n\n${numbered(d.draft.bodyMarkdown)}` : ": (absent)"}`; }).join("\n\n")}`,
  });
  return { selection: data, call };
}
