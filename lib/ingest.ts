import type { Video } from "@/lib/youtube";
import { writeClient, isSanityWriteConfigured, articleExistsForEpisode, uploadHeroImage, setArticleHeroImage } from "@/lib/sanity";
import { fetchTranscript, transcriptToPromptText } from "@/lib/transcript";
import { classifySeries, draftCompanion, extractQuotes } from "@/lib/generate";
import { pickArchitecture } from "@/lib/editorial";
import { teamFactSheet } from "@/lib/fact-sheet";
import { storeQuotes } from "@/lib/quotes";
import { generateArticleHero } from "@/lib/hero-image";
import { slugify } from "@/lib/slug";
import { v3MayWrite } from "@/lib/editorial-v3/flags";
import { v3JoshColumn } from "@/lib/editorial-v3/production";
import { JOSH_BRACKET_FIELD, JOSH_BRACKET_FINAL, JOSH_BRACKET_LABEL } from "@/lib/josh-bracket";

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

    // 2b. Editorial cadence (Josh, 2026-08-21): 3–5 show-companion articles
    // per WEEK, max 1 per day — the show posts ~20 videos a week and every
    // one becoming an article buried the good ones. Episodes past the cap
    // still ingest (episode-only) so the show page stays complete; the
    // daily long-form pipeline (lib/longform.ts) carries the article load.
    const [weekCount, dayCount] = await Promise.all([
      writeClient.fetch<number>(
        `count(*[_type == "article" && defined(episode._ref) && _createdAt > $since])`,
        { since: new Date(Date.now() - 7 * 24 * 3600_000).toISOString() },
      ),
      writeClient.fetch<number>(
        `count(*[_type == "article" && defined(episode._ref) && _createdAt > $since])`,
        { since: new Date(Date.now() - 24 * 3600_000).toISOString() },
      ),
    ]);
    if (weekCount >= 5 || dayCount >= 1) return "episode-only";

    // 3. Transcript (fail-soft)
    const segs = await fetchTranscript(v.id);
    const transcriptText = segs ? transcriptToPromptText(segs) : null;
    await writeClient.patch(episodeId).set({ transcriptStatus: segs ? "fetched" : "unavailable" }).commit();

    // 4. Quote-extraction pass (§2.4a) — verbatim takes into the archive, then
    // fed to the draft so [QUOTE:] markers and the pull quote come from them.
    const quotes = transcriptText ? await extractQuotes(transcriptText) : [];
    if (quotes.length > 0) await storeQuotes(v.id, quotes);

    // 5. Draft — with a rotated architecture (Brief v2 Rule 2).
    const recentArch = await writeClient.fetch<string[]>(
      `*[_type == "article"] | order(_createdAt desc) [0...6].tags[@ match "arch:*"]`
    ).catch(() => [] as string[]);
    const arch = pickArchitecture((recentArch ?? []).map((t) => t.replace(/^arch:/, "")), weekCount + dayCount);
    const factSheet = await teamFactSheet(quotes.flatMap((q) => q.teams)).catch(() => "");
    // Editorial Engine V3 (2026-08-28): Josh's Read is built on the show,
    // additive — his take as the premise, the column from verified facts the
    // show did not have. No segment or nothing to add → no column.
    let draft: Awaited<ReturnType<typeof draftCompanion>> = null;
    let v3Tags: string[] = [];
    if (v3MayWrite("josh") && transcriptText) {
      // Consistency ledger, not material (2026-08-30: every rebuilt column was
      // pivoting to the bracket because this read as a source of additions).
      const onRecord = `CONSISTENCY LEDGER — the site's on-record positions, supplied so the column never contradicts them. Cite at most one, and only if the segment itself is about rankings, the bracket, the playoff field or the champion pick; otherwise do not mention it. ${JOSH_BRACKET_LABEL} — field: ${JOSH_BRACKET_FIELD.map((t) => `${t.seed} ${t.name}`).join(", ")}; final on record: ${JOSH_BRACKET_FINAL}.`;
      const v3 = await v3JoshColumn({ ytId: v.id, title: v.title, description: v.description ?? "", publishedAt: v.published, transcriptText, teams: [...new Set(quotes.flatMap((q) => q.teams))], onRecord, mode: "live" });
      if (!v3.ok) { console.log(`[ingest:v3] ${v.id}: ${v3.reason}`); return "episode-only"; }
      const f = v3.fields as { headline: string; dek: string; bodyMarkdown: string; pullQuote: string; primaryTeam: string; teams: string[]; tags: string[]; seoTitle: string; seoDescription: string };
      draft = { headline: f.headline, dek: f.dek, bodyMarkdown: f.bodyMarkdown, pullQuote: f.pullQuote, primaryTeam: f.primaryTeam, teams: f.teams, tags: [], seo: { title: f.seoTitle, description: f.seoDescription }, lowConfidence: v3.lowConfidence };
      v3Tags = f.tags;
    } else {
      draft = await draftCompanion({
        title: v.title, description: v.description ?? "", publishedAt: v.published,
        series: series ?? "general", transcriptText, extractedQuotes: quotes,
        architecture: arch, factSheet,
      });
    }
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
      // Josh, 2026-08-26 (after reading the kit-era review pack: "every
      // article is written in the third person"): his show columns carry his
      // byline in his first person, matching the approved Three Boards
      // column. This is his direct instruction and outranks the kit's §3.
      byline: "Josh Pate",
      // Kit v4 Constitution §3 (Josh, 2026-08-26): no Josh-byline piece
      // publishes without an explicit human approval click. Every column
      // waits in ai-drafted; Josh's team publishes from Studio.
      workflowState: "ai-drafted",
      lowConfidence: !transcriptText || draft.lowConfidence === true,
      primaryTeam: draft.primaryTeam,
      teams: draft.teams,
      tags: [...draft.tags, ...v3Tags, `arch:${arch.key}`],
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
