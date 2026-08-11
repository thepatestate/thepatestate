// Competition-engine data layer (v2 brief §5.1). Same two access paths as
// the community layer: playClient() is the cookie-less anon client with
// Next-cached fetches for public surfaces (competition cards, post-lock
// leaderboards/consensus — RLS hides other people's entries until lock);
// pages pass the per-request server client (lib/supabase/server) for
// my-entry and my-groups reads.
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

export interface PickemGame {
  id: string;
  away: string;
  home: string;
  awayAbbrev: string;
  homeAbbrev: string;
  awayLogo: string;
  homeLogo: string;
  kickoff: string;
  net: string;
}

export interface Competition {
  slug: string;
  type: "bracket" | "pickem";
  name: string;
  season: number;
  status: "open" | "scored" | "closed";
  opens_at: string;
  locks_at: string;
  ends_at: string | null;
  scoring_rule_id: string;
  terms_version: string;
  config: { games?: PickemGame[]; fieldSize?: number; seededByes?: number };
}

export interface PlayEntry {
  id: string;
  competition_slug: string;
  user_id: string | null;
  is_official: boolean;
  author_label: string | null;
  display_name: string;
  tiebreak_value: number | null;
  points: number | null;
  created_at: string;
}

export interface PlayPick {
  id: string;
  entry_id: string;
  slot: string;
  value: Record<string, unknown>;
  points: number | null;
}

export interface PlayLeague {
  id: string;
  competition_slug: string;
  name: string;
  description: string;
  is_private: boolean;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface LeagueMember {
  league_id: string;
  user_id: string;
  role: "commissioner" | "member";
  joined_at: string;
  citizens: { display_handle: string; favorite_team: string | null } | null;
}

let cachedPublic: SupabaseClient | null = null;

/** Anonymous, cookie-less client with Next-cached fetches (60s). */
export function playClient(): SupabaseClient {
  if (cachedPublic) return cachedPublic;
  cachedPublic = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      global: {
        fetch: (url, opts) =>
          fetch(url, { ...opts, next: { revalidate: 60, tags: ["play"] } } as RequestInit),
      },
    },
  );
  return cachedPublic;
}

export function compLocked(c: Pick<Competition, "locks_at">): boolean {
  return new Date(c.locks_at).getTime() <= Date.now();
}

export async function getCompetitions(): Promise<Competition[]> {
  const { data } = await playClient()
    .from("competitions")
    .select("*")
    .in("status", ["open", "scored"])
    .order("locks_at");
  return (data as Competition[] | null) ?? [];
}

export async function getCompetition(slug: string): Promise<Competition | null> {
  const { data } = await playClient().from("competitions").select("*").eq("slug", slug).maybeSingle();
  return (data as Competition | null) ?? null;
}

/** Pre-lock-safe aggregate stats (security-definer fn). */
export async function getEntryCount(slug: string): Promise<number> {
  const { data } = await playClient().rpc("play_stats", { comp: slug });
  return (data as { entries?: number } | null)?.entries ?? 0;
}

/** The signed-in citizen's entry + picks (server client). */
export async function getMyEntry(
  db: SupabaseClient,
  slug: string,
  userId: string,
): Promise<{ entry: PlayEntry; picks: PlayPick[] } | null> {
  const { data: entry } = await db
    .from("play_entries")
    .select("*")
    .eq("competition_slug", slug)
    .eq("user_id", userId)
    .maybeSingle();
  if (!entry) return null;
  const { data: picks } = await db.from("play_picks").select("*").eq("entry_id", entry.id);
  return { entry: entry as PlayEntry, picks: (picks as PlayPick[] | null) ?? [] };
}

/** Ranked entries. National by default; pass memberIds to scope to a group
 * — the identical query and ordering, filtered only (§12 acceptance: group
 * and national scoring calculate identically). Pre-lock RLS hides foreign
 * entries from the anon client, so callers gate on lock. */
export async function getLeaderboard(
  slug: string,
  opts: { memberIds?: string[]; limit?: number } = {},
): Promise<PlayEntry[]> {
  let q = playClient()
    .from("play_entries")
    .select("*")
    .eq("competition_slug", slug)
    .eq("is_official", false)
    .order("points", { ascending: false, nullsFirst: false })
    .order("tiebreak_value", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(opts.limit ?? 100);
  if (opts.memberIds) q = q.in("user_id", opts.memberIds);
  const { data, error } = await q;
  if (error) console.error("[play:getLeaderboard]", error.message);
  return (data as PlayEntry[] | null) ?? [];
}

export interface PickemConsensus {
  entries: number;
  byGame: Record<string, { away: number; home: number }>;
}

export interface BracketConsensus {
  entries: number;
  field: { slug: string; pct: number }[];
  champions: { slug: string; pct: number }[];
}

/** Post-lock citizen consensus (RLS opens picks to anon at lock). */
export async function getPickemConsensus(slug: string): Promise<PickemConsensus> {
  const { data } = await playClient()
    .from("play_picks")
    .select("slot, value, play_entries!inner(competition_slug, is_official)")
    .eq("play_entries.competition_slug", slug)
    .eq("play_entries.is_official", false)
    .limit(20000);
  const rows = (data as { slot: string; value: { winner?: string } }[] | null) ?? [];
  const byGame: Record<string, { away: number; home: number }> = {};
  for (const r of rows) {
    if (r.value?.winner !== "away" && r.value?.winner !== "home") continue;
    byGame[r.slot] ??= { away: 0, home: 0 };
    byGame[r.slot][r.value.winner] += 1;
  }
  const entries = Math.max(0, ...Object.values(byGame).map((g) => g.away + g.home));
  return { entries, byGame };
}

export async function getBracketConsensus(slug: string): Promise<BracketConsensus> {
  const { data } = await playClient()
    .from("play_picks")
    .select("slot, value, play_entries!inner(competition_slug, is_official)")
    .eq("play_entries.competition_slug", slug)
    .eq("play_entries.is_official", false)
    .limit(20000);
  const rows = (data as { slot: string; value: { team?: string } }[] | null) ?? [];
  const fieldCounts: Record<string, number> = {};
  const champCounts: Record<string, number> = {};
  let entries = 0;
  for (const r of rows) {
    const team = r.value?.team;
    if (!team) continue;
    if (r.slot.startsWith("seed-")) fieldCounts[team] = (fieldCounts[team] ?? 0) + 1;
    if (r.slot === "champion") {
      champCounts[team] = (champCounts[team] ?? 0) + 1;
      entries += 1;
    }
  }
  const toPct = (counts: Record<string, number>, denom: number) =>
    Object.entries(counts)
      .map(([team, n]) => ({ slug: team, pct: denom > 0 ? Math.round((n / denom) * 100) : 0 }))
      .sort((a, b) => b.pct - a.pct);
  return {
    entries,
    field: toPct(fieldCounts, entries).slice(0, 15),
    champions: toPct(champCounts, entries).slice(0, 10),
  };
}

/** Leagues the signed-in citizen belongs to for a competition. */
export async function getMyLeagues(
  db: SupabaseClient,
  userId: string,
  slug?: string,
): Promise<(PlayLeague & { role: string })[]> {
  const { data } = await db
    .from("play_league_members")
    .select("role, play_leagues!inner(*)")
    .eq("user_id", userId);
  const rows =
    (data as unknown as { role: string; play_leagues: PlayLeague }[] | null) ?? [];
  return rows
    .map((r) => ({ ...r.play_leagues, role: r.role }))
    .filter((l) => !slug || l.competition_slug === slug);
}

export async function getLeague(
  db: SupabaseClient,
  id: string,
): Promise<{ league: PlayLeague; members: LeagueMember[] } | null> {
  const { data: league } = await db.from("play_leagues").select("*").eq("id", id).maybeSingle();
  if (!league) return null;
  const { data: members } = await db
    .from("play_league_members")
    .select("league_id, user_id, role, joined_at, citizens(display_handle, favorite_team)")
    .eq("league_id", id)
    .order("joined_at");
  return {
    league: league as PlayLeague,
    members: (members as unknown as LeagueMember[] | null) ?? [],
  };
}
