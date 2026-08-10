// Type-only import: erased at compile time, so it never triggers a runtime `require("undici")`.
// That matters — merely loading the undici module (even unused) has been observed to interfere
// with Node's built-in global fetch decompression. Loading it is deferred to getProxyAgent()
// below, and only when TRANSCRIPT_PROXY_URL is actually set, so the no-proxy path never touches
// the module at all and stays byte-identical to before this feature existed.
import type { ProxyAgent } from "undici";

export interface TranscriptSegment {
  start: number;
  text: string;
}

/** `dispatcher` isn't part of the DOM fetch types Next.js pulls in, but Node's runtime fetch
 * (undici-based) accepts it. FetchOpts widens RequestInit to allow it through without `any`. */
type FetchOpts = RequestInit & { dispatcher?: ProxyAgent };

let proxyAgentPromise: Promise<ProxyAgent | undefined> | undefined;

/** Lazily builds (once) and caches a ProxyAgent from TRANSCRIPT_PROXY_URL, e.g.
 * "http://user:pass@host:port". Resolves to undefined — without ever importing undici or
 * constructing an agent — when the env var is unset, so behavior stays byte-identical to today
 * when proxying isn't configured. */
function getProxyAgent(): Promise<ProxyAgent | undefined> {
  if (!proxyAgentPromise) {
    const url = process.env.TRANSCRIPT_PROXY_URL;
    proxyAgentPromise = url
      ? import("undici").then(({ ProxyAgent: ProxyAgentCtor }) => new ProxyAgentCtor(url))
      : Promise.resolve(undefined);
  }
  return proxyAgentPromise;
}

/** Fetches via the configured proxy (TRANSCRIPT_PROXY_URL) when set; falls through to a direct
 * fetch if the proxy attempt throws, or if no proxy is configured at all. Cheap resilience: try
 * the proxy first (that's the point of configuring one), but never let a bad proxy take down
 * transcript fetching entirely. */
async function proxiedFetch(url: string, opts: RequestInit): Promise<Response> {
  const agent = await getProxyAgent();
  if (agent) {
    try {
      const withDispatcher: FetchOpts = { ...opts, dispatcher: agent };
      return await fetch(url, withDispatcher);
    } catch (err) {
      console.error("[transcript] proxy fetch failed", err);
    }
  }
  return fetch(url, opts);
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
    const res = await proxiedFetch("https://www.youtube.com/youtubei/v1/player", {
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
  const xmlRes = await proxiedFetch(track.baseUrl, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!xmlRes.ok) return null;
  const body = await xmlRes.text();
  const srv3Segs = parseSrv3(body);
  if (srv3Segs.length > 0) return srv3Segs;
  const legacySegs = parseTimedText(body);
  return legacySegs.length > 0 ? legacySegs : null;
}

/** Unofficial caption fetch: watch page -> captionTracks -> timedtext XML. Null on any failure. */
async function fetchTranscriptViaWatchPage(ytId: string): Promise<TranscriptSegment[] | null> {
  const page = await proxiedFetch(`https://www.youtube.com/watch?v=${ytId}`, {
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
  const xmlRes = await proxiedFetch(track.baseUrl, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!xmlRes.ok) return null;
  const segs = parseTimedText(await xmlRes.text());
  return segs.length > 0 ? segs : null;
}

type SupadataChunk = { text: string; offset: number; duration: number; lang?: string };
type SupadataResponse = { content?: SupadataChunk[] | string; jobId?: string };
type SupadataJobResponse = SupadataResponse & { status?: "queued" | "active" | "completed" | "failed" };

function mapSupadataContent(content: SupadataChunk[] | string | undefined): TranscriptSegment[] | null {
  if (!Array.isArray(content) || content.length === 0) return null;
  const segs = content
    .filter((c) => typeof c?.text === "string" && c.text.trim())
    .map((c) => ({ start: c.offset / 1000, text: c.text.trim() }));
  return segs.length > 0 ? segs : null;
}

const SUPADATA_POLL_ATTEMPTS = 20;
const SUPADATA_POLL_INTERVAL_MS = 2000;

/** Supadata third-party transcript API: last-resort fallback for when YouTube's InnerTube API
 * is unreachable from the deployment's datacenter IP (Vercel is commonly blocked; residential
 * IPs are not). Skipped entirely (returns null immediately) when SUPADATA_API_KEY is unset, so
 * behavior is unchanged for anyone not opted into this fallback. Never throws. */
export async function fetchTranscriptSupadata(ytId: string): Promise<TranscriptSegment[] | null> {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) return null;
  try {
    const url = `https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${ytId}`
    )}`;
    const res = await fetch(url, { headers: { "x-api-key": apiKey }, cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as SupadataResponse;

    if (data.jobId) {
      for (let i = 0; i < SUPADATA_POLL_ATTEMPTS; i++) {
        await new Promise((resolve) => setTimeout(resolve, SUPADATA_POLL_INTERVAL_MS));
        const jobRes = await fetch(`https://api.supadata.ai/v1/transcript/${data.jobId}`, {
          headers: { "x-api-key": apiKey },
          cache: "no-store",
        });
        if (!jobRes.ok) return null;
        const job = (await jobRes.json()) as SupadataJobResponse;
        if (job.status === "failed") return null;
        if (job.status === "completed") return mapSupadataContent(job.content);
        // queued / active: keep polling
      }
      return null; // gave up waiting on the job
    }

    return mapSupadataContent(data.content);
  } catch (err) {
    console.error("[transcript:fetchTranscriptSupadata]", ytId, err);
    return null;
  }
}

/** Parses SubRip captions (the official captions.download tfmt=srt format)
 * into segments: "1\n00:00:01,240 --> 00:00:03,900\nline\n". */
export function parseSrt(srt: string): TranscriptSegment[] {
  const out: TranscriptSegment[] = [];
  for (const block of srt.split(/\r?\n\r?\n/)) {
    const lines = block.trim().split(/\r?\n/);
    if (lines.length < 2) continue;
    const timeIdx = lines.findIndex((l) => /-->/.test(l));
    if (timeIdx === -1) continue;
    const m = lines[timeIdx].match(/(\d+):(\d+):(\d+)[,.](\d+)\s*-->/);
    if (!m) continue;
    const start = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
    const text = lines.slice(timeIdx + 1).join(" ").replace(/<[^>]+>/g, "").trim();
    if (text) out.push({ start, text });
  }
  return out;
}

/** Official captions via the YouTube Data API, using the channel's own OAuth
 * grant — the sturdy path that replaces scraping once the channel is
 * connected. Null when not connected or on any failure (callers fall back). */
export async function fetchTranscriptViaCaptionsApi(ytId: string): Promise<TranscriptSegment[] | null> {
  // Lazy import keeps this module free of Supabase deps for callers/tests
  // that never touch the OAuth path.
  const { getChannelAccessToken } = await import("@/lib/youtube-oauth");
  const token = await getChannelAccessToken();
  if (!token) return null;
  try {
    const listRes = await fetch(
      `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${ytId}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (!listRes.ok) {
      console.error("[transcript:captionsApi] list", ytId, listRes.status);
      return null;
    }
    const list = (await listRes.json()) as {
      items?: { id: string; snippet?: { language?: string; trackKind?: string } }[];
    };
    const tracks = list.items ?? [];
    // Prefer a human-uploaded English track; fall back to the auto (ASR) one.
    const track =
      tracks.find((t) => t.snippet?.language?.startsWith("en") && t.snippet?.trackKind !== "asr") ??
      tracks.find((t) => t.snippet?.language?.startsWith("en")) ??
      tracks[0];
    if (!track) return null;
    const dlRes = await fetch(
      `https://www.googleapis.com/youtube/v3/captions/${encodeURIComponent(track.id)}?tfmt=srt`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (!dlRes.ok) {
      console.error("[transcript:captionsApi] download", ytId, dlRes.status);
      return null;
    }
    const segs = parseSrt(await dlRes.text());
    return segs.length > 0 ? segs : null;
  } catch (err) {
    console.error("[transcript:captionsApi]", ytId, err);
    return null;
  }
}

/** Fetches a transcript for a YouTube video. Order: the official captions
 * API via the channel's OAuth grant (sturdiest — no scraping), then the
 * InnerTube player API, then the watch-page scrape, then (if configured)
 * the Supadata third-party API as a last resort. Null on total failure. */
export async function fetchTranscript(ytId: string): Promise<TranscriptSegment[] | null> {
  try {
    const segs = await fetchTranscriptViaCaptionsApi(ytId);
    if (segs) return segs;
  } catch (err) {
    console.error("[transcript:fetchTranscript] captions api failed", ytId, err);
  }
  try {
    const segs = await fetchTranscriptViaInnerTube(ytId);
    if (segs) return segs;
  } catch (err) {
    console.error("[transcript:fetchTranscript] innertube failed", ytId, err);
  }
  try {
    const segs = await fetchTranscriptViaWatchPage(ytId);
    if (segs) return segs;
  } catch (err) {
    console.error("[transcript:fetchTranscript]", ytId, err);
  }
  return fetchTranscriptSupadata(ytId);
}
