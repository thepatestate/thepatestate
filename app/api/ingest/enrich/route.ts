import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { writeClient } from "@/lib/sanity";

export const maxDuration = 300;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ISO8601 duration ("PT1H12M44S") -> seconds
function parseDuration(iso: string): number {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const [, h, min, s] = m;
  return (Number(h) || 0) * 3600 + (Number(min) || 0) * 60 + (Number(s) || 0);
}

interface YtVideoItem {
  id: string;
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string };
}

export async function POST(request: Request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, reason: "no-key" }, { status: 200 });

  try {
    const episodes = await writeClient.fetch<Array<{ _id: string; ytId: string }>>(
      `*[_type == "episode"]{ _id, ytId }`
    );
    const byYtId = new Map(episodes.map((e) => [e.ytId, e._id]));
    const results: Record<string, string> = {};

    for (const group of chunk(episodes, 50)) {
      const ids = group.map((e) => e.ytId).join(",");
      try {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${ids}&key=${apiKey}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          for (const e of group) results[e.ytId] = "failed";
          continue;
        }
        const data = (await res.json()) as { items?: YtVideoItem[] };
        for (const item of data.items ?? []) {
          const episodeId = byYtId.get(item.id);
          if (!episodeId) continue;
          const durationSeconds = item.contentDetails?.duration
            ? parseDuration(item.contentDetails.duration)
            : undefined;
          const viewCount = item.statistics?.viewCount ? Number(item.statistics.viewCount) : undefined;
          try {
            await writeClient
              .patch(episodeId)
              .set({
                ...(durationSeconds !== undefined ? { durationSeconds } : {}),
                ...(viewCount !== undefined ? { viewCount } : {}),
              })
              .commit();
            results[item.id] = "updated";
          } catch {
            results[item.id] = "failed";
          }
        }
      } catch {
        for (const e of group) results[e.ytId] = "failed";
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
