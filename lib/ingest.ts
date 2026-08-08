import type { Video } from "@/lib/youtube";
import { writeClient, isSanityWriteConfigured, getEpisodeByYtId, articleExistsForEpisode } from "@/lib/sanity";
import { fetchTranscript, transcriptToPromptText } from "@/lib/transcript";
import { classifySeries, draftCompanion, BYLINE_JOSH } from "@/lib/generate";
import { slugify } from "@/lib/slug";

export interface IngestVideo extends Video {
  description?: string;
}

/**
 * Idempotent per-episode pipeline: upsert episode -> classify -> transcript ->
 * draft -> article in "ai-drafted". Returns what happened. Never throws.
 */
export async function ingestEpisode(v: IngestVideo): Promise<"created" | "skipped" | "episode-only"> {
  if (!isSanityWriteConfigured) return "skipped";
  try {
    // 1. Upsert episode
    let episode = await getEpisodeByYtId(v.id);
    if (!episode) {
      const series = await classifySeries({
        title: v.title, description: v.description ?? "", publishedAt: v.published,
      });
      const created = await writeClient.create({
        _type: "episode",
        ytId: v.id,
        title: v.title,
        description: v.description ?? "",
        publishedAt: v.published,
        thumbnailUrl: v.thumbnail,
        series,
      });
      episode = { _id: created._id };
    }

    // 2. Skip if an article already exists (idempotency)
    if (await articleExistsForEpisode(episode._id)) return "skipped";

    // 3. Transcript (fail-soft)
    const segs = await fetchTranscript(v.id);
    const transcriptText = segs ? transcriptToPromptText(segs) : null;
    await writeClient.patch(episode._id).set({ transcriptStatus: segs ? "fetched" : "unavailable" }).commit();

    // 4. Draft
    const ep = await writeClient.fetch<{ series?: string }>(
      `*[_id == $id][0]{ series }`, { id: episode._id }
    );
    const draft = await draftCompanion({
      title: v.title, description: v.description ?? "", publishedAt: v.published,
      series: ep?.series ?? "general", transcriptText,
    });
    if (!draft) return "episode-only"; // poll cycle retries later

    // 5. Article in the approval queue — NEVER any state but ai-drafted here
    await writeClient.create({
      _type: "article",
      headline: draft.headline,
      slug: { _type: "slug", current: slugify(draft.headline) },
      dek: draft.dek,
      bodyMarkdown: draft.bodyMarkdown,
      pullQuote: draft.pullQuote,
      episode: { _type: "reference", _ref: episode._id },
      byline: BYLINE_JOSH,
      workflowState: "ai-drafted",
      lowConfidence: !transcriptText,
      primaryTeam: draft.primaryTeam,
      teams: draft.teams,
      tags: draft.tags,
      seoTitle: draft.seo.title,
      seoDescription: draft.seo.description,
    });
    return "created";
  } catch {
    return "episode-only";
  }
}
