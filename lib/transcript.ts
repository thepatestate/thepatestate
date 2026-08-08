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

/** Unofficial caption fetch: watch page -> captionTracks -> timedtext XML. Null on any failure. */
export async function fetchTranscript(ytId: string): Promise<TranscriptSegment[] | null> {
  try {
    const page = await fetch(`https://www.youtube.com/watch?v=${ytId}`, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en" },
      cache: "no-store",
    });
    if (!page.ok) return null;
    const html = await page.text();
    const trackMatch = html.match(/"captionTracks":(\[.*?\])/);
    if (!trackMatch) return null;
    const tracks = JSON.parse(trackMatch[1].replace(/\\u0026/g, "&")) as Array<{
      baseUrl: string;
      languageCode?: string;
      kind?: string;
    }>;
    const track =
      tracks.find((t) => t.languageCode?.startsWith("en") && t.kind !== "asr") ??
      tracks.find((t) => t.languageCode?.startsWith("en")) ??
      tracks[0];
    if (!track?.baseUrl) return null;
    const xmlRes = await fetch(track.baseUrl, { headers: { "User-Agent": UA }, cache: "no-store" });
    if (!xmlRes.ok) return null;
    const segs = parseTimedText(await xmlRes.text());
    return segs.length > 0 ? segs : null;
  } catch {
    return null;
  }
}
