// Editorial Upgrade Brief v2 (2026-08-21) — the structural-variety and
// anti-boilerplate machinery shared by the companion and long-form
// pipelines. Rule 2: the content dictates the structure, never the
// reverse; the condition ladder that used to be every article's skeleton
// is now one architecture among twelve, capped at ~1 in 5.
//
// Josh's MD files (2026-08-23, "Pate State MD files 1 million.0"): the
// editorial system is now modular — 00 Editorial Core (universal) plus one
// product document per article family — and every writer's system prompt
// is assembled by editorialSystem() below from those documents verbatim.
// The Core's banned-language lists are installed as lint gates here so the
// prompts and the gates can never drift apart.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function readPrompt(name: string): string {
  return readFileSync(join(process.cwd(), "prompts", name), "utf8");
}

export type EditorialProduct = "wire" | "notebook" | "recruiting" | "game-week" | "show-adaptation";

const PRODUCT_DOCUMENT: Record<EditorialProduct, string | null> = {
  wire: "wire-editorial-system.md",
  notebook: "notebook.md",
  recruiting: "recruiting-intelligence.md",
  "game-week": "game-week.md",
  // Josh Show → Article inherits the Core; its own contract is the companion prompt.
  "show-adaptation": null,
};

/** Current site policy, appended AFTER Josh's documents so that where a
 * document line conflicts with a standing directive, the directive wins.
 * Each item names what it supersedes so the next editor can lift it. */
export const HOUSE_OVERRIDES = `HOUSE OVERRIDES (current site policy; where any line in the editorial documents above conflicts with these, these win):
1. ATTRIBUTION LIVES IN THE FOOTER. Never open a story with "X reported…", "According to X…", or "Per X…", and never name another website in the deck or the opening section. The site renders outlet credit in the story's sourcing footer automatically. Official sources ("Kansas State announced…", "the head coach said Thursday…") and NAMED individual reporters are fine in prose; unconfirmed specifics are "reported to be…". (Supersedes the Wire document's first-sentence-attribution rule, per the 2026-08-20 site directive, pending Josh's confirmation.)
2. THE DESK HAS NO SELF. Wire, Notebook, Recruiting Intelligence and Game Week prose never uses first person. Josh's positions are third person and attributed ("Pate expects…"); his exact words enter only through supplied archived verbatim quotes. Show adaptations are the one exception: those are Josh's own argument in his own first person by his directive, which is adapting his show, not imitating a personality.
3. NO EM DASHES OR EN DASHES anywhere in prose (write two sentences instead). Zero exclamation points.
4. THE EXAMPLES ARE NOT TEMPLATES. Every illustration in the documents above (Fleming, Pastore, Szymanski, Howard, Trickett, Maryland's tight ends, Kansas State's line, Georgia's edge rushers, Mateer, Notre Dame's admissions calendar, "restore May," "has its No. 1 … now it needs a No. 2," "the pressure behind it isn't," "depth always looks better in August") exists to show a register. Never reuse their wording, people, numbers, or sentence constructions in a story about anything else. A sentence that echoes an example's shape is a defect and will be rejected.
5. SPOKEN DEVICES ARE RATIONED. "Here's the thing," "Look," "Let's be clear," "Think about this," "That's the deal," "That's the bet," "If you're [team]…": at most one such device per article, usually none. Transitions come from the facts.
6. OUTPUT IS JSON. The documents describe editorial content; the task contract below defines the fields. Where a document's output format lists sections, express them through the schema's fields and leave unearned fields empty.`;

/** Builds a writer's system prompt: shared preamble → 00 Editorial Core →
 * the product document → house overrides → the JSON task contract. */
export function editorialSystem(product: EditorialProduct, taskPrompt: string): string {
  const doc = PRODUCT_DOCUMENT[product];
  return [
    readPrompt("global-preamble.md"),
    readPrompt("editorial-core.md"),
    doc ? readPrompt(doc) : "",
    HOUSE_OVERRIDES,
    taskPrompt,
  ].filter(Boolean).join("\n\n");
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
  { name: "the-real-question", re: /\bthe (real |right |better )?question (is|isn't|becomes)\b/i },
  { name: "ceiling/floor anchor", re: /\bthe (ceiling|floor|margin) (is|here|for)\b/i },
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
  input: { headline: string; dek?: string; body: string },
): Promise<QualityVerdict> {
  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
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
        },
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
humanity — the Editorial Core's AI-removal test: does this sound WRITTEN or GENERATED? Generated tells (score low for any): abstract nouns doing football's job ("roster strategy," "internal answer," "production profile"), consulting language, paragraphs that open by announcing their thesis ("The story is… The reality is… The question is…"), announced scaffolding ("the counterpoint is," "the mechanism is"), fake-profound sentences that inform nothing, every sentence auditioning for the pull quote, perfect logical symmetry in every section (thesis, evidence, counter, conclusion), five same-length declaratives in a row, spoken-performance devices stacked up ("Here's the thing… Look… If you're Georgia…"), corporate language a coach would never say aloud. Written tells (score high): named people over concepts, ordinary strong sentences making space around two to four memorable ones, varied temperature (reporting, then a scene, then football, then a human detail), a sentence a smart fan would actually say to a friend.
discovery — the Core's three reactions: does the piece produce "I didn't know that" (a reported fact), "I hadn't thought about it that way" (a second-order insight), and "now I want to watch for that" (something observable on Saturday)? Something new every 150–250 words, or low.
notes: 2-4 blunt sentences naming the weakest categories and exactly what to fix; when humanity scores low, QUOTE the two or three sentences that sound most generated so the rewrite can target them. Output JSON only.`,
      messages: [{ role: "user", content: `HEADLINE: ${input.headline}\nDEK: ${input.dek ?? ""}\n\n${input.body}` }],
    });
    const block = res.content.find((b) => b.type === "text");
    const out = JSON.parse(block && block.type === "text" ? block.text : "{}") as { scores: Record<string, number>; notes: string };
    const low = Object.values(out.scores ?? {}).filter((v) => v < 8).length;
    return { scores: out.scores ?? {}, notes: out.notes ?? "", pass: low < 2 };
  } catch {
    return { scores: {}, notes: "", pass: true };
  }
}

// Article Updates 4.0 (Josh via ChatGPT, 2026-08-22) — the distilled
// human-voice layer injected into EVERY writer call. Full document:
// prompts/article-updates-v4.md. This is deliberately long; voice is the
// product.
export const VOICE_V4_PROMPT = `HUMAN VOICE RULES (Article Updates 4.0 — the standard is "written, not generated"):
- CONCRETE BEFORE ABSTRACT. Players, coaches, positions, games, decisions — never abstract nouns. Not "the roster strategy raises the value of every internal answer" but "with Williams out, somebody who expected to be the fourth edge rusher may need real snaps in September." When an abstract sentence can be translated into actual football, translate it.
- STOP ANNOUNCING THESES. Never open paragraphs repeatedly with "The story is / The reality is / The question is / The key is / The clean read is / What matters here is." Tell the reader what happened and let the meaning emerge. Transitions come from the facts (a new number, a new name, a date), never from stock spoken devices; "Here's the thing," "Look," "That's the bet," "If you're [team]" are rationed to at most one per piece and usually zero (Editorial Core §15).
- NEVER corporate football: roster strategy, internal/usable/dependable "answers" (name what's needed: a tight end who can catch, someone who can play 30 snaps), production profile, personnel solution, competitive landscape, program trajectory. If it could appear in a strategy memo, rewrite it.
- NO FAKE PROFUNDITY ("the season has to prove what the preseason can only assume") and NO FAKE DRAMA on routine stories ("carries the burden," "the season hinges on"). Simple beats manufactured: "Georgia looks deep in August. Williams' injury gives us an early chance to find out how deep."
- ONE memorable short line beats six attempted ones. Punchy landing sentences only after the information earns them.
- PEOPLE OVER CONCEPTS. Name the person; allow warmth without sentimentality ("Szymanski has spent most of his Maryland career waiting for exactly this kind of opening"). Never invent emotions.
- VARY RHYTHM: a short sentence, a normal one, occasionally a long one connecting ideas. If five consecutive sentences share length and shape, rewrite. Vary temperature too: reporting, then observation, then football analysis, then a touch of personality ("Defenses can live with one problem. Two gets annoying.").
- WRITE TO ONE SMART FAN across the table — no lecturing, no over-explaining, forward pull every few paragraphs ("But Fleming isn't actually the most interesting part of this"). Lead with the interesting sentence, not the comprehensive one: "Fleming caught 40 passes last year. Every other Maryland tight end combined caught nine."
- CONTRAST when the facts support it: "Georgia doesn't have a talent problem. It has a January problem." Never manufacture false binaries.
- ONE CENTRAL QUESTION per story, revealed progressively — each section advances it, never restates it; the concluding read RESOLVES it like the writer finally putting cards on the table, and the ending leaves the reader something specific to watch on Saturday ("Watch who stays on the field next to Fleming when Maryland has to throw"), never "time will tell."
- LET THE WRITER NOTICE THINGS: one player with nearly all of a group's production, the freshman suddenly in the two-deep, the schedule stretch that changes the urgency. The reader should feel someone is noticing things on his behalf, and at least once think "I hadn't considered that."
- THE READ-ALOUD TEST governs every sentence: would a knowledgeable college football person actually SAY this on a podcast? Nobody says "the roster's 2026 answer is expected to come from players already in the program." Someone says "Georgia is betting that most of the answers are already on the roster." Before finishing, find the five sentences that sound most like AI and rewrite all five.
Every example sentence above is an illustration from OTHER stories (Georgia, Maryland, Fleming, Williams) — never reuse their wording, teams, players, or lines in your story; they show the register, not phrases to copy.
The voice in one sentence: a smart, curious college football obsessive who did more homework than everyone else, talking to a friend on the front porch — not a professor at a podium, not an algorithm delivering a thesis.`;
