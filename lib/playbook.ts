import { createHmac, timingSafeEqual } from "node:crypto";
import { SITE_URL } from "@/lib/site";

// Dedicated signing key for playbook unsubscribe links — deliberately NOT
// CRON_SECRET, so rotating one never invalidates the other's tokens.
const HMAC_KEY = () => process.env.PLAYBOOK_SIGNING_KEY ?? "";

export function hasSigningKey(): boolean {
  return HMAC_KEY().length > 0;
}

export function signUid(uid: string): string {
  const key = HMAC_KEY();
  if (!key) throw new Error("PLAYBOOK_SIGNING_KEY is not set");
  return createHmac("sha256", key).update(uid).digest("hex");
}

export function verifyUid(uid: string, sig: string): boolean {
  const key = HMAC_KEY();
  if (!key) return false;
  const expected = createHmac("sha256", key).update(uid).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const sigBuf = Buffer.from(sig, "hex");
  if (sigBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(sigBuf, expectedBuf);
}

export interface PlaybookContent {
  episode: { ytId: string; title: string; thumbnailUrl?: string } | null;
  articles: Array<{ headline: string; dek?: string; slug: string }>;
}

export interface PlaybookRenderOpts {
  intro: string;
  unsubscribeUrl: string;
}

const COLOR_BG = "#FDFCF8";
const COLOR_NAVY = "#0F1B2D";
const COLOR_LAMP = "#E8A33D";

// Single escaper used everywhere text is interpolated — both text nodes (intro,
// headline, dek, episode title) and double-quoted attribute values (the `alt`
// attribute on the episode thumbnail). Escapes &, <, >, and " so a `"` in
// caller-supplied text (e.g. a YouTube episode title) cannot break out of an
// `alt="..."` attribute and inject markup/attributes.
//
// Apostrophes are intentionally left unescaped: every attribute in this
// template is double-quoted, so a raw `'` can never terminate an attribute
// value here, and escaping it would corrupt copy that callers (and tests)
// compare verbatim — e.g. the intro "Here's the Quad this morning." must
// appear byte-for-byte in the rendered HTML.
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// URLs used in href/src attributes are mostly internally constructed (SITE_URL,
// known YouTube hosts), but thumbnailUrl comes from Sanity/YouTube metadata and
// unsubscribeUrl is caller-supplied, so both are run through escapeHtml at their
// interpolation sites too — escapeHtml is attribute-safe (see above) and applying
// it here as well means a stray `"` in either can't break out of its attribute.

function watchUrl(ytId: string): string {
  return `https://www.youtube.com/watch?v=${ytId}`;
}

function articleUrl(slug: string): string {
  return `${SITE_URL}/notebook/${slug}`;
}

const KICKER_STYLE =
  `font-family: 'Courier New', Courier, monospace; font-size: 12px; letter-spacing: 2px; ` +
  `text-transform: uppercase; color: ${COLOR_LAMP}; font-weight: bold;`;

const HEADING_STYLE = `color: ${COLOR_NAVY}; font-family: Georgia, 'Times New Roman', serif; margin: 0 0 8px 0;`;

const BODY_TEXT_STYLE = `color: ${COLOR_NAVY}; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6;`;

function buttonHtml(url: string, label: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td style="border-radius: 4px; background-color: ${COLOR_LAMP};">` +
    `<a href="${url}" style="display: inline-block; padding: 12px 24px; font-family: Arial, Helvetica, sans-serif; ` +
    `font-size: 14px; font-weight: bold; color: ${COLOR_BG}; text-decoration: none;" target="_blank" rel="noopener">${escapeHtml(label)}</a>` +
    `</td></tr></table>`
  );
}

function episodeCardHtml(episode: PlaybookContent["episode"]): string {
  if (!episode) return "";
  const url = watchUrl(episode.ytId);
  const thumb = episode.thumbnailUrl
    ? `<tr><td style="padding: 0 0 16px 0;">` +
      `<a href="${url}" target="_blank" rel="noopener">` +
      `<img src="${escapeHtml(episode.thumbnailUrl)}" alt="${escapeHtml(episode.title)}" width="560" ` +
      `style="display: block; width: 100%; max-width: 560px; height: auto; border: 0; border-radius: 6px;" /></a>` +
      `</td></tr>`
    : "";
  return (
    `<tr><td style="padding: 24px 32px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
    `<tr><td style="${KICKER_STYLE} padding: 0 0 8px 0;">This Week's Episode</td></tr>` +
    thumb +
    `<tr><td style="padding: 0 0 16px 0;"><h2 style="${HEADING_STYLE} font-size: 20px;">${escapeHtml(episode.title)}</h2></td></tr>` +
    `<tr><td>${buttonHtml(url, "Watch on YouTube")}</td></tr>` +
    `</table>` +
    `</td></tr>`
  );
}

function articlesHtml(articles: PlaybookContent["articles"]): string {
  if (articles.length === 0) return "";
  const rows = articles
    .map((a) => {
      const dek = a.dek ? `<p style="${BODY_TEXT_STYLE} margin: 4px 0 0 0;">${escapeHtml(a.dek)}</p>` : "";
      return (
        `<tr><td style="padding: 0 0 16px 0;">` +
        `<a href="${escapeHtml(articleUrl(a.slug))}" style="color: ${COLOR_NAVY}; font-family: Georgia, 'Times New Roman', serif; ` +
        `font-size: 17px; font-weight: bold; text-decoration: none;">${escapeHtml(a.headline)}</a>` +
        dek +
        `</td></tr>`
      );
    })
    .join("");
  return (
    `<tr><td style="padding: 8px 32px 24px 32px; border-top: 1px solid #E5E1D6;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
    `<tr><td style="${KICKER_STYLE} padding: 16px 0 12px 0;">From the Notebook</td></tr>` +
    rows +
    `</table>` +
    `</td></tr>`
  );
}

export function renderPlaybookHtml(c: PlaybookContent, opts: PlaybookRenderOpts): string {
  const channelUrl = "https://www.youtube.com/@JoshPateCFB";
  const joinUrl = "https://thepatestate.com/join";
  // Postal address is provided by the owner (CAN-SPAM); omitted until then —
  // the list is small enough that this is not yet a compliance requirement.
  const postalAddressLine = process.env.PLAYBOOK_POSTAL_ADDRESS;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>The Playbook — The Pate State</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${COLOR_BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${COLOR_BG};">
<tr><td align="center" style="padding: 24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 600px; max-width: 100%; background-color: #FFFFFF; border-radius: 6px; overflow: hidden;">
<tr><td style="padding: 24px 32px 8px 32px; background-color: ${COLOR_NAVY};">
<div style="${KICKER_STYLE} color: ${COLOR_LAMP};">The Pate Playbook</div>
</td></tr>
<tr><td style="padding: 16px 32px 0 32px;">
<p style="${BODY_TEXT_STYLE}">${escapeHtml(opts.intro)}</p>
</td></tr>
${episodeCardHtml(c.episode)}
${articlesHtml(c.articles)}
<tr><td style="padding: 8px 32px 32px 32px;">
<p style="${BODY_TEXT_STYLE} margin: 0 0 12px 0;">Catch every episode on <a href="${channelUrl}" style="color: ${COLOR_LAMP}; text-decoration: underline;">YouTube</a>, or grab a spot on the Quad as a Citizen at <a href="${joinUrl}" style="color: ${COLOR_LAMP}; text-decoration: underline;">thepatestate.com/join</a>.</p>
</td></tr>
<tr><td style="padding: 20px 32px; background-color: ${COLOR_NAVY};">
<p style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.6; color: #9AA5B1; margin: 0 0 8px 0;">College Football's Common Ground</p>
<p style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.6; color: #9AA5B1; margin: 0;">
<a href="${escapeHtml(opts.unsubscribeUrl)}" style="color: #9AA5B1; text-decoration: underline;">Unsubscribe from the Playbook</a>
</p>
${postalAddressLine ? `<p style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.6; color: #9AA5B1; margin: 8px 0 0 0;">${escapeHtml(postalAddressLine)}</p>` : ""}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function renderPlaybookText(c: PlaybookContent, opts: PlaybookRenderOpts): string {
  const channelUrl = "https://www.youtube.com/@JoshPateCFB";
  const joinUrl = "https://thepatestate.com/join";
  const lines: string[] = [];
  lines.push("THE PATE PLAYBOOK");
  lines.push("");
  lines.push(opts.intro);
  lines.push("");
  if (c.episode) {
    lines.push("THIS WEEK'S EPISODE");
    lines.push(c.episode.title);
    lines.push(`Watch on YouTube: ${watchUrl(c.episode.ytId)}`);
    lines.push("");
  }
  if (c.articles.length > 0) {
    lines.push("FROM THE NOTEBOOK");
    for (const a of c.articles) {
      lines.push(a.headline);
      if (a.dek) lines.push(a.dek);
      lines.push(articleUrl(a.slug));
      lines.push("");
    }
  }
  lines.push(`Catch every episode on YouTube: ${channelUrl}`);
  lines.push(`Grab a spot on the Quad as a Citizen: ${joinUrl}`);
  lines.push("");
  lines.push("College Football's Common Ground");
  lines.push(`Unsubscribe from the Playbook: ${opts.unsubscribeUrl}`);
  if (process.env.PLAYBOOK_POSTAL_ADDRESS) {
    lines.push(process.env.PLAYBOOK_POSTAL_ADDRESS);
  }
  return lines.join("\n");
}
