// Freeze fresh reported sources (today's feeds) as Engine B fixtures.
//   npx tsx scripts/editorial-freeze-fresh.mts "<id>=<url>[,<url>]|<team-slug>[+<slug>]" ...
// Page text via fetchSourceText; when an outlet blocks the fetch, the feed
// entry's own content stands in (the same grounding the Wire monitor uses).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
for (const l of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim(); }
const { fetchFeeds } = await import("../lib/wire.ts");
const { fetchArticleText } = await import("../lib/editorial-v3/source-text.ts");
const { teamFactSheet } = await import("../lib/fact-sheet.ts");
const feed = await fetchFeeds();
for (const spec of process.argv.slice(2)) {
  const [id, rest] = spec.split("=", 2); const [urls, teams] = rest.split("|");
  const sources = [];
  for (const url of urls.split(",")) {
    const entry = feed.find((e) => e.link === url);
    let text = await fetchArticleText(url).catch(() => "");
    if (text.length < 600 && entry?.content) text = entry.content;
    const outlet = entry?.outlet ?? (/cbssports/.test(url) ? "CBS Sports" : /espn/.test(url) ? "ESPN" : /yahoo/.test(url) ? "Yahoo Sports" : /on3/.test(url) ? "On3" : "web");
    sources.push({ key: id, title: entry?.title ?? id, outlets: [outlet], urls: [url], text });
  }
  const factSheet = teams ? await teamFactSheet(teams.split("+"), { games: 14 }).catch(() => "") : "";
  writeFileSync(`fixtures/editorial-replay/reported-${id}.json`, JSON.stringify({ id, lane: "reported", shape: "fresh", note: `fresh feed item, ${new Date().toISOString().slice(0, 10)}`, frozenAt: new Date().toISOString(), sources, factSheet, knownOutputs: [] }, null, 2));
  console.log(`${id}: ${sources.map((s) => `${s.outlets[0]} ${s.text.length}`).join(" + ")} chars · fact sheet ${factSheet.length}`);
}
