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

export interface ChannelStats {
  subscribers: number;
  videos: number;
  views: number;
}

/** Real channel statistics from the YouTube Data API (v2 brief §0.2 — real
 * social proof only). Refreshes daily; null when the key is missing or the
 * API is down, so callers can simply omit the proof line. */
export async function getChannelStats(): Promise<ChannelStats | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${CHANNEL_ID}&key=${key}`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: { statistics?: Record<string, string> }[] };
    const stats = data.items?.[0]?.statistics;
    if (!stats?.subscriberCount) return null;
    return {
      subscribers: Number(stats.subscriberCount),
      videos: Number(stats.videoCount ?? 0),
      views: Number(stats.viewCount ?? 0),
    };
  } catch {
    return null;
  }
}

/** "534000" → "534K+", "189438520" → "189M+" — always rounded DOWN so the
 * claim is verifiably true. */
export function compactCount(n: number): string {
  if (n >= 1_000_000) return `${Math.floor(n / 100_000) / 10}M+`.replace(".0M", "M");
  if (n >= 1_000) return `${Math.floor(n / 1_000)}K+`;
  return String(n);
}

// YouTube auto-generates a Shorts-only playlist per channel: "UUSH" + the
// channel id minus its "UC" prefix. Same trick the uploads playlist uses
// ("UU" + suffix). Verified live against the channel before shipping.
const SHORTS_PLAYLIST = `UUSH${CHANNEL_ID.slice(2)}`;

export interface Short {
  id: string;
  title: string;
  published: string;
}

/** Vertical 9:16 thumbnail YouTube serves for Shorts. */
export function shortsThumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/oardefault.jpg`;
}

/** Latest Shorts from the channel's auto-generated Shorts playlist (v2 brief
 * §1.2). Fail-soft []: the rail simply doesn't render without data. */
export async function getShorts(limit = 8): Promise<Short[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${SHORTS_PLAYLIST}&maxResults=${limit}&key=${key}`,
      { next: { revalidate: 21600 } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: { snippet?: { title?: string; publishedAt?: string; resourceId?: { videoId?: string } } }[];
    };
    return (data.items ?? [])
      .map((it) => ({
        id: it.snippet?.resourceId?.videoId ?? "",
        title: it.snippet?.title ?? "",
        published: it.snippet?.publishedAt ?? "",
      }))
      .filter((s) => s.id && s.title);
  } catch {
    return [];
  }
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
