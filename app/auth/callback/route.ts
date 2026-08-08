import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/next-path";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  if (!isSupabaseConfigured) return NextResponse.redirect(`${origin}/join`);

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));

  if (searchParams.get("error") && !code && !tokenHash) {
    return NextResponse.redirect(`${origin}/join?error=oauth`);
  }

  const supabase = await createClient();
  let authed = false;

  if (code) {
    authed = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    authed = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }

  if (!authed) return NextResponse.redirect(`${origin}/join?error=expired`);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/join?error=expired`);

  const { data: citizen } = await supabase
    .from("citizens")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.redirect(
    `${origin}${citizen ? next : `/welcome?next=${encodeURIComponent(next)}`}`
  );
}
