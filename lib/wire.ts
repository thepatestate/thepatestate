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

const MODEL = "claude-sonnet-5";
const MAX_STORIES_PER_RUN = 2; // volume guard: full stories per monitor pass
const MAX_ITEMS_PER_RUN = 6;

// §20 source network, RSS tier. Detection AND sourcing (Tier 1/2 only — every
// feed here is a named national outlet, so the source-tier gate is inherent:
// clusters can only ever contain claims from these outlets).
const FEEDS: { outlet: string; url: string }[] = [
  { outlet: "ESPN", url: "https://www.espn.com/espn/rss/ncf/news" },
  { outlet: "CBS Sports", url: "https://www.cbssports.com/rss/headlines/college-football/" },
  { outlet: "Yahoo Sports", url: "https://sports.yahoo.com/college-football/rss.xml" },
];

export interface FeedEntry {
  outlet: string;
  title: string;
  link: string;
  description: string;
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

/** Fetches and parses all monitored feeds. Per-feed fail-soft. */
export async function fetchFeeds(): Promise<FeedEntry[]> {
  const out: FeedEntry[] = [];
  await Promise.all(
    FEEDS.map(async (feed) => {
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
            pubDate: tag(raw, "pubDate"),
          });
        }
      } catch (err) {
        console.error("[wire:feed]", feed.outlet, err);
      }
    })
  );
  return out;
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

/** §21 attribution enforcement: first sentence of whatHappened must credit an
 * outlet (or be an official statement). Exported for tests. */
export function hasAttribution(whatHappened: string, outlets: string[]): boolean {
  const first = whatHappened.split(/(?<=[.!?])\s/)[0]?.toLowerCase() ?? "";
  if (/\bofficial(ly)?\b|\bannounced\b|\bstatement\b/.test(first)) return true;
  if (/\bper\b|\baccording to\b|\breports?\b|\breported\b/.test(first)) {
    return outlets.some((o) => first.includes(o.toLowerCase())) || /\bper\b|\baccording to\b/.test(first);
  }
  return false;
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

  for (const cluster of fresh.slice(0, MAX_ITEMS_PER_RUN)) {
    try {
      const outlets = [...new Set(cluster.entries.map((e) => e.outlet))];
      const urls = [...new Set(cluster.entries.map((e) => e.link).filter(Boolean))];
      const sourceBlock = cluster.entries
        .map((e) => `- [${e.outlet}] ${e.title}\n  ${e.description}\n  ${e.link}`)
        .join("\n");

      // Wire item (12.3)
      const itemRes = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 512,
        output_config: { effort: "low", format: { type: "json_schema", schema: ITEM_SCHEMA } },
        system: prompt("wire-item.md"),
        messages: [{ role: "user", content: `Source cluster:\n${sourceBlock}` }],
      });
      const item = JSON.parse(textOf(itemRes)) as {
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
        })
        .select("id")
        .single();
      if (insErr || !inserted) {
        // unique-violation = another invocation beat us to it — skip cleanly.
        summary.skipped.push(`dup:${clusterKey}`);
        continue;
      }

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

      // Full story for importance >= 7 (§3.3), capped per run.
      if (item.importance >= 7 && summary.stories < MAX_STORIES_PER_RUN) {
        const receipt = await findReceipt(item.teams, [...titleKeywords(cluster.title)]);
        const storyRes = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 2048,
          output_config: { format: { type: "json_schema", schema: STORY_SCHEMA } },
          system: `${prompt("global-preamble.md")}\n\n${prompt("wire-story.md")}`,
          messages: [{
            role: "user",
            content: `Source cluster:\n${sourceBlock}${receipt ? `\n\nJosh's archived on-topic quote (verbatim; render as his receipt, do NOT alter): "${receipt.quote}"` : ""}`,
          }],
        });
        const story = JSON.parse(textOf(storyRes)) as {
          headline: string; verification: "confirmed" | "reported" | "developing";
          whatHappened: string; whyItMatters: string[]; readBody: string;
          whatsNext: string[]; teams: string[]; category: string;
        };

        // §21 verification stack
        const combined = `${story.whatHappened}\n${story.whyItMatters.join("\n")}\n${story.readBody}`;
        if (BANNED_PATTERNS.some((re) => re.test(combined))) {
          summary.skipped.push(`banned:${clusterKey}`);
          continue;
        }
        if (!hasAttribution(story.whatHappened, outlets)) {
          summary.skipped.push(`attribution:${clusterKey}`);
          continue;
        }
        // Second-model fact-check pass: sources + draft only.
        const checkRes = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 512,
          output_config: { effort: "low", format: { type: "json_schema", schema: FACTCHECK_SCHEMA } },
          system: "You are an independent fact-check gate. You receive SOURCES and a DRAFT. Verdict 'contradicted' if any draft claim conflicts with the sources; 'unsupported' if any material factual claim (names, numbers, timelines, outcomes) does not appear in the sources; else 'pass'. Interpretation clearly labeled as analysis is allowed; invented facts are not. Output JSON only.",
          messages: [{ role: "user", content: `SOURCES:\n${sourceBlock}\n\nDRAFT:\n${combined}` }],
        });
        const check = JSON.parse(textOf(checkRes)) as { verdict: string; detail: string };
        if (check.verdict !== "pass") {
          summary.skipped.push(`factcheck-${check.verdict}:${clusterKey}`);
          continue;
        }

        const storyId = `wireStory-${clusterKey}`;
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
          sources: cluster.entries.map((e) => ({ outlet: e.outlet, url: e.link })).slice(0, 6),
          // §14 universal YouTube rule: every story carries an episode link
          // (the receipt's timestamped episode when present, else the latest).
          publishedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        await db.from("wire_clusters").update({ story_id: storyId }).eq("id", inserted.id);
        await writeClient.patch(itemId).set({ story: { _type: "reference", _ref: storyId } }).commit();
        summary.stories++;
      }
    } catch (err) {
      console.error("[wire:cluster]", cluster.title.slice(0, 60), err);
      summary.skipped.push(`error:${cluster.title.slice(0, 40)}`);
    }
  }

  return summary;
}
