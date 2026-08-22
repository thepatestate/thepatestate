// Editorial Upgrade Brief v2 (2026-08-21) — the structural-variety and
// anti-boilerplate machinery shared by the companion and long-form
// pipelines. Rule 2: the content dictates the structure, never the
// reverse; the condition ladder that used to be every article's skeleton
// is now one architecture among twelve, capped at ~1 in 5.

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
];

// Thesis-announcing paragraph openers (Updates 4.0 rule 2): one is fine,
// repetition is the robot tell — flag at two or more.
const THESIS_OPENERS = /(?:^|\n)\s*(?:\*\*)?The (story|reality|question|key|clean read|bigger point|part easy to miss|polling|roster) (is|says)\b/gi;

/** Returns the names of banned-boilerplate violations in a draft: any
 * boilerplate label, or more than one counterpoint framing. Exported for
 * the generation gates and tests. */
export function boilerplateViolations(text: string): string[] {
  const hits: string[] = [];
  for (const b of BOILERPLATE) if (b.re.test(text)) hits.push(b.name);
  const counter = text.match(COUNTERPOINT_RE)?.length ?? 0;
  if (counter > 1) hits.push("multiple counterpoint framings");
  const thesisOpeners = text.match(THESIS_OPENERS)?.length ?? 0;
  if (thesisOpeners >= 2) hits.push("repeated thesis-announcing openers");
  return hits;
}

/** The banned list as prompt text, kept in one place so prompts and gates
 * can never drift apart. */
export const BOILERPLATE_PROMPT = `BANNED BOILERPLATE (the analytical move stays; the label announcing it goes — rephrase in fresh, concrete prose): "the honest complication/counterpoint is" (max ONE counterpoint framing per piece, worded freshly), "the failure condition is", "the condition is", "the consequence is simple", "the (real) question is", "the ceiling/floor/margin is" as section anchors, "watch X for the answer", "this isn't X, it's Y", "the headline is X, the story is Y", "that is the ceiling, floor, and most likely outcome in one sentence", "credit belongs to X, credit also belongs to Y", "quickly, the supporting pieces", "the task/matchup before the task/matchup". Instead of "The counterpoint is the 10-3 record," write "Oklahoma did just win ten games, and that's not nothing. The rushing average tells you which part of those wins is least likely to repeat." Every key fact appears EXACTLY ONCE in body prose; a paragraph after a quote must extend it (context, counter, consequence), never restate it.`;

// Part 8: the scored quality gate. Ten categories, 1-10; an important draft
// scoring below 8 in two or more categories gets one rewrite with the
// judge's notes before publication.
export const QUALITY_CATEGORIES = [
  "voice", "originality", "specificity", "evidence", "pacing",
  "personality", "structuralVariety", "valueAdded", "headline", "accuracy",
  "humanity",
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
humanity — the Article Updates 4.0 test: does this sound WRITTEN or GENERATED? Generated tells (score low for any): abstract nouns doing football's job ("roster strategy," "internal answer," "production profile"), paragraphs that open by announcing their thesis ("The story is… The reality is… The question is…"), fake-profound sentences that inform nothing ("the season has to prove what the preseason can only assume"), every sentence straining to sound important, five same-length declaratives in a row, corporate language a coach would never say aloud. Written tells (score high): named people over concepts, one earned memorable line, varied rhythm, a sentence a smart fan would actually say on a podcast.
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
- STOP ANNOUNCING THESES. Never open paragraphs repeatedly with "The story is / The reality is / The question is / The key is / The clean read is / What matters here is." Tell the reader what happened and let the meaning emerge. Real transitions instead: "And that's where this gets interesting." "There's one problem." "That's the bet." "Now comes the harder part." "Nobody knows that answer yet." (Use these selectively — they must never become the new template.)
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
