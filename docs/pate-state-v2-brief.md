THE PATE STATE — V2 MASTER BUILD BRIEF FOR CLAUDE CODE
You are upgrading thepatestate.com, the online home of Josh Pate's College Football Show. The goal: transform it from a launch shell into one of the top college football destinations on the internet — a national publication, a network of 136 team mini-sites, and a community + interactive-games platform, all under one brand.

Stack: Next.js + Sanity + Supabase. Use the existing codebase as source of truth. Do NOT replatform. Preserve the current visual identity (the porch brand, typography, color system) unless a change is required for clarity, accessibility, mobile usability, or information hierarchy. Implement work as isolated, reviewable changes.


0. GLOBAL RULES (apply to every workstream)
0.1 Demo data policy — highest priority
Placeholder/demo data (read counts, leaderboards, streaks, "2 MIN AGO" timestamps, poll numbers, pick'em standings) may exist ONLY behind a DEMO_MODE environment flag for development, staging, and owner previews.

	•	In production with DEMO_MODE=false: every module renders either real data or a polished empty state (e.g., "Leaderboard opens Week 1," "2026 standings appear when the season begins," "Poll voting opens Aug 24").
	•	Never display sample readership numbers, user records, streaks, or contest results as if live.
	•	Demo pages are noindex and excluded from all public sitemaps.
	•	Audit the current production site and move ALL existing sample values ("48K READS," "W14" streaks, "ONLY 32% OF CITIZENS BEAT JOSH LAST WEEK," static "2 MIN AGO," fake leaderboard names, "Sample content below" banners) behind the flag.
	•	Remove the "Preseason preview — live data arrives with the season" label from sections where it makes no sense (the Store, the Tour, the Citizen Gift). Keep it only on genuinely data-dependent modules, or replace with module-specific empty states.
0.2 Real social proof
Replace invented proof with verifiable proof pulled from real sources: YouTube subscriber count, episode count, years of logged picks, ESPN affiliation. Format: "1M+ subscribers · 1,200+ episodes · Every pick logged."
0.3 No dead links
Every link resolves to a real destination. Kill all links that currently point to "/" as placeholders (Notebook category tabs, "Load More," "More Popular," article cards). If a destination doesn't exist yet, the link doesn't ship.
0.4 Editorial labels on everything
Every published page displays content type (News / Analysis / Opinion / Projection / Data / Community / Sponsored) and production method (Written by Josh Pate / Written by The Pate State editorial team / Produced with Pate State AI and reviewed by [editor] / Automated data update from [source]).
0.5 Immediate content edit — Pick'Em picker roster (slots 21–24)
On the Pick'Em page, replace these four pickers:

	•	21 · David Pollack (ESPN · Gameday) → 21 · Stanford Steve Coughlin (avatar initials "SS", affiliation: ESPN)
	•	22 · Booger McFarland (ESPN · SEC Network) → 22 · Bud Elliott (avatar initials "BE", affiliation: CBS Sports)
	•	23 · Charles Davis (FOX · Big Noon) → 23 · Jordan Rodgers (avatar initials "JR", affiliation: SEC Network)
	•	24 · Cole Cubelic → 24 · Ari Wasserman (avatar initials "AW", affiliation: On3)

Keep the same card format (rank, initials avatar, name, affiliation line, record placeholder per §0.1). Verify affiliation lines against each analyst's current employer before shipping.


1. HOMEPAGE REBUILD
1.1 Hero — split layout with rotating banner (NEW)
Keep the current hero copy and height. Changes:

	•	Left (~55–60% width): the existing headline block — "The Front Porch of College Football." + "No debates. No hot takes. Just the sport, all year long — the show, every week, and a seat that's always open. Pull up a chair." + the two CTAs [Browse the Show] [Become a Citizen — Free]. Reduce headline/body text size slightly (one step down, e.g., headline from current size to ~85–90% of it) and shift the whole block modestly right so the composition balances against the new right panel.
	•	Right (~40–45% width): a rotating/sliding banner (carousel), same height as the hero text block. 3–6 clickable slides, managed in Sanity so editors can change them without code. Each slide: full-bleed image or video still, short bold overlay title, destination link. Launch slides: (1) latest episode, (2) newest Notebook feature, (3) JP Poll reveal / Poll Day, (4) Pick'Em or the active Play competition, (5) tour dates, (6) Citizen Guide offer.
	•	Auto-advance ~6s, pause on hover, swipe on mobile, dot/segment indicators, keyboard accessible, prefers-reduced-motion respected (no auto-advance when set).
	•	Entire hero remains the same total height as today. On mobile, stack: text block first, slider below.
1.2 The Show section — thumbnail grid (FIX)
Current problem: only the main video shows a thumbnail; the 3 secondary videos on the right are text-only. Rebuild using this layout (modeled on a best-in-class "Watch" section):

	•	Section header row: bold "The Show" left; right-aligned uppercase link "MUCH MORE ON YOUTUBE →" in a mono/utility style.
	•	Left (~60%): featured latest episode — large thumbnail with play button, bold title below, "▶ Watch Now" + date in small uppercase/mono.
	•	Right (~40%): 3 stacked episodes, thin divider lines between them. Each row: bold episode title on the left, thumbnail on the right at roughly 1/3 the featured size, with "▶ Watch Now" + date beneath the title. Thumbnails pull automatically from the YouTube API / i.ytimg.com for each video ID — never text-only.
	•	All four episodes populate automatically from the channel's latest uploads (YouTube Data API or RSS), cached server-side, so the section is always current with zero manual work.
	•	More Episodes row (NEW): beneath the featured + stacked layout, add a horizontal row of 4–6 additional recent episodes — uniform thumbnails with title + date below each, all clickable. On mobile this row is horizontally swipeable.
	•	Shorts rail (NEW): beneath the More Episodes row, add a "Shorts from the Porch" rail — 6–10 vertical 9:16 thumbnails in a horizontally scrollable strip (arrow controls on desktop, swipe on mobile), auto-pulled from the channel's Shorts feed, each opening the Short on YouTube. Small uppercase section label + "More Shorts →" link at the end of the rail.
	•	Density target: the Show section should surface 12–16 clickable videos total (1 featured + 3 stacked + 4–6 row + 6–10 Shorts) so the section reads as a deep, living video library — not a preview.
	•	Keep the weekly rhythm strip (MON Weekend Truths … SAT We Watch Ball) beneath.
1.3 Homepage section order (target)
	•	Live score strip (real data — see §7; fix the current garbled ticker rendering, e.g., "NC@TNC @ T")
	•	Hero (per §1.1)
	•	My Teams — personalized module for signed-in users (§6); signed-out: "Choose your teams and personalize The Pate State"
	•	The Show (per §1.2)
	•	The Wire — verified news feed, real timestamps, direct source links. Density: show 8–10 items on the homepage (not 4–5), each fully clickable to its story/source, with category tags and team logos, plus "All Wire Coverage →". Auto-refreshing timestamps.
	•	Trending on The Porch — most active threads, live game threads, Josh's latest reply, top community poll (§3)
	•	Play — the most relevant active competition (§5)
	•	Latest from the Notebook (articles). This module must feel like a real publication's front page, not a teaser. Layout: one featured article (large image, headline, dek) + a grid of 8–12 recent articles (thumbnail, bold headline, author, date, team/category tag — every card clickable) + a Most Read list of 5 with real read counts once live (empty-state per §0.1 until then) + category quick-filters (Josh Pate / News / Rankings / Recruiting / Teams) that link to real filtered views. The module pulls automatically from Sanity and grows as the archive grows; "Open the Notebook →" leads to the full hub. Combined density target: a visitor scrolling the homepage should encounter 20+ distinct clickable articles/stories between the Wire and the Notebook modules — this is what makes the site feel big. (Note: this density target is the product requirement; §7.1's episode-companion pipeline is what fills it with real inventory — treat the two as one system.)
	•	Rankings — JP Poll + Citizen Poll with weekly movement
	•	Recruiting & Portal
	•	Newsletter (The Pate Playbook) — after editorial value has been delivered
	•	Store / Tour / Citizen Guide
1.4 Team visual assets — logos, not blank helmets (SITEWIDE RULE)
The current helmet images read poorly and are unidentifiable. Apply this rule everywhere teams are represented:

	•	Default everywhere: use the official team logo, not a helmet. Score strip/ticker, the Wire, JP Poll and all ranking tables, article cards, team headers, game threads, leaderboards, recruiting modules — all use the team logo mark (ESPN CDN or licensed source, consistent sizing, transparent background, rendered on a light tile where contrast requires it). Remove the current helmet thumbnails from these contexts.
	•	One exception — the Top 10 Games of the Week module keeps helmets, but they must be fixed: every helmet must display the team's logo decal on the helmet shell so the team is instantly identifiable (composite the logo onto the helmet asset at the correct side position, or source pre-decaled helmet artwork). Blank/unbranded helmet shells may not ship anywhere.
	•	Increase helmet size in that module by roughly 30–50% versus current so matchups are readable at a glance (minimum ~64px rendered on desktop, proportionally larger on the matchup card itself), with the two helmets facing each other in the matchup layout.
	•	All team art comes from one shared TeamMark component with variant="logo" | "helmet" so sizing, sourcing, and fallbacks are consistent sitewide; the fallback for any missing asset is the logo on a team-color disc — never a blank shell, never a broken image.


2. NAVIGATION
2.1 Primary nav (desktop)
Latest | Scores | Teams | Recruiting | Rankings | Community | Play | Show

	•	Latest → the article hub. Nav label is plain "Latest"; the page itself keeps its branded header "The Notebook." (Pattern: plain labels for wayfinding, branded names on-page.)
	•	Community → nav label is "Community"; product remains branded "The Porch."
	•	Right-side controls: Search, followed-team quick menu, notifications bell, Join/Profile.
	•	More menu (secondary): Tailgate, The Porch Tour, The Report, Shop, About, Standards, Contact.
	•	Mobile: same order in the drawer; Search and Profile persistent in the header.


3. THE PORCH — MESSAGE BOARD (central community product)
Brand: The Porch. Nav label: Community. Routes: /community, /community/[boardSlug], /community/thread/[threadId].
3.1 Visual spec — BOLD, On3-caliber readability (REQUIRED LOOK)
Model the board list UI on the best team-site boards (HuskerOnline/On3 reference). Recreate this exact feel in Pate State brand colors:

	•	Board header bar: full-width solid brand-color bar (or team color on team boards) with the board logo/mark left, small uppercase kicker line ("THE FRONT PORCH · THE PATE STATE"), and a large bold white title ("Latest on the Porch" / "Alabama Porch").
	•	Thread cards: white/very-light rounded cards on a subtle gray page background, generous padding, clear separation between cards.
	•	Thread title: large, heavy weight (~19–21px desktop, bold/extra-bold), near-black. This is the dominant element — a scanning eye should read titles only.
	•	Author row: circular avatar (user photo or 2-letter initials on a brand/team-color disc), bold username, then muted gray metadata: "started 29 minutes ago" or "· last by [user], 25 minutes ago."
	•	Engagement counts, right-aligned: speech-bubble icon + reply count in bold accent color, eye icon + view count in gray with thousands separators (e.g., "13  2,795").
	•	Active/hot thread treatment: left accent border in brand color + a sub-row "Latest reply 5 minutes ago by [user]."
	•	Footer bar: full-width solid brand-color bar, right-aligned bold uppercase "VIEW ALL THREADS →".
	•	Real relative timestamps everywhere ("5 minutes ago"), auto-updating. Mobile: identical hierarchy, full-width cards, touch targets ≥44px.
	•	This bold/easy-reading standard applies to the entire community product and should inform density and type weight across new modules sitewide.
3.2 Boards at launch
	•	The Front Porch (national: news, rankings, playoff, coaching, conferences, Josh's latest episode)
	•	Recruiting & Portal
	•	Game Day (auto-generated live threads from the schedule feed: score, clock, records, key stats, user predictions, live comments, polls, postgame recap link)
	•	Film Room (scheme/tactics)
	•	Fantasy & Games (league recruitment, draft talk, commissioner announcements)
	•	Ask Josh (mailbag submissions; selected questions answered on-show)
	•	Team Porches — one per team hub, inside the same system (Alabama Porch, Georgia Porch, …)
3.3 User capabilities
Create account · pick primary team + follow up to 5 more · create thread · reply · quote · react/upvote · polls · edit within a limited window · follow thread · report · mute · search · sort (latest / most active / top) · notifications · share · display prediction & fantasy badges.
3.4 Staff capabilities
Pin · lock · slow mode · move · merge · hide/remove · suspend · permanent ban · edit-history review · report queue · moderation log · official labels · auto game-thread creation.
3.5 Thread types & rules
Types: Discussion, Question, Poll, Prediction, Breaking News, Reported News, Rumor, Game Thread, Film Analysis, League Recruitment, Staff Announcement. Only staff can apply Breaking News / Confirmed. News posts prompt for a source link. Rumors can never be labeled confirmed.
3.6 Roles, badges, reputation
Roles: Citizen, Founding Citizen, Verified Contributor, Porch Captain (community mods), Staff, Managing Editor, Josh Pate. Badges: Pick'Em Champion, Playoff Champion, Accuracy Leader, Film Room Contributor, Helpful Citizen, Team Expert, Josh Answered My Question. Reputation rewards quality (unique-account upvotes, accurate predictions, sourced info, clean record), not volume. Negative: removed posts, misinformation, attacks, spam, vote manipulation, fake insider claims.
3.7 Moderation
Pate State AI triages every post (attacks, threats, slurs, doxxing, spam, suspicious links, explicit content, unverified player claims) into risk tiers: Low = allow; Medium = hold/limit; High = hide + human review; Critical = hide, preserve evidence, alert staff. Permanent bans and major decisions are human-only. Prohibited: doxxing, threats, harassment, impersonation, fabricated insider claims, private medical info, unverified criminal allegations, brigading, spam, copyright infringement, posting private messages. No anonymous posting. No private DMs in V1.
3.8 Community growth loops
Every major article ends with "Discuss this on the [Team] Porch." Team pages surface trending team threads + start-a-thread. Homepage surfaces Trending on The Porch. Weekly editorial feature: Porch Take of the Week (editor-selected best community post, featured on homepage + newsletter).


4. TEAM MINI-SITES — 136 FBS PROGRAMS (On3-style team destinations)
Goal: an Alabama fan can use /teams/alabama as their daily Alabama site. One shared framework, not 136 codebases. Paths, not subdomains.
4.1 Routes
/teams/[teamSlug]

/teams/[teamSlug]/news        /teams/[teamSlug]/schedule

/teams/[teamSlug]/roster      /teams/[teamSlug]/stats

/teams/[teamSlug]/depth-chart /teams/[teamSlug]/recruiting

/teams/[teamSlug]/transfer-portal

/teams/[teamSlug]/rankings    /teams/[teamSlug]/community

/teams/[teamSlug]/history     /teams/[teamSlug]/tailgate
4.2 Team header
Team name + approved logo/wordmark, team-color accents (Pate State brand stays dominant), current record, conference record, national ranking, next opponent, Follow Team button, team board link, notification settings.
4.3 Team homepage modules
	•	Next game — opponent, date/time, network, location, Josh's pick, citizen consensus, game-thread link
	•	Latest news — original reporting, team Wire items, Josh analysis, recruiting, portal
	•	Josh on this team — latest video + article, current JP rating, season prediction, historical prediction record (receipts)
	•	Team Porch — trending threads, pinned thread, start-a-thread
	•	Roster snapshot — key players, projected starters, availability
	•	Recruiting — class rank, commitments, offers, top targets, movement
	•	Transfer portal — additions, departures, net assessment
	•	Schedule — results, upcoming, win probabilities, recaps
	•	Rankings — JP Poll, Citizen Poll, properly attributed external polls, week-over-week movement
	•	Team statistics — offense/defense/special teams, leaders, national comparisons
	•	Tailgate & stadium guide — parking, food, traditions, watch parties
	•	Fantasy — team fantasy leaders, projections, most-drafted players
4.4 Ranking table visual spec (REQUIRED LOOK — use sitewide for polls/rankings)
	•	Small uppercase gray column headers: RANK · TEAM · SCORE.
	•	Rank as large bold two-digit numerals (01, 02, 03…).
	•	Team logo in a small rounded white tile beside a bold team name.
	•	Beneath each name: three small stat pills in a gold/tan family (darkest → lightest, e.g., first-place votes / composite metric / movement) — compact rounded rectangles with bold numerals.
	•	Score right-aligned, bold, with a short red/brand-color underline beneath the number.
	•	If the signed-in user follows a team ranked below the visible cut, append a highlighted jump-row for that team (tinted background, e.g., "18 · Nebraska") after the top group.
	•	Clean generous row spacing; entire row clickable to the team page.
4.5 Quick Links card (sidebar component, team pages + community)
White rounded card, thin brand-gradient accent line across the top, small uppercase gray "QUICK LINKS" label, then a vertical list of icon + bold-label rows (icons in brand/team accent color): App (when available), YouTube, X/Twitter, Instagram, TikTok, Boards. Reusable component; links configurable per context.
4.6 Rollout + completeness standard
	•	Build the universal template → 2. Launch the 20–25 most active fanbases → 3. Verify feeds/boards/editorial modules → 4. Expand conference by conference → 5. Index only when complete.

A team page enters the sitemap ONLY when it has: current schedule, roster, record, live team board, several relevant editorial items, recruiting + transfer sections, accurate timestamps, unique metadata, follow-team functionality. Incomplete pages: feature-flagged or clearly labeled coming-soon, noindex, out of sitemap. Never publish 136 thin, lightly-rewritten AI intros.


5. PLAY — INTERACTIVE GAMES & FANTASY
Create /play as the games hub in primary nav. All games share one identity, notification, and reputation system.
5.1 One reusable competition engine (build FIRST — do not hard-code games separately)
Core entities: competition, season, scoring_rule, entry, league, league_member, invitation, pick, draft_room, draft_pick, roster, leaderboard, result, badge, notification, audit_event.

Configurable per competition: type, name, season, start/lock/end times, public/private, min/max members, scoring rule, data source, status, prize status, terms version.

Shared functionality: auth, profiles, groups, invite links, commissioners, pick deadlines, immutable locked entries (timestamped, audit-logged, no edits after lock, scoring-rule version recorded), scoring templates, live leaderboards, group discussion threads, AI recaps, share cards, moderation, terms acceptance.

Rules-engine principle: official scoring, draft logic, and simulator results come from a deterministic rules engine (projection model, draft-value scores, position scarcity, ADP, advancement probabilities, documented random seed). The LLM narrates and explains; it never calculates or alters official outcomes, and AI recaps read from the actual scoring database — they never invent results.
5.2 Pate State Playoff Challenge (first new game)
National bracket challenge: pick every round + champion, confidence points, championship-score tiebreaker. National / friends / team-fan / conference leaderboards. Josh's official bracket and citizen consensus bracket shown alongside. Live scoring from the official data source. Shareable bracket image. AI round recaps (biggest upset, best pick, worst miss, current favorite, path-to-victory per user, group vs. Josh).

Private groups: create/name/describe a group, optional image, public or private, invite link, optional password, email invites, commissioners, member picks visible after lock, group message thread, optional custom scoring templates, remove members pre-start. (Family, workplace, church, alumni, listener, team-fan groups.)
5.3 Playoff Team Draft
2–12 participants draft the playoff field; each team draftable once per league. Snake draft (auction later). Live draft room: draft order, available teams, on-the-clock indicator, countdown timer, team info + Pate State projections + citizen draft %, AI recommendations, group chat, auto-pick, draft recap. Empty seats fillable with AI personas (Chalk Player, Upset Hunter, Defense First, Analytics Player, SEC Loyalist, Contrarian, Josh Consensus Bot) using transparent draft logic. Scoring templates: advancement, performance (points, defense, margin, upsets, turnovers, special teams), or hybrid — commissioner picks a template. AI draft grades post-draft (best pick, biggest reach, strengths/weaknesses, projected finish, shareable report card).
5.4 Fantasy roadmap (in order)
	•	Saturday Slate Fantasy — draft a small roster (QB, RB, 2 WR, Flex, Defense, coach/team multiplier) from a curated weekly player pool tied to the week's featured games. Weekly fresh start, public contest + private groups, compete vs. Josh / nationally / by fanbase / by conference, projections, live scoring, AI recap, user history.
	•	Playoff Player Fantasy — draft players from playoff teams; eliminated team = players stop scoring.
	•	Season-long college fantasy — only after data reliability is proven: public/private leagues, redraft (keepers later), weekly lineups, waivers, trades, standings, playoffs, AI commissioner recaps. Start with a limited player pool (major conferences / curated national pool).
5.5 AI Draft Simulator
Practice tool + standalone game: pick competition type, participants, draft slot, scoring, favorite team, AI difficulty and personas → draft vs. AI → receive draft grade, best pick, biggest reach, roster strengths/weaknesses, passed-on players, "how Josh might view this strategy," projected finish, shareable report card. Deterministic engine per §5.1; LLM narrates only.
5.6 Additional games (same engine)
	•	Beat Pate — make Josh's weekly slate of picks; track straight-up accuracy, confidence points, season record, head-to-head vs. Josh, streaks, fanbase accuracy. (Spread data informational only where legally appropriate.)
	•	Saturday Survivor — one team per week, must win, no reuse; standard or one-strike formats; private survivor groups.
	•	Build Your Playoff — user bracket compared vs. Josh, the committee, the Citizen Poll, Pate State AI, and the real bracket.
	•	Portal General Manager — simulated roster building (NIL budget, targets, retention), AI roster grade. Clearly labeled simulation.
	•	Dynasty Builder — later-stage multi-season program-building game.
5.7 Hard exclusions
No paid-entry contests. No real-money wagering. No unsupervised autonomous breaking-news publication. No general Josh chatbot that invents opinions.


6. PERSONALIZATION
	•	Registration asks: primary team, up to 5 followed teams, favorite conference, opt-ins (recruiting alerts, game reminders, fantasy notifications).
	•	My Teams homepage module: latest team news, upcoming games, followed-board activity, recruiting updates, Josh's latest team analysis, active competitions, league invitations.
	•	Notification preferences: breaking team news, kickoff, final score, Josh's new prediction, commitment, portal move, reply/mention, league invitation, draft starting, pick deadline, leaderboard movement.
	•	Pate Playbook newsletter gains a personalized "What happened with your teams" section.


7. CONTENT DEPTH ENGINE (Priority: raise 3/10 → 8+)
7.1 Episode companions — the core habit
Every episode (~5/week) gets a written companion in the Notebook within hours of upload: 1,000–1,500 words in Josh's voice, embedded video, key takeaways, timestamps, team tags. Build the Sanity pipeline: episode ingest (YouTube API) → transcript → Pate State AI draft → producer/editor review → publish with full labels (§0.4). Target: the complete written archive of the show — the moat nobody can copy.
7.2 Pate State AI (positioning + rules)
Public description: "Pate State AI is built from Josh Pate's owned content archive, show transcripts, rankings philosophy, prediction history, football terminology and editorial guidelines. It helps The Pate State organize, draft and personalize content. Published news and analysis are reviewed by The Pate State editorial team."

Hard rules: (1) never invent an opinion attributed to Josh; (2) every Josh opinion traces to a clip/transcript/article/approval; (3) every direct quote carries a transcript reference + timestamp; (4) injuries, transfers, coaching changes, eligibility, legal, discipline → mandatory editorial review; (5) scores/schedules/standings may auto-update from a licensed source; (6) rumors never labeled confirmed; (7) predictions labeled projections; (8) corrections logged, never silent; (9) third-party reporting links the original publisher; (10) no 136 lightly-rewritten team versions of one story. Prefer retrieval over fine-tuning so every answer can show its source.
7.3 Ask Pate State AI (user-facing feature)
Queries like "What has Josh said about Alabama's QB situation?" return: concise answer + source video/article + episode date + timestamp + related team pages + "Based on Josh Pate's published content through [date]." If no documented position exists: "I could not find a published Josh Pate position on that question." Never generate a probable opinion.
7.4 The Wire
Verified short-form news with real timestamps and direct source links. Keep + expand the existing AI Wire Desk disclosure into a full Standards page (editorial policy, corrections policy, AI disclosure, sourcing rules) linked in the footer.
7.5 Search & discovery
Sitewide search across articles, teams, players, coaches, episodes, transcript passages, board threads, recruiting, predictions, Josh's historical opinions. Filters: team, conference, content type, date, author, video/news/community/recruiting/fantasy. "Alabama quarterback" returns: team info → Josh's latest analysis → news → transcript hits with timestamps → Alabama Porch threads → fantasy implications → historical predictions.


8. TECHNICAL SEO (Priority: raise 5/10 → 9) — includes verified current defects
Fix these confirmed issues plus implement the full framework:

	•	Unique metadata per page. Currently every page reuses the homepage meta description verbatim (verified on /poll, /notebook, /about). Generate unique titles + descriptions for every route, dynamic for teams/articles/threads.
	•	Canonical URLs on every page. Currently absent (verified on /notebook). One canonical per thread/article; correct pagination handling.
	•	Structured data. Homepage currently has zero JSON-LD (verified). Add: Organization, WebSite (+SearchAction), Person (Josh Pate with sameAs links), PodcastSeries/VideoObject for episodes, NewsArticle/Article with author/editor/datePublished/dateModified on all articles, SportsTeam on team pages, BreadcrumbList sitewide, DiscussionForumPosting on indexed threads.
	•	Score ticker bug. The homepage slate strip renders garbled matchups ("NC@TNC @ T"). Fix the abbreviation/rendering logic, bind to the real schedule feed, and swap helmet thumbnails for team logos per §1.4.
	•	Sitemaps. Separate sitemaps: pages, articles, teams, threads; auto-updated; exclude anything incomplete, demo, or noindex.
	•	Indexing policy. Demos: never indexed. Team pages: indexed only at completeness standard (§4.6). Threads: new threads start noindex; staff threads index immediately; community threads index after quality thresholds (unique participants, depth, sources, moderation status, originality); spam/thin/duplicate stay noindex.
	•	Author pages for Josh, staff, and contributors; every article links its author and editor; published + updated timestamps on all content.
	•	Trust/legal pages (currently missing from footer): Privacy Policy, Terms of Service, Editorial Standards & Corrections, AI Disclosure, Contact. Required for sponsorships, commerce, email capture, and E-E-A-T.
	•	Internal linking — articles ↔ team pages ↔ boards ↔ games ↔ episodes, systematically.
	•	Performance — image optimization, lazy loading below the fold, Core Web Vitals budgets on the new heavy modules (slider, boards, leaderboards).


9. DATA ARCHITECTURE
9.1 Sanity (editorial)
Articles, authors, editors, corrections, editorial policies, static pages, show episodes, transcripts, team editorial summaries, tailgate guides, sponsored-content disclosures, hero-slider slides.
9.2 Supabase (identity, community, games)
Auth, profiles, roles, team follows, notification preferences; boards, threads, posts, reactions, reports, moderator actions, mutes, badges; teams, seasons, games, rosters, players, stats, recruiting classes, commitments, transfers, rankings; competitions, rules, leagues, members, invitations, entries, picks, draft rooms, participants, draft picks, fantasy rosters/lineups, leaderboard snapshots; ai_outputs, ai_source_references, editorial_reviews, article_corrections, audit_events.

AI outputs retain: prompt version, model version, source documents, output, reviewer, review status, publication destination, correction history.
9.3 Protections
Row-level security, role-based permissions, soft deletion, immutable moderation logs, immutable picks after lock, private-league access controls, rate limiting, user block/mute lists, audit trails, account deletion + data export.


10. METRICS
North star: Weekly Active Citizen — a signed-in user completing ≥2 meaningful actions/week (reads, follows, posts, picks, joins, drafts, lineup updates, watches/reads a Josh segment, polls). Also track: visitor→citizen conversion, % selecting a team, % joining a board, % joining a league, invite acceptance, posts per active citizen, D7/D30 retention, sessions per citizen, article→community rate, team-page return rate, competition completion, newsletter return traffic, % AI articles requiring correction, moderation reports per 1,000 posts, % reports resolved.

Weekly rhythm the product should reinforce: MON rankings/recap · TUE recruiting/portal · WED film room · THU Josh predictions + fantasy prep · FRI final picks + group reminders · SAT live scores, fantasy, game threads · SUN results, grades, AI recaps.


11. MONETIZATION GUARDRAILS (later phases)
Free forever: core reporting, team pages, public boards, basic Pick'Em, public playoff competition, follows, standard notifications. Citizen+ later: ad-free, advanced fantasy tools, extra private leagues, commissioner customization, deeper data, historical prediction database, premium AI queries, early annual-report access, exclusive Josh Q&A, profile customization. Sponsorable surfaces (always visibly labeled, never influencing editorial): scoreboard, Game of the Week, Playoff Challenge, Draft Room, team pages, tailgate guides, weekly leaderboard, Film Room.


12. IMPLEMENTATION ORDER
Phase 1 — Production trust foundation DEMO_MODE flag + full placeholder audit + polished empty states · editorial/AI labels + source fields + timestamps + corrections system · trust & Standards pages · technical SEO fixes (§8 items 1–5, 7–8) · new navigation · hero slider · Show thumbnails · ticker fix · team-follow foundation · search foundation. Acceptance: no placeholder statistic in production unless labeled demo; no demo page indexed; every article carries content type + production method + reviewer where AI-assisted; every reported news item has a source; every team followable; every page has unique metadata + canonical; homepage has full JSON-LD; hero slider is Sanity-editable and accessible; all 4 Show videos display thumbnails automatically.

Phase 2 — The Porch community MVP Community home + national/recruiting/fantasy boards + initial team boards · threads/replies/reactions/polls/reports · staff moderation suite · notifications · roles + team badges · auto game threads · article↔discussion links · the §3.1 visual spec. Acceptance: users can create/participate in discussions; staff can pin/lock/move/hide/moderate; report + mute work; active team pages show their board; major games get automatic live threads; excellent on mobile; new/low-quality threads unindexed; the board list is visually indistinguishable in boldness/scannability from the On3 reference standard.

Phase 3 — Team-site framework Universal template + all §4 modules · first 20–25 complete team hubs · ranking-table + Quick Links components · team metadata + search · followed teams on homepage. Acceptance: initial hubs feel like complete destinations, not filtered article lists; boards integrated; articles auto-populate correct teams; incomplete pages unindexed; every visible number shows source or update time.

Phase 4 — Playoff Challenge (bracket, groups, locking, leaderboards, Josh's bracket, consensus, live scoring, AI recaps, share cards). Acceptance: private groups work end-to-end; picks lock immutably; results update from the official source; group and national scoring calculate identically; AI recaps use real group data only.

Phase 5 — Playoff Team Draft (draft rooms, snake, AI personas, auto-pick, timers, scoring templates, standings, chat, AI grades). Acceptance: drafts complete with humans/AI/mixed; no team drafted twice per league; results preserved; scoring follows template; AI narration never alters official scores.

Phase 6 — Saturday Slate Fantasy + AI Draft Simulator, then expansion to all 136 complete team sites, then season-long fantasy only after data reliability and prior products are stable.

Do not build first: paid-entry contests, real-money wagering, anonymous posting, private DMs, fully autonomous breaking news, 136 thin team pages, player-level fantasy before reliable data, a Josh chatbot that invents opinions, auction drafts before snake works, custom scoring before templates work, heavy paywalls, multiple independent community systems. Build ONE identity system, ONE team framework, ONE community framework, ONE competition engine.

