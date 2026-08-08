import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { parseFeed, isEpisode } from "@/lib/youtube";
import { ingestEpisode } from "@/lib/ingest";

export const maxDuration = 300;
const FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=UCg-q_MDeWQrjizr1VPLEpYg";

export async function POST(request: Request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  try {
    const countParam = Number(new URL(request.url).searchParams.get("count"));
    const count = Number.isFinite(countParam) && countParam > 0 ? Math.min(countParam, 10) : 5;
    const res = await fetch(FEED_URL, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ ok: false }, { status: 200 });
    const videos = parseFeed(await res.text());
    const results: Record<string, string> = {};
    for (const v of videos.filter(isEpisode).slice(0, count)) {
      results[v.id] = await ingestEpisode(v);
    }
    return NextResponse.json({ ok: true, results });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
