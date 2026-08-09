import type { Video } from "@/lib/youtube";
import { writeClient, isSanityWriteConfigured, articleExistsForEpisode, uploadHeroImage, setArticleHeroImage } from "@/lib/sanity";
import { fetchTranscript, transcriptToPromptText } from "@/lib/transcript";
import { classifySeries, draftCompanion, BYLINE_STAFF } from "@/lib/generate";
import { generateArticleHero } from "@/lib/hero-image";
import { slugify } from "@/lib/slug";

export interface IngestVideo extends Video {
  description?: string;
}

/**
 * Idempotent per-episode pipeline: upsert episode -> classify -> transcript ->
 * draft -> article in "ai-drafted". Returns what happened. Never throws.
 *
 * Idempotency under concurrent invocations (webhook + poll racing on the same
 * video) is guaranteed by deterministic document ids + createIfNotExists, not
 * by the pre-checks below — the pre-checks are cheap fast-path skips only.
 */
export type IngestResult = "created" | "skipped" | "episode-only" | "failed";

export async function ingestEpisode(v: IngestVideo): Promise<IngestResult> {
  if (!isSanityWriteConfigured) return "skipped";
  try {
    const episodeId = `episode-${v.id}`;
    const articleId = `article-${v.id}`;

    // 1. Upsert episode. classifySeries costs an API call, so only pay it when the
    // episode doesn't already exist; createIfNotExists is the authoritative guard
    // against a concurrent request creating the same episode.
    const existingEpisode = await writeClient.fetch<{ _id: string; series?: string } | null>(
      `*[_id == $id][0]{ _id, series }`, { id: episodeId }
    );
    let series = existingEpisode?.series;
    if (!existingEpisode) {
      series = await classifySeries({
        title: v.title, description: v.description ?? "", publishedAt: v.published,
      });
      await writeClient.createIfNotExists({
        _id: episodeId,
        _type: "episode",
        ytId: v.id,
        title: v.title,
        description: v.description ?? "",
        publishedAt: v.published,
        thumbnailUrl: v.thumbnail,
        series,
      });
    }

    // 2. Skip if an article already exists (idempotency fast path). The deterministic
    // id is the primary check; articleExistsForEpisode covers pre-existing articles
    // created under the old random-id scheme (reference-based lookup).
    const existingArticleId = await writeClient.fetch<string | null>(
      `*[_id == $id][0]._id`, { id: articleId }
    );
    if (existingArticleId) return "skipped";
    if (await articleExistsForEpisode(episodeId)) return "skipped";

    // 3. Transcript (fail-soft)
    const segs = await fetchTranscript(v.id);
    const transcriptText = segs ? transcriptToPromptText(segs) : null;
    await writeClient.patch(episodeId).set({ transcriptStatus: segs ? "fetched" : "unavailable" }).commit();

    // 4. Draft
    const draft = await draftCompanion({
      title: v.title, description: v.description ?? "", publishedAt: v.published,
      series: series ?? "general", transcriptText,
    });
    if (!draft) return "episode-only"; // poll cycle retries later

    // 5. Article in the approval queue — NEVER any state but ai-drafted here.
    // createIfNotExists on the deterministic id is the real guarantee against races.
    await writeClient.createIfNotExists({
      _id: articleId,
      _type: "article",
      headline: draft.headline,
      slug: { _type: "slug", current: slugify(draft.headline) },
      dek: draft.dek,
      bodyMarkdown: draft.bodyMarkdown,
      pullQuote: draft.pullQuote,
      episode: { _type: "reference", _ref: episodeId },
      byline: BYLINE_STAFF,
      workflowState: "ai-drafted",
      lowConfidence: !transcriptText || draft.lowConfidence === true,
      primaryTeam: draft.primaryTeam,
      teams: draft.teams,
      tags: draft.tags,
      seoTitle: draft.seo.title,
      seoDescription: draft.seo.description,
    });

    // 6. Hero image — best-effort only. Wrapped in its own try/catch (on top
    // of generateArticleHero already being fail-soft) so a bug in the upload
    // or patch step can never turn a successful ingest into a "failed" one.
    try {
      const heroBuffer = await generateArticleHero(draft.headline, draft.teams);
      if (heroBuffer) {
        const assetId = await uploadHeroImage(heroBuffer);
        if (assetId) await setArticleHeroImage(articleId, assetId);
      }
    } catch (err) {
      console.error("[ingest:hero]", v.id, err);
    }

    return "created";
  } catch (err) {
    console.error("[ingest]", v.id, err);
    return "failed";
  }
}
