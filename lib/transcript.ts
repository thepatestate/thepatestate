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

/** InnerTube player API: POST videoId -> captionTracks -> srv3 (or legacy timedtext) XML. Returns null on any failure. */
async function fetchTranscriptViaInnerTube(ytId: string): Promise<TranscriptSegment[] | null> {
  const res = await fetch("https://www.youtube.com/youtubei/v1/player", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "ANDROID",
          clientVersion: "20.10.38",
          androidSdkVersion: 30,
          hl: "en",
        },
      },
      videoId: ytId,
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  const tracks: CaptionTrack[] | undefined =
    data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
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
