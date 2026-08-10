import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/site";
import { oauthConfigured } from "@/lib/youtube-oauth";

// Kicks off the one-time channel-connection consent. Safe to be public: the
// callback only stores a grant that provably controls @JoshPateCFB, so a
// stranger completing this flow with their own account changes nothing.
export function GET() {
  if (!oauthConfigured()) {
    return NextResponse.json({ error: "oauth not configured" }, { status: 500 });
  }
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: `${SITE_URL}/api/youtube/oauth/callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/youtube.force-ssl",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
