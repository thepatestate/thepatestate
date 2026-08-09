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
  byline: string;
  workflowState: "ai-drafted" | "approved" | "published";
  lowConfidence?: boolean;
  primaryTeam?: string;
  teams?: string[];
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  publishedAt?: string;
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
  "episode": episode->{ ytId, title, durationSeconds, series, description, thumbnailUrl, publishedAt }`;

// Deliberately throws on failure — no try/catch here. Pages calling these
// error on a Sanity outage, and Next's ISR then serves the last good render
// instead of these functions failing over to an empty/fake result. Callers
// that must stay fail-soft (e.g. app/sitemap.ts) catch at the call site.
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
