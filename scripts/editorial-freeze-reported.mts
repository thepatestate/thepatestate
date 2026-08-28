// V3 Test B fixtures (brief §21): three known source packs with different
// amounts of story in them, frozen with their raw outlet text and the V1
// output the site produced from the same source.
//   npx tsx scripts/editorial-freeze-reported.mts
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
for (const l of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim(); }
const { writeClient } = await import("../lib/sanity.ts");
const { teamFactSheet } = await import("../lib/fact-sheet.ts");

const PICKS: { id: string; shape: string; keys: string[]; teams: string[]; note: string }[] = [
  { id: "fsu-edge-visit", shape: "simple item", keys: ["elite-edge-to-visit-florida-state-for-showdown-w"], teams: ["florida-state"], note: "A recruiting visit note. V1 wrote a full seven-part story from it (the padding case)." },
  { id: "alabama-beaman-acl", shape: "real story", keys: ["alabama-football-defensive-line-depth-suffers-ma"], teams: ["alabama"], note: "A season-ending injury with roster context. V1 wrote a 733-word house piece." },
  { id: "sec-pro-penalties", shape: "real story (policy vote, two outlets)", keys: ["sec-schools-except-lsu-approve-penalties-for-sig"], teams: ["lsu"], note: "SEC schools except LSU approve penalties for signing returning pros. Richer source; should carry brief/story depth." },
  { id: "brewster-texas-tech", shape: "real story (No. 1 recruit commits, two outlets)", keys: ["jalen-brewster-the-nation-8217-s-top-recruit-loc", "texas-tech-football-news-5-star-dl-jalen-brewste"], teams: ["texas-tech"], note: "The nation's top recruit commits to Texas Tech; two sources. Should carry story depth." },
  { id: "castellanos-texas-tech", shape: "analysis-worthy", keys: ["former-fsu-qb-tommy-castellanos-commits-to-texas", "texas-tech-football-news-will-tommy-castellanos-"], teams: ["texas-tech", "florida-state"], note: "A quarterback move with a real football question (does he start over Hammond). V1 wrote a 790-word house piece." },
];
const H = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` };
const pack = existsSync(".superpowers/review-pack-2026-08-26.json") ? JSON.parse(readFileSync(".superpowers/review-pack-2026-08-26.json", "utf8")) as { lane: string; headline: string; dek?: string; bodyMarkdown?: string; fan?: { score: number } }[] : [];

for (const p of PICKS) {
  const sources: { key: string; title: string; outlets: string[]; urls: string[]; text: string; storyId?: string }[] = [];
  for (const key of p.keys) {
    const rows = await (await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/wire_clusters?select=cluster_key,title,source_outlets,source_urls,source_text,story_id&cluster_key=like.${encodeURIComponent(key)}*`, { headers: H })).json() as { cluster_key: string; title: string; source_outlets: string[]; source_urls: string[]; source_text: string; story_id?: string }[];
    for (const r of rows) sources.push({ key: r.cluster_key, title: r.title, outlets: r.source_outlets, urls: r.source_urls, text: r.source_text ?? "", storyId: r.story_id ?? undefined });
  }
  const v1: { label: string; headline: string; dek: string; bodyMarkdown: string; words: number }[] = [];
  for (const s of sources.filter((x) => x.storyId)) {
    const st = await writeClient.fetch<{ headline: string; deck?: string; whatHappened?: string; whyBody?: string; missing?: string; section04Body?: string; readBody?: string } | null>(`*[_id == $id][0]{headline, deck, whatHappened, whyBody, missing, section04Body, readBody}`, { id: s.storyId });
    if (st) { const body = [st.whatHappened, st.whyBody, st.missing, st.section04Body, st.readBody].filter(Boolean).join("\n\n"); v1.push({ label: "V1 Wire story", headline: st.headline, dek: st.deck ?? "", bodyMarkdown: body, words: body.split(/\s+/).length }); }
  }
  for (const h of pack.filter((x) => x.lane === "house" && x.bodyMarkdown && p.keys.some((k) => x.headline.toLowerCase().includes(k.split("-")[0]) || (p.id === "alabama-beaman-acl" && /beaman/i.test(x.headline)) || (p.id === "castellanos-texas-tech" && /castellanos/i.test(x.headline))))) v1.push({ label: "V1 house piece (review pack)", headline: h.headline, dek: h.dek ?? "", bodyMarkdown: h.bodyMarkdown!, words: h.bodyMarkdown!.split(/\s+/).length });
  const factSheet = await teamFactSheet(p.teams, { games: 14 }).catch(() => "");
  const fx = { id: p.id, lane: "reported", shape: p.shape, note: p.note, frozenAt: new Date().toISOString(), sources, factSheet, knownOutputs: v1 };
  writeFileSync(`fixtures/editorial-replay/reported-${p.id}.json`, JSON.stringify(fx, null, 2));
  console.log(`reported-${p.id}: ${sources.length} source(s) · ${sources.map((s) => s.text.length).join("+")} chars · fact sheet ${factSheet.length} · ${v1.length} V1 outputs (${v1.map((v) => v.words + "w").join(", ")})`);
}
