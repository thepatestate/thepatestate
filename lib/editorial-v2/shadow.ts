// Shadow mode for the show lane (brief §25 Phase 1): V1 still creates the
// real held draft; V2 produces a candidate that is stored as a run record
// for blind review and is NEVER written to Sanity. Fail-soft everywhere:
// a V2 failure can never affect the V1 result.
import { writeClient, isSanityWriteConfigured } from "@/lib/sanity";
import { fetchTranscript, transcriptToPromptText } from "@/lib/transcript";
import { extractQuotes } from "@/lib/generate";
import { teamFactSheet } from "@/lib/fact-sheet";
import { JOSH_BRACKET_FIELD, JOSH_BRACKET_FINAL, JOSH_BRACKET_LABEL } from "@/lib/josh-bracket";
import { editorialV2Flags } from "./flags";
import { runShowColumnV2 } from "./show-column";
import type { ShowMaterial } from "./dossier";
import type { EditorialRun } from "./types";

export function onRecordBlock(): string {
  return `ON-RECORD SITE POSITIONS (never contradict silently): ${JOSH_BRACKET_LABEL} — field: ${JOSH_BRACKET_FIELD.map((t) => `${t.seed} ${t.name}`).join(", ")}; final on record: ${JOSH_BRACKET_FINAL}.`;
}

export interface ShadowInput {
  ytId: string;
  title: string;
  description: string;
  publishedAt: string;
  series: string;
  transcriptText: string;
  quotes: ShowMaterial["quotes"];
  factSheet: string;
  recentHeadlines?: string[];
}

/** Runs V2 in shadow for one episode from already-gathered material (the
 * ingest path has it in hand). Never writes an article. */
export async function shadowRunShowColumn(input: ShadowInput): Promise<EditorialRun | null> {
  const flags = editorialV2Flags();
  if (!flags.show) return null;
  try {
    return await runShowColumnV2({
      sourceId: input.ytId, mode: flags.shadow ? "shadow" : "live",
      material: { episode: { ytId: input.ytId, title: input.title, description: input.description, publishedAt: input.publishedAt, series: input.series }, transcriptText: input.transcriptText, quotes: input.quotes, factSheet: input.factSheet, onRecord: onRecordBlock(), recentHeadlines: input.recentHeadlines },
    });
  } catch (err) {
    console.error("[v2:shadow]", input.ytId, err instanceof Error ? err.message.slice(0, 200) : err);
    return null;
  }
}

/** Manual/cron entry: gathers material for the newest episode that has a
 * V1 held draft (or the given ytId) and shadow-runs V2. */
export async function shadowRunLatestShowEpisode(opts: { ytId?: string }): Promise<{ ran: boolean; ytId?: string; runId?: string; decision?: string; score?: number; reason?: string }> {
  if (!isSanityWriteConfigured) return { ran: false, reason: "sanity not configured" };
  const ep = opts.ytId
    ? await writeClient.fetch<{ ytId: string; title: string; description?: string; publishedAt: string; series?: string } | null>(`*[_type=="episode" && ytId==$yt][0]{ytId,title,description,publishedAt,series}`, { yt: opts.ytId })
    : await writeClient.fetch<{ ytId: string; title: string; description?: string; publishedAt: string; series?: string } | null>(`*[_type=="article" && defined(episode._ref)] | order(_createdAt desc)[0].episode->{ytId,title,description,publishedAt,series}`);
  if (!ep) return { ran: false, reason: "no episode" };
  const segs = await fetchTranscript(ep.ytId);
  const transcriptText = segs ? transcriptToPromptText(segs) : null;
  if (!transcriptText) return { ran: false, ytId: ep.ytId, reason: "no transcript" };
  const quotes = await extractQuotes(transcriptText);
  const factSheet = await teamFactSheet([...new Set(quotes.flatMap((q) => q.teams))]).catch(() => "");
  const recentHeadlines = await writeClient.fetch<string[]>(`*[_type == "article"] | order(coalesce(publishedAt, _createdAt) desc) [0...15].headline`).catch(() => [] as string[]);
  const run = await shadowRunShowColumn({ ytId: ep.ytId, title: ep.title, description: ep.description ?? "", publishedAt: ep.publishedAt, series: ep.series ?? "general", transcriptText, quotes, factSheet, recentHeadlines });
  if (!run) return { ran: false, ytId: ep.ytId, reason: "disabled or failed" };
  return { ran: true, ytId: ep.ytId, runId: run.id, decision: run.decision?.decision, score: run.finalScore };
}
