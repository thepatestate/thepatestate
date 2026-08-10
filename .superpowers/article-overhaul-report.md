# Article pipeline overhaul — third-person editorial voice, staff byline, verbatim-quote validation

Branch: `main` (local commits only, NOT pushed). Commits: `caedb7d` — "feat: third-person editorial voice, staff byline, verbatim-quote validation, article schema/disclosure"; `9cf037e` — "fix: strip bracketed transcript annotations from verbatim-quote comparison" (see follow-up section below).

## What changed

**1. Voice switch (first-person-as-Josh → third-person editorial)**
- `prompts/global-preamble.md`: rewrote the opening paragraph to frame the writer as The Pate State's editorial desk covering Josh Pate's show as a subject, never as his own voice. Kept the porch-conversational/Herbstreit-analytical blend. §23 now opens with the "House adaptation" note required by the spec, and its Do/Don't and byline lines were updated to match (byline is fixed in code, never model-chosen; explicit "don't write as if you are Josh Pate in first person" added to the Don't list).
- `prompts/companion-article.md`: full rewrite per the research report's recipe — 5-part single-thesis structure (claim-first lede / context / argument-with-verbatim-quotes / honest complication / kicker), all 12 prompt directives (third person, claim-first lede, verbatim quotes, attribution-verb allowlist/banlist, no restating metadata, one-central-claim rule, honest complication, embed placement, pull-quote criteria, banned slop-word list, sentence/paragraph variation), the no-transcript no-meta-commentary rule, and the existing mechanics (length tiers, embed marker rules, single PULLQUOTE, plain-paragraph/`## `/`**bold**` formatting, never-fabricate).

**2. Byline → "The Pate State Staff"**
- `lib/generate.ts`: `BYLINE_JOSH` renamed to `BYLINE_STAFF = "The Pate State Staff"`.
- `lib/ingest.ts`: updated import/usage; byline is still assigned in code when building the article doc (never read from model output) — confirmed by the existing "forces byline... even when the draft tries to smuggle its own" test, updated to assert the new value.

**3. Verbatim-quote validator**
- `lib/generate.ts`: added `findNonVerbatimQuotes(body, transcript): string[]` — a pure function that extracts every straight- or curly-quoted span of ≥5 words from `bodyMarkdown`, normalizes both the span and the transcript (lowercase, curly→straight quotes/apostrophes, strip commas/periods, collapse whitespace), and reports spans that aren't a substring of the transcript. Short scare-quotes (<5 words) are exempt.
- `draftCompanion` now runs this check whenever a transcript was supplied: on a schema-valid draft with non-verbatim quotes, it does exactly one retry with the offending quotes named in the follow-up prompt; if the retry still has bad quotes (or fails), the last schema-valid draft is returned with `lowConfidence: true` rather than being discarded. `CompanionDraft.lowConfidence` is optional and only ever set by this code path (still never model-controlled).
- `lib/ingest.ts`: `lowConfidence` on the article doc is now `!transcriptText || draft.lowConfidence === true`.

**4. Disclosure line + VideoObject schema**
- `app/notebook/[slug]/page.tsx`: added a muted disclosure line near the article foot ("Articles are drafted from Josh Pate's College Football Show and reviewed before publishing.") and a `VideoObject` JSON-LD block (name, description, thumbnailUrl, uploadDate, embedUrl via youtube-nocookie) alongside the existing `NewsArticle` JSON-LD, rendered whenever the article has an episode reference.
- `lib/sanity.ts`: extended the `episode->` GROQ projection and `SanityArticle.episode` type with `description`, `thumbnailUrl`, `publishedAt` so the page has what it needs for the VideoObject fields.

**5. Tests**
- `lib/generate.test.ts`: added a `findNonVerbatimQuotes` suite (verbatim passes, paraphrase-in-quotes fails, curly-quote/punctuation normalization passes, short scare-quote exempt) and a `draftCompanion` suite (mocking `@anthropic-ai/sdk`) covering: no-transcript case skips the check entirely (single API call, no retry), one retry + `lowConfidence: true` when still bad, and a clean accept on retry with no `lowConfidence`. Byline constant test updated to `BYLINE_STAFF`/`"The Pate State Staff"`.
- `lib/ingest.test.ts`: mock and assertion updated from `BYLINE_JOSH`/"Josh Pate" to `BYLINE_STAFF`/"The Pate State Staff".
- Full suite: **74 tests passing** (10 test files).

## Regeneration of the draft queue

- Confirmed via GROQ that all 10 pre-existing articles were `workflowState == "ai-drafted"` (none approved/published) before deleting them via the Sanity mutate HTTP API.
- Ran a local `npx tsx` script (not committed — deleted after use) that imports the new `lib/generate.ts`/`lib/ingest.ts`-equivalent logic directly, iterates every `episode` doc (12 total, no episode docs touched/deleted), and regenerates an `ai-drafted` article for any episode missing one.
- **Race condition encountered and fixed**: production's `/api/ingest/poll` cron (still running the old pre-change deployed code, since nothing was pushed) recreated old-voice/"Josh Pate"-byline articles for the most recently-published episodes in the gap between my deletion and local regeneration finishing (it targets the 5 most recent episodes from the YouTube feed every cron tick). I resolved this by writing a second pass that finds any article with the stale byline and `createOrReplace`s it **in place on the same document id** (rather than delete-then-recreate), so the document is never briefly absent and the cron's existence check keeps skipping it. Confirmed clean afterward via `count(*[_type=="article" && byline!="The Pate State Staff"])` → 0.
- Final state: **12/12 episodes have an `ai-drafted` article, all with byline "The Pate State Staff"**. No episode docs were deleted or modified. 2 articles have `lowConfidence: true` (verbatim-quote retry still failed once, or no transcript was available).

## Verification

- `npm run build` — clean, no errors.
- `npm test` — 74/74 passing.
- Fetched a regenerated draft (`article-Jd032bCjqBc`, USC–Notre Dame rivalry piece) via GROQ and confirmed: third person throughout ("Pate argued...", "Pate said..."), no "In this episode" or scene-setting opener, no meta-commentary about missing sourcing, verbatim quotes attributed to specific transcript moments, honest-complication section present, kicker line, byline "The Pate State Staff".

### 10-line excerpt (article-Jd032bCjqBc)

> Josh Pate argued that rivalry games should be untouchable, full stop, and that the USC-Notre Dame series getting shelved for several years before its 2030 return is exactly the kind of scheduling drift college football needs to stop tolerating.
>
> The series will not be played this year or next, but it is confirmed to resume in 2030. A viewer asked Pate how he should feel about that news — celebrate the return, or resent the wait. Pate's answer was immediate: [EMBED:00:00]
>
> ## The argument
>
> Pate placed rivalry games above even the sport's biggest showcase. "It's like the Pope meme, man. I'm holding Notre Dame USC here above and beyond the college football playoff logo cuz I grew up like that," he said. He went further, saying rivalries are "the very bedrock and foundation of college football" and that they "should be more secure than Fort Knox."
>
> His proposed fix has no gray area. If he were commissioner, the terms of membership would be non-negotiable: "you sign up to be part of Notre Dame, you're signing up to play USC every year." [PULLQUOTE] From there, Pate said, "Case closed."

## Concerns / follow-ups

- **Production/local divergence risk is ongoing until this is deployed.** The `/api/ingest/poll` cron will keep running the old first-person/"Josh Pate" code against the live Sanity dataset every cycle until this branch is pushed and deployed. Any new episode published before deploy will get an old-voice draft that needs the same replace-in-place cleanup.
- Did not modify Vercel cron config, env vars, or deployment protection to stop the race — out of scope for a "commit but don't push" task and a meaningful production change; flagging instead so the next session pushes promptly or reruns the cleanup pass first.
- 2 of the 12 regenerated drafts have `lowConfidence: true` — worth a human glance in Sanity Studio before approving (one had a transcript but the verbatim-quote retry still didn't fully clear; check `bodyMarkdown` for the flagged quotes).
- §23 voice guide previously said Wire Desk/analysis-feature bylines could conditionally be "Josh Pate" after his approval-click; that conditional byline logic was not in code (byline was already hardcoded in `ingest.ts`), so no code change was needed there — only the prose in §23 was reconciled to match reality.

## Follow-up: transcriptStatus + lowConfidence cleanup (commit `9cf037e`)

**transcriptStatus.** My local `_regen.ts`/`_fix_stale.ts` scripts fetched transcripts to draft with, but — unlike `ingestEpisode` in `lib/ingest.ts`, which patches `episode.transcriptStatus` after every fetch attempt — they never wrote that field back. All 12 episodes still showed `transcriptStatus: "unavailable"` (or unset) despite drafts having been generated from real transcripts. Fixed by re-fetching each episode's transcript and patching `transcriptStatus: "fetched"` wherever it succeeded. Result: **12/12 episodes now show `transcriptStatus: "fetched"`.**

**lowConfidence — root cause.** Not a stale-data reuse issue and not the verbatim-quote retry path failing to retry — it retried correctly. The actual bug was in `findNonVerbatimQuotes`'s normalization (`lib/generate.ts`): it lowercased, folded curly quotes, and stripped commas/periods, but left `[MM:SS]`-style transcript timestamp markers as literal characters. `transcriptToPromptText()` emits one such marker per caption line, and real YouTube auto-captions run only 2-4 words per line — so almost any quote longer than a few words spans a caption boundary, and the transcript-side string ends up with a literal `[00:05]`-shaped token landing mid-quote. That breaks the substring match even when the quote is 100% verbatim spoken word-for-word. Confirmed directly: e.g. the transcript for VAw2weXnb9A reads `[00:00] Of course, this is the most all-in of\n[00:01] all-in teams...` — genuinely verbatim, but flagged, because `[00:01]` sits between "of" and "all-in" after normalization. A second, related artifact turned up in the same pass: YouTube auto-captions also insert non-speech annotation tags inline (e.g. `[music]`), which caused the same failure mode for a quote in the same article that didn't even cross a caption-line boundary in the usual sense.

Two prior "quote check" claims turned out to be shallow: (1) my own report said "2 lowConfidence:true," which was simply wrong — it undercounted because I hadn't looked past the two stale-byline articles I'd just fixed. (2) the controller's spot-check of "Pope meme / Fort Knox / bedrock" in `Jd032bCjqBc` confirmed those *phrases* appear in the transcript, but not that the full quoted *span* the model wrote is a contiguous substring — and per `findNonVerbatimQuotes` it wasn't (a `[MM:SS]` marker landed inside it), which is exactly the artifact this fix addresses.

**Fix applied** (`lib/generate.ts`): `normalizeForCompare` now strips *any* bracketed annotation (`\[[^\]]*\]`, generalized from timestamp-only) from both sides of the comparison before matching. Quoted spans extracted from `bodyMarkdown` never legitimately contain bracketed text, so this only ever helps the transcript side. Added two unit tests covering a quote spanning a caption-line boundary and a quote interrupted by a `[music]`-style tag — both now pass; full suite is **84/84 green**. `npm run build` clean.

**Re-verification against live data** (not a blind re-check with the same buggy function — the function itself was fixed first, then every previously-flagged article was re-evaluated against its real transcript with the corrected checker):
- 9 of 12 articles flipped/confirmed `lowConfidence: false` (quotes verified as genuinely verbatim once bracket artifacts were stripped).
- **3 articles legitimately remain `lowConfidence: true`** — manually traced each flagged span back to the raw transcript and confirmed these are real edits, not artifacts:
  - `article-VAw2weXnb9A` ("Pate's Case for Texas Isn't About the Skill Players..."): quote says "**is** not going to get as much attention," transcript says "**he's** not going to get as much attention."
  - `article-uPSenzdOS6Y` ("Pate's Real Question On Texas Isn't The Quarterback..."): quote splices two non-adjacent transcript clauses together under one uninterrupted quotation mark ("Questions are not weaknesses. Weaknesses are weaknesses," — transcript has "questions are not weaknesses, questions are questions. Weaknesses are weaknesses." with a full clause in between that got silently dropped).
  - `article-vf_lGBB5AsY` ("Pate's Defense of the Coaches Poll..."): quote says "**is** looking to do is prop up the SEC," transcript says "the last thing those guys **are** looking to" do it — a truncated fragment with a subject-verb mismatch.

  These 3 stay flagged correctly per the coordinator's own instruction ("articles genuinely generated from title-only stay true" — extended here to "articles whose quotes are genuinely non-verbatim stay true"). No further action needed; a human editor should tighten those specific quotes (or drop the quotation marks and paraphrase) before approving.

### Final counts
- Episodes with `transcriptStatus: "fetched"`: **12/12**
- Articles `lowConfidence: false`: **9/12**
- Articles `lowConfidence: true` (genuine non-verbatim spans, listed above): **3/12**
- Articles with stale byline: **0/12** (unchanged, still clean)
- Full suite: **84/84 passing**; `npm run build` clean.
