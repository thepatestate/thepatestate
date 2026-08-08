import { SITE_URL } from "@/lib/site";

/** Reduce an untrusted `next` value to a safe same-site path. Returns "/" for anything else. */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  let candidate = raw;
  // Accept same-origin absolute URLs (e.g. Supabase's {{ .RedirectTo }} substitution) and reduce them.
  try {
    if (/^https?:\/\//i.test(candidate)) {
      const u = new URL(candidate);
      const site = new URL(SITE_URL);
      const allowedHosts = new Set([site.host, "thepatestate.vercel.app", "localhost:3000"]);
      if (!allowedHosts.has(u.host)) return "/";
      // Unwrap a nested ?next= if the URL points at the auth callback
      const nested = u.searchParams.get("next");
      if (u.pathname === "/auth/callback" && nested) return safeNextPath(nested);
      candidate = u.pathname + u.search;
    }
  } catch {
    return "/";
  }
  if (!candidate.startsWith("/")) return "/";
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) return "/";
  return candidate;
}
