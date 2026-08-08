import { createHmac, timingSafeEqual } from "node:crypto";
import { ingestEpisode } from "@/lib/ingest";
import { isEpisode } from "@/lib/youtube";

export const maxDuration = 300;

const CHANNEL_ID = "UCg-q_MDeWQrjizr1VPLEpYg";
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

// PubSubHubbub subscription verification: echo hub.challenge, but only for our
// own topic — an attacker probing for a live callback shouldn't get an echo.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = url.searchParams.get("hub.challenge");
  const topic = url.searchParams.get("hub.topic");
  if (challenge && topic?.includes(CHANNEL_ID)) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("not found", { status: 404 });
}

// Verifies the PuSH hub's x-hub-signature (sha1=<hmac>) against CRON_SECRET,
// the same secret sent as hub.secret at subscribe time. Absent header ->
// true (caller falls back to the channel-feed cross-check below, which
// covers subscriptions made before hub.secret was wired up).
function verifySignature(rawBody: string, header: string | null): boolean {
  if (!header) return true;
  const secret = process.env.CRON_SECRET ?? "";
  const expected = `sha1=${createHmac("sha1", secret).update(rawBody).digest("hex")}`;
  const sigBuf = Buffer.from(header);
  const expBuf = Buffer.from(expected);
  return sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
}

// Notification: Atom entry for the channel. Always 200 (never trigger PuSH unsubscribe).
export async function POST(request: Request) {
  try {
    const xml = await request.text();
    if (!xml.includes(CHANNEL_ID)) return new Response("ignored", { status: 200 });
    // Extract from the first <entry> block only, so id/title/published can never be
    // pulled from different entries when a notification carries more than one.
    const entry = xml.split("<entry>")[1] ?? xml;
    const id = entry.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/)?.[1];
    const title = entry.match(/<title>([^<]+)<\/title>/)?.[1];
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1];

    if (id) {
      const sigHeader = request.headers.get("x-hub-signature");
      if (!verifySignature(xml, sigHeader)) {
        console.warn("[webhook] invalid signature", id);
        return new Response("ok", { status: 200 });
      }

      // Cross-check against the real channel feed before any ingestion — the
      // hub notification body itself is forgeable, this fetch is not.
      const feedRes = await fetch(FEED_URL, { cache: "no-store" });
      const feedXml = feedRes.ok ? await feedRes.text() : "";
      if (!feedXml.includes(`<yt:videoId>${id}</yt:videoId>`)) {
        console.warn("[webhook] id not in channel feed", id);
        return new Response("ok", { status: 200 });
      }

      const video = {
        id,
        title: title ?? "New episode",
        published: published ?? new Date().toISOString(),
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      };
      if (!isEpisode(video)) {
        console.warn("[webhook] not an episode, skipping", id, video.title);
        return new Response("ok", { status: 200 });
      }

      await ingestEpisode(video);
    }
  } catch (err) {
    console.error("[webhook]", err);
  }
  return new Response("ok", { status: 200 });
}
