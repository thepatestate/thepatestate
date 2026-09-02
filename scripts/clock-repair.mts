// Clock repair (2026-09-01, Isaac: countdown time makes stories stale).
// For every live wireStory whose text measures time from the writing moment,
// Luna rewrites ONLY those expressions into calendar/event-anchored forms,
// using the story's own publish date as the anchor. Nothing else changes.
import { readFileSync, appendFileSync } from "node:fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim().replace(/^"|"$/g, ""); }
const { writeClient } = await import("../lib/sanity.ts");
const { callJSON, modelForRole } = await import("../lib/editorial-v3/models.ts");
const RE = /((?:five|four|three|two|six|seven|eight|nine|\d+) days? (?:before|until|away|from (?:today|now))|\btoday\b|\btonight\b|\btomorrow\b|\bthis week\b|\bnext week\b|\bcurrently\b|\bright now\b)/gi;
const rows: any[] = await writeClient.fetch(`*[_type=="wireStory"]{_id, headline, deck, bodyMarkdown, publishedAt}`);
let cost = 0, fixed = 0, skipped = 0;
for (const r of rows) {
  const all = `${r.headline}\n${r.deck ?? ""}\n${r.bodyMarkdown}`;
  const hits = all.match(RE); if (!hits) continue;
  const pub = new Date(r.publishedAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
  const res = await callJSON<{ headline: string; deck: string; bodyMarkdown: string }>({
    stage: "clock-repair", role: "deskEditor", choice: modelForRole("factRepair"), maxTokens: 4000, schemaName: "clock_repair",
    schema: { type: "object", additionalProperties: false, required: ["headline", "deck", "bodyMarkdown"], properties: { headline: { type: "string" }, deck: { type: "string" }, bodyMarkdown: { type: "string" } } },
    system: `You repair time references in a published sports story so it reads true a month from now. The story was published on the date given. Change ONLY expressions that measure time from the writing moment — "five days before the opener", "days away", "today", "tomorrow", "this week", "currently", "right now" — into calendar or event-anchored forms: compute the actual date from the publish date and use month + day ("the Saturday, Sept. 5 opener", "the Sept. 12 trip to Michigan"), or measure event-to-event ("one week after the opener", "game two"), or simply cut the phrase when the sentence stands without it ("currently unranked" → "unranked"). A weekday alone is fine only for a PAST event within six days of publication ("said Monday"). Keep every other word exactly as it is — same facts, same quotes, same order. Return the full corrected JSON.`,
    user: `PUBLISHED: ${pub} (Eastern).\n\nHEADLINE: ${r.headline}\nDEK: ${r.deck ?? ""}\n\nBODY:\n${r.bodyMarkdown}` });
  cost += res.call.costUsd ?? 0;
  const after = `${res.data.headline}\n${res.data.deck}\n${res.data.bodyMarkdown}`;
  const left = after.match(RE) ?? [];
  const shrunk = res.data.bodyMarkdown.length < r.bodyMarkdown.length * 0.9;
  if (left.length >= hits.length || shrunk) { console.log(`SKIP ${r._id} (left ${left.length}/${hits.length}${shrunk ? ", shrunk" : ""})`); skipped++; continue; }
  appendFileSync(".superpowers/clock-repair-backup.jsonl", JSON.stringify({ at: new Date().toISOString(), doc: r }) + "\n");
  await writeClient.patch(r._id).set({ headline: res.data.headline, deck: r.deck != null ? res.data.deck : r.deck, bodyMarkdown: res.data.bodyMarkdown }).commit();
  console.log(`FIXED ${r._id} (${hits.length} → ${left.length})${left.length ? " residual: " + left.join(",") : ""}`);
  fixed++;
}
console.log(`CLOCK REPAIR done: ${fixed} fixed, ${skipped} skipped · $${cost.toFixed(2)}`);
