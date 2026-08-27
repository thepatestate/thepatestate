// Stage 1 — the reporting dossier (brief §5). Converts raw material into an
// auditable fact base with source refs. Writes no prose, picks no article.
import { callJSON } from "./models";
import { v2Prompt } from "./context-pack";
import type { EditorialDossier, ShowFixture, StageCall } from "./types";

const S = { type: "string" } as const;
const arr = (items: unknown) => ({ type: "array", items });
const obj = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });

export const DOSSIER_SCHEMA = obj({
  subject: S,
  teams: arr(S),
  eventDate: { type: ["string", "null"] },
  coreDevelopment: S,
  confirmedFacts: arr(obj({ fact: S, sourceRef: S, confidence: { type: "string", enum: ["confirmed", "reported"] } })),
  uncertainOrMissing: arr(obj({ item: S, whyItMatters: S })),
  numbers: arr(obj({ value: S, meaning: S, sourceRef: S })),
  quotes: arr(obj({ text: S, speaker: S, timestamp: { type: ["string", "null"] }, sourceRef: S, role: { type: "string", enum: ["claim", "evidence", "tone", "concession", "context"] } })),
  joshOnRecord: arr(obj({ text: S, date: { type: ["string", "null"] }, timestamp: { type: ["string", "null"] }, topic: S })),
  footballMechanisms: arr(obj({ mechanism: S, evidence: arr(S), certainty: { type: "string", enum: ["fact", "reasonable-analysis", "speculative"] } })),
  tensions: arr(S),
  contradictions: arr(S),
  fanObjections: arr(S),
  secondOrderConsequences: arr(S),
  observableTests: arr(obj({ date: { type: ["string", "null"] }, opponent: { type: ["string", "null"] }, thingToWatch: S })),
  thingsActuallyInteresting: arr(S),
  sourceSufficiency: obj({ score: { type: "number" }, canSupportBrief: { type: "boolean" }, canSupportReaction: { type: "boolean" }, canSupportPremiumColumn: { type: "boolean" }, reason: S }),
});

export interface ShowMaterial {
  episode: ShowFixture["episode"];
  transcriptText: string;
  quotes: ShowFixture["quotes"];
  factSheet: string;
  onRecord: string;
  recentHeadlines?: string[];
}

/** The raw material as the dossier agent (and later the fact checker) sees it. */
export function showMaterialBlock(m: ShowMaterial): string {
  return [
    `EPISODE: ${m.episode.title}\nPUBLISHED: ${m.episode.publishedAt}\nSERIES: ${m.episode.series}\nDESCRIPTION [sourceRef: episode-description]:\n${m.episode.description.slice(0, 3000)}`,
    `EXTRACTED VERBATIM QUOTES (timestamps are sourceRefs):\n${m.quotes.map((q) => `[${q.timestamp}] "${q.quote}" (${q.topic}; ${q.teams.join(", ")}; heat ${q.heat})`).join("\n") || "none"}`,
    `TEAM FACTS [sourceRef: fact-sheet]:\n${m.factSheet || "none"}`,
    `${m.onRecord} [sourceRef: on-record]`,
    m.recentHeadlines?.length ? `RECENT PATE STATE HEADLINES (avoid duplicating):\n${m.recentHeadlines.map((h) => `- ${h}`).join("\n")}` : "",
    `TRANSCRIPT (auto-captioned; timestamps are sourceRefs):\n${m.transcriptText}`,
  ].filter(Boolean).join("\n\n");
}

export async function buildDossier(material: ShowMaterial): Promise<{ dossier: EditorialDossier; call: StageCall }> {
  const { data, call } = await callJSON<EditorialDossier>({
    stage: "dossier", role: "dossier", maxTokens: 12000,
    schemaName: "editorial_dossier", schema: DOSSIER_SCHEMA as unknown as Record<string, unknown>,
    system: v2Prompt("dossier"),
    user: showMaterialBlock(material),
  });
  return { dossier: data, call };
}

/** The dossier as later stages see it (compact JSON; refs intact). */
export function dossierBlock(d: EditorialDossier): string {
  return `REPORTING DOSSIER (the fact base; every item carries its sourceRef):\n${JSON.stringify(d, null, 1)}`;
}
