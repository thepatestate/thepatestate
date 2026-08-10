import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/site";
import { CHANNEL_ID, exchangeCode, storeRefreshToken, tokenChannelId } from "@/lib/youtube-oauth";

function page(title: string, body: string, ok: boolean) {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>${title}</title>
     <body style="font-family:Georgia,serif;max-width:520px;margin:80px auto;text-align:center;color:#1C222B">
     <h1 style="color:${ok ? "#1E3B2E" : "#7A1E2B"}">${title}</h1><p style="font-size:17px;line-height:1.6">${body}</p>
     <p><a href="/" style="color:#B8842C">← thepatestate.com</a></p></body>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" }, status: ok ? 200 : 403 },
  );
}

// OAuth callback: exchanges the code, then verifies the granting account
// actually controls the @JoshPateCFB channel before storing anything — a
// grant from any other Google account is discarded.
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("error")) {
    return page("Connection cancelled", "No changes were made. Run the connection link again when ready.", false);
  }
  const code = url.searchParams.get("code");
  if (!code) return page("Missing code", "Google didn't return an authorization code.", false);

  const tokens = await exchangeCode(code, `${SITE_URL}/api/youtube/oauth/callback`);
  if (!tokens) return page("Exchange failed", "Google rejected the code exchange — try the link again.", false);

  const channel = await tokenChannelId(tokens.accessToken);
  if (channel !== CHANNEL_ID) {
    return page(
      "Wrong account",
      "That Google account doesn't control Josh Pate's College Football Show. Sign in as the.pate.state@gmail.com (with channel access accepted) and try again. Nothing was stored.",
      false,
    );
  }
  if (!tokens.refreshToken) {
    return page("No refresh token", "Google didn't issue a long-lived token — try the link once more (it forces a fresh consent).", false);
  }
  const stored = await storeRefreshToken(tokens.refreshToken);
  if (!stored) return page("Storage failed", "Token verified but couldn't be saved — check server logs.", false);

  return page(
    "✓ Channel connected",
    "The Pate State can now read the show's official captions. The transcript pipeline switches over automatically — you're done here, forever.",
    true,
  );
}
