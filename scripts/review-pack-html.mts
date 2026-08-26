// Renders a review-pack JSON (scripts/review-pack.mts) as one self-contained
// review page: docs/review/<name>.html. Design per prompts/kit/08 tokens.
// Run:  npx tsx scripts/review-pack-html.mts <pack.json> <out.html>
import { readFileSync, writeFileSync } from "node:fs";

const [,, inPath, outPath] = process.argv;
const pack = JSON.parse(readFileSync(inPath, "utf8")) as Record<string, any>[];

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const wc = (s: string) => String(s ?? "").split(/\s+/).filter(Boolean).length;
const ts = (t: string) => { const p = t.split(":").map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + (p[1] ?? 0); };

function inline(s: string) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
function md(body: string, ytId?: string, pullQuote?: string): string {
  const out: string[] = [];
  const blocks = body.replace(/\r/g, "").split(/\n{2,}/);
  for (const raw of blocks) {
    const b = raw.trim();
    if (!b) continue;
    const q = b.match(/^\[QUOTE:([\d:]+)\]([\s\S]*?)\[\/QUOTE\]$/);
    if (q) {
      const href = ytId ? `https://www.youtube.com/watch?v=${ytId}&t=${ts(q[1])}s` : "";
      out.push(`<blockquote class="q"><p>${esc(q[2].trim())}</p><cite>Josh Pate on the show${href ? ` · <a href="${href}">${esc(q[1])} ▶</a>` : ` · ${esc(q[1])}`}</cite></blockquote>`);
      continue;
    }
    if (/^\[PULLQUOTE\]$/.test(b)) { if (pullQuote) out.push(`<aside class="pull"><p>${esc(pullQuote)}</p></aside>`); continue; }
    const e = b.match(/^\[EMBED:([\d:]+)\]$/);
    if (e) { const href = ytId ? `https://www.youtube.com/watch?v=${ytId}&t=${ts(e[1])}s` : ""; out.push(`<p class="embed">▶ Watch the segment${href ? ` · <a href="${href}">${esc(e[1])}</a>` : ` · ${esc(e[1])}`}</p>`); continue; }
    if (b.startsWith("## ")) { out.push(`<h3>${inline(b.slice(3))}</h3>`); continue; }
    // inline markers inside a paragraph
    const cleaned = b.replace(/\[EMBED:[\d:]+\]/g, "").replace(/\[PULLQUOTE\]/g, "").trim();
    if (cleaned) out.push(`<p>${inline(cleaned).replace(/\n/g, "<br>")}</p>`);
  }
  return out.join("\n");
}

const LANE = { wire: { name: "The Wire", cls: "wire" }, house: { name: "House analysis", cls: "house" }, show: { name: "Show-derived column", cls: "show" } } as const;
const NOTES: Record<string, string> = {
  wire: "Wire dial (~50% porch): the news itself in the lede, official source or named reporter, no outlet in the upper page. Locked plain module titles. No first person, no predictions, no grades. The Read is house analysis; the receipt is Josh's only voice.",
  house: "Autonomous lane, staff byline, first person dialed to zero. Descriptive title (claim, claim, claim). Claim inside 150 words, mechanism over adjective, a test close with a date, one flywheel action.",
  show: "Josh's argument reported by the house: third person, 2–4 verbatim timestamped quote blocks, his byline never auto-applied (Constitution §3). Facts only from the tape.",
};

function wireBody(p: Record<string, any>): string {
  const sec = (title: string, body?: string, cls = "") => body ? `<h3>${esc(title)}</h3>${cls ? `<div class="${cls}">` : ""}<p>${inline(body)}</p>${cls ? "</div>" : ""}` : "";
  const stats = (p.stats ?? []).filter((s: any) => s.value && s.label);
  const board = p.board?.rows?.length ? `<div class="board"><b>${esc(p.board.title || "The Replacement Board")}</b><span class="lbl">Pate State projection, not a depth chart</span>${p.board.rows.map((r: any) => `<div class="row"><span><b>${esc(r.name)}</b> <small>${esc(r.meta)}</small></span><span>${esc(r.note)}</span></div>`).join("")}${p.board.summary ? `<p class="tell"><b>The tell:</b> ${esc(p.board.summary)}</p>` : ""}</div>` : "";
  const watching = (p.watching ?? []).filter((w: any) => w.title);
  return [
    stats.length ? `<div class="nums">${stats.map((s: any) => `<div class="num${s.critical ? " crit" : ""}"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join("")}</div>` : "",
    sec("What Happened", p.whatHappened),
    sec("Why This One Matters", p.whyBody),
    sec("What Most People Are Missing", p.missing, "missing"),
    p.callout ? `<aside class="pull"><p>${esc(p.callout)}</p></aside>` : "",
    sec(p.section04Title || "What Changes Now", p.section04Body),
    board,
    sec("The Chessboard", p.chessboard, "chess"),
    p.joshReceipt?.quote ? `<blockquote class="q receipt"><span class="lbl">On the record · Josh's receipt</span><p>${esc(p.joshReceipt.quote)}</p><cite>Josh Pate${p.joshReceipt.ytId ? ` · <a href="https://www.youtube.com/watch?v=${p.joshReceipt.ytId}&t=${p.joshReceipt.tsSeconds ?? 0}s">watch the moment ▶</a>` : ""}</cite></blockquote>` : "",
    p.readBody ? `<h3>The Pate State Read <span class="lbl">${esc(p.readLabel ?? "")}</span></h3><div class="read"><p>${inline(p.readBody)}</p></div>` : "",
    watching.length ? `<h3>What to Watch Next</h3><ol class="watch">${watching.map((w: any) => `<li><b>${esc(w.title)}</b>${w.body ? ` ${esc(w.body)}` : ""}</li>`).join("")}</ol>` : "",
    `<p class="src">Sourcing: ${(p.sources ?? []).map((s: any) => s.url ? `<a href="${esc(s.url)}">${esc(s.outlet)}</a>` : esc(s.outlet)).join(" · ")}</p>`,
  ].join("\n");
}

const pieces = pack.map((p, i) => {
  const lane = LANE[p.lane as keyof typeof LANE];
  const n = i + 1;
  const body = p.lane === "wire" ? wireBody(p) : md(p.bodyMarkdown, p.ytId, p.pullQuote);
  const words = p.lane === "wire" ? wc([p.deck, p.whatHappened, p.whyBody, p.missing, p.section04Body, p.chessboard, p.readBody].join(" ")) : wc(p.bodyMarkdown);
  const meta = p.lane === "wire"
    ? `Category · ${esc(p.category ?? "general")} · Status · ${esc(p.verification)} · Impact · ${esc(p.impact)}${p.impactRationale ? ` (${esc(p.impactRationale)})` : ""}`
    : p.lane === "show" ? `Episode · ${esc(p.episode)} · Series · ${esc(p.series)}` : `Type · ${esc(p.typeId)} · ${esc(p.topic)} · Architecture · ${esc(p.archKey)}`;
  const byline = p.lane === "wire" ? "The Pate State Wire Desk" : "The Pate State Staff";
  const gates = p.lane === "wire" ? "passed every gate: attribution, source narration, first person, language law, second-model fact-check, quality judge" : (Array.isArray(p.gates) && p.gates.length === 0 ? "passed every gate: language law, verbatim quotes, fact-check" : `language-law flags: ${(p.gates ?? []).join(", ")}`);
  return `
<article id="p${n}" class="piece ${lane.cls}">
  <header>
    <div class="kick"><span class="lane">${lane.name}</span><span class="n">${n} of ${pack.length}</span></div>
    <h2>${esc(p.headline)}</h2>
    ${p.dek || p.deck ? `<p class="dek">${esc(p.dek ?? p.deck)}</p>` : ""}
    <p class="by">${byline} · ${words} words · ${esc(meta)}</p>
  </header>
  <div class="body">${body}</div>
  <aside class="review">
    <b>For the review</b>
    <p>${esc(NOTES[p.lane])}</p>
    <p class="gate">Drafted live through the pipeline in ${p.seconds}s; ${gates}. Not published.</p>
  </aside>
</article>`;
}).join("\n");

const toc = pack.map((p, i) => `<li><a href="#p${i + 1}"><span class="dot ${LANE[p.lane as keyof typeof LANE].cls}"></span><span>${esc(p.headline)}</span></a></li>`).join("");
const counts = { wire: pack.filter((p) => p.lane === "wire").length, house: pack.filter((p) => p.lane === "house").length, show: pack.filter((p) => p.lane === "show").length };

const html = `<title>Kit Review Pack</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Public+Sans:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{--navy:#0E2240;--navy-deep:#0A1730;--gold:#C9A227;--gold-dk:#A8861B;--red:#C8102E;--ink:#151A22;--ink-dim:#4C5361;--paper:#FBF9F4;--card:#FFFFFF;--rule:#D9D3C4;--wash:#F1EDE2;--display:"Barlow Condensed",Impact,"Arial Narrow",sans-serif;--body:"Public Sans",system-ui,Helvetica,Arial,sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--paper:#0B1628;--card:#10203A;--ink:#EDE9DF;--ink-dim:#A9B1C2;--rule:#2A3A57;--wash:#16284A;--navy:#EDE9DF;--navy-deep:#F6F3EA;--gold:#D9B64A;--gold-dk:#C9A227}}
:root[data-theme="dark"]{--paper:#0B1628;--card:#10203A;--ink:#EDE9DF;--ink-dim:#A9B1C2;--rule:#2A3A57;--wash:#16284A;--navy:#EDE9DF;--navy-deep:#F6F3EA;--gold:#D9B64A;--gold-dk:#C9A227}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--body);font-size:17px;line-height:1.6}
a{color:var(--gold-dk)}
.wrap{max-width:1180px;margin:0 auto;padding:40px 24px 80px;display:grid;grid-template-columns:260px minmax(0,1fr);gap:48px}
@media (max-width:900px){.wrap{grid-template-columns:1fr;gap:24px}}
.rail{position:sticky;top:24px;align-self:start;font-size:13px}
@media (max-width:900px){.rail{position:static}}
.rail h1{font-family:var(--display);font-weight:800;font-size:38px;line-height:.95;text-transform:uppercase;margin:0 0 6px;color:var(--navy);text-wrap:balance}
.rail .sub{font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-dim);margin:0 0 18px}
.rail ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.rail li a{display:flex;gap:8px;align-items:flex-start;color:var(--ink);text-decoration:none;line-height:1.35}
.rail li a:hover span:last-child{text-decoration:underline}
.dot{flex:0 0 8px;width:8px;height:8px;border-radius:50%;margin-top:6px;background:var(--gold)}
.dot.house{background:var(--navy)}.dot.show{background:var(--red)}
.legend{margin:18px 0 0;padding:14px 0 0;border-top:1px solid var(--rule);font-family:var(--mono);font-size:11px;color:var(--ink-dim);display:flex;flex-direction:column;gap:6px}
.legend span{display:flex;gap:8px;align-items:center}
.intro{max-width:68ch;margin-bottom:36px}
.intro h2{font-family:var(--display);font-size:30px;font-weight:700;text-transform:uppercase;margin:0 0 8px;color:var(--navy)}
.intro p{margin:0 0 10px;color:var(--ink)}
.piece{background:var(--card);border:1px solid var(--rule);border-left:6px solid var(--gold);padding:28px 32px 24px;margin-bottom:36px;max-width:76ch}
.piece.house{border-left-color:var(--navy)}.piece.show{border-left-color:var(--red)}
.kick{display:flex;justify-content:space-between;font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-dim);margin-bottom:10px}
.kick .lane{color:var(--gold-dk);font-weight:500}.house .kick .lane{color:var(--navy)}.show .kick .lane{color:var(--red)}
.piece h2{font-family:var(--display);font-weight:800;font-size:34px;line-height:1.02;margin:0 0 10px;color:var(--navy);text-wrap:balance}
.dek{font-size:18px;line-height:1.5;margin:0 0 8px;color:var(--ink)}
.by{font-family:var(--mono);font-size:11.5px;color:var(--ink-dim);margin:0 0 18px;padding-bottom:14px;border-bottom:1px solid var(--rule)}
.body{max-width:68ch}
.body h3{font-family:var(--display);font-weight:700;font-size:22px;text-transform:uppercase;letter-spacing:.02em;margin:26px 0 8px;color:var(--navy);display:flex;gap:10px;align-items:baseline}
.body p{margin:0 0 14px}
.lbl{font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-dim);font-weight:400}
.nums{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:0 0 6px}
.num{background:var(--wash);padding:12px 14px;border-radius:2px}
.num b{font-family:var(--display);font-size:34px;line-height:1;color:var(--navy);display:block}
.num.crit b{color:var(--red)}
.num span{font-size:12.5px;color:var(--ink-dim);display:block;margin-top:4px;line-height:1.35}
.missing,.chess,.read{background:var(--wash);padding:14px 18px;border-radius:2px;margin-bottom:14px}
.missing p,.chess p,.read p{margin:0}
.pull{border-top:2px solid var(--gold);border-bottom:2px solid var(--gold);padding:14px 4px;margin:18px 0}
.pull p{font-family:var(--display);font-size:24px;line-height:1.15;font-weight:600;color:var(--navy);margin:0}
blockquote.q{margin:16px 0;padding:14px 18px;border-left:3px solid var(--red);background:var(--wash)}
blockquote.q p{margin:0 0 6px;font-style:italic}
blockquote.q cite{font-family:var(--mono);font-size:11px;font-style:normal;color:var(--ink-dim)}
blockquote.receipt{border-left-color:var(--gold)}
.board{border:1px solid var(--rule);padding:12px 16px;margin:0 0 16px}
.board .row{display:grid;grid-template-columns:1fr 1.4fr;gap:12px;padding:8px 0;border-top:1px solid var(--rule);font-size:15px}
.board small{color:var(--ink-dim);display:block;font-family:var(--mono);font-size:11px}
.board .tell{margin:10px 0 0;font-size:15px}
ol.watch{padding-left:20px;margin:0 0 14px}ol.watch li{margin-bottom:8px}
.embed{font-family:var(--mono);font-size:12px;color:var(--ink-dim)}
.src{font-family:var(--mono);font-size:11.5px;color:var(--ink-dim);border-top:1px solid var(--rule);padding-top:12px;margin-top:20px}
.review{margin-top:22px;background:var(--wash);padding:14px 18px;font-size:14px;border-radius:2px}
.review b{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-dim);display:block;margin-bottom:6px}
.review p{margin:0 0 6px}.review .gate{font-family:var(--mono);font-size:11.5px;color:var(--ink-dim);margin:0}
:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
</style>
<div class="wrap">
  <nav class="rail" aria-label="Contents">
    <h1>Kit Review Pack</h1>
    <p class="sub">Writing system v1.0 · drafted ${new Date().toISOString().slice(0, 10)}</p>
    <ol>${toc}</ol>
    <div class="legend"><span><i class="dot"></i>The Wire · ${counts.wire}</span><span><i class="dot house"></i>House analysis · ${counts.house}</span><span><i class="dot show"></i>Show-derived · ${counts.show}</span></div>
  </nav>
  <main>
    <section class="intro">
      <h2>Twelve pieces, written under the kit</h2>
      <p>Every piece below came out of the live pipeline on ${new Date().toISOString().slice(0, 10)} with the writing system you sent (Constitution, Voice Bible v3.5, the Wire and Features specs) as the only instruction set, and passed every automated gate: the language law, no outlet in the upper page, no first person outside quote blocks, verbatim quotes checked against the tape, a second-model fact-check against the sources, and the quality judge. Nothing here is published. The sources are real recent news and real episodes.</p>
      <p>What would help most: mark the sentences that still read generated, the module or structure you would cut, and anywhere the dial is wrong for the lane. A correction becomes a rule in the one kit file that owns it.</p>
    </section>
    ${pieces}
  </main>
</div>
`;
writeFileSync(outPath, html);
console.log(`wrote ${outPath} (${pack.length} pieces, ${Math.round(html.length / 1024)} KB)`);
