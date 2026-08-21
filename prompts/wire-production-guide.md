# THE PATE STATE WIRE — Production Guide v1.2
**What this is:** the complete standard for every breaking-news article on The Wire — writing, voice, structure, design, sourcing, and QA — regardless of story type. The reference implementation is wire-kansas-state-pastore-v3.html; every Wire page ships to that standard.

**The promise every page must keep:**

*"I saw the news somewhere else. I came to The Pate State to understand it."*

**Changed in v1.2:** the outlet-credit rule in §5 — never name another website in the lede or upper page; outlet credit lives only in the bottom sourcing box. Named individual reporters (a "Pete Thamel reports" situation) are the lone exception. v1.1 added §7, "The Porch Voice."

## 1. The Mission (Every Story, Every Time)
A Wire article is never a summary of someone else's reporting. It answers five questions, in order of depth:

- **What happened?**
- **Why is this bigger than the headline suggests?**
- **What are most people missing?**
- **What actually changes — on the field, the roster, or the program?**
- **What should the reader watch next?**

If the article only answers question one, it does not publish.

## 2. The Design Constitution
### The Pate State owns the page. The team provides the context.
- The page inherits the **production site shell**: rhythm bar (MON Weekend Truths → SAT We Watch Ball), sticky dark mast with gold-italic logo, global nav, Join Free button, gold scroll-progress bar, site footer. A Wire article lives *inside* The Pate State — it is never a separate media property.
- **Site tokens are law.** Use the site's :root variables exactly: white base, --off #F4F6F9 cards, --mast #0D1321, --navy #0E2240, --gold #C9A227 (the site's brand accent — inherits its existing site-wide semantics), --red #C8102E, --green #1E7D3E, --ink #151A22, --mut #5F6B7A, --hair #E5E9EF. Fonts: Public Sans (headlines + body), Barlow Condensed (labels/eyebrows/chips). No new typefaces, ever. Monospace only for tiny timestamp/data uses, if at all.
- **Red is the Wire signal.** The slim breaking strip under the mast, the WIRE chip, status dots, discovery eyebrows, the critical number in the stat strip. Small doses. Never whole sections.
- **Team color is a garnish, not an identity.** The team may appear in exactly: (1) the team chip with logo, (2) the hero graphic gradient, (3) at most one small contextual accent. Roughly: 70% site navy/white/off-white structure, ~20% neutrals, ~8% red signal, ~2% team color. Never recolor chips, bars, drop caps, quotes, links, or house modules in team colors.
- **The team-swap test (run before every ship):** mentally replace this team with Alabama, Oregon, USC, Notre Dame. If anything beyond the logo, team name, and one small accent would need to change, the design is wrong.
- **Decoration must communicate.** No ghost words, no glow stacks, no gradient walls, no animation beyond the breaking-pulse dot. Target feel: editorial authority + Saturday energy — never a betting dashboard.

## 3. The Story Architecture (Fixed Order)
Every Wire article uses this sequence. Sections marked ★ are required on every story; the rest deploy when the story supports them.

| **#** | **Section** | **Words** | **Notes** |
|---|---|---|---|
| — | ★ Status + Impact chips | — | See §4. Both appear in the kicker row. |
| — | ★ Headline | — | Lead with the biggest **consequence**, not the transaction. Specific, searchable, no clickbait. |
| — | ★ Deck | 35–60 | Reveals the deeper stakes, not the whole story. One layer the headline doesn't show. |
| — | ★ Byline row | — | "The Pate State Wire Desk" avatar, source list (dynamic — never a hard-coded count), status dot, date. |
| — | ★ At-a-Glance strip | 3 stats | Three numbers that establish scale in seconds. Precision rule: §8. Critical number renders red. |
| 01 | ★ What Happened | 100–175 | Lead with the news itself, attributed to the official source or a named reporter — never another website (§5). All facts, fast. |
| 02 | ★ Why This One Matters | 100–175 | Quantify the magnitude. The human/career arc compresses in here (≤3 sentences) or into a compact timeline — never both. |
| 03 | ★ What Most People Are Missing | 90–130 | The signature discovery module. See §6. |
| 04 | Next Man Up / What Changes Now | 125–225 | Title adapts by story type (§10). Replacement Board only when a real depth question exists. |
| 05 | The Chessboard | 100–160 | Only when a genuine schematic angle exists. Phrase as *possible coaching responses*, never confirmed plans. |
| 06 | ★ The Pate State Read | 120–175 | One thesis, in the porch voice (§7). Never a summary. |
| 07 | ★ What We're Watching | 75–125 | 3–4 concrete tells the next reporting cycle will answer. |
| — | ★ Sourcing & standards box | — | Named sources with links; "monitored by an editor; corrections timestamped, never silent." |
| — | ★ What to Read & Watch Next | — | Full-width strip closing the page: **the latest show video first** (▶ red badge), then 2–3 Wire articles. Video + articles, always both media types. Exact title, exact order: "What to Read & Watch Next." |

**Word count is non-negotiable:** 600–1,100 words of article prose (chips, boards, labels, sources, related links don't count). Routine stories: 600–750. Major stories (coaching changes, star injuries, QB moves, portal bombs, playoff news): 850–1,100. Over 1,100 → cut repetition, never shrink fonts.

**Flow test:** every section moves the reader *deeper*. If a paragraph restates something already established, delete it.

## 4. Status & Impact Taxonomy
**STATUS** (green chip):

- **CONFIRMED** — announced by school, coach, player, or conference.
- **REPORTED** — credible reporting, no official confirmation yet.
- **DEVELOPING** — core facts unresolved or conflicting.

Split statuses when parts differ, in the facts rail: *"Absence: confirmed · diagnosis: per On3 · replacement plan: developing."* An unresolved follow-up (like a replacement) does **not** make a confirmed injury "developing."

**IMPACT** (gold chip + one-sentence rationale in the rail):

- **LOW · MODERATE · SIGNIFICANT · MAJOR · SEASON-SHAPING**
- Rate the football consequence, not the story's popularity. SEASON-SHAPING is reserved for developments that can realistically alter a championship/playoff/division trajectory. Calibrated language beats drama — credibility is the product.

## 5. Attribution, Accuracy, and the Josh Rule
- **The outlet-credit rule.** Never name another website in the lede or anywhere in the upper page — not On3, ESPN, 247, The Athletic, or anyone else. The lede leads with the news itself, attributed to the official source when confirmed: "Kansas State starting left tackle John Pastore will miss the 2026 season, head coach Collin Klein confirmed Thursday." The lone exception is a **named individual reporter** breaking the story — "Pete Thamel reports" is acceptable; "ESPN reported" is not. Unconfirmed reported details are phrased as "reported to be…" in the body, with the outlet credited by name **only in the bottom Sourcing & Standards box**, with a link. This satisfies attribution honestly without sending readers to a competitor in sentence one — and never imply The Pate State broke news it didn't.
- **Four categories, never blurred:** confirmed fact · reported information · analysis · projection. Label projections as projections (e.g., the Replacement Board header carries "Pate State projection — not a confirmed depth chart").
- **Never invent:** injury details, diagnoses, timelines, return dates, depth-chart decisions, quotes, stats, recruiting/eligibility info, coach or player opinions, NFL evaluations, opponents, or schedule details. Unknown = say it's unknown. (Reference-build lesson: an invented opener opponent was caught in QA and cut. The rule exists because the temptation is real.)
- **The Josh Rule:** never manufacture, paraphrase, or project a Josh Pate opinion. No "Josh thinks / Josh would say." No disclaimer either — never write "Josh has not yet commented" or speculate on when he will. The Pate State Read stands on its own as house analysis. If Josh comments publicly later, add a clearly attributed **Josh's Take** module and timestamp the update.
- **Source synthesis:** never "Source A said, Source B said." Establish the verified facts, determine what they mean *together*, write one coherent Pate State story, attribute the load-bearing reporting.

## 6. The Three Signature Modules (Recurring Pate State IP)
These three sections do different jobs, look identical on every team's story, and are never recolored for the subject team.

**WHAT MOST PEOPLE ARE MISSING — Discovery.** *Job:* the second-order implication a headline reader overlooks. *Look:* white card, 4px **red** left rail, red eyebrow line, standard ink text. *Standard:* the reader thinks "I hadn't thought about that." Hunt in: roster construction, a second absence that magnifies the first, schedule timing, scheme fit, experience math, a portal decision that just aged badly, a downstream position battle. **No forced contrarianism** — the conventional reaction is often correct, just incomplete. The best versions reframe (talent loss → *certainty* loss), not contradict.

**THE CHESSBOARD — Football intelligence.** *Job:* what coaches could actually change. *Look:* deep **navy** card, warm-white text. *Standard:* teach the reader football with named mechanisms — slides, chips, personnel groupings, launch points, pressure rates, box counts, RPO volume — phrased as plausible responses ("the likeliest levers"), never confirmed plans. "The offense may have to adjust" is banned; *how* is the section.

**THE PATE STATE READ — House conclusion.** *Job:* the thesis. *Look:* warm **cream** card (#FCF9EF), red top rule, red eyebrow, navy text — the newspaper card the reader learns to recognize without reading the label. *Standard:* one argument, one supporting flow, one honest counterweight if it exists. Written in the porch voice (§7) — this is the section readers hear in Josh's cadence, so it is held to the strictest voice standard on the page. Vary the construction across stories. A thesis, not a catchphrase.

## 7. The Porch Voice (Anti-AI-Cadence Rules)
The Wire is smart, but it talks like a person. These rules apply to all article prose and are enforced hardest in The Pate State Read.

- **No em dashes in article prose. Zero.** The em dash is the number-one AI tell. When a sentence wants a dash, break it into two sentences instead. (Dashes remain fine in labels, chips, data rows, and metadata — this rule is about prose.)
- **Short declaratives over clause-stacking.** One idea per sentence, most of the time. A colon followed by a four-item list inside one sentence is essay writing, not porch talk. Break lists into their own short sentences: "Not one starter back from last year's five. Three transfers from three different programs."
- **No abstraction where a football word exists.** Banned register: "shared language," "institutional memory," "structural math," "the counterweight is real," "compounding tax." Say the football version: "this line has never played a snap together," "four guys who know the calls," "they'll protect the new guy with tight ends and chip help."
- **One metaphor maximum, then drop it.** Never stack a metaphor across three sentences ("machines run on time… the schedule isn't selling any… the bill shrinks"). If an image can't be paid off in one sentence, cut it.
- **Conversational connectors are allowed and encouraged.** "Now, if any program in America deserves the benefit of the doubt here, it's this one." "Here's the thing." "That's the wrong place to start." These are the sound of the brand.
- **End plain.** The last sentence of an analysis section should land as a simple statement a person would say out loud, not a crafted flourish. "How fast they can stop doing that will tell you what kind of season this is."
- **The read-aloud test (mandatory before ship):** read The Pate State Read out loud. If it sounds like a written thesis instead of a guy on a porch explaining the story to a friend, rewrite it until it does.

**The canonical before/after (from the reference build):**

*Before (essay voice):* "The first question is who plays left tackle. The more important question is what this line's shared language is. 'Next man up' assumes a system with institutional memory absorbing one absence — and as of Thursday, this room has none…"

*After (porch voice):* "Everybody's first question is who plays left tackle. That's the wrong place to start. The real issue is that this line has never played a snap together. Next man up works when four guys who know the calls absorb one new face. Kansas State doesn't have that."

Same insight. Different sound. Ship the second one.

## 8. Numbers, Precision, and the Wow Rule
- **Three great stats beat twelve available ones.** Every number must answer a question: how experienced, how productive, how replaceable, how vulnerable, how young.
- **Precision is house law.** "0 returning starts" is wrong if any lineman has ever started anywhere; "0 starters returning from the 2025 line" is right. Write claims that survive a fact-check comma by comma.
- **The Wow Rule:** "wow" means better insight, not more adjectives. Specific beats dramatic: name *who* must step up, *which* protections change, *which* stat reframes the headline.
- **Defensible beats absolute.** Cut any colorful claim whose mechanism can't be supported ("ends hundreds of careers a year," "never happens through the middle"). Great writing makes the truth vivid; it never stretches the truth to get there.
- **Banned phrases** (non-exhaustive): "remains to be seen," "only time will tell," "moving forward," "will look to," "underscores," "at the end of the day," "one thing is certain," "something to monitor," "this development comes as." If a sentence could open any article about any team, it doesn't belong in this one.
- **Go one level deeper:** after every obvious sentence, ask "why does that matter *for this team specifically*?" until the answer is interesting. That last layer is usually the story.

## 9. Data & Visual Modules (Deploy When Earned)
- **The Ledger viz** (navy-header bar chart): when unit-level numbers quantify the loss/gain. Last bar = the punchline, rendered red when negative.
- **Replacement Board** (navy-header table): up to three *realistic* candidates — never three for symmetry — each with class/background and the one question around him. Header always carries the projection disclaimer.
- **Room Board** (Out / Arrivals / Internal): unified card system; red indicator for out, neutral for arrivals, navy for internal. Never one saturated color family per column.
- **Compact timeline:** only when a career arc materially improves the page, and only *instead of* prose milestones, never duplicating them.
- **Facts rail** (sticky right rail): player line, injury/status line with split statuses, résumé line, collateral news, next date. Plus the Impact card with its one-sentence rationale, and the Join card.

## 10. Story-Type Playbook
The architecture holds for every story; section 04's title and the module mix adapt.

| **Story type** | **Section 04 title** | **Modules that usually earn their place** | **The angle to hunt** |
|---|---|---|---|
| **Injury / departure** | Next Man Up | Ledger viz, Replacement Board, Chessboard | What the plan was *built around*; the second absence that magnifies the first |
| **Coaching hire/fire/promotion** | What Changes Now | Chessboard (scheme fingerprint), timeline of the coach | What the hire says about the program's self-diagnosis; which players' stock moves |
| **Transfer portal (in/out)** | Where This Leaves the Roster | Room Board, Replacement Board | The chain reaction — one move creating a hole or logjam elsewhere |
| **Recruiting commitment/decommit** | Where This Leaves the Class | Class-context stat strip | Positional need vs. rankings; who they beat; what it signals about the pitch |
| **Depth chart / QB battle resolution** | What the Decision Tells Us | Chessboard | What choosing player A over player B reveals about the staff's priorities |
| **Suspension / eligibility / legal** | Where This Leaves the Roster | Facts rail with careful split statuses | Stick strictly to reported facts; calibrate impact conservatively; no speculation on outcomes |
| **Conference / playoff / rules news** | What This Changes | Bracket/format explainer module | Who benefits mechanically; the team-level consequence hiding in the league-level story |
| **Poll & rankings reaction** | What the Number Means | JP Poll context strip | The Model vs. the market vs. Josh's on-record positions (see §11) |
| **Game fallout / results** | What It Changes Going Forward | Ledger viz | The result vs. the on-record pick — grade the receipt honestly |

Minor stories: stay near 600 words, combine sections, never force the Chessboard, the Board, or a fake contrarian "Missing." Even a small story must deliver at least one thing the headline didn't.

## 11. Canon Consistency (Site-Wide)
- **The JP Poll is the Model** — power ratings, not a ranking. Josh's personal rankings and bracket are separate voices. Never blend them; never manufacture either.
- Wire articles must never contradict on-record site positions (annual picks, the consistency ledger, JP Poll numbers). When news collides with an on-record pick, say so plainly and link the receipt — receipts are the brand.
- House vocabulary: citizens, the Porch, the Ledger, graded in January, corrections timestamped never silent. Breaking coverage publishes autonomously under the standards page; Josh-voice content requires his approval and clear attribution.

## 12. Pre-Publish QA (Run Every Time)
**Attribution & accuracy:** lede attributes to official source or named reporter, never another website · outlet credit and links live only in the sourcing box · no invented facts · fact/reported/analysis/projection cleanly separated · statuses precise, split where needed · source list matches sources actually used (never a hard-coded count). **Value:** every section adds something new · at least one genuine second-order insight · the three signature sections do three different jobs · a reader who knew the headline still learns enough to be glad they clicked. **Football:** the article explains football rather than talking about it — named players, named mechanisms, named consequences. **Voice:** zero em dashes in article prose · no banned phrases or abstraction register · one metaphor max, paid off in a sentence · The Pate State Read passes the read-aloud test. **Style:** no unsupported absolutes · varied sentence rhythm · calibrated significance · 600–1,100 prose words. **Design:** site shell inherited · tokens exact · team-swap test passes · red controlled · signature modules in house colors · What to Read & Watch Next present with video + articles · tag-balanced, self-contained HTML.

**The final test:** would a serious college football fan who already knew the headline finish this page and feel smarter about the sport? If not, it isn't done.

*The Pate State Wire · Production Guide v1.2 · Aug 20, 2026 · Reference build: **wire-kansas-state-pastore-v3.html** (final, porch-voice edition) · Companions: the Wire Desk master prompt (story generation) and the site design tokens (page shell).*
