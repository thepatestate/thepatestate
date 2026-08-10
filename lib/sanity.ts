import { createClient } from "@sanity/client";

const projectId = process.env.SANITY_PROJECT_ID || "kuv6jjyo";
const dataset = process.env.SANITY_DATASET || "production";
const token = process.env.SANITY_WRITE_TOKEN;

export const isSanityWriteConfigured = Boolean(token);

export const readClient = createClient({
  projectId, dataset, apiVersion: "2026-08-01", useCdn: true, perspective: "published",
});

export const writeClient = createClient({
  projectId, dataset, apiVersion: "2026-08-01", useCdn: false, token,
});

// Mirrors the Sanity "episode" schema (studio/schemas) — no query currently
// returns this exact shape, but it documents the fields ingest/enrich write.
export interface SanityEpisode {
  _id: string;
  ytId: string;
  title: string;
  description?: string;
  publishedAt: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  viewCount?: number;
  series: string;
  transcriptStatus?: "fetched" | "unavailable";
}

export interface SanityArticle {
  _id: string;
  headline: string;
  slug: { current: string };
  dek?: string;
  bodyMarkdown: string;
  pullQuote?: string;
  heroUrl?: string | null;
  byline: string;
  workflowState: "ai-drafted" | "approved" | "published";
  lowConfidence?: boolean;
  primaryTeam?: string;
  teams?: string[];
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  publishedAt?: string;
  contentType?: string;
  productionMethod?: "josh" | "staff" | "ai-reviewed" | "automated";
  reviewedBy?: string;
  corrections?: { at: string; note: string }[];
  episode?: {
    ytId: string;
    title: string;
    durationSeconds?: number;
    series?: string;
    description?: string;
    thumbnailUrl?: string;
    publishedAt?: string;
  } | null;
}

const ARTICLE_FIELDS = `_id, headline, slug, dek, bodyMarkdown, pullQuote, byline,
  workflowState, lowConfidence, primaryTeam, teams, tags, seoTitle, seoDescription, publishedAt,
  contentType, productionMethod, reviewedBy, corrections,
  "heroUrl": heroImage.asset->url,
  "episode": episode->{ ytId, title, durationSeconds, series, description, thumbnailUrl, publishedAt }`;

// Deliberately throws on failure — no try/catch here. Pages calling these
// error on a Sanity outage, and Next's ISR then serves the last good render
// instead of these functions failing over to an empty/fake result. Callers
// that must stay fail-soft (e.g. app/sitemap.ts) catch at the call site.
export interface SanityHeroSlide {
  _id: string;
  title: string;
  kicker?: string;
  link: string;
  imageUrl?: string | null;
}

/** Active hero-carousel slides in display order (v2 brief §1.1). */
export async function getHeroSlides(): Promise<SanityHeroSlide[]> {
  return readClient.fetch<SanityHeroSlide[]>(
    `*[_type == "heroSlide" && active == true] | order(order asc)[0...6]{
      _id, title, kicker, link,
      "imageUrl": coalesce(image.asset->url, imageUrl)
    }`,
    {},
    { next: { revalidate: 300, tags: ["hero"] } } as never,
  );
}

export async function getPublishedArticles(limit = 20): Promise<SanityArticle[]> {
  return await readClient.fetch(
    `*[_type == "article" && workflowState == "published"] | order(publishedAt desc)[0...$limit]{ ${ARTICLE_FIELDS} }`,
    { limit },
    { next: { revalidate: 300, tags: ["articles"] } } as never
  );
}

export async function getArticleBySlug(slug: string): Promise<SanityArticle | null> {
  return await readClient.fetch(
    `*[_type == "article" && workflowState == "published" && slug.current == $slug][0]{ ${ARTICLE_FIELDS} }`,
    { slug },
    { next: { revalidate: 300, tags: ["articles", `article:${slug}`] } } as never
  );
}

export async function articleExistsForEpisode(episodeId: string): Promise<boolean> {
  const n = await writeClient.fetch(`count(*[_type == "article" && references($id)])`, { id: episodeId });
  return n > 0;
}

/** Uploads a generated hero image buffer to Sanity assets. Fail-soft: returns
 * the new asset's `_id` on success, null on ANY failure (including when writes
 * aren't configured) — callers (ingest, the backfill script) treat a missing
 * hero image as non-fatal. */
export async function uploadHeroImage(buffer: Buffer): Promise<string | null> {
  if (!isSanityWriteConfigured) return null;
  try {
    const asset = await writeClient.assets.upload("image", buffer, { contentType: "image/png" });
    return asset._id;
  } catch (err) {
    console.error("[sanity:uploadHeroImage]", err);
    return null;
  }
}

/** Patches an article's heroImage field to reference an uploaded asset.
 * Fail-soft: swallows and logs errors, never throws. */
export async function setArticleHeroImage(articleId: string, assetId: string): Promise<void> {
  try {
    await writeClient
      .patch(articleId)
      .set({ heroImage: { _type: "image", asset: { _type: "reference", _ref: assetId } } })
      .commit();
  } catch (err) {
    console.error("[sanity:setArticleHeroImage]", articleId, err);
  }
}

// ---- Wire Desk (v1.2) ----

export interface SanityWireItem {
  _id: string;
  headline: string;
  sub?: string;
  category?: string;
  teams?: string[];
  sourceUrl?: string | null;
  importance?: number;
  publishedAt?: string;
  storySlug?: string | null;
}

export interface SanityWireStory {
  _id: string;
  headline: string;
  slug: { current: string };
  verification?: "confirmed" | "reported" | "developing";
  category?: string;
  teams?: string[];
  whatHappened?: string;
  whyItMatters?: string[];
  joshReceipt?: { quote?: string; ytId?: string; tsSeconds?: number } | null;
  readLabel?: string;
  readBody?: string;
  whatsNext?: string[];
  sources?: { outlet?: string; url?: string }[];
  publishedAt?: string;
  updatedAt?: string;
  corrections?: { at: string; note: string }[];
}

const WIRE_STORY_FIELDS = `_id, headline, slug, verification, category, teams, whatHappened,
  whyItMatters, joshReceipt, readLabel, readBody, whatsNext, sources, publishedAt, updatedAt, corrections`;

export async function getWireItems(limit = 8): Promise<SanityWireItem[]> {
  return await readClient.fetch(
    `*[_type == "wireItem"] | order(publishedAt desc)[0...$limit]{
      _id, headline, sub, category, teams, importance, publishedAt,
      "storySlug": story->slug.current, "sourceUrl": sourceUrls[0]
    }`,
    { limit },
    { next: { revalidate: 120, tags: ["wire"] } } as never
  );
}

export async function getWireStories(limit = 12): Promise<SanityWireStory[]> {
  return await readClient.fetch(
    `*[_type == "wireStory"] | order(publishedAt desc)[0...$limit]{ ${WIRE_STORY_FIELDS} }`,
    { limit },
    { next: { revalidate: 120, tags: ["wire"] } } as never
  );
}

export async function getWireStoryBySlug(slug: string): Promise<SanityWireStory | null> {
  return await readClient.fetch(
    `*[_type == "wireStory" && slug.current == $slug][0]{ ${WIRE_STORY_FIELDS} }`,
    { slug },
    { next: { revalidate: 120, tags: ["wire", `wire:${slug}`] } } as never
  );
}
