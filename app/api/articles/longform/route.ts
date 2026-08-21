import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { requireCronSecret } from "@/lib/cron-auth";
import { generateLongformArticle } from "@/lib/longform";

export const maxDuration = 300;

// Daily long-form pipeline (Josh, 2026-08-21: 1–2 standalone articles/day).
// Cron hits this twice daily; each invocation produces at most one article.
export async function POST(request: Request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  const result = await generateLongformArticle();
  console.log("[longform]", result);
  if (result.startsWith("ok:")) {
    revalidateTag("articles", { expire: 0 });
    revalidatePath("/notebook");
    revalidatePath("/");
  }
  return NextResponse.json({ ok: result.startsWith("ok:"), result });
}
