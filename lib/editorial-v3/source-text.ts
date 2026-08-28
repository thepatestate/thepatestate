// A real article extractor. V1's fetchSourceText joins the first twelve
// <p> tags on the page, which on CBS and ESPN is the site navigation ("All
// Sports Menu Sports Watch Fantasy…") or bundled JavaScript — so stories were
// being grounded on chrome. This one prefers the article body itself:
// JSON-LD articleBody → <article> → known body containers → paragraphs that
// read like sentences, with nav/boilerplate filtered out.
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;|&#8217;|&rsquo;/g, "'").replace(/&#8216;|&lsquo;/g, "'").replace(/&#8220;|&ldquo;|&#8221;|&rdquo;/g, '"').replace(/&#8211;|&ndash;/g, "–").replace(/&#8212;|&mdash;/g, "—").replace(/&nbsp;|&#160;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const strip = (html: string) => decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

const NAV = /\b(Menu|Sign In|Subscribe|Newsletter|Privacy|Cookie|Terms of|All Rights Reserved|Fantasy Football Draft Kit|Search Query|Watch Fantasy Betting|Shop Northeast|Explore More|Podcasts Prize|Live Updates Odds Schedule)\b/i;

function sentences(paras: string[]): string[] {
  return paras.map((p) => p.trim()).filter((p) => p.length >= 60 && /[.!?"”]$/.test(p) && p.split(/\s+/).length >= 10 && !NAV.test(p) && (p.match(/[.!?]/g) ?? []).length >= 1);
}

export function extractArticleText(html: string, max = 6000): string {
  // 1. JSON-LD articleBody (news sites commonly ship it)
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (o: unknown): string | null => { if (!o || typeof o !== "object") return null; const r = o as Record<string, unknown>; if (typeof r.articleBody === "string" && r.articleBody.length > 300) return r.articleBody; for (const v of Object.values(r)) { const f = walk(v); if (f) return f; } return null; };
      const body = walk(JSON.parse(m[1]));
      if (body) return decode(body).replace(/\s+/g, " ").trim().slice(0, max);
    } catch { /* not JSON */ }
  }
  // 2. the article element or a known body container
  const containers = [/<article[^>]*>([\s\S]*?)<\/article>/i, /<div[^>]+class="[^"]*(?:article-body|Article__Content|story-body|entry-content|caas-body|article__body|body-content)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i, /<main[^>]*>([\s\S]*?)<\/main>/i];
  for (const re of containers) {
    const m = html.match(re);
    if (!m) continue;
    const inner = m[1] ?? m[2] ?? "";
    const paras = sentences([...inner.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((x) => strip(x[1])));
    if (paras.join(" ").length > 400) return paras.join("\n").slice(0, max);
  }
  // 3. every paragraph on the page that reads like prose
  const paras = sentences([...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((x) => strip(x[1])));
  return paras.join("\n").slice(0, max);
}

export async function fetchArticleText(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 PateStateWire/1.0", accept: "text/html,application/xhtml+xml" }, signal: AbortSignal.timeout(12_000), cache: "no-store" });
    if (!res.ok) return "";
    return extractArticleText(await res.text());
  } catch { return ""; }
}
