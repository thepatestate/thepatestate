export interface TranscriptSegment {
  start: number;
  text: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export function parseTimedText(xml: string): TranscriptSegment[] {
  const out: TranscriptSegment[] = [];
  const re = /<text start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const text = decodeEntities(decodeEntities(m[2])).replace(/<[^>]+>/g, "").trim();
    if (text) out.push({ start: parseFloat(m[1]), text });
  }
  return out;
}

/** Parses srv3 timedtext XML (InnerTube player API caption tracks): <p t="ms" d="ms">text or <s>frag</s></p>. */
export function parseSrv3(xml: string): TranscriptSegment[] {
  const out: TranscriptSegment[] = [];
  const re = /<p t="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const text = decodeEntities(decodeEntities(m[2]))
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text) out.push({ start: parseInt(m[1], 10) / 1000, text });
  }
  return out;
}

export function transcriptToPromptText(segs: TranscriptSegment[]): string {
  const lines: string[] = [];
  let total = 0;
  for (const s of segs) {
    const mm = String(Math.floor(s.start / 60)).padStart(2, "0");
    const ss = String(Math.floor(s.start % 60)).padStart(2, "0");
    const line = `[${mm}:${ss}] ${s.text}`;
    if (total + line.length + 1 > 60000) break;
    lines.push(line);
    total += line.length + 1;
  }
  return lines.join("\n");
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";

type CaptionTrack = { baseUrl: string; languageCode?: string; kind?: string };

function pickTrack(tracks: CaptionTrack[]): CaptionTrack | undefined {
  return (
    tracks.find((t) => t.languageCode?.startsWith("en") && t.kind !== "asr") ??
    tracks.find((t) => t.languageCode?.startsWith("en")) ??
    tracks[0]
  );
}

type InnertubeClient = {
  name: string;
  body: (videoId: string) => Record<string, unknown>;
  headers: Record<string, string>;
};

/** InnerTube client contexts to try in order. YouTube blocks the ANDROID client from
 * datacenter IPs (works fine from residential), so we fall back to IOS then a TV embedded
 * client, which tend to be allowed from datacenter/cloud IPs like Vercel's. */
const INNERTUBE_CLIENTS: InnertubeClient[] = [
  {
    name: "ANDROID",
    body: (videoId) => ({
      context: {
        client: {
          clientName: "ANDROID",
          clientVersion: "20.10.38",
          androidSdkVersion: 30,
          hl: "en",
        },
      },
      videoId,
    }),
    headers: { "Content-Type": "application/json" },
  },
  {
    name: "IOS",
    body: (videoId) => ({
      context: {
        client: {
          clientName: "IOS",
          clientVersion: "20.10.4",
          deviceMake: "Apple",
          deviceModel: "iPhone16,2",
          hl: "en",
        },
      },
      videoId,
    }),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)",
    },
  },
  {
    name: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
    body: (videoId) => ({
      context: {
        client: {
          clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
          clientVersion: "2.0",
          hl: "en",
        },
        thirdParty: { embedUrl: "https://www.youtube.com" },
      },
      playbackContext: {
        contentPlaybackContext: { signatureTimestamp: 19950 },
      },
      videoId,
    }),
    headers: { "Content-Type": "application/json" },
  },
];

/** InnerTube player API: POST videoId -> captionTracks -> srv3 (or legacy timedtext) XML.
 * Tries each client in INNERTUBE_CLIENTS in order, stopping at the first that yields
 * captionTracks. Returns null on total failure. */
async function fetchTranscriptViaInnerTube(ytId: string): Promise<TranscriptSegment[] | null> {
  let tracks: CaptionTrack[] | undefined;
  for (const client of INNERTUBE_CLIENTS) {
    const res = await fetch("https://www.youtube.com/youtubei/v1/player", {
      method: "POST",
      headers: client.headers,
      body: JSON.stringify(client.body(ytId)),
      cache: "no-store",
    });
    if (!res.ok) continue;
    const data = await res.json();
    const status = data?.playabilityStatus?.status;
    if (status !== "OK") {
      console.error("[transcript] client", client.name, status);
      continue;
    }
    const clientTracks: CaptionTrack[] | undefined =
      data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (clientTracks && clientTracks.length > 0) {
      tracks = clientTracks;
      break;
    }
  }
  if (!tracks || tracks.length === 0) return null;
  const track = pickTrack(tracks);
  if (!track?.baseUrl) return null;
  const xmlRes = await fetch(track.baseUrl, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!xmlRes.ok) return null;
  const body = await xmlRes.text();
  const srv3Segs = parseSrv3(body);
  if (srv3Segs.length > 0) return srv3Segs;
  const legacySegs = parseTimedText(body);
  return legacySegs.length > 0 ? legacySegs : null;
}

/** Unofficial caption fetch: watch page -> captionTracks -> timedtext XML. Null on any failure. */
async function fetchTranscriptViaWatchPage(ytId: string): Promise<TranscriptSegment[] | null> {
  const page = await fetch(`https://www.youtube.com/watch?v=${ytId}`, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en" },
    cache: "no-store",
  });
  if (!page.ok) return null;
  const html = await page.text();
  const trackMatch = html.match(/"captionTracks":(\[.*?\])/);
  if (!trackMatch) return null;
  const tracks = JSON.parse(trackMatch[1].replace(/\\u0026/g, "&")) as CaptionTrack[];
  const track = pickTrack(tracks);
  if (!track?.baseUrl) return null;
  const xmlRes = await fetch(track.baseUrl, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!xmlRes.ok) return null;
  const segs = parseTimedText(await xmlRes.text());
  return segs.length > 0 ? segs : null;
}

/** Fetches a transcript for a YouTube video. Tries the InnerTube player API first, falling
 * back to the watch-page scrape if that fails entirely. Null on total failure. */
export async function fetchTranscript(ytId: string): Promise<TranscriptSegment[] | null> {
  try {
    const segs = await fetchTranscriptViaInnerTube(ytId);
    if (segs) return segs;
  } catch (err) {
    console.error("[transcript:fetchTranscript] innertube failed", ytId, err);
  }
  try {
    return await fetchTranscriptViaWatchPage(ytId);
  } catch (err) {
    console.error("[transcript:fetchTranscript]", ytId, err);
    return null;
  }
}
