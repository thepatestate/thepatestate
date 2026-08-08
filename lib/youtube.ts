const CHANNEL_ID = "UCg-q_MDeWQrjizr1VPLEpYg";
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

export const CHANNEL_URL = "https://www.youtube.com/@JoshPateCFB";
export const SUBSCRIBE_URL = `${CHANNEL_URL}?sub_confirmation=1`;
export const APPLE_PODCASTS_URL =
  "https://podcasts.apple.com/us/podcast/josh-pates-college-football-show/id1485905502";
export const SPOTIFY_URL = "https://open.spotify.com/show/553DKKHsBSCOkrZdppJpeB";

export const SOCIAL_LINKS = {
  x: "https://x.com/JoshPateCFB",
  instagram: "https://www.instagram.com/joshpatecfb",
  tiktok: "https://www.tiktok.com/@joshpatecfb",
  merch: "https://patestatematerial.com",
} as const;

export interface Video {
  id: string;
  title: string;
  published: string; // ISO 8601
  thumbnail: string;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'",
};

function decodeEntities(s: string): string {
  return s.replace(/&(?:amp|lt|gt|quot|#39|apos);/g, (m) => ENTITIES[m]);
}

export function parseFeed(xml: string): Video[] {
  const videos: Video[] = [];
  for (const entry of xml.split("<entry>").slice(1)) {
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = entry.match(/<title>([^<]*)<\/title>/)?.[1];
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1];
    const thumbnail = entry.match(/<media:thumbnail url="([^"]+)"/)?.[1];
    if (id && title && published && thumbnail) {
      videos.push({ id, title: decodeEntities(title), published, thumbnail });
    }
  }
  return videos;
}

export function isEpisode(v: Video): boolean {
  return /college football show/i.test(v.title);
}

export function videoUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

export async function getVideos(): Promise<Video[]> {
  try {
    const res = await fetch(FEED_URL, { next: { revalidate: 21600 } });
    if (!res.ok) return [];
    return parseFeed(await res.text());
  } catch {
    return [];
  }
}
