import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { parseFeed } from "@/lib/youtube";
import { ingestEpisode } from "@/lib/ingest";

export const maxDuration = 300;
const FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=UCg-q_MDeWQrjizr1VPLEpYg";

export async function POST(request: Request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  try {
    const res = await fetch(FEED_URL, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ ok: false }, { status: 200 });
    const videos = parseFeed(await res.text());
    const results: Record<string, string> = {};
    for (const v of videos.slice(0, 5)) {
      results[v.id] = await ingestEpisode(v);
    }
    return NextResponse.json({ ok: true, results });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
