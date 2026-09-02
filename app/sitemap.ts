import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { getPublishedArticles, getWireStories } from "@/lib/sanity";

const BASE = SITE_URL;

// Indexing policy (v2 brief §8): noindex routes never enter the sitemap —
// /play (thin hub), /search, /me, /welcome, and /teams/georgia (template
// page below the §4.6 completeness standard). Demo-only content never has
// its own routes, so nothing demo can leak in here.
const STATIC_PATHS = [
  "",
  "/show",
  "/about",
  "/scores",
  "/pickem",
  "/poll",
  "/playoffs",
  "/recruiting",
  "/notebook",
  "/wire",
  "/quad",
  "/tailgate",
  "/shop",
  "/teams",
  "/report",
  "/ledger",
  "/join",
  "/standards",
  "/privacy",
  "/terms",
  "/contact",
  "/authors/josh-pate",
  "/authors/the-pate-state-staff",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries = STATIC_PATHS.map((p) => ({
    url: `${BASE}${p}`,
    changeFrequency: "daily" as const,
  }));

  // Fail-soft: the sitemap should still serve the static routes if Sanity is
  // down, unlike article pages, which intentionally throw (see lib/sanity.ts).
  let articles: Awaited<ReturnType<typeof getPublishedArticles>> = [];
  let wireStories: Awaited<ReturnType<typeof getWireStories>> = [];
  try {
    [articles, wireStories] = await Promise.all([getPublishedArticles(100), getWireStories(100)]);
  } catch (err) {
    console.error("[sitemap]", err);
  }

  const articleEntries = articles.map((a) => ({
    url: `${BASE}/notebook/${a.slug.current}`,
    changeFrequency: "daily" as const,
    ...(a.publishedAt ? { lastModified: new Date(a.publishedAt) } : {}),
  }));
  const wireEntries = wireStories.map((w) => ({
    url: `${BASE}/wire/${w.slug.current}`,
    changeFrequency: "hourly" as const,
    ...(w.updatedAt || w.publishedAt ? { lastModified: new Date(w.updatedAt ?? w.publishedAt!) } : {}),
  }));

  return [...staticEntries, ...articleEntries, ...wireEntries];
}
