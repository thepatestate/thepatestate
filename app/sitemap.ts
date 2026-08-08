import type { MetadataRoute } from "next";

const BASE = "https://thepatestate.vercel.app"; // update when custom domain lands

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/show", "/about", "/scores", "/pickem", "/poll", "/playoffs", "/recruiting", "/notebook", "/porch", "/tailgate", "/shop", "/teams", "/teams/georgia", "/report", "/ledger"].map((p) => ({ url: `${BASE}${p}`, changeFrequency: "daily" as const }));
}
