// Josh's verbatim quote archive (ops manual §2.4a / §26) — the "Josh said it
// first" table. Server-only: uses the service-role Supabase client.
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { tsToSeconds } from "@/lib/markers";
import type { ExtractedQuote } from "@/lib/generate";

export interface ArchivedQuote {
  quote: string;
  yt_id: string;
  ts_seconds: number;
  topic: string;
  teams: string[];
  heat: number;
}

/** Stores extracted quotes for an episode. Idempotent (unique yt_id+quote is
 * upsert-ignored). Fail-soft: logs and returns count stored; never throws. */
export async function storeQuotes(ytId: string, quotes: ExtractedQuote[]): Promise<number> {
  if (!isAdminConfigured || quotes.length === 0) return 0;
  try {
    const rows = quotes.map((q) => ({
      yt_id: ytId,
      quote: q.quote,
      ts_seconds: tsToSeconds(q.timestamp),
      topic: q.topic,
      teams: q.teams,
      heat: q.heat,
    }));
    const { error, count } = await createAdminClient()
      .from("josh_quotes")
      .upsert(rows, { onConflict: "yt_id,quote", ignoreDuplicates: true, count: "exact" });
    if (error) {
      console.error("[quotes:store]", error.message);
      return 0;
    }
    return count ?? rows.length;
  } catch (err) {
    console.error("[quotes:store]", err);
    return 0;
  }
}

/** "Josh's Receipt" lookup (wire-desk manual §3): his most relevant archived
 * take for a set of team slugs and/or topic keywords. Highest heat wins; null
 * when nothing matches. Never throws. */
export async function findReceipt(
  teams: string[],
  keywords: string[]
): Promise<ArchivedQuote | null> {
  if (!isAdminConfigured) return null;
  try {
    const db = createAdminClient();
    if (teams.length > 0) {
      const { data } = await db
        .from("josh_quotes")
        .select("quote, yt_id, ts_seconds, topic, teams, heat")
        .overlaps("teams", teams)
        .order("heat", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1);
      if (data?.[0]) return data[0] as ArchivedQuote;
    }
    for (const kw of keywords.filter((k) => k.length >= 4).slice(0, 5)) {
      const { data } = await db
        .from("josh_quotes")
        .select("quote, yt_id, ts_seconds, topic, teams, heat")
        .or(`topic.ilike.%${kw}%,quote.ilike.%${kw}%`)
        .order("heat", { ascending: false })
        .limit(1);
      if (data?.[0]) return data[0] as ArchivedQuote;
    }
    return null;
  } catch (err) {
    console.error("[quotes:findReceipt]", err);
    return null;
  }
}
