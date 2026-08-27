// Editorial Engine V2 — shadow runner (brief §25 Phase 1). Flag-guarded:
// returns 404-like "disabled" unless EDITORIAL_V2_ENABLED and
// EDITORIAL_V2_SHOW_ENABLED are on. Runs the V2 room for the most recent
// show episode that already has a V1 held draft and no V2 run, stores the
// run record, and NEVER writes an article. Cron-callable later; callable
// now with the cron secret for manual shadow runs.
import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { editorialV2Flags } from "@/lib/editorial-v2/flags";
import { shadowRunLatestShowEpisode } from "@/lib/editorial-v2/shadow";

export const maxDuration = 800;

export async function POST(request: Request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  const flags = editorialV2Flags();
  if (!flags.show) return NextResponse.json({ ok: false, reason: "editorial v2 show lane disabled" }, { status: 200 });
  const ytId = new URL(request.url).searchParams.get("ytId") ?? undefined;
  const result = await shadowRunLatestShowEpisode({ ytId });
  return NextResponse.json({ ok: true, ...result });
}
