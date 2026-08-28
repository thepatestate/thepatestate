// The two reader tests (brief §15–§16). Not a rubric: the first place a fan
// would quit, and the sentences that reveal a machine.
import { callJSON, modelForRole, type ModelChoice } from "./models";
import { v3Prompt, S, arr, obj, nullable, paragraphs } from "./v3-context";
import { renderedForJudge } from "@/lib/editorial";
import type { AiSmell, ArticleDraft, QuitReading, StageCall } from "./v3-types";

const QUIT_SCHEMA = obj({
  neverWantedToQuit: { type: "boolean" },
  quitParagraphIndex: nullable({ type: "integer" }),
  quitText: nullable(S),
  reason: { type: "string", enum: ["repetitive", "obvious", "overexplained", "generic", "AI-sounding", "abstract", "irrelevant", "too slow", "confusing", "no new information", "none"] },
  didFinish: { type: "boolean" }, soundsLikeFootballPerson: { type: "boolean" }, worthTheTime: { type: "boolean" }, wouldClickAnother: { type: "boolean" }, wouldSend: { type: "boolean" },
  note: S,
});
const SMELL_SCHEMA = obj({ pass: { type: "boolean" }, sentences: arr(S), structural: { type: "boolean" }, note: S });

function numbered(d: ArticleDraft): string {
  return `HEADLINE: ${d.headline}\nDEK: ${d.dek}\n\n${paragraphs(renderedForJudge(d.bodyMarkdown)).map((p, i) => `[${i}] ${p}`).join("\n\n")}`;
}

export async function quitReadingTest(draft: ArticleDraft, choice?: ModelChoice): Promise<{ result: QuitReading; call: StageCall }> {
  const { data, call } = await callJSON<QuitReading & { quitParagraphIndex: number | null; quitText: string | null }>({ stage: "quit-reading", role: "quitJudge", choice, maxTokens: 1500, schemaName: "quit_reading", schema: QUIT_SCHEMA as unknown as Record<string, unknown>, system: v3Prompt("quit-reading"), user: numbered(draft) });
  const result: QuitReading = { ...data, quitParagraphIndex: data.quitParagraphIndex ?? undefined, quitText: data.quitText ?? undefined };
  if (result.neverWantedToQuit) { result.reason = "none"; result.quitParagraphIndex = undefined; result.quitText = undefined; }
  return { result, call };
}

export async function aiSmellTest(draft: ArticleDraft, choice: ModelChoice = modelForRole("smellJudge")): Promise<{ result: AiSmell; call: StageCall }> {
  const { data, call } = await callJSON<AiSmell>({ stage: "ai-smell", role: "smellJudge", choice, maxTokens: 1500, schemaName: "ai_smell", schema: SMELL_SCHEMA as unknown as Record<string, unknown>, system: v3Prompt("ai-smell"), user: `HEADLINE: ${draft.headline}\nDEK: ${draft.dek}\n\n${renderedForJudge(draft.bodyMarkdown)}` });
  return { result: { ...data, sentences: data.sentences.slice(0, 5) }, call };
}

/** Brief §15 production rule: didFinish=false fails the article. */
export function quitVerdict(q: QuitReading): "pass" | "fail" {
  return q.didFinish ? "pass" : "fail";
}
