// Sitewide search foundation (v2 brief §7.5): one query fans out across the
// Notebook (articles), the Wire (stories + items), the show archive
// (episodes), and Josh's verbatim quote archive (transcript hits with
// timestamps). Server-only; every source fails soft to [] so one backend
// being down never blanks the whole results page.
import { readClient } from "@/lib/sanity";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export interface SearchArticle {
  headline: string;
  slug: string;
  dek?: string;
  byline: string;
  publishedAt?: string;
}

export interface SearchWireStory {
  headline: string;
  slug: string;
  category?: string;
  publishedAt?: string;
}

export interface SearchEpisode {
  title: string;
  ytId: string;
  publishedAt?: string;
}

export interface SearchQuote {
  quote: string;
  ytId: string;
  tsSeconds: number;
  topic: string;
}

export interface SearchResults {
  articles: SearchArticle[];
  wireStories: SearchWireStory[];
  episodes: SearchEpisode[];
  quotes: SearchQuote[];
}

const EMPTY: SearchResults = { articles: [], wireStories: [], episodes: [], quotes: [] };

export async function searchSite(rawQuery: string): Promise<SearchResults> {
  const q = rawQuery.trim().slice(0, 80);
  if (q.length < 2) return EMPTY;
  const pattern = `*${q}*`;

  const [articles, wireStories, episodes, quotes] = await Promise.all([
    readClient
      .fetch<SearchArticle[]>(
        `*[_type == "article" && workflowState == "published" &&
           (headline match $p || dek match $p || bodyMarkdown match $p)]
           | order(publishedAt desc)[0...10]{ headline, "slug": slug.current, dek, byline, publishedAt }`,
        { p: pattern },
      )
      .catch(() => []),
    readClient
      .fetch<SearchWireStory[]>(
        `*[_type == "wireStory" && (headline match $p || whatHappened match $p)]
           | order(publishedAt desc)[0...10]{ headline, "slug": slug.current, category, publishedAt }`,
        { p: pattern },
      )
      .catch(() => []),
    readClient
      .fetch<SearchEpisode[]>(
        `*[_type == "episode" && title match $p]
           | order(publishedAt desc)[0...10]{ title, ytId, publishedAt }`,
        { p: pattern },
      )
      .catch(() => []),
    searchQuotes(q),
  ]);

  return { articles, wireStories, episodes, quotes };
}

async function searchQuotes(q: string): Promise<SearchQuote[]> {
  if (!isAdminConfigured) return [];
  try {
    const { data, error } = await createAdminClient()
      .from("josh_quotes")
      .select("quote, yt_id, ts_seconds, topic")
      .or(`quote.ilike.%${q.replace(/[%,()]/g, "")}%,topic.ilike.%${q.replace(/[%,()]/g, "")}%`)
      .order("heat", { ascending: false })
      .limit(8);
    if (error) return [];
    return (data ?? []).map((r) => ({
      quote: r.quote as string,
      ytId: r.yt_id as string,
      tsSeconds: r.ts_seconds as number,
      topic: r.topic as string,
    }));
  } catch {
    return [];
  }
}
