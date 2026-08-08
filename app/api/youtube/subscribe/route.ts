import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { SITE_URL } from "@/lib/site";

export async function POST(request: Request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  const body = new URLSearchParams({
    "hub.mode": "subscribe",
    "hub.topic": "https://www.youtube.com/xml/feeds/videos.xml?channel_id=UCg-q_MDeWQrjizr1VPLEpYg",
    "hub.callback": `${SITE_URL}/api/youtube/webhook`,
    "hub.verify": "async",
  });
  const res = await fetch("https://pubsubhubbub.appspot.com/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return NextResponse.json({ ok: res.ok, status: res.status });
}
