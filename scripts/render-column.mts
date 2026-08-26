// Renders one Josh's Read column JSON into the approved Three Boards chrome
// (kit 08-design-system §1: copy the chrome, swap the article).
// Run:  npx tsx scripts/render-column.mts <piece.json> <out.html>
import { readFileSync, writeFileSync } from "node:fs";
const [,, inPath, outPath] = process.argv;
const a = (JSON.parse(readFileSync(inPath, "utf8")) as Record<string, any>[])[0];
const t = readFileSync("docs/reference-builds/feature-three-boards-josh.html", "utf8");
const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const ts = (s: string) => { const p = s.split(":").map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + (p[1] ?? 0); };
const yt = a.ytId as string | undefined;
const body: string[] = [];
for (const raw of String(a.bodyMarkdown).replace(/\r/g, "").split(/\n{2,}/)) {
  const p = raw.trim(); if (!p) continue;
  const q = p.match(/^\[QUOTE:([\d:]+)\]([\s\S]*?)\[\/QUOTE\]$/);
  if (q) { body.push(`<div class="receipt"><div class="k">On the Show</div><p>"${esc(q[2].trim())}"</p><div class="d">Said on the show at ${q[1].replace(/^0+:?/, "")}${yt ? ` · <a href="https://www.youtube.com/watch?v=${yt}&t=${ts(q[1])}s">watch the segment ▶</a>` : ""}</div></div>`); continue; }
  const e = p.match(/^\[EMBED:([\d:]+)\]$/);
  if (e) { body.push(`<p class="a-cap">▶ ${yt ? `<a href="https://www.youtube.com/watch?v=${yt}&t=${ts(e[1])}s"><b>Watch the segment</b></a>` : "<b>Watch the segment</b>"} · the argument starts at ${e[1].replace(/^0+:?/, "")}</p>`); continue; }
  if (p === "[PULLQUOTE]") { if (a.pullQuote) body.push(`<div class="receipt"><div class="k">The Line Worth Keeping</div><p>"${esc(a.pullQuote)}"</p><div class="d">From this column</div></div>`); continue; }
  if (p.startsWith("## ")) { body.push(`<h2>${esc(p.slice(3))}</h2>`); continue; }
  body.push(`<p>${esc(p).replace(/\*\*/g, "")}</p>`);
}
const words = String(a.bodyMarkdown).split(/\s+/).length;
const teams: string[] = (a.teams ?? []).map((s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()));
const article = `
      <div class="a-crumb"><a href="/notebook">Read</a> / <a href="/notebook">The Notebook</a> / <b>Josh's Read</b></div>
      <div class="a-kick">
        <span class="k">The Notebook · From Josh</span>
        <span class="conf"><i></i>Josh’s Read · Logged to the Ledger</span>
        <span class="s">Preseason · From the Show</span>
      </div>
      <h1 class="a-hl">${esc(a.headline)}</h1>
      <p class="a-dek">${esc(a.dek)}</p>
      <div class="a-by">
        <span class="av" style="background:linear-gradient(135deg,#C8102E,#8C0B20)">JP</span>
        <div class="who"><b>Josh Pate</b><span>Aug 26, 2026 · ${Math.max(2, Math.round(words / 230))} min read · Adapted from the show, every claim on the tape</span></div>
        <div class="a-share"><a href="#" aria-label="Share on X">𝕏</a><a href="#" aria-label="Copy link">🔗</a><a href="#" aria-label="Share">↗</a></div>
      </div>
      <div class="a-hero"><div class="ph"><span class="lbl">Photo Slot — ${esc(teams.slice(0, 3).join(", ") || "The Porch")}</span></div></div>
      <p class="a-cap"><b>${esc(a.headline.split(":")[0])}.</b> <span style="color:#AAB2BD">· Photo credit slot</span></p>
      <div class="a-body">
${body.join("\n")}
        <div class="pulse">
          <div class="k">🗳 Citizen Pulse · One Tap, Citizens Only</div>
          <h3>Do you buy Josh's call here?</h3>
          <div class="p-opts"><button class="p-btn" data-side="yes">Yes — He's Right</button><button class="p-btn" data-side="no">No — He's Wrong</button></div>
          <div class="p-bar"><i id="pulseBar"></i></div>
          <div class="p-lab"><span><b id="yesPct">50%</b> Yes</span><span><b id="noPct">50%</b> No</span></div>
          <p class="ft" id="pulseFoot">The porch opens when this column publishes.</p>
        </div>
      </div>
      <div class="a-pb"><span class="ic">▶</span><div class="tx"><b>This column comes from the show.</b><span>${esc(a.episode ?? "")}</span></div><a href="${yt ? `https://www.youtube.com/watch?v=${yt}` : "#"}">Watch the Episode →</a></div>
      <div class="a-src"><b>On the record:</b> Adapted from Josh's argument on the episode "${esc(a.episode ?? "")}". Every claim in the column is on the tape. <p class="disc">Published under the Josh Pate byline per <a href="/standards">our editorial standards</a>. Corrections are timestamped, never silent.</p></div>
      <div class="a-tags"><a href="#">Josh's Read</a>${teams.map((x) => `<a href="#">${esc(x)}</a>`).join("")}</div>
      <div class="a-author"><span class="av" style="background:linear-gradient(135deg,#C8102E,#8C0B20)">JP</span><div><b>Josh Pate</b><p>The mayor's desk. Every take timestamped, every pick graded, every miss printed first. For those of us who live for Saturdays in the fall.</p></div><a class="fl" href="/notebook">All of Josh's Columns →</a></div>
      <div class="a-porch"><span class="ic">🪑</span><div class="tx"><b>Argue It Out on the Porch</b><span>This column has a live thread</span></div><a href="/community">Join the Argument →</a></div>
    `;
let out = t.replace(/<article class="article">[\s\S]*?<\/article>/, () => `<article class="article">${article}</article>`);
out = out.replace(/<title>.*?<\/title>/, `<title>${esc(a.headline)} — Josh Pate · The Pate State</title>`);
out = out.replace("var yes=57, votes=14522, voted=false;", "var yes=50, votes=0, voted=false;");
writeFileSync(outPath, out);
console.log(`wrote ${outPath} (${Math.round(out.length / 1024)} KB) — ${a.headline}`);
