import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { writeClient, isSanityWriteConfigured } from "@/lib/sanity";

export async function POST(request: Request) {
  const secret = request.headers.get("x-revalidate-secret");
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    if (isSanityWriteConfigured) {
      // Promote approved -> published (sets publishedAt once)
      const approved = await writeClient.fetch<Array<{ _id: string }>>(
        `*[_type == "article" && workflowState == "approved"]{ _id }`,
        {}
      );
      for (const a of approved) {
        await writeClient
          .patch(a._id)
          .set({ workflowState: "published", publishedAt: new Date().toISOString() })
          .commit();
      }
    }
    // Next 16's revalidateTag requires a cacheLife profile (2nd arg); { expire: 0 }
    // forces immediate expiration, matching the brief's intended "revalidate now"
    // semantics of the old single-argument signature.
    revalidateTag("articles", { expire: 0 });
    revalidatePath("/notebook");
    revalidatePath("/");
    revalidatePath("/sitemap.xml");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[revalidate]", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
