import { verifyUid } from "@/lib/playbook";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const COLOR_BG = "#FDFCF8";
const COLOR_NAVY = "#0F1B2D";
const COLOR_LAMP = "#E8A33D";

function confirmationPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Unsubscribed — The Pate State</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${COLOR_BG}; font-family: Georgia, 'Times New Roman', serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${COLOR_BG};">
<tr><td align="center" style="padding: 64px 16px;">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="width: 480px; max-width: 100%; text-align: center;">
<tr><td style="padding-bottom: 8px; font-family: 'Courier New', Courier, monospace; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: ${COLOR_LAMP}; font-weight: bold;">The Pate Playbook</td></tr>
<tr><td style="padding-bottom: 16px; color: ${COLOR_NAVY}; font-size: 22px; font-weight: bold;">You're off the Playbook list.</td></tr>
<tr><td style="color: ${COLOR_NAVY}; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6;">The porch light stays on — resubscribe anytime by asking at <a href="mailto:porch@thepatestate.com" style="color: ${COLOR_LAMP};">porch@thepatestate.com</a>.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const uid = url.searchParams.get("uid");
  const sig = url.searchParams.get("sig");

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
    if (error) console.error("[playbook] unsubscribe update failed", error);
  } catch (err) {
    console.error("[playbook] unsubscribe failed", err);
  }

  return new Response(confirmationPage(), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
