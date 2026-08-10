import { NextResponse } from "next/server";
import { getTeamDirectory } from "@/lib/cfbd";

// Public, cacheable slim team directory — client components (MyTeams chip
// row) resolve slugs to school/abbrev/logo/color here so the homepage can
// stay statically rendered while personalization happens in the browser.
export const revalidate = 86400;

export async function GET() {
  const dir = await getTeamDirectory();
  return NextResponse.json(dir, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" },
  });
}
