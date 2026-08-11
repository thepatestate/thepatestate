"use client";

// Global next/image loader (next.config images.loaderFile) — added when the
// free Vercel tier's 5,000 monthly image transformations hit 75%. The
// high-cardinality remote images (136+ ESPN team logos, YouTube thumbnails)
// are already tiny, compressed CDN assets; re-optimizing them burns quota
// for no visual gain, so they serve direct. Sanity images resize on
// Sanity's own free CDN. Local images (heroes, editorial art, helmets)
// keep Vercel's optimizer — a small fixed set that caches for 31 days.
export default function imageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  if (src.startsWith("https://cdn.sanity.io/")) {
    const sep = src.includes("?") ? "&" : "?";
    return `${src}${sep}w=${width}&q=${quality ?? 75}&auto=format`;
  }
  if (src.startsWith("https://") || src.startsWith("http://")) {
    return src; // espncdn / ytimg etc. — pre-optimized CDNs, serve as-is
  }
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality ?? 75}`;
}
