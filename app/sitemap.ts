import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const BASE = SITE_URL;

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/show", "/about", "/scores", "/pickem", "/poll", "/playoffs", "/recruiting", "/notebook", "/porch", "/tailgate", "/shop", "/teams", "/teams/georgia", "/report", "/ledger"].map((p) => ({ url: `${BASE}${p}`, changeFrequency: "daily" as const }));
}
