// The JP Poll data layer — the People's Top 25 (site promise: weekly top-10
// ballots from citizens, Sunday 8 PM ET lock, Tuesday reveal, full public
// vote distribution). Reads mirror the other layers: cookie-less anon
// client with Next-cached fetches for public surfaces; pages pass the
// per-request server client for my-ballot reads. Tabulation is pure,
// deterministic, unit-tested code — no model anywhere near the count.
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

export interface JpBoard {
  id: string;
  season: number;
  week: number;
  label: string;
  opens_at: string;
  locks_at: string;
  reveals_at: string;
  status: "open" | "tabulated" | "published";
}

export interface JpResultRow {
  board_id: string;
  rank: number;
  team_slug: string;
  points: number;
  first_place: number;
  ballots: number;
}

export interface BallotRank {
  rank: number;
  team_slug: string;
}

let cachedPublic: SupabaseClient | null = null;

/** Anonymous, cookie-less client with Next-cached fetches (60s). */
export function jpClient(): SupabaseClient {
  if (cachedPublic) return cachedPublic;
  cachedPublic = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      global: {
        fetch: (url, opts) =>
          fetch(url, { ...opts, next: { revalidate: 60, tags: ["jp-poll"] } } as RequestInit),
      },
    },
  );
  return cachedPublic;
}

export function boardOpenForVoting(b: JpBoard, now = Date.now()): boolean {
  return (
    b.status === "open" &&
    new Date(b.opens_at).getTime() <= now &&
    now < new Date(b.locks_at).getTime()
  );
}

export async function getBoards(season = 2026): Promise<JpBoard[]> {
  const { data } = await jpClient().from("jp_boards").select("*").eq("season", season).order("week");
  return (data as JpBoard[] | null) ?? [];
}

/** The board citizens should see on the ballot module right now: the
 * earliest board that hasn't locked yet (voting or upcoming), else the
 * latest board of the season. */
export async function getCurrentBoard(): Promise<JpBoard | null> {
  const boards = await getBoards();
  const now = Date.now();
  return (
    boards.find((b) => now < new Date(b.locks_at).getTime()) ??
    boards[boards.length - 1] ??
    null
  );
}

export async function getLatestPublished(): Promise<JpBoard | null> {
  const boards = await getBoards();
  const published = boards.filter((b) => b.status === "published");
  return published[published.length - 1] ?? null;
}

export async function getBoardResults(boardId: string): Promise<JpResultRow[]> {
  const { data } = await jpClient()
    .from("jp_results")
    .select("*")
    .eq("board_id", boardId)
    .order("rank");
  return (data as JpResultRow[] | null) ?? [];
}

export async function getBallotCount(boardId: string): Promise<number> {
  const { data } = await jpClient().rpc("jp_ballot_count", { bid: boardId });
  return (data as number | null) ?? 0;
}

/** A team's placement on the latest published JP board (for team hubs).
 * null = no board published yet or team outside the top 25. */
export async function getTeamJpRank(
  teamSlug: string,
): Promise<{ rank: number; label: string; ballots: number } | null> {
  const board = await getLatestPublished();
  if (!board) return null;
  const results = await getBoardResults(board.id);
  const hit = results.find((r) => r.team_slug === teamSlug);
  return hit ? { rank: hit.rank, label: board.label, ballots: hit.ballots } : null;
}

/** The signed-in citizen's ballot ranks for a board (server client). */
export async function getMyBallot(
  db: SupabaseClient,
  boardId: string,
  userId: string,
): Promise<BallotRank[] | null> {
  const { data: ballot } = await db
    .from("jp_ballots")
    .select("id")
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!ballot) return null;
  const { data: ranks } = await db
    .from("jp_ballot_ranks")
    .select("rank, team_slug")
    .eq("ballot_id", (ballot as { id: string }).id)
    .order("rank");
  return (ranks as BallotRank[] | null) ?? [];
}

// ---- deterministic tabulation (pure) --------------------------------------

/** Points for a ballot rank: 1st → 10 … 10th → 1 (AP method at top-10 depth). */
export function rankPoints(rank: number): number {
  return 11 - rank;
}

export interface TallyRow {
  team_slug: string;
  points: number;
  first_place: number;
}

/** Tabulate ballots into a ranked top-N. Ties: points desc, then
 * first-place votes desc, then alphabetical (fully deterministic). */
export function tabulateBallots(
  ballots: BallotRank[][],
  topN = 25,
): TallyRow[] {
  const tally = new Map<string, { points: number; first_place: number }>();
  for (const ballot of ballots) {
    for (const r of ballot) {
      if (r.rank < 1 || r.rank > 10) continue;
      const row = tally.get(r.team_slug) ?? { points: 0, first_place: 0 };
      row.points += rankPoints(r.rank);
      if (r.rank === 1) row.first_place += 1;
      tally.set(r.team_slug, row);
    }
  }
  return [...tally.entries()]
    .map(([team_slug, t]) => ({ team_slug, ...t }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.first_place - a.first_place ||
        a.team_slug.localeCompare(b.team_slug),
    )
    .slice(0, topN);
}

/** Validate a (possibly partial) ballot: ranks 1–10 once each, ten distinct
 * known FBS teams. Returns error strings; [] = valid. */
export function validateBallot(
  ranks: BallotRank[],
  knownTeams: Set<string>,
): string[] {
  const errors: string[] = [];
  const seenRanks = new Set<number>();
  const seenTeams = new Set<string>();
  for (const r of ranks) {
    if (!Number.isInteger(r.rank) || r.rank < 1 || r.rank > 10) errors.push(`invalid rank ${r.rank}`);
    if (seenRanks.has(r.rank)) errors.push(`rank ${r.rank} used more than once`);
    seenRanks.add(r.rank);
    if (!knownTeams.has(r.team_slug)) errors.push(`unknown team ${r.team_slug}`);
    if (seenTeams.has(r.team_slug)) errors.push(`${r.team_slug} appears more than once`);
    seenTeams.add(r.team_slug);
  }
  return errors;
}
