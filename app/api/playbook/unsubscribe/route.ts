import { verifyUid, hasSigningKey } from "@/lib/playbook";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const COLOR_BG = "#FDFCF8";
const COLOR_NAVY = "#0F1B2D";
const COLOR_LAMP = "#E8A33D";

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function pageShell(title: string, heading: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title} — The Pate State</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${COLOR_BG}; font-family: Georgia, 'Times New Roman', serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${COLOR_BG};">
<tr><td align="center" style="padding: 64px 16px;">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="width: 480px; max-width: 100%; text-align: center;">
<tr><td style="padding-bottom: 8px; font-family: 'Courier New', Courier, monospace; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: ${COLOR_LAMP}; font-weight: bold;">The Pate Playbook</td></tr>
<tr><td style="padding-bottom: 16px; color: ${COLOR_NAVY}; font-size: 22px; font-weight: bold;">${heading}</td></tr>
<tr><td style="color: ${COLOR_NAVY}; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6;">${body}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function confirmPage(uid: string, sig: string): string {
  const body =
    `Click below and we'll take you off the Playbook list.` +
    `<form method="POST" action="/api/playbook/unsubscribe" style="margin: 20px 0 0 0;">` +
    `<input type="hidden" name="uid" value="${escapeAttr(uid)}" />` +
    `<input type="hidden" name="sig" value="${escapeAttr(sig)}" />` +
    `<button type="submit" style="background-color: ${COLOR_LAMP}; color: ${COLOR_BG}; border: 0; border-radius: 4px; ` +
    `padding: 12px 24px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: bold; cursor: pointer;">` +
    `Take me off the list</button>` +
    `</form>`;
  return pageShell("Unsubscribe", "Sure you want off the Quad?", body);
}

function failurePage(): string {
  return pageShell(
    "Unsubscribe error",
    "That didn't go through on our end.",
    `Try the link once more, or email <a href="mailto:porch@thepatestate.com" style="color: ${COLOR_LAMP};">porch@thepatestate.com</a> and we'll take you off by hand.`
  );
}

function notReadyPage(): string {
  return pageShell(
    "Unsubscribe unavailable",
    "This link isn't working right now.",
    `Email <a href="mailto:porch@thepatestate.com" style="color: ${COLOR_LAMP};">porch@thepatestate.com</a> and we'll take you off by hand.`
  );
}

// GET only verifies the signature and renders a confirm page — it never
// mutates. The actual opt-out happens on POST (see below), so a link scanner
// or email-client prefetch hitting GET can't silently unsubscribe someone.
export async function GET(request: Request) {
  if (!hasSigningKey()) {
    console.error("[playbook] PLAYBOOK_SIGNING_KEY not configured");
    return new Response(notReadyPage(), { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const url = new URL(request.url);
  const uid = url.searchParams.get("uid");
  const sig = url.searchParams.get("sig");

  if (!uid || !sig || !verifyUid(uid, sig)) {
    // Reuse the failure-page style/copy — a branded page instead of bare text.
    return new Response(failurePage(), { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  return new Response(confirmPage(uid, sig), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function readParams(request: Request): Promise<{ uid: string | null; sig: string | null }> {
  const url = new URL(request.url);
  let uid = url.searchParams.get("uid");
  let sig = url.searchParams.get("sig");
  if (uid && sig) return { uid, sig };

  // Mail-client one-click POSTs (RFC 8058) carry no useful body, but our own
  // confirm-page form posts uid/sig as form fields — read those as a fallback.
  try {
    const form = await request.formData();
    uid = uid ?? (form.get("uid") as string | null);
    sig = sig ?? (form.get("sig") as string | null);
  } catch {
    // no parseable body — fall through with whatever we already have
  }
  return { uid, sig };
}

// POST performs the actual opt-out. This is the RFC 8058 one-click target
// (mail clients POST here directly using the List-Unsubscribe-Post header)
// and is also what the GET confirm page's form submits to.
export async function POST(request: Request) {
  if (!hasSigningKey()) {
    console.error("[playbook] PLAYBOOK_SIGNING_KEY not configured");
    return new Response(notReadyPage(), { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const { uid, sig } = await readParams(request);

  if (!uid || !sig || !verifyUid(uid, sig)) {
    return new Response("bad request", { status: 400, headers: { "Content-Type": "text/plain" } });
  }

  if (!isAdminConfigured) {
    console.error("[playbook] admin client not configured");
    return new Response("service unavailable", { status: 503, headers: { "Content-Type": "text/plain" } });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("citizens").update({ playbook_opt_out: true }).eq("id", uid);
    if (error) {
      console.error("[playbook] unsubscribe update failed", error);
      return new Response("error", { status: 500, headers: { "Content-Type": "text/plain" } });
    }
  } catch (err) {
    console.error("[playbook] unsubscribe update failed", err);
    return new Response("error", { status: 500, headers: { "Content-Type": "text/plain" } });
  }

  return new Response("ok", { status: 200, headers: { "Content-Type": "text/plain" } });
}
