# Research: making thepatestate.com companion articles genuinely good (third-person, non-slop)

Grounded in the live pipeline: `prompts/companion-article.md` (current first-person prompt, 600–1100
words / 300–500 without transcript), `prompts/series-classifier.md` (episode → series tag), `lib/transcript.ts`
(timestamped `[MM:SS] text` transcript lines, InnerTube-sourced), `components/ArticleBody.tsx` (renders
`[EMBED:HH:MM:SS]` and `[PULLQUOTE]` markers, byline block, `##`/`**bold**`-only markdown), and
`studio/schemas/article.ts` (headline, dek, bodyMarkdown, pullQuote, workflowState gate, lowConfidence flag).
The switch under consideration is first-person-as-host → third-person editorial ("Pate argued that…").

---

## 1. How quality sports/culture outlets cover podcast/video episodes editorially

There's no single dominant format, but recurring, nameable structures show up across the genre (Ringer-style
recap posts, Awful Announcing's media-criticism pieces, beat-writer "3 things we learned" posts, YouTube-recap
SEO content):

- **Takeaways list** — "5 things we learned from [episode]." Each takeaway is a bolded one-line claim
  followed by 2-4 sentences of evidence/quote. Strength: skimmable, SEO-friendly (numbered lists rank and
  get featured snippets), easy to timestamp-link. Weakness: becomes a transcript summary if each item isn't a
  genuine argument. Best practice: cap at 3-5 items, each item must be a claim, not a topic ("Pate thinks
  Georgia's defense is overrated" not "Pate talks about Georgia").
- **Argument-analysis (single-thesis)** — one claim from the episode, unpacked: what was said, why it
  matters, what the counter-argument is, what the record shows. This is the strongest format for a single
  32-second Sonnet-generated companion piece because it forces specificity instead of coverage-of-everything.
  Structural skeleton: hook (the claim, stated plainly) → context (why now / what prompted it) → the
  argument itself with direct quotes → the honest counterpoint or complication → a closing line that doesn't
  just restate the thesis.
- **Quote-driven recap** — built around 2-4 verbatim quotes, each introduced with enough context that the
  quote lands without having watched the episode, then briefly unpacked. Works well combined with pull-quote
  selection since the quotes double as pull-quote candidates.
- **"What X got right / what X got wrong"** — retrospective framing applied to picks, predictions, or
  takes once results are in (this is a natural fit for "picks-drop" and "poll-day" franchises once a game
  week resolves — a follow-up-article pattern, not just a same-day companion piece).
- **Media-criticism / meta framing** (Awful Announcing house style) — treats the host's take itself as the
  subject: not just "what he said" but "how strong is this argument, and is he right." This is closer to
  the third-person editorial voice being asked for here than a fan recap is — it treats Pate as a subject of
  coverage, not as the site's own voice.

Common thread: none of these formats summarize the whole episode chronologically. They pick one axis (a
claim, a set of quotes, a verdict) and build the whole piece around it. That's the single biggest structural
lesson to port into the prompt.

Sources: [The Ringer (Wikipedia, format/history context)](https://en.wikipedia.org/wiki/The_Ringer_(website)),
[Awful Announcing college football coverage](https://awfulannouncing.com/tag/college-football),
[Awful Announcing media-bias takeaways example](https://awfulannouncing.com/college-football/six-takeaways-media-bias-survey-espn-fox-nbc-sec-big-ten.html),
[Sports journalism structure notes](https://fiveable.me/sports-journalism/unit-3/structure-style-sports-articles/study-guide/lMfznWdgUWzLM7aF)

---

## 2. LLM-editorial AI-tell avoidance: prohibited patterns + techniques that measurably help

**Confirmed slop-word list (cross-referenced across multiple 2026 sources) — worth hard-banning in the prompt:**
delve, tapestry, landscape (metaphorical), crucial, pivotal, seamless, robust, leverage, elevate, navigate
(metaphorical), realm, "in the realm of," "it's important to note," "the key takeaway is," "in today's
fast-paced world," "in the ever-evolving landscape of," testament, game-changer, unlock, dive deep, unveil,
elucidate, "not alone," "let that sink in," "it's not X, it's Y," self-answered rhetorical questions, em
dashes on every line, "in summary"/"in conclusion" closers, hedge words (arguably, perhaps, some might say)
stacked defensively. One source's practical finding: pasting a banned-word list at the end of the prompt
removes an estimated 30-40% of surface-level slop on its own — cheap and worth doing regardless of anything
else.

**Structural tells (harder to filter with a word list, more relevant to this pipeline):**
- Generic scene-setting intros that could preface any episode ("In a wide-ranging conversation, Josh Pate
  discussed several topics...") — the classic failure mode of transcript-to-article generation. Ban explicitly:
  the piece must open on the specific claim, not a scene-setter.
- Uniform paragraph lengths / metronomic rhythm — a tell in itself; real editorial writing varies sentence
  and paragraph length for emphasis.
- Empty transitions ("Furthermore," "Moreover," "That said,") standing in for actual logical connection.
- Rule-of-three overuse (triads of adjectives/examples where two or four flows more naturally) — a known
  LLM tic worth naming explicitly as banned.
- Hedge-everything / false balance — LLMs default to "some say X, others say Y" even when the transcript
  shows the host taking a clear side. This directly undermines the third-person voice goal ("Pate argued")
  since it launders a real, specific claim into mush.
- Summary-of-summary — restating the episode description/title in different words instead of adding new
  information. Directly bannable: "do not restate the episode description; every sentence must add
  information not already in the title/description."

**Techniques with real leverage, in priority order:**
1. **Grounding in verbatim transcript quotes** — require at least N direct quotes pulled from the actual
   `[MM:SS]` transcript text (not paraphrased), each with its timestamp. This is the single strongest lever
   against both hallucination and genericness, and it's already structurally available in this pipeline via
   `lib/transcript.ts`'s `transcriptToPromptText()` output.
2. **Timestamp-anchored claims** — every substantive claim in the article should be traceable to a specific
   transcript moment. This is a natural fit since `[EMBED:HH:MM:SS]` markers already exist in the schema —
   the prompt can require that each embed marker sits at the exact moment the paragraph right above it is
   describing (current prompt already says this; worth keeping and tightening).
3. **Explicit ban on summary-of-summary** (see above) — forces the model to add analytical value instead of
   restating input.
4. **Style guide with negative examples**, not just positive rules — "don't write like this" examples
   measurably outperform "write like this" positive-only guides because they give the model a concrete
   contrast class rather than an abstract target. Concretely: include 2-3 one-line "bad opener" examples
   in the prompt (generic scene-setters) alongside 1 "good opener" example.
5. **Few-shot with one gold example** — a single hand-edited, human-approved third-person article from this
   exact pipeline (once one exists) is worth more in the prompt than pages of rules. Recommend: after the
   first 3-5 human-approved articles under the new voice, promote the best one into the prompt as a worked
   example.
6. **Vocabulary constraint list** appended at the end of the prompt (see banned-word list above) — cheap,
   high-value, do it regardless of the rest.

Sources: [The Field Guide to AI Slop](https://www.ignorance.ai/p/the-field-guide-to-ai-slop),
[34 types of AI slop to avoid](https://momenticmarketing.com/blog/avoid-ai-slop),
[How to Spot AI Writing Tells — 17 examples + blacklist](https://www.oliviacal.com/post/ai-writing-tells),
[stop-slop skill file (self-editing for writing tells)](https://dev.to/wonderlab/one-open-source-project-a-day-no-78-stop-slop-a-skill-file-that-teaches-ai-to-eliminate-its-2nci),
[Few-shot prompting guide (pos/neg examples)](https://www.prompthub.us/blog/the-few-shot-prompting-guide),
[The prompt Towards AI uses to prevent slop](https://learnaitogethernewsletter.substack.com/p/the-prompt-we-use-to-prevent-ai-slop)

---

## 3. Third-person voice mechanics

**Attribution verbs**: "said" is the neutral default and should carry most of the load — it's invisible to
readers and never editorializes. For this content specifically (a host arguing opinions, not reporting facts),
a small approved set of stronger verbs is appropriate and matches how the show actually functions:
**argued, said, pushed back on, predicted, dismissed, singled out, conceded, called [X] "quote."** Explicitly
ban verbs that inject unearned judgment the model isn't positioned to make — **claimed, admitted, revealed,
insisted, warned** — these silently editorialize (e.g., "claimed" implies doubt about truth; "admitted"
implies reluctant confession) in ways a recap site quoting its own host shouldn't be doing. This maps almost
exactly onto standard newsroom attribution guidance.

**Quote handling / accuracy**: because this is the show's own site quoting its own host from its own
transcript, there's no fair-use concern — the concern is purely accuracy. Rules worth encoding:
- Direct quotes (inside quotation marks) must be verbatim substrings of the transcript text, not paraphrases
  dressed as quotes — this is checkable programmatically post-generation if desired (string-match the quoted
  text against the transcript blob).
- Light cleanup of verbal filler (um, you know, false starts) inside a quote is normal editorial practice,
  but must not change meaning or add words; mark any non-verbatim edit inside a quote with brackets per
  standard convention, or simply avoid quoting through a disfluency at all.
- Paraphrased claims ("Pate argued Georgia's defense is overrated") don't need quotation marks and don't
  need to be verbatim, but should still be traceable to a specific transcript passage/timestamp — this is
  the difference between a paraphrase and a fabrication.

**Pull-quote selection criteria**: the current schema has exactly one `pullQuote` field and one
`[PULLQUOTE]` marker per article. Good pull-quotes are: (a) self-contained — make sense with zero
surrounding context, (b) opinionated/quotable, not descriptive ("Georgia's offensive line is a problem, and
I don't think it gets fixed by November" beats "I talked to some scouts about Georgia's line"), (c) short
enough to read in one breath (roughly one sentence, under ~30 words), (d) ideally the same sentence anchoring
the article's central thesis, so the pull-quote and the headline/dek reinforce each other rather than
competing for attention.

---

## 4. SEO for this content type in 2026

**AI-content policy (verified against Google's current developer docs, fetched directly)**: Google does not
penalize content for being AI-assisted; it penalizes low-quality/manipulative content regardless of how it
was produced. The operative framework is still E-E-A-T with **trust as the dominant factor**, and content
must be "people-first" — created to genuinely help a reader, not engineered to rank. Google explicitly asks
publishers to self-assess: is the use of automation self-evident or disclosed; is there background on how/why
automation was used. Practical implication for this pipeline: the `workflowState: ai-drafted → approved →
published` gate is already the right shape for this — a visible, real human-approval step is exactly the kind
of signal ("experience," a real person vouching for accuracy) E-E-A-T rewards, and Josh's byline should now
be read as an editorial-desk byline/AN attribution rather than ghost-written-as-Josh. A one-line disclosure
in a footer or about page ("Articles are drafted from Josh's own show and reviewed before publishing") is
cheap and on-trend for 2026 guidance rather than something to avoid.

**Title patterns for CFB analysis/recap pieces**: episode-companion pieces benefit from titles that state the
claim, not the topic — "Pate: Georgia's defense is more fragile than the ranking suggests" outperforms
"Josh Pate breaks down Georgia's defense" for both click-through and for matching how people search
(they search the claim/team/controversy, not "breaks down"). Numbered-list titles ("3 things Pate got right
about the Big Ten this week") work for takeaways-format pieces specifically.

**Schema**: Article/BlogPosting schema is a baseline in 2026's top-10 most-used types; since every companion
article embeds a YouTube video via `[EMBED:HH:MM:SS]`, VideoObject schema (name, description, thumbnailUrl,
uploadDate, embedUrl) should sit alongside Article schema wherever an embed appears — Google explicitly treats
VideoObject as required for it to understand an embedded video at all, otherwise it has to infer from
surrounding text alone. This is a straightforward technical addition independent of the writing-voice change.

**Internal linking**: 2-5 contextual links per 1000 words is the commonly-cited range; for this site that
means linking to the source episode page, to the relevant franchise/series hub (weekend-truths, poll-day,
etc. — already a first-class concept per `series-classifier.md`), and to previous articles about the same
team/topic. Given `studio/schemas/article.ts` already has `primaryTeam` and `teams` fields, an automatic
"more on [team]" linked block is close to free to build and is exactly the kind of hub-and-cluster structure
2026 guidance rewards.

Sources: [Google: Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content),
[Google Search's guidance on AI-generated content](https://developers.google.com/search/blog/2023/02/google-search-and-ai-content),
[Video schema markup guide 2026](https://swarmify.com/blog/video-schema-markup/),
[Internal linking best practices 2026](https://upwardengine.com/blog/internal-linking-best-practices-seo/)

---

## 5. What separates a good companion article from a transcript summary

The editorial value-add is *everything the transcript doesn't say explicitly but a knowledgeable viewer
would supply*:

- **Context the episode assumes** — the transcript captures what Pate said, not what he's reacting to. A
  good article supplies the one sentence of context a reader needs if they didn't watch last week's episode
  or don't already know the storyline (an injury, a previous take, a rival analyst's take he's rebutting).
- **Records/standings/schedule facts the host references but doesn't restate** — "the Dawgs" or "after that
  loss" needs a name and a score attached in text even though Pate didn't spell it out on air, because he's
  talking to an audience that already watched the game.
- **Contrarian framing when it exists** — if Pate is taking a position against the grain (against the AP
  poll, against a "hot take" from elsewhere), naming that explicitly ("Pate is not with the field on this
  one") is what makes an article worth reading rather than notes-with-punctuation.
- **One specific angle per article, not full coverage** — the biggest structural failure mode of transcript
  summarization is trying to mention everything the host talked about. A good piece picks the single
  strongest, most specific claim in the episode and builds the whole article around it, leaving the rest of
  the episode for the embed/video itself to cover. This is the same lesson as the takeaways-list vs.
  argument-analysis comparison in section 1 — specificity over coverage.
- **A verdict, not just a report** — third-person coverage of an opinion show still needs a point of view on
  whether the argument holds up (does the record support it, is there a counter-argument the host didn't
  address) — otherwise it's stenography, not editorial coverage.

---

## Recommended article recipe

**Structure** (single-thesis argument-analysis, the strongest fit for a per-episode companion piece):
1. **Lede** — states the specific claim in the first sentence. No scene-setting, no "in this episode."
2. **Context** — 1-2 sentences supplying what the claim assumes (record, standings, prior take, rival
   argument) that a reader wouldn't already know.
3. **The argument, with evidence** — Pate's reasoning in his own words (quoted, verbatim, timestamped),
   interspersed with brief connective analysis. First `[EMBED:HH:MM:SS]` marker sits here, at the exact
   moment being described.
4. **The honest complication** — the counter-argument, a stat that cuts against it, or what would have to
   be true for Pate to be wrong. This is what separates editorial coverage from fan recap.
5. **The kicker** — a closing line with a point of view, not a restatement of the lede.

**Length**: keep the existing tiering — 600-1100 words with a full transcript, 300-500 words on
title/description only (current prompt values are sound; don't inflate word count just because more
transcript text is now available — length should track how much *specific* material exists, not how much
raw transcript there is).

**Voice rules**:
- Third person throughout: "Pate argued," "Pate said," never "I."
- "Said" is the default attribution verb; "argued/pushed back on/predicted/dismissed/singled out/conceded"
  are the approved alternates for when they're accurate to what's happening in the transcript. Never
  "claimed/admitted/revealed/insisted/warned."
- Byline becomes an editorial-desk attribution (or stays "Josh Pate's College Football Show" as a masthead
  credit), not a first-person voice signal.
- Every direct quote (in quotation marks) is a verbatim substring of the transcript; paraphrases don't get
  quotation marks but must still be traceable to a timestamp.

**Prompt directives (ready to drop in):**
1. Write in third person throughout. Refer to the host as "Pate." Never write "I," "my," or "we" as the host's voice.
2. Open the first sentence on Pate's specific claim, not on the episode, the format, or a scene-setting summary. Never begin with "In this episode" or any variant.
3. Every quotation-marked phrase must be a verbatim substring copied from the transcript text, not a paraphrase — the writer must be able to point to the exact `[MM:SS]` line it came from.
4. Use "said" as the default attribution verb. Approved alternates when accurate: argued, pushed back on, predicted, dismissed, singled out, conceded. Never use: claimed, admitted, revealed, insisted, warned.
5. Do not restate or summarize the episode title or description — every sentence must add information not already given in the source metadata.
6. Build the article around exactly one central claim from the episode. Do not attempt to cover everything discussed; name the single strongest, most specific argument and go deep on it.
7. Include one clear "honest complication" — a counter-argument, a contradicting stat, or what would have to be true for the claim to be wrong. Do not present the host's take as uncontested.
8. Supply any context (record, standings, rival take, prior episode's position) a reader would need but that the host didn't spell out on air, in one or two sentences, not a full recap.
9. Place each `[EMBED:HH:MM:SS]` marker at the exact transcript timestamp of the moment the surrounding paragraph is describing — never at a generic or approximate point.
10. Select the `[PULLQUOTE]` as the single most self-contained, opinionated sentence Pate says that also anchors the article's central claim — under ~30 words, comprehensible with zero surrounding context.
11. Do not use any of: delve, tapestry, landscape (metaphorical), crucial, pivotal, seamless, robust, leverage, elevate, navigate (metaphorical), realm, "it's important to note," "the key takeaway is," "in today's [x] world," testament, game-changer, unlock, dive deep, unveil. Do not close with "In summary" or "In conclusion." Avoid rule-of-three lists of adjectives.
12. Vary sentence and paragraph length; do not write in uniform metronomic paragraphs. End on a specific, opinionated line — not a restated thesis.
