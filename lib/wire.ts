// The Wire Desk (ops manual §3, §20–21; wire-desk manual v2.0).
// RSS-tier monitoring → cluster/dedup (Supabase) → wire items (auto-publish) →
// importance ≥ 7 → full story through the autonomous verification stack.
// Server-only; called from /api/wire/monitor on a pg_cron cadence.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { writeClient, isSanityWriteConfigured } from "@/lib/sanity";
import { getTeamDirectory } from "@/lib/cfbd";
import { findReceipt } from "@/lib/quotes";
import { slugify } from "@/lib/slug";
import { writeJSON } from "@/lib/writer";
import { boilerplateViolations, BOILERPLATE_PROMPT, VOICE_V4_PROMPT, scoreDraft, editorialSystem } from "@/lib/editorial";

const MODEL = "claude-sonnet-5";
// Client directive (2026-08-17): wire clicks must never leave the site, so
// every published item gets a full-story attempt — the run cap only guards
// against a runaway pass, not coverage.
const MAX_STORIES_PER_RUN = 6;
const MAX_ITEMS_PER_RUN = 6;

// §20 source network, RSS tier. Detection AND sourcing (Tier 1/2 only — every
// feed here is a named national outlet, so the source-tier gate is inherent:
// clusters can only ever contain claims from these outlets).
const FEEDS: { outlet: string; url: string }[] = [
  // ESPN arrives via fetchEspnNews() (site API) — their RSS is abandoned.
  { outlet: "CBS Sports", url: "https://www.cbssports.com/rss/headlines/college-football/" },
  { outlet: "Yahoo Sports", url: "https://sports.yahoo.com/college-football/rss.xml" },
  // Josh, 2026-08-19: "We cannot just rely on Yahoo." On3's feed is
  // site-wide (recruiting-heavy, some other sports) — the CFB relevance
  // filter below already discards off-topic entries, same as Yahoo's
  // wrestling. Bleacher Report, SI, and Fox no longer publish RSS
  // (verified 404, 2026-08-19); X requires the paid API — see ops notes.
  { outlet: "On3", url: "https://www.on3.com/feed/" },
];

export interface FeedEntry {
  outlet: string;
  title: string;
  link: string;
  description: string;
  /** Full article text when the feed provides it (content:encoded — On3's
   * WordPress feed carries whole articles; their pages block our fetcher,
   * so this is the only real grounding we get for On3 stories). */
  content: string;
  pubDate: string;
}

function prompt(name: string): string {
  return readFileSync(join(process.cwd(), "prompts", name), "utf8");
}

function textOf(res: Anthropic.Message): string {
  const block = res.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

/** ESPN killed meaningful RSS output (their ncf feed carries ~1 item), but
 * the same site API the rest of the app already leans on has a live news
 * endpoint. Video clips have no article text to ground a story in, so only
 * real story links pass through. Fail-soft empty. */
async function fetchEspnNews(): Promise<FeedEntry[]> {
  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/college-football/news?limit=20",
      { signal: AbortSignal.timeout(10000), cache: "no-store" },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      articles?: { headline?: string; description?: string; published?: string; links?: { web?: { href?: string } } }[];
    };
    return (data.articles ?? [])
      .filter((a) => a.headline && a.links?.web?.href && !a.links.web.href.includes("/video/"))
      .slice(0, 15)
      .map((a) => ({
        outlet: "ESPN",
        title: a.headline!,
        link: a.links!.web!.href!,
        description: (a.description ?? "").slice(0, 500),
        content: "",
        pubDate: a.published ?? "",
      }));
  } catch (err) {
    console.error("[wire:feed]", "ESPN api", err);
    return [];
  }
}

/** Fetches and parses all monitored feeds. Per-feed fail-soft. */
export async function fetchFeeds(): Promise<FeedEntry[]> {
  const out: FeedEntry[] = [];
  await Promise.all([
    fetchEspnNews().then((entries) => out.push(...entries)),
    ...FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          headers: { "user-agent": "PateStateWire/1.0 (+https://thepatestate.com)" },
          signal: AbortSignal.timeout(10000),
          cache: "no-store",
        });
        if (!res.ok) return;
        const xml = await res.text();
        const items = xml.split(/<item[\s>]/i).slice(1);
        for (const raw of items.slice(0, 15)) {
          const title = tag(raw, "title");
          if (!title) continue;
          out.push({
            outlet: feed.outlet,
            title,
            link: tag(raw, "link") || tag(raw, "guid"),
            description: tag(raw, "description").slice(0, 500),
            content: tag(raw, "content:encoded").slice(0, 2400),
            pubDate: tag(raw, "pubDate"),
          });
        }
      } catch (err) {
        console.error("[wire:feed]", feed.outlet, err);
      }
    }),
  ]);
  return out;
}

// National CFB feeds carry other sports (Yahoo's especially: wrestling
// schedules, hoops recruiting, high-school previews). The Wire is college
// football only — kill off-topic entries before they cost a scoring call.
const OFF_TOPIC = /\b(wrestl\w*|basketball|hoops|baseball|softball|volleyball|gymnastics|hockey|lacrosse|soccer|golf|tennis|track and field|swimming|wnba|nba|nfl|mlb|nhl|high school|nascar|indycar|formula one|motocross|real american freestyle|boxing|mma|ufc)\b/i;

/** True when an entry clearly isn't college football. Exported for tests.
 * 400 chars of body text — 160 missed sport mentions that arrive a sentence
 * or two in (a basketball portal story slipped through on 2026-08-20). */
export function isOffTopic(title: string, description = ""): boolean {
  return OFF_TOPIC.test(title) || OFF_TOPIC.test(description.slice(0, 400));
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "in", "on", "for", "to", "with", "at", "by", "as",
  "is", "are", "was", "be", "has", "have", "his", "her", "its", "their", "after", "before",
  "college", "football", "ncaa", "cfb", "news", "report", "reports", "sources", "source",
]);

/** Normalized keyword set used for both clustering and dedup. Exported for tests. */
export function titleKeywords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
  );
}

/** Jaccard-ish overlap: |intersection| / |smaller set|. Exported for tests. */
export function keywordOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let hit = 0;
  for (const w of a) if (b.has(w)) hit++;
  return hit / Math.min(a.size, b.size);
}

interface ClusterRow {
  id: string;
  cluster_key: string;
  title: string;
  source_urls: string[];
  source_outlets: string[];
  importance: number | null;
  item_id: string | null;
  story_id: string | null;
}

const ITEM_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    sub: { type: "string" },
    category: { type: "string", enum: ["recruiting", "coaching", "injury", "transfer", "playoff", "media", "legal", "general"] },
    teams: { type: "array", items: { type: "string" } },
    importance: { type: "integer" },
    importance_reason: { type: "string" },
  },
  required: ["headline", "sub", "category", "teams", "importance", "importance_reason"],
  additionalProperties: false,
} as const;

// Production Guide v1.2 architecture (prompts/wire-production-guide.md,
// reference build docs/content/wire-kansas-state-pastore-v3.html).
export const STORY_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    deck: { type: "string" },
    verification: { type: "string", enum: ["confirmed", "reported", "developing"] },
    impact: { type: "string", enum: ["low", "moderate", "significant", "major", "season-shaping"] },
    impactRationale: { type: "string" },
    stats: {
      type: "array",
      items: {
        type: "object",
        properties: { value: { type: "string" }, label: { type: "string" }, critical: { type: "boolean" } },
        required: ["value", "label", "critical"],
        additionalProperties: false,
      },
    },
    // Wire Editorial System v2.0 §47–48: the visible architecture adapts to
    // the story — each section carries its own descriptive header ("" = the
    // page's default). Never the same six headers on every story.
    openTitle: { type: "string" },
    whatHappened: { type: "string" },
    whyTitle: { type: "string" },
    whyBody: { type: "string" },
    missingTitle: { type: "string" },
    missing: { type: "string" },
    section04Title: { type: "string" },
    section04Body: { type: "string" },
    chessboardTitle: { type: "string" },
    chessboard: { type: "string" },
    readBody: { type: "string" },
    board: {
      type: "object",
      properties: {
        title: { type: "string" },
        rows: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, meta: { type: "string" }, note: { type: "string" } },
            required: ["name", "meta", "note"],
            additionalProperties: false,
          },
        },
        summary: { type: "string" },
      },
      required: ["title", "rows", "summary"],
      additionalProperties: false,
    },
    watching: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, body: { type: "string" } },
        required: ["title", "body"],
        additionalProperties: false,
      },
    },
    facts: {
      type: "array",
      items: {
        type: "object",
        properties: { label: { type: "string" }, value: { type: "string" } },
        required: ["label", "value"],
        additionalProperties: false,
      },
    },
    teams: { type: "array", items: { type: "string" } },
    category: { type: "string" },
  },
  required: ["headline", "deck", "verification", "impact", "impactRationale", "stats", "openTitle", "whatHappened", "whyTitle", "whyBody", "missingTitle", "missing", "section04Title", "section04Body", "chessboardTitle", "chessboard", "readBody", "board", "watching", "facts", "teams", "category"],
  additionalProperties: false,
} as const;

/** Writers sometimes emit slug-plus-mascot ("lsu-tigers") — resolve to the
 * FBS directory key by progressively dropping trailing words. Exported for
 * tests. */
export function resolveTeamSlug(slug: string, dir: Record<string, unknown>): string {
  if (dir[slug]) return slug;
  const parts = slug.split("-");
  for (let cut = 1; cut < parts.length; cut++) {
    const candidate = parts.slice(0, parts.length - cut).join("-");
    if (dir[candidate]) return candidate;
  }
  return slug;
}

/** Porch-voice rule (§7): zero em dashes in article prose — the number-one
 * AI tell. Deterministic scrub as the backstop behind the prompt ban.
 * Exported for tests. */
export function scrubDashes(t: string): string {
  return t.replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ", ");
}

// ---------------------------------------------------------------------------
// Callout selection (overhaul 2026-08-20, per the Claude/ChatGPT/Grok
// consult): the bold quote is chosen by an independent scorer over the
// story's own complete sentences — never by the writer picking its own
// "sharpest line," which produced template phrases and hedges. No sentence
// clears the bar → no callout; an empty slot beats junk.

/** Sentence tokenizer tuned for sports copy: protects common abbreviations,
 * dates ("Oct. 10"), ranks ("No. 10"), and initials so splits land on real
 * sentence boundaries. Exported for tests. */
export function splitSentences(text: string): string[] {
  const SHIELD = "";
  const shielded = text
    .replace(/\b(No|Oct|Nov|Dec|Jan|Feb|Sept?|Aug|Jul|Jun|Apr|Mar|St|Dr|Jr|Sr|Mr|Mrs|Ms|vs|U\.S|D\.C)\.\s/g, (m) => m.replace(". ", `${SHIELD} `))
    .replace(/\b([A-Z])\.\s(?=[A-Z]\.)/g, `$1${SHIELD} `)
    .replace(/\b([A-Z])\.([A-Z])\.\s/g, `$1${SHIELD}$2${SHIELD} `);
  return shielded
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(new RegExp(SHIELD, "g"), ".").trim())
    .filter(Boolean);
}

/** Phrases and shapes that never make a pull quote — the observed template
 * leaks and the hedge/process vocabulary. Exported so the prompt-hygiene
 * test can assert the prompts themselves stay clean. */
export const CALLOUT_BANNED: RegExp[] = [
  /a spot,? not the earth/i,
  /\bthe (task|job) (now|is|gets|for)\b/i,
  /\bfailure condition\b/i,
  /\bdecision communication\b/i,
  /\bavailable (information|reporting)\b/i,
  /\b(doesn'?t|does not) establish\b/i,
  /\bremains to be seen\b|\bonly time will tell\b|\bwe'?ll see\b/i,
  /^\s*(this|that|it) (moves|changes|shifts|means|makes this)\b/i,
  /\bthe (process|conversation|needle)\b/i,
  /\bworth (noting|watching)\b|\bnotably\b/i,
  /\bverification event\b/i,
];

const HEDGES = /\b(might|could|whether|unclear|uncertain|possibly|perhaps|may\b)/gi;
const CONTRAST = /\b(but|yet|however|still|instead|until|unless)\b/i;
const STRONG_VERBS = /\b(wins?|forces?|owns?|costs?|decides?|buys?|breaks?|ends?|beats?|carries|swings?|settles?|earns?|loses?|proves?)\b/i;

/** Scores one sentence as a pull-quote candidate; -Infinity = vetoed.
 * Rubric from the consult: concrete beats abstract, claims beat process,
 * contrast reads well ripped out of context. Exported for tests. */
export function scoreCallout(sentence: string): number {
  const s = sentence.trim();
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 8 || words.length > 24) return -Infinity;
  if (!/^[A-Z"“]/.test(s) || !/[.!?”"]$/.test(s)) return -Infinity;
  if (CALLOUT_BANNED.some((re) => re.test(s))) return -Infinity;
  // Ramp openers read as mid-paragraph fragments, not standalone lines.
  if (/^(speaking|according to|talking|appearing|in an interview|asked about|when asked)\b/i.test(s)) return -Infinity;
  if (/(?:^|[\s“"(])(I|I'm|I've|I'd|my)\b/.test(s)) return -Infinity;
  if (headlineNamesOutlet(s) || /\breport(s|ed|ing)?\b/i.test(s)) return -Infinity;
  const hedges = s.match(HEDGES)?.length ?? 0;
  if (hedges >= 2) return -Infinity;
  // Standalone anchor (Isaac 2026-08-21: a reader seeing ONLY the quote must
  // understand it): a sentence with neither a name nor a number is unmoored.
  const hasProper = words.slice(1).some((w) => /^[A-Z][a-z]/.test(w.replace(/^["“(']/, "")));
  const hasDigit = /\d/.test(s);
  if (!hasProper && !hasDigit) return -Infinity;
  let score = 0;
  if (hasProper) score += 2;
  if (hasDigit) score += 2;
  if (CONTRAST.test(s)) score += 2;
  if (STRONG_VERBS.test(s)) score += 1;
  if (words.length >= 10 && words.length <= 18) score += 1;
  score -= hedges;
  return score;
}

/** Picks the story's callout: every complete sentence competes — the read
 * (the take lives there, +2.5) over the bullets (+0.5) over the facts
 * (-0.5, so biography/transaction trivia can't outrank a real claim).
 * A sentence that mostly restates the headline is penalized (the pull
 * quote must ADD something), and sober categories (injury, legal) never
 * carry one. Nothing qualifying → "". */
export function selectCallout(story: {
  whatHappened?: string;
  whyItMatters?: string[];
  readBody?: string;
  headline?: string;
  category?: string;
}): string {
  if (story.category === "injury" || story.category === "legal") return "";
  // Thin-source briefs (whatHappened only) never earned a strong line — a
  // callout there is writing toward the graphic (Updates 4.0 rule 10).
  const st = story as { missing?: string; whyBody?: string };
  if (!story.readBody && !st.missing && !st.whyBody && !(story.whyItMatters ?? []).length) return "";
  const headlineKw = titleKeywords(story.headline ?? "");
  const pools: { text: string; bonus: number }[] = [
    { text: story.readBody ?? "", bonus: 2.5 },
    { text: (story as { missing?: string }).missing ?? "", bonus: 1.5 },
    { text: (story as { chessboard?: string }).chessboard ?? "", bonus: 1 },
    { text: (story as { section04Body?: string }).section04Body ?? "", bonus: 0.5 },
    { text: (story as { whyBody?: string }).whyBody ?? "", bonus: 0.5 },
    { text: (story.whyItMatters ?? []).join(" "), bonus: 0.5 },
    { text: story.whatHappened ?? "", bonus: -0.5 },
  ];
  let best = "";
  let bestScore = -Infinity;
  for (const pool of pools) {
    for (const sentence of splitSentences(pool.text)) {
      let score = scoreCallout(sentence);
      if (score === -Infinity) continue;
      // Restating the headline in different clothes adds nothing.
      if (headlineKw.size > 0 && keywordOverlap(titleKeywords(sentence), headlineKw) >= 0.5) score -= 3;
      // Biography shape ("X is a former … who …") is trivia, not a take.
      if (/\bis an? (former|current)?\s?\w+ (alumnus|native|graduate|member|executive|goalkeeper|walk-on)\b/i.test(sentence)) score -= 3;
      const total = score + pool.bonus;
      if (total > bestScore) { bestScore = total; best = sentence; }
    }
  }
  return bestScore >= 4 ? best : "";
}

/** Josh's Receipt only renders when he was genuinely talking about THIS
 * news — team overlap alone attached Heisman takes to recruiting notes
 * (Isaac, 2026-08-20). Cheap second-model check; fail-soft false. */
async function receiptIsRelevant(
  anthropic: Anthropic,
  receipt: { quote: string; topic: string },
  job: StoryJob,
): Promise<boolean> {
  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 256,
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: { relevant: { type: "boolean" } },
            required: ["relevant"],
            additionalProperties: false,
          },
        },
      },
      system:
        'An archived spoken quote may be attached to a news story as "Josh said it first." Return relevant=true ONLY when the quote is clearly about the same specific subject as the news — the same player, hire, game, ranking argument, or storyline. Same team but different topic is NOT relevant. When unsure, false. Output JSON only.',
      messages: [{
        role: "user",
        content: `NEWS:\n${job.sourceBlock.slice(0, 900)}\n\nARCHIVED QUOTE (topic: ${receipt.topic}):\n"${receipt.quote}"`,
      }],
    });
    return JSON.parse(textOf(res)).relevant === true;
  } catch {
    return false;
  }
}

const FACTCHECK_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["pass", "unsupported", "contradicted"] },
    detail: { type: "string" },
  },
  required: ["verdict", "detail"],
  additionalProperties: false,
} as const;

// §21 banned-inference regexes — hard blocks regardless of model output.
const BANNED_PATTERNS = [
  /sources tell the pate state/i,
  /pate state has learned/i,
  /!\s/,
  /\block of the (week|year)\b/i,
  /\bguaranteed\b/i,
];

/** §21 attribution rule, FLIPPED (Josh via Isaac, 2026-08-20): source credit
 * lives in the cited-sources footer, never in the prose. This gate REJECTS
 * drafts that open on an outlet lean ("Per On3's report, …", "According to
 * ESPN, …") or narrate "the report" instead of the news. Official-statement
 * phrasing ("Tennessee announced…") is normal prose and passes. Exported
 * for tests. */
/** Headline hygiene: the writer sometimes emits markdown bold in string
 * fields (renders as literal asterisks) and trailing outlet leans ("…, per
 * On3") that the prose gate can't see. Applied to every item and story
 * headline. Exported for tests. */
const OUTLET_NAMES = "(?:On3|ESPN|Yahoo(?:\\s+Sports)?|CBS(?:\\s+Sports)?|247Sports|Athlon(?:\\s+Sports)?|Rivals)";

export function cleanHeadline(h: string): string {
  let out = h
    .replace(/\*\*?/g, "")
    .replace(/,?\s+(per|according to|via)\s+[A-Za-z0-9 .&'’]+$/i, "")
    // "On3 Reports Five Oregon Players…" / "ESPN: Rebuilt Pac-12…" — the
    // news is the subject, never the outlet (Josh via Isaac, 2026-08-20).
    .replace(
      new RegExp(
        `^${OUTLET_NAMES}[’']?s?:?\\s*(?:report(?:s|ed)?|detail(?:s|ed)?|examin(?:es|ed)|project(?:s|ed)?|update(?:s|d)?|publish(?:es|ed)?|breaks?\\s+down|broke\\s+down|list(?:s|ed)?|name(?:s|d)?|rank(?:s|ed)?|grade(?:s|d)?|flag(?:s|ged)?|pick(?:s|ed)?|preview(?:s|ed)?|release(?:s|d)?|say(?:s)?|note(?:s|d)?)?\\s*`,
        "i",
      ),
      "",
    )
    .trim();
  if (out && out !== h.trim()) out = out.charAt(0).toUpperCase() + out.slice(1);
  return out;
}

/** True when a headline still names an outlet after cleaning — those need a
 * real rewrite, not a regex strip. "Rivals" is matched case-sensitively:
 * lowercase "rivals" is ordinary football English ("three SEC rivals"), the
 * brand is always capitalized. Exported for the archive pass + tests. */
export function headlineNamesOutlet(h: string): boolean {
  return (
    /\b(?:On3|ESPN|Yahoo(?:\s+Sports)?|CBS(?:\s+Sports)?|247Sports|Athlon(?:\s+Sports)?)\b/i.test(h) ||
    /\bRivals(?:100|250|300|\.com)?\b/.test(h)
  );
}

export function hasAttributionOpener(text: string): boolean {
  const first = text.split(/(?<=[.!?])\s/)[0]?.toLowerCase() ?? "";
  if (/^\s*(per|according to)\b/.test(first)) return true;
  return /\b(a|the|its|their) reports? (says|said|notes|noted|adds|added|examines|examined|presents|presented|includes|included|details|detailed|indicates|indicated|frames|framed|describes|described|lists|listed)\b/i.test(text);
}

/** The desk has no self (wire-desk rule): first-person prose in a wire
 * story is a fabricated voice — the receipt module is the only place a
 * person speaks. Exported for tests. */
export function hasFirstPersonProse(text: string): boolean {
  return /(?:^|[\s“"(])(I|I'm|I've|I'd|I'll|my|me|we're|we've)(?=[\s,.!?'’])/m.test(text) && /\bI\b|I'm|I've|I'd|I'll/.test(text);
}

/** Isaac, 2026-08-21: the prose must never narrate its own sourcing —
 * "described as," "the source material," "provided here" reads like a
 * paralegal, not an analyst. Applied to ALL prose fields with a corrective
 * retry. ("reported to be …" stays legal per §5.) Exported for tests. */
export function narratesSourcing(text: string): boolean {
  return (
    /\b(the|this) (source material|available information|available report(ing|s)?)\b/i.test(text) ||
    /\bbased on (the|this) report\b/i.test(text) ||
    /\bin the source(s| material)?\b/i.test(text) ||
    /\bis (described|framed|characterized|listed|presented) as\b/i.test(text) ||
    /\b(provided|identified|named|listed) (here|in the report)\b/i.test(text) ||
    /\bper the (report|reporting)\b/i.test(text) ||
    /\bno [^.!?]{0,40} (is|are) (reported|provided|identified|named|listed)\b/i.test(text)
  );
}

export interface StoryJob {
  sourceBlock: string;
  outlets: string[];
  /** Outlet/url pairs rendered as the story's cited-sources block. */
  sources: { outlet: string; url: string }[];
  clusterKey: string;
  teams: string[];
  receiptKeywords: string[];
  itemId: string;
}

/** Full-story generation + the §21 verification stack (banned patterns,
 * attribution, second-model fact-check). Shared by the live monitor and the
 * backfill. Returns "ok" or a skip reason. */
/** Generation + the full §21 verification stack, shared by the live
 * monitor, the backfill, and the archive-upgrade script. Returns the
 * sanity-ready field object (everything but _id/_type/slug/publishedAt)
 * or a skip reason. */
/** The page renders board.summary behind a bold "The tell:" label, so a
 * summary that opens with its own "The tell will be…" doubles the label.
 * Strip the writer's copy of it. Exported for tests. */
/** Section headers (Wire §48) are short descriptive labels: strip markdown,
 * dashes, trailing punctuation, and anything longer than eight words
 * (a sentence is not a header) so the page never renders a runaway h2.
 * Exported for tests. */
export function cleanSectionTitle(title: string | undefined): string {
  const t = (title ?? "").replace(/\*\*?/g, "").replace(/\s*[—–]\s*/g, ": ").replace(/[.:;,\s]+$/g, "").trim();
  if (!t || t.split(/\s+/).length > 8 || headlineNamesOutlet(t)) return "";
  return t;
}

export function cleanTellSummary(summary: string): string {
  const stripped = (summary ?? "").replace(/^\s*the tell (will be|is|:|comes?( first)? (with|from|in))[:,]?\s*/i, "");
  return stripped ? stripped.charAt(0).toUpperCase() + stripped.slice(1) : summary;
}

export async function generateWireStory(
  anthropic: Anthropic,
  job: StoryJob,
): Promise<{ ok: true; fields: Record<string, unknown> } | { ok: false; reason: string }> {
  let receipt = await findReceipt(job.teams, job.receiptKeywords);
  if (receipt && !(await receiptIsRelevant(anthropic, receipt, job))) receipt = null;
  const baseUser = `${VOICE_V4_PROMPT}\n\n${BOILERPLATE_PROMPT}\n\nSource cluster:\n${job.sourceBlock}${receipt ? `\n\nJosh's archived on-topic quote (verbatim; render as his receipt, do NOT alter): "${receipt.quote}"` : ""}`;
  // One corrective retry when the draft names an outlet in the upper page
  // (guide §5) — the old pipeline REQUIRED that habit, so writers relapse.
  // System prompt = preamble → 00 Editorial Core → 01 Wire (Josh's documents,
  // verbatim) → house overrides → the JSON contract in wire-story.md.
  const system = editorialSystem("wire", prompt("wire-story.md"));
  let storyRaw = "";
  let user = baseUser;
  for (let attempt = 0; attempt < 2; attempt++) {
    storyRaw = await writeJSON({
      system,
      user,
      schema: STORY_SCHEMA,
      schemaName: "wire_story",
      maxTokens: 8192,
    });
    const draft = JSON.parse(storyRaw) as Record<string, string | undefined>;
    const upper = `${draft.deck ?? ""}\n${draft.whatHappened ?? ""}`;
    const allProse = ["deck", "whatHappened", "whyBody", "missing", "section04Body", "chessboard", "readBody"]
      .map((k) => draft[k] ?? "").join("\n");
    const boiler = boilerplateViolations(allProse);
    if (!headlineNamesOutlet(upper) && !hasAttributionOpener(draft.whatHappened ?? "") && !narratesSourcing(allProse) && !hasFirstPersonProse(allProse) && boiler.length === 0 && !/\*{2,}/.test(allProse)) break;
    user = `${baseUser}\n\nYOUR PREVIOUS DRAFT VIOLATED the writing standard${boiler.length ? ` (gated language found: ${boiler.join("; ")})` : ""}. The desk NEVER speaks in first person — no "I," "my," or "we've" anywhere in prose (the desk has no self; Josh's voice exists only in the receipt module). Never name an outlet or use in-prose attribution in the deck or the opening section (official source or a NAMED individual reporter only; unconfirmed details are "reported to be…"). And NEVER narrate your own sourcing anywhere — no "the source material," "the available information," "is described as," "no names are provided," "per the report." Write what IS known directly, the way an analyst explains news to a friend; where something is unknown, say what we don't know yet in plain speech ("Washington hasn't said who") without pointing at documents. Never include censored profanity from a source quote ("a lot of good *** can happen") — trim the quote at a word boundary before the censored word, or paraphrase the sentiment without quoting. Never reuse the editorial documents' example sentences or people. Rewrite the full story.`;
  }
  type StoryDraft = {
    headline: string; deck: string; verification: "confirmed" | "reported" | "developing";
    impact: string; impactRationale: string;
    stats: { value: string; label: string; critical: boolean }[];
    openTitle: string; whatHappened: string; whyTitle: string; whyBody: string; missingTitle: string; missing: string;
    section04Title: string; section04Body: string; chessboardTitle: string; chessboard: string; readBody: string;
    board: { title: string; rows: { name: string; meta: string; note: string }[]; summary: string };
    watching: { title: string; body: string }[];
    facts: { label: string; value: string }[];
    teams: string[]; category: string;
  };
  // Porch voice: scrub em dashes from every prose field (labels/data keep theirs).
  const parseDraft = (raw: string): { story: StoryDraft; combined: string } => {
    const draft = JSON.parse(raw) as StoryDraft;
    for (const k of ["deck", "whatHappened", "whyBody", "missing", "section04Body", "chessboard", "readBody"] as const) {
      draft[k] = scrubDashes(draft[k] ?? "");
    }
    draft.watching = (draft.watching ?? []).slice(0, 4).map((w) => ({ title: w.title, body: scrubDashes(w.body ?? "") }));
    const combined = [
      draft.deck, draft.whatHappened, draft.whyBody, draft.missing,
      draft.section04Body, draft.chessboard, draft.readBody,
      ...(draft.board?.rows ?? []).map((r) => `${r.name} ${r.meta} ${r.note}`),
      draft.board?.summary ?? "",
      ...draft.watching.map((w) => `${w.title} ${w.body}`),
      ...(draft.stats ?? []).map((st) => `${st.value} ${st.label}`),
    ].filter(Boolean).join("\n");
    return { story: draft, combined };
  };
  const proseGateFailure = (d: StoryDraft, c: string): string | null => {
    if (BANNED_PATTERNS.some((re) => re.test(c))) return "banned";
    if (hasAttributionOpener(d.whatHappened) || headlineNamesOutlet(`${d.deck}\n${d.whatHappened}`)) return "attribution";
    if (narratesSourcing(c)) return "sourcenarration";
    if (hasFirstPersonProse(c)) return "firstperson";
    return null;
  };
  const factCheck = async (c: string): Promise<{ verdict: string; detail: string }> => {
    const checkRes = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      output_config: { effort: "low", format: { type: "json_schema", schema: FACTCHECK_SCHEMA } },
      system: "You are an independent fact-check gate. You receive SOURCES and a DRAFT. Verdict 'contradicted' if any draft claim conflicts with the sources; 'unsupported' if any material factual claim (names, numbers, timelines, outcomes) does not appear in the sources; else 'pass'. Interpretation clearly labeled as analysis is allowed; invented facts are not. Output JSON only.",
      messages: [{ role: "user", content: `SOURCES:\n${job.sourceBlock}\n\nDRAFT:\n${c}` }],
    });
    return JSON.parse(textOf(checkRes)) as { verdict: string; detail: string };
  };

  let { story, combined } = parseDraft(storyRaw);
  const gateFail = proseGateFailure(story, combined);
  if (gateFail) return { ok: false, reason: `${gateFail}:${job.clusterKey}` };
  const check = await factCheck(combined);
  if (check.verdict !== "pass") return { ok: false, reason: `factcheck-${check.verdict}:${job.clusterKey}` };

  // Article Updates 4.0: the scored judge (now including the humanity
  // category) gets one shot at forcing a rewrite. Fail-open by design — the
  // Wire has to publish, and the hard gates above remain the floor; the
  // rewrite is only adopted when it passes those same gates plus fact-check.
  const verdict = await scoreDraft(anthropic, { headline: story.headline, dek: story.deck, body: combined });
  if (!verdict.pass) {
    try {
      const rewriteRaw = await writeJSON({
        system,
        user: `${baseUser}\n\nYOUR PREVIOUS DRAFT FAILED the pre-publish quality judge. Judge notes (fix exactly these): ${verdict.notes}\n\nPrevious draft for reference:\n${storyRaw}\n\nRewrite the full story. Keep every verified fact; change the writing. The humanity standard is pass/fail: it must sound written by a person, never generated.`,
        schema: STORY_SCHEMA,
        schemaName: "wire_story",
        maxTokens: 8192,
      });
      const re = parseDraft(rewriteRaw);
      if (!proseGateFailure(re.story, re.combined) && (await factCheck(re.combined)).verdict === "pass") {
        ({ story, combined } = re);
      }
    } catch (err) {
      console.error("[wire:judge-rewrite]", job.clusterKey, err);
    }
  }

  const teamDir = await getTeamDirectory().catch(() => ({}) as Record<string, unknown>);
  const normalizedTeams = (story.teams ?? []).map((t) => resolveTeamSlug(t, teamDir));
  return {
    ok: true,
    fields: {
    headline: cleanHeadline(story.headline),
    verification: story.verification,
    category: story.category,
    teams: normalizedTeams,
    deck: story.deck,
    impact: story.impact,
    impactRationale: story.impactRationale,
    stats: (story.stats ?? []).slice(0, 3).map((st, i) => ({ _key: `stat${i}`, ...st })),
    openTitle: cleanSectionTitle(story.openTitle),
    whatHappened: story.whatHappened,
    whyTitle: cleanSectionTitle(story.whyTitle),
    whyBody: story.whyBody,
    missingTitle: cleanSectionTitle(story.missingTitle),
    missing: story.missing,
    section04Title: cleanSectionTitle(story.section04Title),
    section04Body: story.section04Body,
    chessboardTitle: cleanSectionTitle(story.chessboardTitle),
    chessboard: story.chessboard,
    ...(story.board?.rows?.length
      ? { board: { title: story.board.title, summary: cleanTellSummary(story.board.summary), rows: story.board.rows.slice(0, 3).map((r, i) => ({ _key: `row${i}`, ...r })) } }
      : {}),
    watching: story.watching.map((w, i) => ({ _key: `w${i}`, ...w })),
    facts: (story.facts ?? []).slice(0, 6).map((f, i) => ({ _key: `f${i}`, ...f })),
    callout: selectCallout({ ...story, headline: story.headline, category: story.category }),
    ...(receipt
      ? { joshReceipt: { quote: receipt.quote, ytId: receipt.yt_id, tsSeconds: receipt.ts_seconds } }
      : {}),
    readLabel: "THE PATE STATE READ",
    readBody: story.readBody.replace(/^\s*THE PATE STATE READ:?\s*/i, ""),
    sources: job.sources.slice(0, 6),
    },
  };
}

async function writeStoryFromSources(
  anthropic: Anthropic,
  db: ReturnType<typeof createAdminClient> | null,
  job: StoryJob,
): Promise<string> {
  const gen = await generateWireStory(anthropic, job);
  if (!gen.ok) return gen.reason;
  const storyId = `wireStory-${job.clusterKey}`;
  await writeClient.createIfNotExists({
    _id: storyId,
    _type: "wireStory",
    slug: { _type: "slug", current: slugify(gen.fields.headline as string) },
    ...gen.fields,
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  if (db) await db.from("wire_clusters").update({ story_id: storyId }).eq("item_id", job.itemId);
  // Brief v2 Part 7: the homepage teaser IS the story headline — one
  // headline, never two versions of it.
  await writeClient
    .patch(job.itemId)
    .set({ story: { _type: "reference", _ref: storyId }, headline: gen.fields.headline as string })
    .commit();
  return "ok";
}

/** Fetches a source article and extracts readable text (og:description +
 * paragraph content, tags stripped) so backfilled stories are grounded in
 * the actual report, not just a stored headline. Fail-soft empty string. */
export async function fetchSourceText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "PateStateWire/1.0 (+https://thepatestate.com)" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return "";
    const html = await res.text();
    const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? "";
    const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => decodeEntities(m[1]))
      .filter((t) => t.length > 60)
      .slice(0, 12)
      .join("\n");
    return decodeEntities(`${ogDesc}\n${paras}`).slice(0, 2400);
  } catch {
    return "";
  }
}

/** Backfill: full stories for already-published wire items that never got
 * one (pre-directive importance gate, verification skips, caps). Fetches
 * the stored source articles for real grounding, then runs the same
 * verification stack — items that still can't clear it stay storyless. */
export async function backfillWireStories(limit = 20): Promise<{
  candidates: number; stories: number; skipped: string[];
}> {
  const summary = { candidates: 0, stories: 0, skipped: [] as string[] };
  if (!isAdminConfigured || !isSanityWriteConfigured || !process.env.ANTHROPIC_API_KEY) {
    summary.skipped.push("not-configured");
    return summary;
  }
  const db = createAdminClient();
  const anthropic = new Anthropic();
  const items: {
    _id: string; headline: string; sub?: string; category?: string;
    teams?: string[]; sourceUrls?: string[]; sourceOutlets?: string[];
  }[] = await writeClient.fetch(
    `*[_type == "wireItem" && !defined(story)] | order(publishedAt desc)[0...$limit]{
      _id, headline, sub, category, teams, sourceUrls, sourceOutlets
    }`,
    { limit },
  );
  summary.candidates = items.length;
  for (const item of items) {
    try {
      // Attempt cap: a story that failed verification 3 times isn't going
      // to pass on identical grounding — stop paying for retries. The
      // counter lives on the cluster row.
      const { data: cl } = await db
        .from("wire_clusters")
        .select("id, source_text, backfill_attempts")
        .eq("item_id", item._id)
        .maybeSingle();
      if ((cl?.backfill_attempts ?? 0) >= 3) {
        summary.skipped.push(`attempts:${item._id.slice(9, 49)}`);
        continue;
      }
      const outlets = item.sourceOutlets?.length ? item.sourceOutlets : ["the original report"];
      const urls = item.sourceUrls ?? [];
      const texts = await Promise.all(urls.slice(0, 2).map(fetchSourceText));
      // Outlets that block our fetcher (On3) leave texts empty — fall back
      // to the feed article text stored on the cluster at detection time.
      if (!texts.some(Boolean) && cl?.source_text) texts[0] = cl.source_text;
      const sourceBlock = outlets
        .map((o, i) => {
          const body = texts[i] || texts[0] || item.sub || "";
          return `- [${o}] ${item.headline}\n  ${body}\n  ${urls[i] ?? urls[0] ?? ""}`;
        })
        .join("\n");
      const clusterKey = item._id.replace(/^wireItem-/, "");
      const result = await writeStoryFromSources(anthropic, db, {
        sourceBlock,
        outlets,
        sources: outlets.map((o, i) => ({ outlet: o, url: urls[i] ?? urls[0] ?? "" })),
        clusterKey,
        teams: item.teams ?? [],
        receiptKeywords: [...titleKeywords(item.headline)],
        itemId: item._id,
      });
      if (result === "ok") summary.stories++;
      else {
        summary.skipped.push(result);
        if (cl?.id) {
          await db
            .from("wire_clusters")
            .update({ backfill_attempts: (cl.backfill_attempts ?? 0) + 1 })
            .eq("id", cl.id);
        }
      }
    } catch (err) {
      console.error("[wire:backfill]", item._id, err);
      summary.skipped.push(`error:${item._id.slice(0, 40)}`);
    }
  }
  return summary;
}

/** One monitor pass. Returns a summary for the route response. Never throws. */
export async function runWireMonitor(): Promise<{
  entries: number; clusters: number; items: number; stories: number; skipped: string[];
}> {
  const summary = { entries: 0, clusters: 0, items: 0, stories: 0, skipped: [] as string[] };
  if (!isAdminConfigured || !isSanityWriteConfigured || !process.env.ANTHROPIC_API_KEY) {
    summary.skipped.push("not-configured");
    return summary;
  }
  const db = createAdminClient();
  const anthropic = new Anthropic();

  const entries = await fetchFeeds();
  summary.entries = entries.length;
  if (entries.length === 0) return summary;

  // Existing clusters from the last 48h for dedup.
  const { data: recentRaw } = await db
    .from("wire_clusters")
    .select("id, cluster_key, title, source_urls, source_outlets, importance, item_id, story_id")
    .gte("last_seen", new Date(Date.now() - 48 * 3600_000).toISOString());
  const recent: ClusterRow[] = recentRaw ?? [];
  const recentKeywords = recent.map((c) => ({ row: c, kw: titleKeywords(c.title) }));

  // Group THIS batch's entries into new clusters (or attach to existing ones).
  const fresh: { title: string; entries: FeedEntry[] }[] = [];
  for (const entry of entries) {
    if (isOffTopic(entry.title, `${entry.description} ${entry.content.slice(0, 300)}`)) {
      summary.skipped.push(`offtopic:${entry.title.slice(0, 40)}`);
      continue;
    }
    const kw = titleKeywords(entry.title);
    const existing = recentKeywords.find((c) => keywordOverlap(kw, c.kw) >= 0.6);
    if (existing) {
      // Known story — refresh last_seen and merge sources; no new item.
      const urls = new Set([...existing.row.source_urls, entry.link].filter(Boolean));
      const outlets = new Set([...existing.row.source_outlets, entry.outlet]);
      await db.from("wire_clusters").update({
        last_seen: new Date().toISOString(),
        source_urls: [...urls].slice(0, 10),
        source_outlets: [...outlets],
      }).eq("id", existing.row.id);
      continue;
    }
    const inBatch = fresh.find((f) => keywordOverlap(kw, titleKeywords(f.title)) >= 0.6);
    if (inBatch) inBatch.entries.push(entry);
    else fresh.push({ title: entry.title, entries: [entry] });
  }
  summary.clusters = fresh.length;

  // Outlet balance: Yahoo publishes ~3x the volume of ESPN/CBS and was 85%
  // of the wire. Process the quieter outlets' clusters first, and cap how
  // many items any single outlet can land per run (big news still breaks
  // through the cap on importance).
  const OUTLET_PRIORITY: Record<string, number> = { ESPN: 0, "CBS Sports": 1, "Yahoo Sports": 2 };
  const ITEMS_PER_OUTLET_PER_RUN = 4;
  const outletItemCount: Record<string, number> = {};
  fresh.sort(
    (a, b) =>
      (OUTLET_PRIORITY[a.entries[0].outlet] ?? 9) - (OUTLET_PRIORITY[b.entries[0].outlet] ?? 9),
  );

  for (const cluster of fresh.slice(0, MAX_ITEMS_PER_RUN)) {
    try {
      const outlets = [...new Set(cluster.entries.map((e) => e.outlet))];
      const urls = [...new Set(cluster.entries.map((e) => e.link).filter(Boolean))];
      // Feed-provided article text (content:encoded) grounds the story far
      // better than a 500-char description — and for On3 it's the only
      // grounding, since their pages block our fetcher.
      const sourceBlock = cluster.entries
        .map((e) => `- [${e.outlet}] ${e.title}\n  ${e.content || e.description}\n  ${e.link}`)
        .join("\n");
      const clusterSourceText = cluster.entries.map((e) => e.content).find(Boolean) ?? "";

      // Wire item (12.3) — written by the provider-routed prose writer.
      const itemRaw = await writeJSON({
        system: prompt("wire-item.md"),
        user: `Source cluster:\n${sourceBlock}`,
        schema: ITEM_SCHEMA,
        schemaName: "wire_item",
        maxTokens: 512,
      });
      const item = JSON.parse(itemRaw) as {
        headline: string; sub: string; category: string; teams: string[];
        importance: number; importance_reason: string;
      };
      item.importance = Math.max(1, Math.min(10, Math.round(item.importance ?? 1)));

      const clusterKey = slugify(cluster.title).slice(0, 80);
      const { data: inserted, error: insErr } = await db
        .from("wire_clusters")
        .insert({
          cluster_key: clusterKey,
          title: cluster.title,
          source_urls: urls.slice(0, 10),
          source_outlets: outlets,
          importance: item.importance,
          source_text: clusterSourceText || null,
        })
        .select("id")
        .single();
      if (insErr || !inserted) {
        // unique-violation = another invocation beat us to it — skip cleanly.
        summary.skipped.push(`dup:${clusterKey}`);
        continue;
      }

      // Quality floor + outlet cap: fluff (importance ≤ 2) never becomes an
      // item, and an outlet that already landed its per-run share only
      // breaks through with genuinely big news. The cluster row above still
      // exists either way, so the story is deduped and never re-scored.
      const primaryOutlet = cluster.entries[0].outlet;
      const outletCapped = (outletItemCount[primaryOutlet] ?? 0) >= ITEMS_PER_OUTLET_PER_RUN;
      if (item.importance <= 2 || (outletCapped && item.importance < 6)) {
        summary.skipped.push(`${item.importance <= 2 ? "low" : "capped"}:${clusterKey}`);
        continue;
      }
      outletItemCount[primaryOutlet] = (outletItemCount[primaryOutlet] ?? 0) + 1;

      const itemId = `wireItem-${clusterKey}`;
      await writeClient.createIfNotExists({
        _id: itemId,
        _type: "wireItem",
        headline: cleanHeadline(item.headline),
        sub: item.sub,
        category: item.category,
        teams: item.teams,
        importance: item.importance,
        sourceUrls: urls.slice(0, 10),
        sourceOutlets: outlets,
        publishedAt: new Date().toISOString(),
      });
      await db.from("wire_clusters").update({ item_id: itemId }).eq("id", inserted.id);
      summary.items++;

      // Client directive (2026-08-17): every published item gets a
      // full-story attempt so no wire click ever leaves the site. The old
      // importance ≥ 6 gate is gone; the per-run cap is only a runaway guard.
      if (summary.stories < MAX_STORIES_PER_RUN) {
        const result = await writeStoryFromSources(anthropic, db, {
          sourceBlock,
          outlets,
          sources: cluster.entries.map((e) => ({ outlet: e.outlet, url: e.link })),
          clusterKey,
          teams: item.teams,
          receiptKeywords: [...titleKeywords(cluster.title)],
          itemId,
        });
        if (result === "ok") summary.stories++;
        else summary.skipped.push(result);
      }
    } catch (err) {
      console.error("[wire:cluster]", cluster.title.slice(0, 60), err);
      summary.skipped.push(`error:${cluster.title.slice(0, 40)}`);
    }
  }

  // Self-heal (2026-08-20): leftover story budget converts the storyless
  // backlog so dead headlines drain instead of accumulating between manual
  // backfills. The attempt cap above keeps hopeless items from burning the
  // budget every run.
  if (summary.stories < MAX_STORIES_PER_RUN) {
    try {
      const extra = await backfillWireStories(MAX_STORIES_PER_RUN - summary.stories);
      summary.stories += extra.stories;
      summary.skipped.push(...extra.skipped.map((s) => `bf-${s}`));
    } catch (err) {
      console.error("[wire:selfheal]", err);
    }
  }

  return summary;
}
