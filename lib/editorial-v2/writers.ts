// Stage 8 — two independent writers (brief §12) and the shared draft schema.
// Both receive the identical context pack (hard policy, voice card, angle,
// blueprint, dossier, retrieved fragments, relevant Josh positions, output
// contract) and never each other's prose. Neither sees the gold standard.
import { callJSON, modelForRole } from "./models";
import { v2Prompt, hardPolicyForLane, voiceCardForLane, outputContractForProduct } from "./context-pack";
import { dossierBlock } from "./dossier";
import { angleBlock, blueprintBlock } from "./blueprint";
import { fragmentsBlock } from "./voice-retrieval";
import type { AngleDecision, ArticleDraft, EditorialDossier, Lane, Product, StageCall, StoryAngle, StoryBlueprint, VoiceFragment, WriterOutput } from "./types";

const S = { type: "string" } as const;
export const ARTICLE_SCHEMA = {
  type: "object",
  properties: {
    headline: S, dek: S, bodyMarkdown: S, pullQuote: S, primaryTeam: S,
    teams: { type: "array", items: S }, tags: { type: "array", items: S },
    seo: { type: "object", properties: { title: S, description: S }, required: ["title", "description"], additionalProperties: false },
  },
  required: ["headline", "dek", "bodyMarkdown", "pullQuote", "primaryTeam", "teams", "tags", "seo"],
  additionalProperties: false,
} as const;

export interface ContextPack {
  lane: Lane;
  product: Product;
  dossier: EditorialDossier;
  angle: StoryAngle;
  decision: AngleDecision;
  blueprint: StoryBlueprint;
  fragments: VoiceFragment[];
  /** The verified team facts, passed through whole (the dossier compresses them). */
  factSheet?: string;
  /** Verbatim lines eligible for the pull quote (show lane). */
  quoteCandidates?: { quote: string; timestamp: string }[];
}

/** Brief §11: the writer receives only what it needs. */
export function writerContext(p: ContextPack): string {
  const josh = p.dossier.joshOnRecord.length ? `JOSH'S OWN POSITIONS FROM THE MATERIAL (the only opinions the column may call his; each with its ref):\n${p.dossier.joshOnRecord.map((j) => `- ${j.text} (${j.timestamp ?? j.date ?? "on-record"}; ${j.topic})`).join("\n")}` : "";
  const quotes = p.quoteCandidates?.length ? `PULL-QUOTE CANDIDATES (verbatim; the only text allowed inside quotation marks):\n${p.quoteCandidates.map((q) => `[${q.timestamp}] "${q.quote}"`).join("\n")}` : "";
  const facts = p.factSheet ? `VERIFIED TEAM FACTS [sourceRef: fact-sheet] (records, polls, full schedules with dates and venues; part of the fact base):\n${p.factSheet}` : "";
  return [hardPolicyForLane(p.lane), voiceCardForLane(p.lane), angleBlock(p.angle, p.decision), blueprintBlock(p.blueprint), dossierBlock(p.dossier), facts, fragmentsBlock(p.fragments), josh, quotes, outputContractForProduct(p.product)].filter(Boolean).join("\n\n");
}

export function cleanDraft(d: ArticleDraft): ArticleDraft {
  const fix = (s: string) => s.replace(/\\(["'])/g, "$1");
  return { ...d, headline: fix(d.headline), dek: fix(d.dek), bodyMarkdown: fix(d.bodyMarkdown).trimEnd(), pullQuote: fix(d.pullQuote) };
}

export async function writeDrafts(pack: ContextPack): Promise<{ drafts: WriterOutput[]; prompts: { A: string; B: string }; calls: StageCall[] }> {
  const context = writerContext(pack);
  const promptA = v2Prompt("writer-argument");
  const promptB = v2Prompt("writer-reader");
  // Loop 4 (2026-08-27 replays): the strongest Anthropic model produced the
  // best draft in the room every time; a third writer gives the selector
  // two of them on different briefs plus the cross-family alternative.
  const settled = await Promise.allSettled([
    callJSON<ArticleDraft>({ stage: "writer-A", role: "writerA", maxTokens: 9000, schemaName: "article", schema: ARTICLE_SCHEMA as unknown as Record<string, unknown>, system: promptA, user: context }),
    callJSON<ArticleDraft>({ stage: "writer-B", role: "writerB", maxTokens: 9000, schemaName: "article", schema: ARTICLE_SCHEMA as unknown as Record<string, unknown>, system: promptB, user: context }),
    callJSON<ArticleDraft>({ stage: "writer-C", role: "writerB", choice: modelForRole("writerB"), maxTokens: 9000, schemaName: "article", schema: ARTICLE_SCHEMA as unknown as Record<string, unknown>, system: promptA, user: context }),
  ]);
  const drafts: WriterOutput[] = [];
  const calls: StageCall[] = [];
  settled.forEach((r, i) => {
    const w = (["A", "B", "C"] as const)[i];
    if (r.status === "fulfilled") { drafts.push({ writer: w, model: r.value.call.model, draft: cleanDraft(r.value.data) }); calls.push(r.value.call); }
    else console.warn(`[v2:writer-${w}] failed`, r.reason instanceof Error ? r.reason.message.slice(0, 160) : r.reason);
  });
  return { drafts, prompts: { A: `${promptA}\n\n${context}`, B: `${promptB}\n\n${context}` }, calls };
}
