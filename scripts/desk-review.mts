// The sports-desk-editor skill's fetch-and-measure step (Isaac, 2026-08-28:
// "create a skill that can read and recommend how to improve the articles").
//   npx tsx scripts/desk-review.mts <sanity-id | slug | site-url>   # a live piece
//   npx tsx scripts/desk-review.mts --file <path>                    # a fixture / replay JSON / .md / .txt
//   add --model for a model-run review with prompts/editorial-v3/craft-review.md
// Prints the piece with paragraph numbers and the machine-tell metrics from
// .claude/skills/sports-desk-editor/references/ai-tells.md. Publishes nothing.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
if (existsSync(join(process.cwd(), ".env.local"))) for (const l of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim(); }
const argv = process.argv.slice(2);
const flag = (k: string) => { const i = argv.indexOf(k); return i !== -1 ? argv[i + 1] : undefined; };
const MODEL = argv.includes("--model");
const FILE = flag("--file");
const key = argv.find((a) => !a.startsWith("--") && a !== FILE);

interface Piece { title: string; headline: string; dek: string; body: string; byline?: string; publishedAt?: string; sources?: string[]; sourceText?: string }

async function load(): Promise<Piece> {
  if (FILE) {
    const raw = readFileSync(FILE, "utf8");
    if (FILE.endsWith(".json")) {
      const j = JSON.parse(raw);
      const d = j.final ?? j.draft ?? j.fields ?? j;
      return { title: FILE, headline: d.headline ?? "", dek: d.dek ?? d.deck ?? "", body: d.bodyMarkdown ?? d.body ?? "", sourceText: typeof j.sources === "object" ? JSON.stringify(j.sources).slice(0, 12000) : undefined };
    }
    const lines = raw.split("\n"); const h = lines.find((l) => l.startsWith("# "))?.slice(2) ?? ""; const dk = lines.find((l) => l.startsWith("## "))?.slice(3) ?? "";
    return { title: FILE, headline: h, dek: dk, body: lines.filter((l) => !l.startsWith("# ") && !l.startsWith("## ")).join("\n").trim() };
  }
  if (!key) throw new Error("give a Sanity id, a slug, a site URL, or --file <path>");
  const slug = key.replace(/^https?:\/\/[^/]+\/(wire|read|article|articles)\//, "").replace(/\/$/, "");
  const { writeClient } = await import("../lib/sanity.ts");
  const doc = await writeClient.fetch<Record<string, unknown> | null>(`*[(_id == $k || slug.current == $k || _id == "wireStory-" + $k || _id == "article-" + $k || _id == "drafts." + $k) && _type in ["wireStory", "article"]][0]{ _type, _id, headline, dek, deck, bodyMarkdown, byline, publishedAt, "sources": sources[].url, "item": *[_type=="wireItem" && references(^._id)][0]{ sourceUrls } }`, { k: slug });
  if (!doc) throw new Error(`no wireStory or article matches "${slug}"`);
  const urls = ((doc.sources as string[] | null) ?? (doc.item as { sourceUrls?: string[] } | null)?.sourceUrls ?? []).filter(Boolean);
  let sourceText = "";
  if (urls.length) { const { fetchArticleText } = await import("../lib/editorial-v3/source-text.ts"); for (const u of urls.slice(0, 3)) { const t = await fetchArticleText(u).catch(() => ""); if (t) sourceText += `SOURCE ${u}\n${t.slice(0, 5000)}\n\n`; } }
  return { title: `${doc._type} ${doc._id}`, headline: String(doc.headline ?? ""), dek: String(doc.dek ?? doc.deck ?? ""), body: String(doc.bodyMarkdown ?? ""), byline: doc.byline as string | undefined, publishedAt: doc.publishedAt as string | undefined, sources: urls, sourceText };
}

// ---------------------------------------------------------------- metrics
const STATIVE = /^(?:[^,.;:]{0,70}?)\b(is|are|was|were|remains|remained|enters|entered|gives|gave|provides|provided|has|have|had|includes|included|stands|sits|lists|listed|projects|projected|ranks|ranked|appears|seems)\b/i;
const ABSTRACT = /\b(ceiling|floor|utility|identity|evidence|r[ée]sum[ée]|outcome|comparison|mechanism|continuity|narrative|dynamic|framework|calculus|landscape|trajectory|blueprint|conversation)\b/gi;
const TIME = /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|today|tonight|yesterday|this (week|weekend|month|morning|afternoon)|last (week|weekend|night|month)|next (week|weekend|month)|(\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) (days?|weeks?|hours?|months?) (before|after|ago|out|from|until)|(Jan|January|Feb|February|March|April|May|June|July|Aug|August|Sept|September|Oct|October|Nov|November|Dec|December)\.? \d{1,2})\b/gi;
const hasTime = (s: string) => new RegExp(TIME.source, "i").test(s);
const OPENERS = /^(Elsewhere|Meanwhile|Separately|Still|That said|Beyond that|In the end|Ultimately),?\b/;
const WILLSHOW = /\b(will (show|tell|reveal|determine|decide)( (us|whether|if|how))?|the (real )?test (is|comes|arrives)|remains to be seen|time will tell)\b/i;
const SELF_AUDIT = /\b(the reporting|the sources?|the report|the article) (does not|do not|doesn't|don't|did not|didn't) (establish|specify|say|confirm|indicate|include)|it is (a|an) [\w ]*(projection|prediction|estimate)\b/i;
const IFPAIR = /^If\b[^.]*\.\s*If (it|they|he|she|that|the|not)\b/;

function metrics(p: Piece) {
  const body = p.body.replace(/\[EMBED:[^\]]*\]|\[PULLQUOTE\]|\*\*/g, "").replace(/—\s*JP\s*$/, "").trim();
  const paras = body.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
  const sents = paras.flatMap((x) => x.split(/(?<!\b(?:No|Sept|Oct|Nov|Dec|Jan|Feb|Aug|Jr|Sr|St|vs|Mr|Dr|Sen|Gov|Rep)\.)(?<=[.!?]["”’)]?)\s+(?=["“(]?[A-Z0-9])/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 2));
  const lens = sents.map((s) => s.split(/\s+/).length);
  const mean = lens.reduce((a, b) => a + b, 0) / Math.max(1, lens.length);
  const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, lens.length));
  const words = body.split(/\s+/).filter(Boolean).length;
  const paraSizes = paras.map((x) => x.split(/(?<!\b(?:No|Sept|Oct|Nov|Dec|Jan|Feb|Aug|Jr|Sr|St|vs|Mr|Dr|Sen|Gov|Rep)\.)(?<=[.!?]["”’)]?)\s+(?=["“(]?[A-Z0-9])/).length);
  const uniform = paraSizes.length >= 3 && paraSizes.filter((n) => n >= 2 && n <= 3).length / paraSizes.length >= 0.8;
  const quoted = (body.match(/[“"][^”"]{8,}[”"]/g) ?? []).join(" ").split(/\s+/).filter(Boolean).length;
  const stative = sents.filter((s) => STATIVE.test(s)).length;
  const flags: { tell: number; text: string }[] = [];
  if (uniform) flags.push({ tell: 1, text: `paragraph sizes ${paraSizes.join("/")} — all 2–3 sentences` });
  if (sents[0] && /\d/.test(sents[0]) && !hasTime(sents[0])) flags.push({ tell: 2, text: sents[0] });
  for (const s of sents) if (SELF_AUDIT.test(s)) flags.push({ tell: 3, text: s });
  for (const x of paras) if (IFPAIR.test(x)) flags.push({ tell: 4, text: x.slice(0, 160) });
  if (sents.length && WILLSHOW.test(sents[sents.length - 1] + " " + (sents[sents.length - 2] ?? ""))) flags.push({ tell: 5, text: sents[sents.length - 1] });
  for (const m of body.matchAll(ABSTRACT)) flags.push({ tell: 6, text: m[0] });
  if (paras.length && /(Sept|Oct|Nov|Dec|Jan)\.? \d/.test(paras[paras.length - 1]) && !/[“"]/.test(paras[paras.length - 1])) flags.push({ tell: 8, text: paras[paras.length - 1].slice(0, 160) });
  for (const x of paras) if (OPENERS.test(x)) flags.push({ tell: 13, text: x.slice(0, 80) });
  for (const s of sents) if (/\b(isn't|is not|wasn't|aren't) [^.]{2,40}\. (It's|It is|They're|That's) /.test(s + " " + (sents[sents.indexOf(s) + 1] ?? ""))) flags.push({ tell: 14, text: s });
  const tc = p.headline.split(" ").filter((w) => w.length > 3); if (tc.length >= 4 && tc.filter((w) => /^[A-Z]/.test(w)).length / tc.length > 0.8) flags.push({ tell: 15, text: p.headline });
  if (!hasTime(body)) flags.push({ tell: 12, text: "no weekday, no 'days before', no dated clause anywhere in the body" });
  return { words, sentences: sents.length, meanLen: Math.round(mean * 10) / 10, sd: Math.round(sd * 10) / 10, paraSizes, timeAnchors: (body.match(TIME) ?? []).length, stativeShare: Math.round((stative / Math.max(1, sents.length)) * 100), abstractHits: (body.match(ABSTRACT) ?? []).length, quoteShare: Math.round((quoted / Math.max(1, words)) * 100), flags };
}

const p = await load();
const m = metrics(p);
console.log(`\n${p.title}${p.byline ? ` · ${p.byline}` : ""}${p.publishedAt ? ` · ${p.publishedAt}` : ""}\n# ${p.headline}\n## ${p.dek}\n`);
p.body.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean).forEach((x, i) => console.log(`[${i}] ${x}\n`));
console.log(`METRICS  ${m.words} words · ${m.sentences} sentences · mean ${m.meanLen} words/sentence · spread (sd) ${m.sd} (pros > 9; machine 4–6)\n         paragraphs ${m.paraSizes.join("/")} sentences · time anchors ${m.timeAnchors} (pros ≥ 1 per 100 words) · stative-verb sentences ${m.stativeShare}% (pros < 25%) · abstract nouns ${m.abstractHits} · quote share ${m.quoteShare}% (news 20–40%)`);
if (m.flags.length) { console.log("\nTELLS"); for (const f of m.flags) console.log(`  #${f.tell}  ${f.text}`); } else console.log("\nTELLS  none by the quick checks (read it anyway)");
if (p.sources?.length) console.log(`\nSOURCES  ${p.sources.join("  ")}`);

if (MODEL) {
  const { callJSON } = await import("../lib/editorial-v3/models.ts");
  const { v3Prompt, S, arr, obj } = await import("../lib/editorial-v3/v3-context.ts");
  const SCHEMA = obj({ verdict: { type: "string", enum: ["yes", "with edits", "no"] }, verdictReason: S, form: S, threeThings: arr(obj({ tell: { type: "integer" }, sentence: S, fix: S })), missingMoves: arr(obj({ move: { type: "integer" }, where: S, whatItWouldSay: S })), lead: S, kicker: S, sentenceList: arr(obj({ sentence: S, fix: S })), upstream: S });
  const { data } = await callJSON<{ verdict: string; verdictReason: string; form: string; threeThings: { tell: number; sentence: string; fix: string }[]; missingMoves: { move: number; where: string; whatItWouldSay: string }[]; lead: string; kicker: string; sentenceList: { sentence: string; fix: string }[]; upstream: string }>({ stage: "craft-review", role: "craftReview", maxTokens: 6000, schemaName: "craft_review", schema: SCHEMA as unknown as Record<string, unknown>, system: v3Prompt("craft-review"), user: `HEADLINE: ${p.headline}\nDEK: ${p.dek}\n\n${p.body}${p.sourceText ? `\n\nTHE SOURCES IT WAS BUILT FROM (for the rewrites; add nothing that is not here or in the piece):\n${p.sourceText.slice(0, 14000)}` : ""}` });
  console.log(`\nMODEL REVIEW\nVERDICT: ${data.verdict} — ${data.verdictReason}\nFORM: ${data.form}\n\nTHE THREE THINGS`);
  data.threeThings.forEach((t, i) => console.log(`${i + 1}. #${t.tell} — "${t.sentence}" → ${t.fix}`));
  console.log("\nTHE MISSING MOVES"); for (const x of data.missingMoves) console.log(`- §${x.move} ${x.where} — ${x.whatItWouldSay}`);
  console.log(`\nREWRITE THE LEAD\n${data.lead}\n\nREWRITE THE KICKER\n${data.kicker}\n\nSENTENCE LIST`); for (const x of data.sentenceList) console.log(`"${x.sentence}" → ${x.fix}`);
  if (data.upstream) console.log(`\nUPSTREAM\n${data.upstream}`);
}
