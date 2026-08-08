THE PATE STATE — SITE OPERATIONS MANUAL
Complete automation specification for build & handoff
Prepared for: Isaac Meek (implementation lead) Version: 1.1 — August 7, 2026 (autonomy revision) Companion file: the-pate-state-site.zip (18-page approved wireframe — this is the visual/UX source of truth. Build what's in the wireframe; this document explains how it runs itself.)


0. WHAT THIS SITE IS (read first)
The Pate State is not a news site that happens to have a community. It is a community with a newsroom attached. Every automated system below serves one loop:

Shows bring people in → open articles catch search/AI traffic → gated "Citizens Only (free)" content converts them to registered citizens → citizens get the daily Playbook email + free Preseason Guide → rituals (Poll Day, Picks, brackets) bring them back → their votes/picks become proprietary data → that data becomes content nobody else has → repeat.

Success metric #1 is registered citizens. Traffic is second. Never make an automation decision that trades citizen trust for pageviews.

The autonomy model (v1.1): This site runs itself. Breaking news, wire items, data surfaces, rankings, grading, emails, and social clips all publish fully automatically under the machine guardrails in §13 and §21 — no per-item human click. Human approval is reserved for exactly one category: content published in Josh's voice or under Josh's byline (episode companion articles, Weekend Truths, the Watch Order paragraph, mailbag answers). One human monitor watches the dashboards throughout the day (§22) and can pause any pipeline with one switch, but the pipelines do not wait for them.


1. RECOMMENDED ARCHITECTURE
Layer
Recommendation
Why
Framework
Next.js 14+ (App Router) on Vercel
ISR/SSG for SEO pages, edge functions for live data, preview deploys
CMS
Sanity (or Payload) headless
Structured content, editorial workflow states (draft → AI-drafted → approved → published), webhooks
Database
Postgres (Supabase)
Citizens, picks, ballots, brackets, ledger entries, leaderboards; Supabase also gives auth + row-level security
Auth / Citizenship
Supabase Auth (email magic link + Google/Apple OAuth)
One-tap citizenship; email is the whole point
Email (The Playbook)
Customer.io or Beehiiv
Daily automated newsletter assembled from site content (spec §8)
AI
Anthropic API — claude-sonnet-4-6 for all generation; upgrade individual pipelines only if quality demands
Fast, cheap enough for daily volume; all prompts in §12
Video
YouTube Data API v3 + official embeds
Never re-host Josh's video; embed only (keeps his YT metrics intact)
Sports data
CollegeFootballData.com API (CFBD) as primary (cheap, comprehensive); SportRadar if/when budget allows for sub-minute live scores
Scores, schedules, rankings, lines
Jobs/cron
Vercel Cron or Inngest
Every schedule in §11
Search on site
Algolia or Postgres full-text
Episode + article archive search
Analytics
Plausible (public-facing) + Postgres event tables (picks, votes, streaks)
KPIs in §14
Media/CDN
Vercel/Cloudflare Images
Auto-resize; every image gets width variants + WebP

Environment variables Isaac will need to provision:

ANTHROPIC_API_KEY

YOUTUBE_API_KEY            # Google Cloud console, YouTube Data API v3 enabled

CFBD_API_KEY               # collegefootballdata.com

SANITY_PROJECT_ID / SANITY_TOKEN

SUPABASE_URL / SUPABASE_SERVICE_KEY

EMAIL_PROVIDER_KEY

SPORTRADAR_KEY             # optional, phase 2


2. THE YOUTUBE PIPELINE (the heartbeat)
Everything starts with Josh's channel. Source of truth: Josh Pate's College Football Show channel (get the channel ID once via API; store as JP_CHANNEL_ID).
2.1 Detection — new video published
	•	Primary: subscribe to YouTube PubSubHubbub push notifications for the channel (instant webhook on publish).
	•	Fallback: poll search.list?channelId={JP_CHANNEL_ID}&order=date every 10 minutes (belt and suspenders — PuSH leases expire).
	•	On detection, create an episode record: {yt_id, title, description, published_at, duration, thumbnail_url, series (classified in 2.3), view_count}.
2.2 Transcript acquisition
	•	Try YouTube's own caption track via API (captions.list → download if available).
	•	If unavailable within 30 min, pull audio → Whisper large-v3 transcription (self-hosted or API).
	•	Store transcript with timestamps in the episode record. Timestamps matter — they power the "starts at 14:22" deep links in articles.
2.3 Series classification
Classify each video into one of the franchises using title + publish day (Claude call, prompt §12.1):

	•	weekend-truths (Mon recap) · poll-day (Tue) · sit-down (Wed interviews) · picks-drop (Thu) · espn-friday · mailbag · general

The series determines the article template, the franchise badge (📝 🗳 ✓ 🎙), and where it surfaces on the site.
2.4 Episode → written companion article (THE core content engine)
Within 60 minutes of every episode publishing, the system must produce a draft companion article and place it in the editor's approval queue.

Process:

	•	Send transcript + metadata to Claude with the Companion Article prompt (§12.2).
	•	Output is structured JSON (schema in §12.2): headline, dek, body (with [EMBED:{timestamp}] markers where the relevant clip should appear), pull quote, tags, team references, internal-link candidates, SEO fields.
	•	System auto-inserts: the episode embed at each [EMBED] marker (YouTube embed with ?start={seconds}), the JP Poll data panel if a top-25 team is tagged, the team-page link card for the primary team, related-articles module.
	•	Article enters CMS in state ai-drafted. Editor (or Josh) reviews in the Sanity dashboard — expected edit time 5–10 min — clicks Approve → publishes.
	•	Byline rules: if the article is a faithful writeup of Josh's own words/takes → byline "Josh Pate" (he approved it). If it's aggregation/news → byline "The Wire Desk" with the standing disclosure (see §3.4).
2.5 Homepage/show-page sync
On publish of any episode: revalidate the homepage hero episode slot, the Show page "Latest Drops" grid, and the archive. Most-popular ordering = trailing-30-day view_count from the API, refreshed daily 6:00 AM ET.
2.6 Clips & Shorts
Poll the channel's Shorts (same API, videoDuration=short) hourly; newest 6 populate the "Clips & Shorts" strip automatically. No approval needed (it's Josh's own published content, embedded).


3. THE WIRE (breaking news) + THE WIRE DESK (AI instant stories)
3.1 Monitoring inputs
Poll every 5 minutes, 6 AM–midnight ET (15 min overnight):

	•	RSS/APIs: ESPN CFB news, On3, 247Sports, CBS Sports CFB, Yahoo CFB, AP CFB wire
	•	CFBD transactions/coaching-change endpoints
	•	Official conference + school press-release feeds (build the list once; ~150 feeds)
	•	X/Twitter lists of insiders — via API if available, else a scraping service — used for detection only, never as sole source
3.2 Dedup + wire item creation
Cluster incoming items by story (embedding similarity > 0.85 = same story). For each new cluster, Claude writes a wire item (prompt §12.3): ≤ 12-word bold headline + ≤ 25-word sub + category + team tag(s) + timestamp. Wire items auto-publish to the Wire columns (home + Notebook) without human review — they are short, sourced, factual. Every item stores its source URLs internally.
3.3 Importance scoring → full-article trigger
Each cluster gets an importance score 1–10 from Claude (criteria in prompt §12.3: national relevance, top-25 involvement, coaching/QB/playoff impact, recruit rank, virality).

	•	Score ≥ 7 → auto-trigger the Wire Desk full story pipeline: Claude drafts a complete 400–700-word article (prompt §12.4), it passes the automated verification stack (§21), and it publishes immediately with no human approval. The wire item gets its ⚡ "Full Story Ready" badge the moment the article is live. The human monitor is notified after publication and can retract/correct. Target: news → live article in under 10 minutes.
	•	Score 4–6 → wire item only.
	•	Score ≤ 3 → hold unless it fits a team page.
3.4 Standing disclosure (must render on every Wire Desk article)
"This story was drafted by The Pate State's Wire Desk AI from the cited sources and reviewed by an editor before publication." This sentence is the trust moat. Never remove it.
3.5 Corrections
Any factual correction: strike-through original text, append correction note with timestamp. Never silently edit facts post-publish (Google News + reader trust both require this).
PART 2 — DATA FEEDS
4. SCORES & SCHEDULES (scores.html)
4.1 Live scoreboard
	•	Source: CFBD /games + /scoreboard (or SportRadar push in phase 2).
	•	Saturdays & any gameday: refresh every 30 seconds while any game is live; edge-cached JSON so the page never hammers the API.
	•	Card states exactly as wireframed: LIVE · Q3 8:42 (pulsing dot), FINAL, 7:30 PM ET; leader's score in gold; network tag from CFBD tv field.
	•	Off days: show "Next Saturday's slate" (upcoming games sorted by JP-Poll-weighted watchability, see 4.3).
4.2 Team schedule picker
	•	Annual sync every June 1 + weekly diffs: pull all 136 FBS team schedules from CFBD into schedules table.
	•	Dropdown ordering (as approved): optgroup 1 = current JP Top 25 with rank numbers; optgroup 2 = all 136 A–Z. Regenerate the Top-25 group every Tuesday after the poll reveal.
	•	Row rendering: home dates gold, ROAD TRIP / NEUTRAL SITE labels, ⭐ on games involving a JP Top 25 team, and WATCH-LIST GAME when the game appears in that week's Top 10 (4.3).
4.3 Top 10 Games of the Week ("The Watch List")
Every Thursday 9:00 AM ET (pairs with Picks Drop):

	•	Pull the week's slate + lines from CFBD.
	•	Claude ranks the 10 most watchable (prompt §12.5 — watchability ≠ biggest brands; criteria: stakes, spread closeness, rivalry, chaos potential, JP Poll ranks) and writes each game's one-line meta ("NIGHT GAME CHAOS INDEX: HIGH") + Josh's Watch Order paragraph for the conference section.
	•	Helmet art: SVG helmets auto-colored from the teams table (primary_color, secondary_color from CFBD). Production upgrade: licensed logo pack (see §15) drops into the same slots.
	•	Publishes automatically as data; the Watch Order paragraph goes through 60-second editor glance (it's voice content).
	•	"Best game in every conference": highest-ranked Watch List game per conference, automatic.
5. THE JP POLL (poll.html — the signature IP)
5.1 Weekly cycle (immovable ritual times, ET)
	•	Sunday 8:00 PM — ballots open to citizens. Ballot = rank your top 10 (drag UI) + the 4 side votes (No. 1, most overrated in AP, best win, best atmosphere attended).
	•	Tuesday 9:00 AM — ballots close.
	•	Tuesday 12:00 PM — reveal publishes site-wide, synced to Josh's Poll Day episode. Never publish before the video is live — the show reveals it first, always.
5.2 Tabulation (pure math, auto-publishes)
	•	Points: rank 1 = 25 pts … rank 10 = 16 pts (standard ballot weighting, extended: teams ranked by total points; ties → % of first-place votes → head-to-head if played).
	•	Anti-brigading: one ballot per citizen; ballots from accounts < 7 days old are counted separately and excluded if they exceed 15% of total and skew one team by > 3 spots (log + alert, don't announce).
	•	Store weekly snapshots forever → powers team-page rank history and "JP said it first" receipts.
5.3 Comparison tables (auto)
	•	Ingest AP + Coaches (weekly, CFBD/AP API) and CFP rankings (in season, Tuesday nights).
	•	Auto-build both approved modules: the arrows table (Δ vs each poll, ★ on the two largest disagreements) and "Four Boards, Side by Side" (top 10 columns; gold JP cell wherever JP differs from that rank's consensus).
	•	"Citizen Confidence" stats (e.g., "74% say top-4 seed") come straight from side-vote aggregates — these feed article data panels automatically.
5.4 Rank cards
Top-5 rank cards (home + poll page) regenerate on reveal: rating = normalized points (leader ≈ 96–97 scale, cosmetic), Δ arrows vs last week, OFF/DEF/SOS pills from CFBD advanced stats (SP+ offense/defense percentile, SOS rank).
6. RECRUITING (recruiting.html)
6.1 Nightly sync — 3:00 AM ET
	•	Team rankings: 247Sports Composite + On3 Industry team pages (licensed API if obtainable; otherwise a maintained scraper with change-detection alerts — scrapers WILL break in December, monitor them).
	•	Pate Recruiting Index = average of the two team ranks; tie-break = higher 247 points. Store nightly snapshots (movement arrows).
	•	Player rankings: 247 Top247 + On3 industry player lists → merged player table (rank, pos, ht/wt, hometown, school, commitment, stars per service).
	•	Commit/decommit/flip detection vs yesterday's snapshot → auto wire item (score via §3.3; a five-star commit is typically ≥ 7 → full Wire Desk story).
6.2 Page assembly (auto)
Top-5 rank cards (commits / five-stars / blue-chip pills, 247 pts as the big number) + full sortable table + player top-100 + recruiting wire filtered to category=recruiting.
7. JOSH vs. THE PROS + PORCH PICK'EM (pickem.html)
7.1 The Pros board (20 personalities)
	•	Input: each pro's public weekly picks. Reality: no clean API exists. Build an admin picks-entry screen — a staffer enters each pro's published picks Thu–Sat (sources: their shows/posts; store source link per pick). Claude can pre-fill by reading provided links/transcripts (prompt §12.6); staffer confirms. ~20 min/week of human work; this data is gold, treat it as sacred.
	•	Grading: Sunday 2:00 AM ET, auto-grade every pick vs closing lines (CFBD betting endpoint). Recompute season ATS records, re-rank, regenerate the two-column board (Josh's row styled per wireframe), and render the auto-share graphic (server-side OG image: "JOSH 71–43 · PORTNOY 50–64") for social.
	•	Rules page footnote: picks counted only when published publicly before kickoff; source links retained.
7.2 Porch Pick'Em
	•	Thursday 8:00 AM ET: board of 10 games auto-generated (same watchability engine §4.3, biased toward ranked matchups + one chaos game), lines locked from that morning's consensus. Editor glance, publish by 9:00.
	•	Lock: Saturday 11:58 AM ET (hard cutoff; UI countdown ticks live — this countdown is the single best engagement device on the site, make it prominent).
	•	Scoring: straight-up 10 pts, ATS 15 pts (player chooses mode per pick), streak bonus +5/game after 3 straight, upset bonus = underdog moneyline in points/10.
	•	Sunday 2:00 AM: auto-grade, update: top-10 leaderboard + "You" row (rank, points), season record + pick % ("YOUR SEASON: 44–28 · 61.1%"), badges (🏆 weekly win, 🎯 5-streak, 🗳 poll streak, 🏟 attended-game verified), the "only X% of citizens beat Josh" line (computed weekly, auto-inserted home + pickem).
	•	Leagues: private groups (create/join by code), commissioner = creator; league leaderboards same engine filtered by group.
	•	Prize fulfillment queue: weekly/monthly/season winners land in an admin queue with shipping-info request emails auto-sent. Champion + Wall of Champions updates are manual (they involve Josh's calendar).
8. THE PLAYBOOK (daily email — the retention engine)
Assembled automatically 5:30 AM ET daily, sent 6:00 AM:

	•	Template: yesterday's episode (thumbnail + 1-line hook) → top 3 wire items → today's ritual CTA (Mon: Weekend Truths link; Tue: POLL REVEAL AT NOON; Thu: PICKS ARE LIVE; Sat: watch-list + your picks reminder; Sun: BALLOTS OPEN) → one community stat ("SicEmSaturdays ran the week 9-1") → shop/tour slot (only when there's news; no filler ads).
	•	Claude writes the subject line + intro sentence in Josh's voice (prompt §12.7); everything else is templated data. The daily email auto-sends without approval (it's assembled from already-approved content) — but any day containing a Wire Desk story about a tragedy/scandal flags for human review first (sensitivity gate, §13.3).
PART 3 — INTERACTIVE SYSTEMS, SCHEDULE, PROMPTS & GUARDRAILS
9. CITIZENSHIP, GATING & THE GIFT
9.1 Signup flow (must be ≤ 30 seconds)
Email or one-tap OAuth → pick a handle → optional favorite team → done. Immediately: welcome email with the 2026 JP Preseason Football Guide (PDF/flipbook link) — the Citizen Gift — plus Playbook subscription (pre-checked, one-click unsubscribe, honest copy).
9.2 Gating rules (encode exactly)
	•	Always open (SEO layer): all news/wire, rankings, scores, schedules, recruiting tables, team pages, tailgate guide basics, most columns.
	•	Citizens Only · Free (conversion layer): the Mailbag, JP Poll ballot-data deep dives, "survival guide"-tier evergreen guides, voting, Pick'Em, Bracket Challenge, Ledger, commenting.
	•	Gated article UX: first 2 paragraphs visible → gold-bordered gate card ("Still free, forever. Citizenship is just how the porch knows who's home.") → inline signup, return to position after auth. Never gate anything Google sends cold traffic to.
	•	The 🔑 badge auto-renders from the CMS access: citizens field.
9.3 Data captured per citizen (powers everything)
handle, email, favorite team, join date, poll-vote streak, pick record, badges, ledger entries, stadiums visited, league memberships. This table IS the business.
10. PLAYOFFS PAGE SYSTEMS
	•	Current bracket + rankings: every Sunday 9:00 PM ET in season, regenerate the 12-team field from JP Poll + conference standings (champs = top 4 seeds/byes per CFP rules), both approved mirrored-bracket renders (AI Predictor's + Josh's), and the seeds table + First Four Out.
	•	Josh's bracket: admin form; Josh (or producer) updates his picks; every change is timestamped publicly ("Updated Oct 12") — receipts are the brand.
	•	AI Predictor's bracket: weekly Claude run (prompt §12.8) fed current records/SP+/remaining schedules; store its stated reasoning; grade vs Josh in January with a permanent results page.
	•	Run the AI Playoff Predictor (the tool): Anthropic API call per wireframe. Rate-limit 5 runs/hour per citizen (1 for anonymous), cache identical inputs 10 min, always render the "demo fallback" if the API errors.
	•	Citizens' Bracket Challenge: Window 1 (August bracket) locks at Week 1 kickoff — scoring +10 field / +25 exact seed / +100 champion, auto-scored weekly as reality unfolds. Window 2 opens Selection Sunday, round scoring 10/20/40/80, locks at first-round kickoff. Combined leaderboard; prize queue same as Pick'Em.
11. THE MASTER AUTOMATION CALENDAR (all times ET)
When
Job
Every 5 min (6a–12a)
Wire monitoring + dedup + wire items + importance scoring
Every 10 min
YouTube poll fallback; Shorts refresh hourly
On YT webhook
Episode ingest → transcript → companion article draft → editor queue
Daily 3:00 AM
Recruiting sync + Index recompute + commit-diff wire items
Daily 5:30 AM
Playbook email assembly → 6:00 send
Daily 6:00 AM
View-count refresh; most-popular reorder; sitemap ping
Mon
Weekend Truths companion is the flagship article of the day (from Monday's episode)
Tue 9:00 AM
Ballots close → tabulate → hold
Tue ~12:00 PM
Poll reveal publishes WITH the episode; rank cards, comparison tables, ticker, schedule-picker Top-25 group all regenerate
Thu 8:00 AM
Pick'Em board + Watch List + conference bests generated → 9:00 publish
Sat 11:58 AM
Picks lock
Sat (gamedays)
Live scores every 30s; live mode on scoreboard
Sun 2:00 AM
Grade Pick'Em + Pros board + bracket scores; regenerate leaderboards + share graphics
Sun 8:00 PM
Ballots open (push + email to citizens)
Sun 9:00 PM
Playoff bracket/rankings regenerate
June 1 annually
Full schedule sync; season rollover; archive last season's leaderboards to the Wall
July annually
Preseason Guide production cycle (manual/editorial) + gift-fulfillment link swap
12. PROMPT LIBRARY (verbatim starting points — keep in repo as /prompts, version them)
Global system preamble for ALL generation calls:

You write for The Pate State, Josh Pate's college football community. Primary voice: Josh Pate — confident, dry-witted, Southern-porch conversational; short declarative sentences; sets up an argument, pays it off with a kicker line; talks TO fans, never down to them; zero clickbait; never "In the world of college football"; never exclamation points; respects every fanbase while telling the truth. Analytical layer: Kirk Herbstreit's approach — when the piece turns to analysis, think like a former player/film watcher: explain WHY through scheme, matchups, line play, and quarterback comfort; big-picture and fair-minded; credits what the opponent does well before the criticism; "here's what the tape says" energy without jargon walls. The blend: Pate's voice carries the piece, Herbstreit's rigor carries the analysis paragraphs. Never impersonate or quote either man saying things they didn't say. Facts must come from the provided sources only — if a fact isn't in the sources, don't state it. Output valid JSON matching the provided schema, nothing else. (Full voice guide with examples: §23.)

12.1 Series classifier — input: title, description, weekday → output {series, confidence}.

12.2 Companion article — input: transcript w/ timestamps, episode metadata, current JP Poll top 25, this week's schedule. Output schema:

{"headline":"", "dek":"", "body_markdown":"(600-1100 words; [EMBED:HH:MM:SS] markers at 1-3 relevant moments; one [PULLQUOTE] marker)",

"pull_quote":"", "primary_team":"", "teams":[], "tags":[], "series":"",

"internal_links":[{"anchor":"","target":"poll|team-{slug}|playoffs|pickem|tailgate-{slug}"}],

"seo":{"title":"≤60 chars","description":"≤155 chars"}, "citizens_only": false}

Instructions: capture Josh's actual takes faithfully — this publishes under his byline after his approval; do not invent takes he didn't say; structure = his strongest argument first, evidence, the honest counterpoint, the kicker line.

12.3 Wire item + importance — input: clustered source excerpts → {headline:"≤12 words, bold, no clickbait", sub:"≤25 words", category, teams, importance:1-10, importance_reason}. Scoring guide: 9-10 coach fired/major scandal/No.1 recruit flips; 7-8 top-25 QB injury, five-star commit, playoff-relevant result; 4-6 standard news; 1-3 minor.

12.4 Wire Desk full story — input: all sources in cluster → 400-700 word article JSON (same schema as 12.2, no EMBED markers, byline fixed "The Wire Desk"); MUST attribute ("per ESPN's report…"), MUST include the standing AI disclosure slot, MUST NOT speculate beyond sources.

12.5 Watch List ranker — input: week slate + lines + JP ranks → ordered 10 with one-line metas + "Josh's Watch Order" paragraph (drafted for editor tweak; it renders in Josh's voice).

12.6 Pros picks extractor — input: provided links/transcripts of a pundit's picks → {picks:[{game, side, line_at_pick}], source_url, confidence} — flag anything below 0.9 confidence for the staffer.

12.7 Playbook subject/intro — input: today's assembled items + weekday ritual → {subject:"≤45 chars", intro:"1-2 sentences, Josh voice"}.

12.8 AI Predictor bracket — input: records, SP+, remaining schedules, conference standings → 12-team field with seeds + game-by-game winners + 120-word rationale. Temperature 0.3; consistency matters because it's graded publicly.
13. EDITORIAL & SAFETY GUARDRAILS (hard rules)
	•	(Revised v1.1) Human approval is required ONLY for Josh-voice/Josh-byline content (companions, Weekend Truths, mailbag, Watch Order). Everything else — Wire Desk stories, wire items, data modules, Playbook, social clips — publishes autonomously under the §21 verification stack.
	•	Injuries/legal/personal news: Wire Desk may report only what named outlets report, with attribution; never AI speculation on health, legal outcomes, or minors beyond public recruiting rankings. Recruits are minors — coverage stays strictly to rankings/commitments; no character commentary.
	•	Sensitivity handling (revised v1.1): clusters tagged death/arrest/scandal/serious-injury still publish autonomously BUT under the strictest §21 rules — Tier-1 sourcing only, attribution in the headline ("per ESPN"), no adjectives, no speculation, conservative template — and they page the human monitor immediately for post-publication review. Only stories involving the death of a player/coach hold for two independent Tier-1 confirmations before auto-publishing.
	•	No betting advice framing. Lines and ATS records are scorekeeping/entertainment; required footer on Pick'Em/Pros: 21+, problem-gambling resources. Never "lock," "guaranteed," or staking advice.
	•	AI disclosure stays on every Wire Desk piece (§3.4).
	•	Comments/porch moderation: Claude moderation pass on every comment (prompt: flag slurs, threats, doxxing, spam) → auto-hide + human review queue. Citizens-only commenting keeps this manageable.
	•	Never alter the JP Poll math editorially. The poll's integrity IS the product.
14. SEO / GEO (AI-search) REQUIREMENTS
	•	Schema.org on everything: NewsArticle (with author, datePublished, dateModified), VideoObject on episode embeds, SportsEvent on games, FAQPage on tailgate guides, ItemList on rankings.
	•	The JP Poll page publishes a stable weekly permalink (/poll/2026-week-3) + a machine-readable JSON endpoint (/api/poll/current) — this is what AI engines will cite; keep it clean and public.
	•	llms.txt at root describing the site's canonical data endpoints; XML sitemaps segmented (news sitemap for articles < 48h — required for Google News); RSS feeds per franchise.
	•	Internal-linking rule (enforced in the article pipeline): every article links ≥ 1 team page + ≥ 1 franchise page. Team pages are the hub of the link graph.
	•	Page targets: LCP < 2.0s, CLS < 0.05; articles statically generated, revalidated on edit.
15. LICENSING (before public launch — legal must clear)
	•	Team logos/marks: the wireframe's color-helmet SVG system is the safe default; licensed marks (CLC/Learfield or a licensed data-art provider) drop into the same slots when cleared.
	•	Pros' headshots: initials avatars until image rights are cleared per person; records/names with sources are fine (factual).
	•	Game photography: license via Getty/Imagn subscription; the SVG tile system remains the fallback for wire items forever (it's on-brand).
	•	Preseason Guide cover art: current comp uses player likenesses — requires NIL licensing before commercial use; otherwise re-shoot with Josh-only cover.
	•	247/On3 data: pursue formal data licenses; scraping is bridge-only.
16. KPIs & DASHBOARD (what "working" means)
Weekly admin dashboard, auto-emailed Monday 8 AM:

	•	North star: registered citizens (total, weekly adds, source attribution)
	•	Playbook: delivery, open %, click %, unsub %
	•	Ritual health: ballots cast, picks made, brackets started, % returning week-over-week
	•	Content: articles published (AI-drafted vs approved rate, avg approval time), wire→story conversion, top pages, search clicks (GSC API)
	•	Josh vs Pros share-graphic reach (UTM'd)
	•	Alerts: any scraper failure, API quota > 80%, approval queue > 60 min old, error-rate spikes
17. BUILD ORDER FOR ISAAC (pragmatic phasing)
	•	Weeks 1–2: Next.js port of the approved wireframe (pixel-faithful), Supabase citizenship + gating, Playbook pipeline, YouTube ingest + companion-article pipeline with approval dashboard. (This alone is a launchable site.)
	•	Weeks 3–4: JP Poll voting/tabulation/reveal automation; scores + schedules; Watch List; Wire monitoring + Wire Desk.
	•	Weeks 5–6: Pick'Em engine + Pros board + admin picks entry; recruiting sync; playoffs systems + Bracket Challenge; AI Predictor tool.
	•	Week 7: Ledger, moderation, dashboards, load testing against a Saturday traffic profile (10× weekday), licensing swaps.
	•	Definition of done per feature: runs on schedule unattended for 7 days, editor touch-time within targets, and a written runbook entry for its failure mode.
18. FAILURE MODES & FALLBACKS (runbook seeds)
	•	YouTube API down → RSS fallback (https://www.youtube.com/feeds/videos.xml?channel_id=...); articles can run without embeds temporarily.
	•	CFBD down on Saturday → switch scoreboard to "manual mode" banner + last-good data with timestamp; never show wrong live scores.
	•	Anthropic API errors → all generators retry 3× with backoff; predictor tool shows the built-in demo response; article pipeline queues and alerts.
	•	Scraper breakage (recruiting) → serve yesterday's snapshot with "as of" date; alert.
	•	Approval queue stale > 60 min during breaking news → escalate to secondary editor (on-call rotation during the season).



End of manual. Pair this document with the wireframe zip; where they conflict, the wireframe wins on design and this manual wins on behavior. Questions from implementation should be logged as issues against section numbers.


PART 4 — v1.1 ADDITIONS (AUTONOMY, SOURCES, SOCIAL, VOICE)
19. FULLY AUTOMATED PROS-PICKS HARVESTING (supersedes the manual-entry note in §7.1)
The 20 pros publish their picks in predictable public places every week. The harvester runs Thursday 6 AM → Saturday kickoff, every 15 minutes, per-pundit, with this source map (maintain as a config table — pros_sources.yaml):

Pundit
Primary automated source
Secondary
Kirk Herbstreit
ESPN College GameDay broadcast — pull the show's YouTube upload/clips, transcribe, extract picks segment
His X account; ESPN.com GameDay picks articles
Nick Saban, Desmond Howard, Rece Davis, Tim Tebow, Pat McAfee
Same GameDay pipeline (the final-picks segment names every host's picks); McAfee also: The Pat McAfee Show YouTube (daily), his X
ESPN articles aggregating GameDay picks
Joel Klatt
The Joel Klatt Show YouTube (weekly picks episode) — transcript extraction
FOX Sports site picks columns; his X
Chris "The Bear" Fallica
FOX Sports weekly "Bear Bets" column (structured, scrapable)
Big Noon Kickoff broadcast clips; his X
Brady Quinn, Matt Leinart, Urban Meyer, Mark Ingram II
Big Noon Kickoff YouTube clips (picks segment) transcribed
FOX Sports articles; their X accounts
Greg McElroy
Always College Football YouTube (his picks episodes)
ESPN/SEC Network clips
Danny Kanell
Cover 3 Podcast (CBS) YouTube — picks segments
His X (very active with picks)
Dan "Big Cat" Katz
Pardon My Take picks segments (YouTube/audio transcript) + Barstool picks posts
His X
Dave Portnoy
His X account (posts picks/bets directly — image OCR needed for bet-slip screenshots)
Barstool site
Paul Finebaum
The Paul Finebaum Show clips (SEC Network YouTube)
ESPN appearances
Taylor Lewan, Will Compton
Bussin' With The Boys / The Locker Room: CFB episodes (they're Josh's co-hosts — easiest feed of all)
Their X accounts

Pipeline: per source → transcript or page text or image → Claude extraction (prompt §12.6) → {game, side, line_at_time} with confidence → ≥ 0.9 confidence auto-accepts; < 0.9 goes to the monitor's exception queue (expect < 5 exceptions/week once tuned). Picks-graphic images (GameDay's on-screen picks board, bet slips) go through a vision-model call — same extraction schema. Every pick stores its source URL + capture timestamp; the rules page states only pre-kickoff public picks count. If a pundit publishes no picks in a given week, their record simply doesn't move (display "NO CARD THIS WEEK" in the weekly detail view).
20. THE BREAKING-NEWS SOURCE NETWORK (who hears it first)
Goal: be live within 10 minutes of first credible report. The monitor list, in priority polling order (X lists polled every 60–90 seconds during the season via API or a monitoring service like a firehose vendor; RSS/API sources every 5 min):

Tier 1 — national insiders (single source is publishable WITH attribution): X: Pete Thamel (ESPN), Bruce Feldman (The Athletic/FOX), Ross Dellenger (Yahoo), Brett McMurphy (On3), Chris Low (ESPN), Chris Hummer (247), Matt Zenitz (CBS/247), Nicole Auerbach (NBC), Adam Rittenberg (ESPN); plus AP College Football wire, ESPN/CBS/FOX/Yahoo CFB news APIs/RSS.

Tier 1R — recruiting-specific: Hayes Fawcett (On3 — commitment graphics, run image OCR on his posts), Steve Wiltfong (Rivals/On3), 247Sports team insider accounts, On3 recruiting feed. A Fawcett commitment graphic alone = publishable ("per On3's Hayes Fawcett").

Tier 2 — beat writers & team media (publishable with attribution; two Tier-2s = treat as confirmed): maintained list of 1–3 beat reporters per Power-4 program + the major G5s (~200 accounts; build once from each outlet's masthead, review each August), official team/conference X accounts and press-release pages (official statements are auto-confirmed by definition).

Tier 3 — aggregators & fan networks (detection only, NEVER a source): r/CFB new/rising (poll every 2 min — Reddit often surfaces news minutes early), On3/247 team message boards' breaking threads, large aggregator accounts. A Tier-3 spike triggers an urgent sweep of Tiers 1–2; nothing publishes on Tier 3 alone, ever.

Speed levers: X list streaming beats polling — budget for API access; it is the single biggest speed unlock. Secondary: Google News API with 5-min windows, YouTube "live" detection on insider channels (press conferences), and school athletics-site change detection (coaching changes hit official sites fast).
21. THE AUTONOMOUS VERIFICATION STACK (the guardrails that replace the human click)
Every Wire Desk article passes ALL gates in < 60 seconds, automatically, before publish:

	•	Source-tier gate: every factual claim in the draft must map to a Tier 1/2 source captured in the cluster (official statements auto-pass). Claims that don't map → sentence auto-removed or article held.
	•	Second-model fact-check pass: an independent Claude call receives ONLY the sources + the draft and answers per-claim: supported / unsupported / contradicted. Any contradicted → block + page monitor. Any unsupported → strip the sentence, re-verify.
	•	Attribution enforcement: first sentence must name the reporting outlet for any non-official news ("per ESPN's Pete Thamel"). Regex + model check.
	•	Category templates: firings, transfers, commitments, injuries, and legal stories each render from a fixed conservative template (what happened, who reported it, verified context from our own data — record, rank, contract facts if sourced — what's next). Legal template additionally: charges are allegations, no outcome speculation, mandatory "has not commented / could not be reached" line status.
	•	Banned-inference list: no motive attribution, no health prognosis, no "sources tell The Pate State" (we have none), no anonymous sourcing of our own, nothing about a recruit beyond rankings/commitment facts.
	•	Contradiction watch: post-publish, the cluster keeps monitoring 24h; if Tier-1 sources materially revise (e.g., "not fired, reassigned"), auto-append a timestamped update line and push a correction to the wire item + notify monitor.
	•	Kill switch: monitor dashboard has per-pipeline pause + one-click article retraction (replaces body with a retraction note, preserves URL).

This stack is what lets breaking news run human-free: speed from automation, safety from redundancy, accountability from attribution + audit logs (every article stores its full source bundle + both model outputs, forever).
22. THE HUMAN MONITOR (the "eventually checking in all day" role)
One person, one dashboard, four duties — none of which block publication:

	•	Morning sweep (15 min): overnight wire output, email that went out, any flagged exceptions.
	•	Approval lane: Josh-voice queue only (companion articles ~1/day, 5–10 min each; Watch Order Thursdays; mailbag Fridays).
	•	Exception queue: low-confidence pro picks, sensitivity pages, scraper alerts, contradiction alerts.
	•	Season Saturdays: live-mode watch (scores feed health, wire volume, comment moderation queue). Escalation: pipeline auto-pages (SMS) on: contradicted-claim block, death-category cluster, data-feed failure on gameday, approval queue > 4h on Josh-voice items.
23. VOICE GUIDE v2 — HOW EVERY ARTICLE SOUNDS (expanded)
Primary voice: Josh Pate. Porch-conversational, dry wit, Southern cadence without caricature. Short declaratives that build to a kicker. Second person welcome ("You already know what Tuscaloosa does to pretenders."). Honest about every fanbase including the ones he likes. Signature moves: name the conventional wisdom, inspect it, keep what's true, throw out the furniture line that everyone repeats without checking.

Analytical layer: the Herbstreit school. When the piece analyzes football, it thinks like a film-room former player: explains why through matchup and scheme (protection vs. pressure, leverage, QB comfort on third down), credits the opponent first, stays big-picture fair, never hides behind jargon. No hot-take heel turns; disagreement is respectful and evidence-first.

The blend in practice: open and close in Pate voice; the middle third — the "here's what's actually happening on the field" section — carries Herbstreit-style reasoning, still worded plainly.

Do: "Deep rosters don't win road games in September. Grown-ups do." / "Watch the left guard on early downs — that's where this game lives." Don't: exclamation points, "elite" more than once per article, ALL-CAPS takes, dunking on 18-year-olds, fake insider sourcing, first-person plural claiming to be Josh in Wire Desk pieces (Wire Desk is a desk, not a person). Bylines: Josh-approved companions = "Josh Pate". Autonomous news = "The Wire Desk" + AI disclosure. Analysis features drafted for approval = "Josh Pate" only after his click; otherwise "The Pate State Staff".
24. SOCIAL MEDIA INTEGRATION (site + automation)
Confirmed channels (verified handles, current as of Aug 2026): YouTube — Josh Pate's College Football Show (flagship); X @JoshPateCFB (his most active daily platform — takes, reactions, Friday Night Lines announcements); Instagram @joshpatecfb (~115K — clips, guest announcements, IG Live shows); TikTok @joshpatecfb (~34K); Threads @joshpatecfb; existing merch store at patestatematerial.com (note: 'Pate State' is already live brand language in his ecosystem — coordinate the State Store with whoever runs that). Distribution partners: The Locker Room: CFB w/ Compton & Lewan (Bussin' With The Boys) and the ESPN Friday show. Old 'LateKick' handles are legacy — use JoshPateCFB everywhere; verify handle redirects at launch.

On-site (already added to the wireframe v1.1): social row in the footer of every page; "Follow the Porch Everywhere" strip on The Show page; "Follow the Mayor" panel on the Porch. Production additions: (a) an embedded X timeline of @JoshPateCFB on the Porch page ("The Mayor's Feed"), (b) TikTok/IG oEmbeds powering the Clips & Shorts strip when a clip performs, (c) share buttons on every article/leaderboard emit pre-written Pate-voice copy + the auto-generated OG graphic.

Outbound automation (grows the channels from the site): on every Wire Desk publish → auto-post headline + link from the site's own brand accounts (create @ThePateState handles on X/IG/TikTok at launch — the site posts as the State, Josh's personal accounts stay human); Poll reveal Tuesdays → auto-render the Top-25 graphic + post; Sunday gradings → the Josh vs. Pros share graphic + post. Josh's personal accounts are NEVER auto-posted — suggestions can be queued to his phone, he taps to send.
25. COMPLETENESS SWEEP — remaining systems now specified
	•	Shop: Shopify (headless via Storefront API) behind the State Store pages; citizen discount = auto-applied logged-in price rule; free-shipping-for-citizens as a script; Pick'Em/Bracket prize fulfillment = auto-generated 100%-off codes emailed from the prize queue; Creed Tee + gear print-on-demand (Printful) to start, cut inventory later.
	•	Tour & tickets: ticketing partner embeds (per-venue links in the tour rows); citizen presale = unique code emailed 48h before public.
	•	Chapters & watch parties: a chapters table (city, host citizen, venue, RSVP counts) + host application form → monitor approves → host kit fulfillment task; season phase 2: private chapter rooms via Discord server with role-sync from citizenship (OAuth link).
	•	Season Ledger: log-a-game form (game picker from schedule data, star rating, note, "attended" flag with optional geo-verify for the 🏟 badge); December "Wrapped" job renders each citizen's shareable season card (server-side image) — auto-emailed Dec 15.
	•	Team pages ×136: generated from data (JP Poll history, schedule/results, recruiting rank, Josh's ATS picking them, tailgate guide link, latest team-tagged articles) + one Claude-written 120-word season-state blurb refreshed Tuesdays (data-cited, auto-published — it's a data surface with words).
	•	Tailgate guides: evergreen articles seeded by AI draft from structured facts (parking, traditions, food) → these ARE Josh-voice-adjacent → human-approved once, then live for years; citizen tips submitted → moderated queue → appended with credit.
	•	Comments ("the porch is loudest"): citizens-only; Claude moderation on every post (auto-hide threshold + monitor queue); comment counts feed the hot-threads module automatically.
	•	Push & PWA: web push opt-in for citizens (poll reveal, picks lock warning 2h before, your-bracket-scored); site ships as installable PWA — this is the mobile app until a native one is justified.
	•	Contact/advertise: forms → routed inbox; partner page auto-lists current sponsor slots (pick'em presenter, playbook presenter, tour).
	•	The Pate Report annual: production is editorial/manual each July (design + print vendor); the site's job is the store listing, citizen free-digital fulfillment link, and the gift automation.
	•	About page & press: static; add a /press with logo kit + the AI-editorial-policy page (link the §3.4 disclosure — transparency page builds trust and is itself a GEO asset).

(v1.1 complete. Supersedes: §7.1 manual entry, §13.1, §13.3 as noted inline.)

