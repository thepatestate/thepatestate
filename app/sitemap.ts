import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { getPublishedArticles } from "@/lib/sanity";

const BASE = SITE_URL;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries = ["", "/show", "/about", "/scores", "/pickem", "/poll", "/playoffs", "/recruiting", "/notebook", "/porch", "/tailgate", "/shop", "/teams", "/teams/georgia", "/report", "/ledger", "/join"].map((p) => ({ url: `${BASE}${p}`, changeFrequency: "daily" as const }));
  const articles = await getPublishedArticles(100);
  const articleEntries = articles.map((a) => ({ url: `${BASE}/notebook/${a.slug.current}`, changeFrequency: "daily" as const }));
  return [...staticEntries, ...articleEntries];
}
