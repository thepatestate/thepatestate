import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireCronSecret } from "@/lib/cron-auth";
import { runWireMonitor } from "@/lib/wire";

export const maxDuration = 300;

export async function POST(request: Request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  try {
    const summary = await runWireMonitor();
  console.log("[wire:monitor]", JSON.stringify(summary));
    if (summary.items > 0 || summary.stories > 0) revalidateTag("wire", { expire: 0 });
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[wire/monitor]", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
