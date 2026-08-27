// Stage 10 — the developmental rewrite (brief §14): a new writing act by a
// model from the opposite family of the selected draft's author, given the
// editor's plan and the passages worth keeping, never "make it more Josh."
import { callJSON, oppositeOf } from "./models";
import { v2Prompt, hardPolicyForLane, voiceCardForLane, outputContractForProduct } from "./context-pack";
import { dossierBlock } from "./dossier";
import { angleBlock, blueprintBlock } from "./blueprint";
import { fragmentsBlock } from "./voice-retrieval";
import { ARTICLE_SCHEMA, cleanDraft, type ContextPack } from "./writers";
import { paragraphs } from "./draft-editor";
import { styleDiagnostics, diagnosticsBlock } from "./diagnostics";
import type { ArticleDraft, DraftSelection, StageCall, WriterOutput } from "./types";

export function keptPassages(selection: DraftSelection, drafts: WriterOutput[]): string {
  const by = Object.fromEntries(drafts.map((d) => [d.writer, paragraphs(d.draft.bodyMarkdown)]));
  const kept = selection.bestParagraphs.map((p) => `[${p.draft}:${p.paragraphIndex}] (${p.reason})\n${by[p.draft]?.[p.paragraphIndex] ?? ""}`).filter((s) => !s.endsWith("\n"));
  return kept.length ? `PASSAGES THE EDITOR KEPT (keep the ideas; the wording is yours):\n${kept.join("\n\n")}` : "PASSAGES THE EDITOR KEPT: none — write from the blueprint.";
}

export async function developmentalRewrite(pack: ContextPack, drafts: WriterOutput[], selection: DraftSelection, opts: { instructions?: string[]; previous?: ArticleDraft }): Promise<{ draft: ArticleDraft; call: StageCall; prompt: string }> {
  const winner = selection.winner === "A" || selection.winner === "B" ? drafts.find((d) => d.writer === selection.winner) : drafts[0];
  const authorVendor = winner?.model.startsWith("claude") ? "anthropic" : "openai";
  const plan = [
    `THE EDITOR'S DEVELOPMENTAL PLAN (follow it precisely):`,
    ...selection.developmentalPlan.map((p) => `- ${p}`),
    selection.structuralProblems.length ? `STRUCTURAL PROBLEMS TO REMOVE: ${selection.structuralProblems.join("; ")}` : "",
    selection.voiceProblems.length ? `VOICE PROBLEMS TO REMOVE: ${selection.voiceProblems.join("; ")}` : "",
    selection.generatedTells.length ? `SENTENCES THAT READ AS GENERATED (do not reproduce their shape): ${selection.generatedTells.join(" | ")}` : "",
    selection.cut.length ? `CUT (do not carry these ideas forward): ${selection.cut.map((c) => `${c.draft}:${c.paragraphIndex} — ${c.reason}`).join("; ")}` : "",
    opts.instructions?.length ? `EDITOR-IN-CHIEF INSTRUCTIONS FROM THE LAST CYCLE:\n${opts.instructions.map((i) => `- ${i}`).join("\n")}` : "",
    opts.previous ? `${diagnosticsBlock(styleDiagnostics(opts.previous.bodyMarkdown))} — on the last version. Every restated sentence appears once in yours.` : (winner ? `${diagnosticsBlock(styleDiagnostics(winner.draft.bodyMarkdown))} — on the selected draft. Every restated sentence appears once in yours.` : ""),
    `LENGTH: write to the blueprint's ideal (${pack.blueprint.targetLength.ideal} words, ${pack.blueprint.targetLength.minGuidance}–${pack.blueprint.targetLength.maxGuidance}). Cut restatement, never evidence; a shorter piece is right only when a beat was empty.`,
  ].filter(Boolean).join("\n");
  const user = [hardPolicyForLane(pack.lane), voiceCardForLane(pack.lane), angleBlock(pack.angle, pack.decision), blueprintBlock(pack.blueprint), plan, keptPassages(selection, drafts), dossierBlock(pack.dossier), fragmentsBlock(pack.fragments), pack.quoteCandidates?.length ? `PULL-QUOTE CANDIDATES (verbatim; the only text allowed inside quotation marks):\n${pack.quoteCandidates.map((q) => `[${q.timestamp}] "${q.quote}"`).join("\n")}` : "", outputContractForProduct(pack.product)].filter(Boolean).join("\n\n");
  const { data, call } = await callJSON<ArticleDraft>({
    stage: "developmental-rewrite", role: "rewrite", choice: oppositeOf(authorVendor, "high"), maxTokens: 9000,
    schemaName: "article", schema: ARTICLE_SCHEMA as unknown as Record<string, unknown>,
    system: v2Prompt("developmental-rewrite"), user,
  });
  return { draft: cleanDraft(data), call, prompt: user };
}
