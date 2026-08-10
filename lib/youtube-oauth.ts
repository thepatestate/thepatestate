// OAuth plumbing for the channel connection (official captions pipeline).
// The refresh token lives in Supabase's private_oauth table (service-role
// only); access tokens are minted on demand and cached in-memory. The token
// belongs to the.pate.state@gmail.com's grant on the @JoshPateCFB channel —
// the callback route refuses to store a grant from any other channel.
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const CHANNEL_ID = "UCg-q_MDeWQrjizr1VPLEpYg";
const TOKEN_ROW_ID = "youtube-channel";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function oauthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

export async function storeRefreshToken(refreshToken: string): Promise<boolean> {
  if (!isAdminConfigured) return false;
  const { error } = await createAdminClient()
    .from("private_oauth")
    .upsert({ id: TOKEN_ROW_ID, refresh_token: refreshToken, updated_at: new Date().toISOString() });
  if (error) console.error("[youtube-oauth:store]", error.message);
  return !error;
}

let cached: { token: string; expiresAt: number } | null = null;

/** Access token for the channel grant, or null when not yet connected.
 * Fail-soft: callers fall back to the scraping transcript path. */
export async function getChannelAccessToken(): Promise<string | null> {
  if (!oauthConfigured() || !isAdminConfigured) return null;
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  try {
    const { data } = await createAdminClient()
      .from("private_oauth")
      .select("refresh_token")
      .eq("id", TOKEN_ROW_ID)
      .maybeSingle();
    const refreshToken = data?.refresh_token as string | undefined;
    if (!refreshToken) return null;
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[youtube-oauth:refresh]", res.status, await res.text());
      return null;
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;
    cached = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
    return cached.token;
  } catch (err) {
    console.error("[youtube-oauth:refresh]", err);
    return null;
  }
}

/** Exchanges an authorization code (callback route only). */
export async function exchangeCode(code: string, redirectUri: string): Promise<{ accessToken: string; refreshToken?: string } | null> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("[youtube-oauth:exchange]", res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as { access_token?: string; refresh_token?: string };
  if (!json.access_token) return null;
  return { accessToken: json.access_token, refreshToken: json.refresh_token };
}

/** The channel id the given access token controls (channels.list mine=true). */
export async function tokenChannelId(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id&mine=true", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { items?: { id: string }[] };
    return json.items?.[0]?.id ?? null;
  } catch {
    return null;
  }
}
