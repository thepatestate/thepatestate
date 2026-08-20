// The Wire Desk (ops manual §3, §20–21; wire-desk manual v2.0).
// RSS-tier monitoring → cluster/dedup (Supabase) → wire items (auto-publish) →
// importance ≥ 7 → full story through the autonomous verification stack.
// Server-only; called from /api/wire/monitor on a pg_cron cadence.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { writeClient, isSanityWriteConfigured } from "@/lib/sanity";
import { findReceipt } from "@/lib/quotes";
import { slugify } from "@/lib/slug";
import { writeJSON } from "@/lib/writer";

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
const OFF_TOPIC = /\b(wrestl\w*|basketball|hoops|baseball|softball|volleyball|gymnastics|hockey|lacrosse|soccer|golf|tennis|track and field|swimming|wnba|nba|nfl|mlb|nhl|high school)\b/i;

/** True when an entry clearly isn't college football. Exported for tests. */
export function isOffTopic(title: string, description = ""): boolean {
  return OFF_TOPIC.test(title) || OFF_TOPIC.test(description.slice(0, 160));
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

const STORY_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    verification: { type: "string", enum: ["confirmed", "reported", "developing"] },
    whatHappened: { type: "string" },
    whyItMatters: { type: "array", items: { type: "string" } },
    readBody: { type: "string" },
    whatsNext: { type: "array", items: { type: "string" } },
    teams: { type: "array", items: { type: "string" } },
    category: { type: "string" },
  },
  required: ["headline", "verification", "whatHappened", "whyItMatters", "readBody", "whatsNext", "teams", "category"],
  additionalProperties: false,
} as const;

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
export function hasAttributionOpener(text: string): boolean {
  const first = text.split(/(?<=[.!?])\s/)[0]?.toLowerCase() ?? "";
  if (/^\s*(per|according to)\b/.test(first)) return true;
  return /\b(a|the|its|their) reports? (says|said|notes|noted|adds|added|examines|examined|presents|presented|includes|included|details|detailed|indicates|indicated)\b/i.test(text);
}

interface StoryJob {
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
async function writeStoryFromSources(
  anthropic: Anthropic,
  db: ReturnType<typeof createAdminClient> | null,
  job: StoryJob,
): Promise<string> {
  const receipt = await findReceipt(job.teams, job.receiptKeywords);
  // Written by the provider-routed prose writer; 4096 tokens because 2048
  // truncated JSON mid-string once drafts were grounded in fetched source
  // text (backfill) — headroom, not a target.
  const storyRaw = await writeJSON({
    system: `${prompt("global-preamble.md")}\n\n${prompt("wire-story.md")}`,
    user: `Source cluster:\n${job.sourceBlock}${receipt ? `\n\nJosh's archived on-topic quote (verbatim; render as his receipt, do NOT alter): "${receipt.quote}"` : ""}`,
    schema: STORY_SCHEMA,
    schemaName: "wire_story",
    maxTokens: 4096,
  });
  const story = JSON.parse(storyRaw) as {
    headline: string; verification: "confirmed" | "reported" | "developing";
    whatHappened: string; whyItMatters: string[]; readBody: string;
    whatsNext: string[]; teams: string[]; category: string;
  };

  const combined = `${story.whatHappened}\n${story.whyItMatters.join("\n")}\n${story.readBody}`;
  if (BANNED_PATTERNS.some((re) => re.test(combined))) return `banned:${job.clusterKey}`;
  if (hasAttributionOpener(story.whatHappened)) return `attribution:${job.clusterKey}`;

  const checkRes = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    output_config: { effort: "low", format: { type: "json_schema", schema: FACTCHECK_SCHEMA } },
    system: "You are an independent fact-check gate. You receive SOURCES and a DRAFT. Verdict 'contradicted' if any draft claim conflicts with the sources; 'unsupported' if any material factual claim (names, numbers, timelines, outcomes) does not appear in the sources; else 'pass'. Interpretation clearly labeled as analysis is allowed; invented facts are not. Output JSON only.",
    messages: [{ role: "user", content: `SOURCES:\n${job.sourceBlock}\n\nDRAFT:\n${combined}` }],
  });
  const check = JSON.parse(textOf(checkRes)) as { verdict: string; detail: string };
  if (check.verdict !== "pass") return `factcheck-${check.verdict}:${job.clusterKey}`;

  const storyId = `wireStory-${job.clusterKey}`;
  await writeClient.createIfNotExists({
    _id: storyId,
    _type: "wireStory",
    headline: story.headline,
    slug: { _type: "slug", current: slugify(story.headline) },
    verification: story.verification,
    category: story.category,
    teams: story.teams,
    whatHappened: story.whatHappened,
    whyItMatters: story.whyItMatters.slice(0, 3),
    ...(receipt
      ? { joshReceipt: { quote: receipt.quote, ytId: receipt.yt_id, tsSeconds: receipt.ts_seconds } }
      : {}),
    readLabel: "THE PATE STATE READ",
    readBody: story.readBody,
    whatsNext: story.whatsNext.slice(0, 3),
    sources: job.sources.slice(0, 6),
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  if (db) await db.from("wire_clusters").update({ story_id: storyId }).eq("item_id", job.itemId);
  await writeClient.patch(job.itemId).set({ story: { _type: "reference", _ref: storyId } }).commit();
  return "ok";
}

/** Fetches a source article and extracts readable text (og:description +
 * paragraph content, tags stripped) so backfilled stories are grounded in
 * the actual report, not just a stored headline. Fail-soft empty string. */
async function fetchSourceText(url: string): Promise<string> {
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
      const outlets = item.sourceOutlets?.length ? item.sourceOutlets : ["the original report"];
      const urls = item.sourceUrls ?? [];
      const texts = await Promise.all(urls.slice(0, 2).map(fetchSourceText));
      // Outlets that block our fetcher (On3) leave texts empty — fall back
      // to the feed article text stored on the cluster at detection time.
      if (!texts.some(Boolean)) {
        const { data: cl } = await db
          .from("wire_clusters")
          .select("source_text")
          .eq("item_id", item._id)
          .maybeSingle();
        if (cl?.source_text) texts[0] = cl.source_text;
      }
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
      else summary.skipped.push(result);
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
    if (isOffTopic(entry.title, entry.description)) {
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
        headline: item.headline,
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

  return summary;
}
