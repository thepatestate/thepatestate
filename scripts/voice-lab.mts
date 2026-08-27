// Voice lab (Isaac, 2026-08-26: "I want to get this score even higher"):
// think → write (best of three writers) → line-edit → judge, on one
// episode. Publishes nothing; writes the best result to --out.
//
// Run:  npx tsx scripts/voice-lab.mts --episode "wrong about" [--out path]
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
function loadDotEnvLocal() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim(); if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("="); if (eq === -1) continue;
    const key = line.slice(0, eq).trim(); if (key && !(key in process.env)) process.env[key] = line.slice(eq + 1).trim();
  }
}
loadDotEnvLocal();

const epArg = process.argv.indexOf("--episode"); const EPISODE = epArg !== -1 ? process.argv[epArg + 1].toLowerCase() : "";
const outArg = process.argv.indexOf("--out"); const OUT = outArg !== -1 ? process.argv[outArg + 1] : ".superpowers/voice-lab.json";

const { default: Anthropic } = await import("@anthropic-ai/sdk");
const { getVideos, isEpisode } = await import("../lib/youtube.ts");
const { fetchTranscript, transcriptToPromptText } = await import("../lib/transcript.ts");
const { extractQuotes, classifySeries, DRAFT_SCHEMA, findNonVerbatimQuotes, placePullQuoteMarker, validateDraft } = await import("../lib/generate.ts");
const { editorialSystem, readPrompt, boilerplateViolations, fanScore, voiceMatch, restatements, abstractParagraphs } = await import("../lib/editorial.ts");
const { teamFactSheet } = await import("../lib/fact-sheet.ts");
const { judgeJSON } = await import("../lib/judge.ts");

const anthropic = new Anthropic();
const v = (await getVideos()).filter(isEpisode).find((x) => x.title.toLowerCase().includes(EPISODE));
if (!v) { console.error("episode not found"); process.exit(1); }
const segs = await fetchTranscript(v.id); const transcriptText = transcriptToPromptText(segs!);
const [series, quotes] = await Promise.all([classifySeries({ title: v.title, description: v.description ?? "", publishedAt: v.published }), extractQuotes(transcriptText)]);
const factSheet = await teamFactSheet(quotes.flatMap((q) => q.teams)).catch(() => "");
console.log(`episode: ${v.title}\n${quotes.length} quotes · fact sheet ${factSheet.length} chars\n`);

// ---- 1. THINK: the argument notes (Opus) -----------------------------------
const NOTES_SCHEMA = {
  type: "object",
  properties: {
    segment: { type: "object", properties: { topic: { type: "string" }, start: { type: "string" }, end: { type: "string" }, why: { type: "string" } }, required: ["topic", "start", "end", "why"], additionalProperties: false },
    take: { type: "string" },
    mechanisms: { type: "array", items: { type: "object", properties: { claim: { type: "string" }, football: { type: "string" }, source: { type: "string" } }, required: ["claim", "football", "source"], additionalProperties: false } },
    surprise: { type: "string" },
    textLine: { type: "string" },
    watch: { type: "array", items: { type: "string" } },
    cut: { type: "array", items: { type: "string" } },
  },
  required: ["segment", "take", "mechanisms", "surprise", "textLine", "watch", "cut"],
  additionalProperties: false,
} as const;
const notesRes = await anthropic.messages.create({
  model: "claude-opus-5",
  max_tokens: 6000,
  output_config: { format: { type: "json_schema", schema: NOTES_SCHEMA } },
  system: `You are Josh Pate's editor, planning his column from his own show before a word is written. Read the transcript and the verified team facts. FIRST, choose ONE segment: the single take in the episode with the most football reasoning behind it and the clearest thing for a fan to argue with. The column will be about that one thing only; the rest of the episode is out of scope (the video embed carries it). A column that tours every take in the episode reads as a listicle and fails. Then produce the ARGUMENT NOTES for that segment:
segment: topic, start and end timestamps, and why this one.
take: the one sentence a fan would argue with at a bar, in Josh's own position (never invent one; it must be on the tape).
mechanisms: exactly 3. Each: the claim; the football that proves it (a player, a matchup, a number, a game, a date — from the transcript or the team facts, never invented); where it comes from (transcript timestamp or "team facts").
surprise: the angle a fan hasn't considered, grounded in the tape or the facts — the second-order point, the thing the obvious reaction misses. Never manufactured contrarianism.
textLine: the single line a fan would text a friend — true, plain, quotable on its own. Josh's actual words if the tape has one; otherwise a line that only uses what's on the tape.
watch: 2-3 specific things to watch, each with a player or a game and a date from the team facts.
cut: 3-5 obvious points the column should NOT spend words on (things every fan already knows, restatements of the take).
Output JSON only.`,
  messages: [{ role: "user", content: `EPISODE: ${v.title}\n\nTRANSCRIPT:\n${transcriptText}\n\n${factSheet}` }],
});
const notesBlock = notesRes.content.find((b) => b.type === "text");
const notes = JSON.parse(notesBlock && notesBlock.type === "text" ? notesBlock.text : "{}");
console.log("NOTES:", JSON.stringify(notes, null, 1).slice(0, 1800), "\n");

// ---- 2. WRITE: best of three writers from the same notes ----------------------
const system = editorialSystem("show-adaptation", readPrompt("companion-article.md"));
const baseUser = [
  `THIS COLUMN IS ABOUT ONE THING: ${notes.segment?.topic} (the show segment from ${notes.segment?.start} to ${notes.segment?.end}). Everything else in the episode is out of scope; do not tour the other takes; the embed carries them. Voice Bible §3: 800–1,100 words (the floor is law, so the depth comes from the tape's football and the team facts, never filler); cold open → claim early → two to four blended case sections → brisk sweep → flag plant → porch close signed — JP. Section headers only where the argument turns. Say the take once, prove it once, tell the reader what to watch once. Name the realistic alternative and say plainly why it falls short. At most two dates in the whole column, each attached to a reason; never list a schedule. Never carry a spoken bit or a captioner's garble into prose ("whomst," "whomsted," or any word that isn't a word).\n\nTHE ARGUMENT NOTES (your editor's plan; write from these): TAKE: ${notes.take}\nMECHANISMS:\n${(notes.mechanisms ?? []).map((m: any, i: number) => `${i + 1}. ${m.claim} — the football: ${m.football} (${m.source})`).join("\n")}\nTHE ANGLE A FAN HASN'T CONSIDERED: ${notes.surprise}\nTHE LINE TO TEXT A FRIEND (use it, verbatim, where it lands hardest): ${notes.textLine}\nWATCH: ${(notes.watch ?? []).join(" · ")}\nDO NOT SPEND WORDS ON: ${(notes.cut ?? []).join(" · ")}\nEvery mechanism appears with its football specifics. Nothing beyond the transcript and the team facts. Say each thing once.`,
  `Episode title: ${v.title}`, `Series: ${series}`, `Published: ${v.published}`, `Description:\n${(v.description ?? "").slice(0, 3000)}`,
  `NO QUOTE BLOCKS: this is Josh's own first-person column, so it never quotes him back to the reader (a narrator quoting himself reads bolted on). Do not emit [QUOTE] blocks. His spoken lines become his written sentences. Never carry a spoken bit or a captioner's garble into prose ("whomst," "whomsted"). pullQuote: THE LINE WORTH KEEPING, a verbatim transcript line that argues the claim and stands alone, or one sentence of the column's own text character-for-character; or "". The "I logged this on [date]" line appears once, in the porch close.`,
  `Transcript (timestamped, AUTO-CAPTIONED: cross-check names against the title and description; where a name looks garbled and you cannot be certain, refer to the player by school and position):\n${transcriptText}`,
  factSheet,
].filter(Boolean).join("\n\n");

async function writeWith(provider: "openai" | "anthropic", model: string): Promise<string> {
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model, max_completion_tokens: 8192, response_format: { type: "json_schema", json_schema: { name: "companion_draft", strict: true, schema: DRAFT_SCHEMA } }, messages: [{ role: "system", content: system }, { role: "user", content: baseUser }] }), signal: AbortSignal.timeout(240_000) });
    if (!res.ok) throw new Error(`openai ${res.status}`);
    return ((await res.json()) as any).choices?.[0]?.message?.content ?? "";
  }
  const res = await anthropic.messages.create({ model, max_tokens: 8192, output_config: { format: { type: "json_schema", schema: DRAFT_SCHEMA } }, system, messages: [{ role: "user", content: baseUser }] });
  const b = res.content.find((x) => x.type === "text"); return b && b.type === "text" ? b.text : "";
}
const gate = (d: any) => {
  const prose = d.bodyMarkdown.replace(/\[QUOTE:[\d:]+\][\s\S]*?\[\/QUOTE\]/g, "");
  const bad = findNonVerbatimQuotes(d.bodyMarkdown, transcriptText);
  if (d.pullQuote.trim().split(/\s+/).length >= 5 && findNonVerbatimQuotes(`"${d.pullQuote}"`, transcriptText).length) bad.push(d.pullQuote);
  const problems = [...boilerplateViolations(prose), ...(bad.length ? [`non-verbatim: ${bad[0].slice(0, 60)}`] : []), ...(/(?:^|[\s“"(])(I|I'm|I've|my)(?=[\s,.!?'’])/.test(prose) ? [] : ["no first person"])];
  return problems;
};
async function score(d: any) {
  const [fan, voice] = await Promise.all([fanScore(anthropic, { headline: d.headline, dek: d.dek, body: d.bodyMarkdown }), voiceMatch(anthropic, { lane: "feature", draft: d.bodyMarkdown })]);
  return { fan, voice };
}
const WRITERS: [string, "openai" | "anthropic", string][] = [["luna", "openai", "gpt-5.6-luna"], ["terra", "openai", "gpt-5.6-terra"], ["opus", "anthropic", "claude-opus-5"], ["gpt-5.2", "openai", "gpt-5.2"]];
const candidates: any[] = [];
await Promise.all(WRITERS.map(async ([name, prov, model]) => {
  try {
    const raw = await writeWith(prov, model);
    const d = validateDraft(placePullQuoteMarker(JSON.parse(raw)));
    if (!d) { console.log(`${name}: invalid draft`); return; }
    d.bodyMarkdown = d.bodyMarkdown.replace(/\\(["'])/g, "$1");
    const problems = gate(d);
    const s = await score(d);
    console.log(`${name}: fan ${s.fan.score} (leg ${s.fan.legibility} · enj ${s.fan.enjoyment} · josh ${s.fan.joshVoice}) · voice ${s.voice.score}${problems.length ? ` · GATES: ${problems.join("; ")}` : ""}\n   ${s.fan.notes.replace(/\n/g, " ").slice(0, 500)}\n`);
    candidates.push({ writer: name, ...d, problems, ...s });
  } catch (err) { console.log(`${name}: failed (${err instanceof Error ? err.message.slice(0, 80) : err})`); }
}));
const clean = candidates.filter((c) => c.problems.length === 0);
const pool = clean.length ? clean : candidates;
pool.sort((a, b) => b.fan.score - a.fan.score || b.voice.score - a.voice.score);
let best = pool[0];
if (!best) { console.error("no candidates"); process.exit(1); }
console.log(`best of three: ${best.writer} at ${best.fan.score}\n`);

// ---- 3. LINE EDIT (Opus): cut and sharpen, add nothing ------------------------
const editRes = await anthropic.messages.create({
  model: "claude-opus-5",
  max_tokens: 8192,
  output_config: { format: { type: "json_schema", schema: DRAFT_SCHEMA } },
  system: `You are a line editor working on Josh Pate's column. You do not rewrite; you edit. Rules: keep his argument, order, and voice; cut every sentence that restates an earlier one; replace any abstract sentence with the specific from the notes or the tape (a name, a number, a game, a date) or cut it; make sure the line a fan would text a friend is in the piece and lands hard; keep every [QUOTE] block and the [EMBED] marker exactly; add NO facts, NO claims, NO quotes; keep the first person; keep or shorten the length, never lengthen; no em dashes, no exclamation points. Return the edited column in the same JSON shape.\n\nTHE ARGUMENT NOTES:\n${JSON.stringify(notes)}\n\nA FAN'S NOTES ON THE DRAFT (fix these):\n${best.fan.notes}\n\nRESTATED SENTENCES (cut or make new): ${restatements(best.bodyMarkdown).slice(0, 5).join(" | ")}\nABSTRACT PARAGRAPHS (put the football in or cut): ${abstractParagraphs(best.bodyMarkdown).slice(0, 3).map((p: string) => p.slice(0, 80)).join(" | ")}`,
  messages: [{ role: "user", content: JSON.stringify({ headline: best.headline, dek: best.dek, bodyMarkdown: best.bodyMarkdown, pullQuote: best.pullQuote, primaryTeam: best.primaryTeam, teams: best.teams, tags: best.tags, seo: best.seo }) }],
});
const eb = editRes.content.find((x) => x.type === "text");
try {
  const ed = validateDraft(placePullQuoteMarker(JSON.parse(eb && eb.type === "text" ? eb.text : "{}")));
  if (ed) {
    ed.bodyMarkdown = ed.bodyMarkdown.replace(/\\(["'])/g, "$1");
    const problems = gate(ed);
    const s = await score(ed);
    console.log(`edited: fan ${s.fan.score} (leg ${s.fan.legibility} · enj ${s.fan.enjoyment} · josh ${s.fan.joshVoice}) · voice ${s.voice.score}${problems.length ? ` · GATES: ${problems.join("; ")}` : ""}\n   ${s.fan.notes.replace(/\n/g, " ").slice(0, 500)}\n`);
    if (problems.length === 0 && s.fan.score >= best.fan.score) best = { ...best, ...ed, ...s, writer: `${best.writer}+edit` };
  }
} catch (err) { console.log("edit failed", err instanceof Error ? err.message.slice(0, 100) : err); }

console.log(`FINAL: ${best.writer} · fan ${best.fan.score} · voice ${best.voice.score}`);
writeFileSync(OUT, JSON.stringify([{ lane: "show", label: "Josh's Read · voice lab", episode: v.title, ytId: v.id, series, notes, ...best }], null, 2));
