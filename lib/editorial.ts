// Editorial Upgrade Brief v2 (2026-08-21) — the structural-variety and
// anti-boilerplate machinery shared by the companion and long-form
// pipelines. Rule 2: the content dictates the structure, never the
// reverse; the condition ladder that used to be every article's skeleton
// is now one architecture among twelve, capped at ~1 in 5.
//
// THE KIT (Josh, 2026-08-26, "Pate from scratch adjustments"): the writing
// system is prompts/kit/ — 01 Constitution (always), 02 Voice Bible (any
// prose), one product spec, 07 current-state, then the JSON task contract.
// Every earlier instruction file is retired (prompts/retired/) and never
// loaded; the kit's own rule is that old files carry no authority. The Voice
// Bible's ban lists are installed as lint gates here so prompts and gates
// can never drift apart.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { voiceExemplarBlock, exemplarProse, EXEMPLAR_FOR_LANE } from "@/lib/exemplars";
import { judgeJSON } from "@/lib/judge";

export function readPrompt(name: string): string {
  return readFileSync(join(process.cwd(), "prompts", name), "utf8");
}

/** The kit's lanes. wire + news-reaction are the autonomous lane (04);
 * feature = staff-byline house analysis in the features register (06);
 * show-adaptation = a show-derived column under the staff byline (06 §1);
 * annual = the magazine (05). */
export type EditorialProduct = "wire" | "news-reaction" | "feature" | "show-adaptation" | "annual";

const SPEC_FOR_PRODUCT: Record<EditorialProduct, string> = {
  wire: "pate-state-kit/04-spec-wire.md",
  "news-reaction": "pate-state-kit/04-spec-wire.md",
  feature: "pate-state-kit/06-spec-features.md",
  "show-adaptation": "pate-state-kit/06-spec-features.md",
  annual: "pate-state-kit/05-spec-annual.md",
};

/** Site mechanics the kit's files don't carry: what the site renders for the
 * writer, and the output shape. Not writing instructions (the kit's
 * exclusivity rule); the Voice Bible owns every rule about how prose sounds. */
export const HOUSE_NOTES = `SITE MECHANICS (what the site does for you; not style rules):
1. OUTPUT IS JSON matching the provided schema, nothing else. The task contract at the end defines the fields; the kit defines everything about the writing.
2. THE SITE RENDERS THE FURNITURE: status rows, byline, the companion-episode card, Citizen Pulse, the Ledger receipts module, the Sourcing box, forward links. Never write chrome into prose fields. The Sourcing box is where outlet credit prints, so outlet names stay out of the prose; official sources and named individual reporters are attributed in the text.
3. FACTS come only from the supplied source material and the current-state snapshot when it is loaded; on-record site positions supplied with the assignment are the consistency ledger's state and are never contradicted.
4. THE GOLD STANDARD's facts, picks and lines are illustration only; never reuse its people, numbers, or sentence constructions.`;

const SNAPSHOT_NOTE = `[The current-state snapshot is loaded because this task may state season facts. Check its stamp; it outranks memory; it never licenses a fact the source material does not carry.]`;

const KIT = "pate-state-kit";

/** Kit v4 lanes: wire + news-reaction are the autonomous lane (spec 04, the
 * Wire register: third person, zero Josh opinion); feature + show-adaptation
 * are the approval lane (spec 06: first person, signed "— JP", human publish
 * click). */
export function exemplarLane(product: EditorialProduct): keyof typeof EXEMPLAR_FOR_LANE {
  return product === "wire" || product === "news-reaction" ? "wire" : "feature";
}

/** Builds a writer's system prompt in the kit's load order (00-START-HERE):
 * 01 always → 02 for prose → the one product spec → 07 for season facts →
 * the lane's gold-standard build (the kit says open it before writing) →
 * site mechanics → the JSON contract. Nothing outside prompts/pate-state-kit
 * is loaded as instruction. */
export function editorialSystem(product: EditorialProduct, taskPrompt: string): string {
  return [
    readPrompt(`${KIT}/01-constitution.md`),
    readPrompt(`${KIT}/02-voice-bible.md`),
    readPrompt(SPEC_FOR_PRODUCT[product]),
    `${SNAPSHOT_NOTE}\n\n${readPrompt(`${KIT}/07-current-state.md`)}`,
    voiceExemplarBlock(exemplarLane(product)),
    HOUSE_NOTES,
    taskPrompt,
  ].filter(Boolean).join("\n\n");
}

// ---------------------------------------------------------------------------
// Voice Bible §13 as code: fail-closed validators the pipelines call.

/** Isolated one-sentence kickers (body paragraphs of ≤12 words), excluding
 * the cold-open hook and the porch close. §0B: at most one per 400–600
 * words. Exported for the gates and tests. */
export function kickerBudget(bodyMarkdown: string): { kickers: string[]; allowed: number; ok: boolean } {
  const paras = bodyMarkdown
    .replace(/\[[^\]]*\]/g, " ")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith("## ") && !/^—\s*JP$/.test(p));
  const body = paras.slice(1, Math.max(1, paras.length - 1));
  const words = paras.join(" ").split(/\s+/).filter(Boolean).length;
  const kickers = body.filter((p) => p.split(/\s+/).filter(Boolean).length <= 12);
  const allowed = Math.max(1, Math.floor(words / 400));
  return { kickers, allowed, ok: kickers.length <= allowed };
}

/** The Wire's sentence-one attribution (spec 04 §2.2): who reported it or
 * who said it, on the record, before anything else. Exported for tests. */
export function attributedInSentenceOne(whatHappened: string): boolean {
  const first = whatHappened.split(/(?<=[.!?])\s+/)[0] ?? "";
  return /\b(announced|said|says|confirmed|reported|reports|told|according to|statement|release|declared|posted|wrote)\b/i.test(first);
}

/** Josh-lane pieces sign off "— JP" (Voice Bible §3); the em-dash law
 * allows the dash only here. Appends the sign-off when the writer forgot. */
export function ensureSignOff(bodyMarkdown: string): string {
  const b = bodyMarkdown.trimEnd();
  return /—\s*JP\s*$/.test(b) ? b : `${b}\n\n— JP`;
}

/** Word count of the prose (markers stripped). Exported for the floors. */
export function proseWords(text: string): number {
  return text.replace(/\[[^\]]*\]/g, " ").replace(/—\s*JP\s*$/, "").split(/\s+/).filter(Boolean).length;
}

/** What a reader sees: markers become the furniture the site renders.
 * Judges score this, never the raw markup. Exported for tests. */
export function renderedForJudge(body: string): string {
  return body
    .replace(/\[EMBED:[\d:]+\]\s*/g, "")
    .replace(/\[QUOTE:[\d:]+\]([\s\S]*?)\[\/QUOTE\]/g, (_m, q: string) => `“${q.trim()}” (Josh, on the show)`)
    .replace(/\s*\[PULLQUOTE\]\s*/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface FanVerdict { legibility: number; enjoyment: number; joshVoice: number; score: number; notes: string; pass: boolean }

/** The reader's judge (Isaac, 2026-08-26: "until articles are coming out at
 * 8.5 out of 10 in terms of FAN legibility and enjoyment"). A college
 * football fan, not an editor: could I follow it at speed, did I want to
 * keep reading, did it sound like Josh talking to me. score = the mean of
 * legibility and enjoyment; pass at 8.5. Fail-open. */
export async function fanScore(
  anthropic: import("@anthropic-ai/sdk").default,
  input: { headline: string; dek?: string; body: string },
): Promise<FanVerdict> {
  try {
    const { text } = await judgeJSON(anthropic, {
      maxTokens: 2048,
      effort: "low",
      schemaName: "fan_verdict",
      schema: {
            type: "object",
            properties: { legibility: { type: "number" }, enjoyment: { type: "number" }, joshVoice: { type: "number" }, notes: { type: "string" } },
            required: ["legibility", "enjoyment", "joshVoice", "notes"],
            additionalProperties: false,
      },
      system: `You are a serious college football fan who reads a lot: message boards, the national writers, and you listen to Josh Pate's show. You are NOT an editor. Read the piece once at normal speed and score it 1-10 on three things, harshly.
legibility: could you follow every sentence on the first pass with no decoding? Did you always know who was being talked about and why it mattered? Deduct for insider labels, koans, clever lines you had to re-read, paragraphs that restate the last one, abstractions where a name or a number should be, and anything that sounds like a memo instead of a person.
enjoyment: did you want to keep reading, and were you glad you did? Did you learn something, hear a take you could argue with, get a line you'd text a friend, and get something to watch for on Saturday? Deduct for padding, hedging, throat-clearing, fake drama, and endings that trail off.
joshVoice: does it sound like Josh Pate talking to you on the porch: first person, plain, confident, dry, complete sentences, verdict first, the football reason right behind it, respect for every fanbase, zero performance? Deduct for anonymous-journalist prose, third-person "Pate says," clipped shorthand, or sounding like an AI doing an impression.
Calibration: 10 = you'd send it to a friend unprompted; 8.5 = you'd finish it and remember one line; 7 = fine, forgettable; 5 = you skimmed; 3 = you closed the tab.
notes: 3-5 blunt sentences from the fan's chair: what bored you, what confused you, what you liked, and QUOTE the two sentences that most made it feel written by a machine. Output JSON only.`,
      user: `HEADLINE: ${input.headline}\nDEK: ${input.dek ?? ""}\n\n${renderedForJudge(input.body)}`,
    });
    const out = JSON.parse(text || "{}") as Partial<FanVerdict>;
    const legibility = out.legibility ?? 10, enjoyment = out.enjoyment ?? 10, joshVoice = out.joshVoice ?? 10;
    const score = Math.round(((legibility + enjoyment) / 2) * 10) / 10;
    return { legibility, enjoyment, joshVoice, score, notes: out.notes ?? "", pass: score >= 8.5 };
  } catch {
    return { legibility: 10, enjoyment: 10, joshVoice: 10, score: 10, notes: "", pass: true };
  }
}

export interface VoiceVerdict { score: number; notes: string; pass: boolean }

/** Scores a draft's REGISTER against the lane's approved article (Josh,
 * 2026-08-26: "the exact same voice as those articles"). Facts and topic
 * are ignored; person, rhythm, placement of verdicts and numbers, humor
 * and warmth are what's judged. Fail-open. Pass = 8 or better. */
export async function voiceMatch(
  anthropic: import("@anthropic-ai/sdk").default,
  input: { lane: keyof typeof EXEMPLAR_FOR_LANE; draft: string },
): Promise<VoiceVerdict> {
  try {
    const { text } = await judgeJSON(anthropic, {
      maxTokens: 2048,
      effort: "low",
      schemaName: "voice_verdict",
      schema: { type: "object", properties: { score: { type: "number" }, notes: { type: "string" } }, required: ["score", "notes"], additionalProperties: false },
      system: `You are a voice-match judge. EXEMPLAR is an article written and approved by the site's owner. DRAFT is a new piece on a different subject that must read as if the same person wrote it. Score 1-10 on register match ONLY, never on facts, topic, or length: grammatical person and address (first person "I" to a "you" reader, or the desk's third person), sentence construction and the rhythm of lengths, where the short hammer sentence lands, how a fact and a verdict share a paragraph, how numbers carry credibility, how rare and where the humor is, how sections open and close, paragraph length, warmth versus distance. 10 = indistinguishable; 8 = the same writer on a different day; 6 = the same building, a different desk; 4 = a competent stranger; 2 = generated. Penalize hard: a different grammatical person than the exemplar; announced structure ("the honest read is", "the counterpoint is"); clipped shorthand the exemplar doesn't use; runs of same-length sentences; clever lines the exemplar wouldn't attempt; consultant vocabulary; every sentence auditioning for a pull quote. notes: 2-4 sentences naming the specific mismatches and QUOTING the draft's two or three most off-voice sentences so a rewrite can target them. Output JSON only.`,
      user: `EXEMPLAR:\n${exemplarProse(EXEMPLAR_FOR_LANE[input.lane]).slice(0, 14000)}\n\nDRAFT:\n${renderedForJudge(input.draft)}`,
    });
    const out = JSON.parse(text || "{}") as { score?: number; notes?: string };
    const score = typeof out.score === "number" ? out.score : 10;
    return { score, notes: out.notes ?? "", pass: score >= 8 };
  } catch {
    return { score: 10, notes: "", pass: true };
  }
}

export interface Architecture {
  key: string;
  name: string;
  brief: string;
}

export const ARCHITECTURES: Architecture[] = [
  { key: "condition-ladder", name: "The condition ladder", brief: "Ceiling / floor / most-likely reasoning with named conditions. Use the THINKING but never the labels ('ceiling', 'floor', 'failure condition' as anchors are banned) — express conditions in fresh prose." },
  { key: "number-first", name: "Open with a surprising number", brief: "Lead with one startling, verified number, then interrogate it: where it comes from, what it hides, what it predicts." },
  { key: "scene-first", name: "Open with a scene", brief: "Start inside a concrete moment (from the show or the reported news), then widen to the argument it proves." },
  { key: "wisdom-demolition", name: "Conventional wisdom, then destroy it", brief: "State the thing everybody repeats fairly and fully, then dismantle it piece by piece with evidence." },
  { key: "chronological", name: "Chronological build", brief: "Tell it in time order — how the situation assembled itself — and let the argument emerge from the sequence." },
  { key: "three-questions", name: "Three questions", brief: "Organize the entire piece around three sharply-posed questions a serious fan is actually asking; answer each." },
  { key: "single-argument", name: "One continuous argument", brief: "No subheads at all — one uninterrupted argument that builds paragraph on paragraph to a conclusion." },
  { key: "scouting-report", name: "Scouting report", brief: "Position-group-by-position-group or unit-by-unit assessment with a verdict per section and one overall grade of the situation." },
  { key: "magazine-feature", name: "Magazine feature", brief: "A character or program at the center; stakes, texture, and reporting-style detail; the argument arrives through the story." },
  { key: "myth-vs-reality", name: "Myth vs. reality", brief: "Name 3-5 specific beliefs about the subject; grade each true, false, or partly true, with the evidence." },
  { key: "debate", name: "The debate piece", brief: "Steelman both sides at full strength — the best case FOR and AGAINST — then rule, explaining exactly what tips it." },
  { key: "receipt", name: "The receipt piece", brief: "Anchor on a logged prediction (the site's or Josh's), state the exact conditions that will grade it, and argue which way the evidence currently leans." },
];

/** Picks an architecture not used by the most recent articles. The
 * condition ladder additionally only surfaces when it hasn't appeared in
 * the last five (Brief cap: ~1 in 5). Deterministic seed = article count,
 * so the pipeline can't accidentally streak one shape. */
export function pickArchitecture(recentArchKeys: string[], seed: number): Architecture {
  const recent = new Set(recentArchKeys.slice(0, 4));
  const eligible = ARCHITECTURES.filter((a) => {
    if (recent.has(a.key)) return false;
    if (a.key === "condition-ladder" && recentArchKeys.slice(0, 5).includes("condition-ladder")) return false;
    return true;
  });
  const pool = eligible.length > 0 ? eligible : ARCHITECTURES.filter((a) => !recent.has(a.key));
  return pool[Math.abs(seed) % pool.length] ?? ARCHITECTURES[1];
}

// Part 3: banned house boilerplate. Each regex is an announced-move label —
// the analytical move stays, the label announcing it goes. One counterpoint
// FRAMING is allowed per article; everything else is zero-tolerance as a
// recurring anchor (we flag any occurrence and let the writer rephrase).
const COUNTERPOINT_RE = /\bthe (honest )?(complication|counterpoint|counterweight) (is|here)\b/gi;
const BOILERPLATE: { name: string; re: RegExp }[] = [
  { name: "failure-condition label", re: /\bthe (failure )?condition (is|here is)\b/i },
  { name: "consequence-is-simple", re: /\bthe consequence is (simple|straightforward|plain)\b/i },
  // The plain "The question is…" is Josh's own sentence in the gold standard
  // (v3_1: "The question is what it can see."); only the qualified label is gated.
  { name: "the-real-question", re: /\bthe (real |right |better )question (is|isn't|becomes)\b|\bthe question becomes\b/i },
  // As a section ANCHOR (a header or a paragraph opener); mid-sentence "the
  // margin is" in a column about a point spread is football, not a label.
  { name: "ceiling/floor anchor", re: /(?:^|\n)\s*(?:#+\s*|\*\*)?the (ceiling|floor|margin) (is|here|for)\b/i },
  { name: "watch-for-the-answer", re: /\bwatch [^.!?]{2,40} for the answer\b/i },
  { name: "isn't-X-it's-Y", re: /\bthis isn'?t [^.!?]{2,40}\. it'?s\b/i },
  { name: "headline-vs-story", re: /\bthe headline is [^.!?]{2,40}\. the (story|news) is\b/i },
  { name: "ceiling-floor-one-sentence", re: /\bceiling, floor, and most likely\b/i },
  { name: "credit-belongs", re: /\bcredit (belongs|also belongs) to\b/i },
  { name: "quickly-supporting", re: /\bquickly, the supporting\b/i },
  { name: "task-before-the", re: /\bthe (task|matchup|question) (comes )?before the\b/i },
  // Article Updates 4.0 additions (Josh via ChatGPT, 2026-08-22):
  { name: "corporate noun phrase", re: /\b(roster strategy|internal answer|usable answers?|production profile|expectation territory|postseason burden|roster construction dynamic|continuity equation|developmental infrastructure|personnel solution|position-group outcome|competitive landscape|program trajectory|evaluation point|strategic implication|volume gap|larger offensive assignment|deployment becomes)\b/i },
  { name: "answer-as-player", re: /\b(dependable|second|offensive|defensive|roster|another|every internal) answer(s)?\b/i },
  { name: "fake drama", re: /\b(carries the burden|must answer the call|the season hinges on|faces a defining test|must prove itself|cash (that|the) check|the pressure now falls)\b/i },
  { name: "fake profundity", re: /\b(what the preseason can only assume|only matters until [^.!?]{2,30} is tested|create(s)? (its|their) own burden|between projection and production)\b/i },
  { name: "the-clean-read", re: /\bthe clean read\b/i },
  { name: "story-under-the-story", re: /\bthe story under the story\b/i },
  // Josh's Editorial Core (2026-08-23) — his lists, installed as gates:
  // §13 consulting language (the phrases not already caught above).
  { name: "consulting language", re: /\b(strategic implications?|developmental infrastructure|opportunity landscape|personnel solutions?|roster dynamics?|pathway to production|meaningful contribution|broader implications|leverage point|performance environment|public confidence|talent acquisition|impact profile|position-group pipeline|developmental pathway|future roster flexibility|strategic roster construction)\b/i },
  // §14 generic AI transitions.
  { name: "generic AI transition", re: /\b(this development comes as|it remains to be seen|moving forward|only time will tell|it'?s worth noting|it is worth noting|this situation underscores|at the end of the day|one thing is certain|the road ahead|fans will certainly be watching|this could have significant implications|the bigger question becomes|that being said)\b/i },
  // §17 + Notebook §18/§59: announced analytical scaffolding.
  { name: "scaffolding label", re: /\bthe (mechanism|alternative|first test|best-case scenario|worst-case scenario|cleanest read|best version|worst version|alternative scenario) (is|here|:)/i },
  // Game Week §63–64: coaching clichés published as analysis.
  { name: "coaching cliché", re: /\b(throw (out )?the records( out)?|statement game|(battle|won|win|decided) in the trenches|whoever wants it more|impose (their|its) will|complementary football|survive and advance|bend but don'?t break|win the turnover battle|first real test)\b/i },
  // Recruiting Intelligence §73 + §85: hype in place of roster analysis.
  { name: "recruiting hype", re: /\b(rich get richer|recruiting heater|statement commitment|(massive|huge|big-time|major) (get|pickup)|loaded class|stacked room|making waves|pipeline continues|recruiting battle is heating up)\b/i },
  // The kit (Voice Bible v3.5 §6, Constitution law 8):
  { name: "announcing candor", re: /\b(the honest (read|truth|answer|version|take) is|if i'?m being honest|to be (perfectly )?honest|in all honesty)\b/i },
  { name: "the-machine as the Predictor", re: /\bthe machine('s)?\b/i },
  { name: "internal craft vocabulary", re: /\b(load-bearing|fair[- ]witness|tripwire|the multiplier|can'?t price|price the|priced in|the ecosystem|layer three|the dial)\b/i },
  { name: "generic AI transition (kit)", re: /\b(will look to|will now turn (its|their) attention|something to monitor|in the world of college football|it'?s important to note)\b/i },
  { name: "overrated dunk-framing", re: /\boverrated\b/i },
  { name: "BREAKING in body copy", re: /\bBREAKING:/ },
  // Kit v4.0, Voice Bible §2.6–2.8:
  { name: "AI tell (§2.8)", re: /\b(delve|delving|crucial|pivotal|landscape|navigat(e|es|ed|ing))\b/i },
  { name: "model nickname (§2.6)", re: /\b(the model says|the formula|the machine)\b/i },
  { name: "craft vocabulary (§2.7)", re: /\b(reframe the|the frame is|price (in|the) [a-z]+ take|honest read)\b/i },
  // Kit v4.2, Voice Bible §0B (Josh's Aug 27 corrections to the Miami
  // column): the contingency that is true of every team in America, the
  // sentence that narrates the analysis instead of making it, the Ledger
  // timestamp as a robotic prose line, and "card" for a schedule.
  { name: "banal contingency (v4.2)", re: /\b(if [^.!?]{0,40}\b(stays?|stay|remains?|can stay|keeps?) (healthy|upright)|as long as [^.!?]{0,40}\b(is |stays? |remains? )?(healthy|upright)|if [^.!?]{0,40}\b(goes down|gets hurt|get hurt|is hurt|were to (get hurt|go down)|is injured|gets injured|suffers an injury)|barring (an )?injur(y|ies)|injuries (permitting|aside|notwithstanding)|health (is|will be|becomes) (the|a) (key|factor|x-factor|question|variable)|turnovers? (will|are going to|could) (matter|decide|be the difference)|(one|an) injury (away|from)|if (the )?(quarterback|qb|starter) (goes down|gets hurt))\b/i },
  { name: "meta-analytical framing (v4.2)", re: /\b(deserves (one |an |a )?(honest |quick |brief )?(footnote|caveat|asterisk)|(here'?s|here is|this is|that'?s|that is) the part (that |I think |everybody |most people |people )?(gets|get) (missed|lost|overlooked)|the part (nobody|everyone|people) (is |are )?(missing|miss(es)?|skips?)|is doing (more|most|less|all|the|the real|the heavy) (of the )?(work|lifting)( here)? than|does more (of the )?work than|the (calendar|schedule|roster|number|gap) is doing the (work|lifting)|here'?s what (gets|people) (lost|miss(ed)?)|what (this|that) (argument|column|piece|number) is (really |actually )?(doing|about|saying)|the (bigger|larger|real) (point|story) here is|worth (a|one) (footnote|caveat|asterisk))\b/i },
  { name: "Ledger narrated in prose (v4.2)", re: /\b(I (logged|filed|am logging|'m logging|have logged|'ve logged) (this|it|that|the (pick|call|take))\b|(logged|timestamped|filed) (this |it )?(on|at) (January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}|(will|'ll) be graded (when|on|the)|it gets graded when|is logged (on|to) the ledger)\b/i },
  { name: "card for a schedule (v4.2)", re: /\b(?:on the|whole|full|entire|the|his|their|its|[A-Z][a-z]+(?:'|’)s) card\b(?! game)/i },
];

// Thesis-announcing paragraph openers (Updates 4.0 rule 2): one is fine,
// repetition is the robot tell — flag at two or more.
const THESIS_OPENERS = /(?:^|\n)\s*(?:\*\*)?The (story|reality|question|key|clean read|bigger point|part easy to miss|polling|roster) (is|says)\b/gi;

// Core §15 / Wire §26: spoken-performance devices. One may fit; two reads
// like a transcript. ("Look." only counts as a sentence of its own.)
const PODCAST_PHRASES = /\b(here'?s the thing|let'?s be clear|think about this|here'?s where (it|this) gets (interesting|fun)|that'?s the deal|that'?s the bet)\b/gi;
const PODCAST_ADDRESS = /\bIf you'?re [A-Z][A-Za-z.&'’]+(?: [A-Z][A-Za-z.&'’]+)?,|(?:^|[.!?]\s+)Look[.,]/g;

// The documents' own example sentences and the people in them. Models
// parrot prompt examples ("a spot, not the earth" landed in 44 stories);
// these are the lines most likely to leak, plus the Updates 4.0 examples.
const EXEMPLAR_LINES: RegExp[] = [
  /every other maryland tight end/i,
  /combined caught nine\b/i,
  /\bcannot restore may\b/i,
  /has its no\.? ?1 [a-z -]+\. (now )?it needs a no\.? ?2\b/i,
  /the one lineman it thought it didn'?t have to replace/i,
  /the ranking is familiar\. the pressure behind it isn'?t/i,
  /depth always looks (better|excessive) (on an august roster|in august)/i,
  /rarely believe they have enough by november/i,
  /two-tight-end personnel only creates uncertainty/i,
  /only returning starter on (a|an offensive) line already replacing four/i,
  /the problem was the calendar\b/i,
  /doesn'?t have a talent problem\. it has a january problem/i,
  /can live with one problem\. two gets annoying/i,
  /most of the answers are already on the roster/i,
  /a spot,? not the earth/i,
  /\bfair witness\b/i,
  /the 44th[- ]player\b/i,
];
// (Not "Trickett": Rick Trickett coaches West Virginia's line and shows up in
// real news — the audit caught him on 2026-08-23.)
const EXEMPLAR_PEOPLE = /\b(Fleming|Pastore|Szymanski|Tuihalamaka)\b/;
const EXEMPLAR_TEAMS = /\b(Maryland|Terrapins|Terps|Kansas State|Wildcats|Notre Dame|Irish)\b/i;

/** The documents' example sentences and people, appearing where they don't
 * belong. Exported for tests and the archive audit. */
export function exemplarParroting(text: string): string[] {
  const hits: string[] = [];
  if (EXEMPLAR_LINES.some((re) => re.test(text))) hits.push("exemplar line");
  if (EXEMPLAR_PEOPLE.test(text) && !EXEMPLAR_TEAMS.test(text)) hits.push("exemplar name out of context");
  return hits;
}

/** The reader's judge kept failing pieces for restating one point four
 * ways (loop rounds 1–3, 2026-08-26). Deterministic check: sentences that
 * share four or more content words with an earlier sentence are restating
 * it. Returns the restating sentences; a piece with more than 12% of its
 * sentences restating is circling. Exported for the gates and tests. */
export function restatements(text: string): string[] {
  const STOP = new Set(["about", "after", "again", "against", "before", "being", "between", "could", "every", "first", "going", "their", "there", "these", "those", "three", "through", "under", "until", "where", "which", "while", "would", "still", "other", "since", "because", "should", "might", "season", "football", "state", "team", "teams", "game", "games", "year", "years", "week", "weeks"]);
  const sentences = text.replace(/\[[^\]]*\]/g, " ").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 6);
  const seen: Set<string>[] = [];
  const hits: string[] = [];
  for (const s of sentences) {
    const words = new Set(s.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).filter((w) => w.length > 4 && !STOP.has(w)));
    if (words.size < 4) { seen.push(words); continue; }
    const restates = seen.some((prev) => { let n = 0; for (const w of words) if (prev.has(w)) n++; return n >= 4 && n / words.size >= 0.5; });
    if (restates) hits.push(s);
    seen.push(words);
  }
  return hits;
}

/** Paragraphs of 35+ words with no specific in them: no digit and no proper
 * noun beyond sentence starts (and "I"). The reader's judge calls these
 * "a lawyer's brief." Exported for the gates and tests. */
export function abstractParagraphs(text: string): string[] {
  return text
    .replace(/\[[^\]]*\]/g, " ")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.split(/\s+/).length >= 35 && !p.startsWith("## "))
    .filter((p) => {
      if (/\d/.test(p)) return false;
      const proper = p.replace(/(^|[.!?]\s+)([A-Z])/g, "$1").match(/\b[A-Z][a-z]{2,}\b/g) ?? [];
      return proper.filter((w) => w !== "I" && !/^(The|And|But|That|This|There|Those|These|When|Where|What|Why|How|If|In|On|For|With|From|So|Now|Then|Here|You|Your|His|Their|Our|My|We|They|He|She|It|Not|No|Yes|Nobody|Somebody|Every|Some|Most|All|Just|Still|Even|Only|Maybe|Sometimes|Because|Until|Unless|While|After|Before|Since|Once|Also|Again|Instead|Rather|Whether|Either|Neither|Nor|Or|Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|January|February|March|April|May|June|July|August|September|October|November|December)$/.test(w)).length === 0;
    });
}

/** True when the piece circles: more than 12% of its sentences restate an earlier one. */
export function circles(text: string): boolean {
  const total = text.split(/(?<=[.!?])\s+/).filter((s) => s.split(/\s+/).length >= 6).length;
  return total >= 8 && restatements(text).length / total > 0.12;
}

/** Returns the names of banned-boilerplate violations in a draft: any
 * boilerplate label, more than one counterpoint framing, repeated thesis
 * openers, stacked podcast devices, a pile of rhetorical questions, or
 * parroted document examples. Exported for the generation gates and tests. */
export function boilerplateViolations(text: string): string[] {
  const hits: string[] = [];
  for (const b of BOILERPLATE) if (b.re.test(text)) hits.push(b.name);
  const counter = text.match(COUNTERPOINT_RE)?.length ?? 0;
  if (counter > 1) hits.push("multiple counterpoint framings");
  const thesisOpeners = text.match(THESIS_OPENERS)?.length ?? 0;
  if (thesisOpeners >= 2) hits.push("repeated thesis-announcing openers");
  const devices = (text.match(PODCAST_PHRASES)?.length ?? 0) + (text.match(PODCAST_ADDRESS)?.length ?? 0);
  if (devices >= 2) hits.push("podcast-transcript devices");
  const questions = (text.match(/\?/g) ?? []).length;
  if (questions >= 5) hits.push("rhetorical question pile-up");
  if (exemplarParroting(text).length > 0) hits.push("exemplar parroting");
  return hits;
}

/** The banned list as prompt text, kept in one place so prompts and gates
 * can never drift apart. */
export const BOILERPLATE_PROMPT = `BANNED BOILERPLATE (the analytical move stays; the label announcing it goes — rephrase in fresh, concrete prose): "the honest complication/counterpoint is" (max ONE counterpoint framing per piece, worded freshly), "the failure condition is", "the condition is", "the consequence is simple", "the (real) question is", "the ceiling/floor/margin is" as section anchors, "watch X for the answer", "this isn't X, it's Y", "the headline is X, the story is Y", "that is the ceiling, floor, and most likely outcome in one sentence", "credit belongs to X, credit also belongs to Y", "quickly, the supporting pieces", "the task/matchup before the task/matchup", "the mechanism/alternative/first test/best-case scenario is", "the cleanest read / best version / worst version". Also gated, straight from the Editorial Core: consulting language (§13), generic AI transitions (§14: "this development comes as," "it remains to be seen," "moving forward," "that being said" …), more than one spoken-performance device per piece (§15), five or more question marks, coaching clichés ("in the trenches," "statement game," "first real test"), recruiting hype ("massive get," "rich get richer," "loaded class"), and any reuse of the documents' example sentences or people. Instead of "The counterpoint is the 10-3 record," write "Oklahoma did just win ten games, and that's not nothing. The rushing average tells you which part of those wins is least likely to repeat." Every key fact appears EXACTLY ONCE in body prose; a paragraph after a quote must extend it (context, counter, consequence), never restate it.`;

// Part 8: the scored quality gate. Ten categories, 1-10; an important draft
// scoring below 8 in two or more categories gets one rewrite with the
// judge's notes before publication.
export const QUALITY_CATEGORIES = [
  "voice", "originality", "specificity", "evidence", "pacing",
  "personality", "structuralVariety", "valueAdded", "headline", "accuracy",
  "humanity", "discovery",
] as const;

export interface QualityVerdict {
  scores: Record<string, number>;
  notes: string;
  pass: boolean;
}

/** Scores a draft on the Brief's ten categories with a Sonnet judge.
 * Fail-open: any judge failure returns pass=true so a scoring outage never
 * blocks publication. */
export async function scoreDraft(
  anthropic: import("@anthropic-ai/sdk").default,
  input: { headline: string; dek?: string; body: string; sources?: string },
): Promise<QualityVerdict> {
  try {
    const { text } = await judgeJSON(anthropic, {
      maxTokens: 4096,
      effort: "low",
      schemaName: "quality_verdict",
      schema: {
            type: "object",
            properties: {
              scores: {
                type: "object",
                properties: Object.fromEntries(QUALITY_CATEGORIES.map((c) => [c, { type: "number" }])),
                required: [...QUALITY_CATEGORIES],
                additionalProperties: false,
              },
              notes: { type: "string" },
            },
            required: ["scores", "notes"],
            additionalProperties: false,
      },
      system: `You are the pre-publish quality judge for a college football site aiming at A+ national-caliber writing. Score the draft 1-10 on each category, harshly and honestly:
voice — could this appear on any generic sports site? (generic = low)
originality — a thought the source material didn't hand the writer?
specificity — could the team names be swapped and the article still work? (swappable = low)
evidence — are major claims supported by verifiable specifics?
pacing — redundant paragraphs, restated facts? (repetition = low)
personality — at least one genuinely memorable idea or line?
structuralVariety — does the shape feel like a template? (formulaic = low)
valueAdded — would someone who already watched the source video still learn something?
headline — would a serious CFB fan click, and does the dek add information?
accuracy — any name, stat, or claim that smells unverified?
humanity — the Editorial Core's AI-removal test: does this sound WRITTEN or GENERATED? Generated tells (score low for any): abstract nouns doing football's job ("roster strategy," "internal answer," "production profile"), consulting language, paragraphs that open by announcing their thesis ("The story is… The reality is… The question is…"), announced scaffolding ("the counterpoint is," "the mechanism is"), fake-profound sentences that inform nothing, every sentence auditioning for the pull quote, perfect logical symmetry in every section (thesis, evidence, counter, conclusion), five same-length declaratives in a row, spoken-performance devices stacked up ("Here's the thing… Look… If you're Georgia…"), corporate language a coach would never say aloud, metaphor stacking, over-compressed shorthand that assumes the reader shares the writer's context, prose admiring its own device, announced candor ("the honest read is"), kickers that need decoding. Written tells (score high): named people over concepts, ordinary strong sentences making space around two to four memorable ones, varied temperature (reporting, then a scene, then football, then a human detail), a sentence a smart fan would actually say to a friend.
discovery — the Core's three reactions: does the piece produce "I didn't know that" (a reported fact), "I hadn't thought about it that way" (a second-order insight), and "now I want to watch for that" (something observable on Saturday)? Something new every 150–250 words, or low.
When SOURCES are supplied, evidence, valueAdded and discovery are judged relative to what the sources contain: a draft that says only what is known, briefly, scores WELL on pacing and valueAdded; a draft that pads beyond the sources (the same facts restated in new clothes, hypothetical scenarios standing in for reporting) scores LOW on pacing and humanity. Never penalize a draft for lacking reporting the sources do not contain; penalize it for pretending otherwise, and say in the notes when the right fix is to CUT rather than add.
notes: 2-4 blunt sentences naming the weakest categories and exactly what to fix; when humanity scores low, QUOTE the two or three sentences that sound most generated so the rewrite can target them. Output JSON only.`,
      user: `${input.sources ? `SOURCES:\n${input.sources.slice(0, 12000)}\n\n` : ""}DRAFT:\nHEADLINE: ${input.headline}\nDEK: ${input.dek ?? ""}\n\n${input.body}`,
    });
    const out = JSON.parse(text || "{}") as { scores: Record<string, number>; notes: string };
    const low = Object.values(out.scores ?? {}).filter((v) => v < 8).length;
    return { scores: out.scores ?? {}, notes: out.notes ?? "", pass: low < 2 };
  } catch {
    return { scores: {}, notes: "", pass: true };
  }
}
