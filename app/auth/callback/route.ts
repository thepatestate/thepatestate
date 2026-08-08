import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") ? rawNext : "/";

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
  const { data: citizen } = await supabase
    .from("citizens")
    .select("id")
    .eq("id", user!.id)
    .maybeSingle();

  return NextResponse.redirect(
    `${origin}${citizen ? next : `/welcome?next=${encodeURIComponent(next)}`}`
  );
}
