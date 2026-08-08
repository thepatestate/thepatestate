import { NextResponse } from "next/server";
import { ingestEpisode } from "@/lib/ingest";

export const maxDuration = 300;

// PubSubHubbub subscription verification: echo hub.challenge (unauthenticated by spec)
export async function GET(request: Request) {
  const challenge = new URL(request.url).searchParams.get("hub.challenge");
  if (challenge) return new Response(challenge, { status: 200 });
  return NextResponse.json({ ok: true });
}

// Notification: Atom entry for the channel. Always 200 (never trigger PuSH unsubscribe).
export async function POST(request: Request) {
  try {
    const xml = await request.text();
    if (!xml.includes("UCg-q_MDeWQrjizr1VPLEpYg")) return new Response("ignored", { status: 200 });
    // Extract from the first <entry> block only, so id/title/published can never be
    // pulled from different entries when a notification carries more than one.
    const entry = xml.split("<entry>")[1] ?? xml;
    const id = entry.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/)?.[1];
    const title = entry.match(/<title>([^<]+)<\/title>/)?.[1];
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1];
    if (id) {
      await ingestEpisode({
        id,
        title: title ?? "New episode",
        published: published ?? new Date().toISOString(),
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      });
    }
  } catch {
    // swallow — always 200
  }
  return new Response("ok", { status: 200 });
}
