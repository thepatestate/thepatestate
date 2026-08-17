import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireCronSecret } from "@/lib/cron-auth";
import { runWireMonitor, backfillWireStories } from "@/lib/wire";

export const maxDuration = 300;

export async function POST(request: Request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  try {
    // ?backfill=N: one-off pass writing full stories for existing storyless
    // items (client directive: wire clicks never leave the site). The normal
    // cron cadence stays on the plain monitor.
    const backfill = new URL(request.url).searchParams.get("backfill");
    if (backfill) {
      const summary = await backfillWireStories(Math.min(40, Math.max(1, Number(backfill) || 20)));
      console.log("[wire:backfill]", JSON.stringify(summary));
      if (summary.stories > 0) revalidateTag("wire", { expire: 0 });
      return NextResponse.json({ ok: true, mode: "backfill", ...summary });
    }
    const summary = await runWireMonitor();
    console.log("[wire:monitor]", JSON.stringify(summary));
    if (summary.items > 0 || summary.stories > 0) revalidateTag("wire", { expire: 0 });
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[wire/monitor]", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
