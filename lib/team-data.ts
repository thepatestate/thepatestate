// Team-hub data layer (v2 brief §4). Everything here is real, sourced
// data — CFBD for schedule/roster/records/portal, Sanity for editorial,
// Supabase for Josh's quote archive and the team porches. Modules with no
// honest data source yet (JP Poll placement, 2026 stats) render labeled
// empty states at the page level; this file never fabricates.
import { slugifyTeam } from "@/lib/teams-meta";
import { getTeamDirectory, type TeamInfo } from "@/lib/cfbd";
import { readClient, type SanityArticle, type SanityWireItem } from "@/lib/sanity";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

const BASE = "https://api.collegefootballdata.com";
const YEAR = 2026;

export { LAUNCH_TEAMS } from "@/lib/launch-teams";

async function cfbd<T>(path: string, revalidate = 3600): Promise<T | null> {
  if (!process.env.CFBD_API_KEY) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${process.env.CFBD_API_KEY}` },
      next: { revalidate, tags: ["cfbd"] },
    } as RequestInit);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    console.error("[team-data]", path, err);
    return null;
  }
}

// ---- schedule ------------------------------------------------------------

export interface TeamGame {
  id: string;
  week: number;
  kickoff: string; // ISO
  dateLabel: string; // "SAT SEP 5"
  timeLabel: string; // "7:00 PM ET" | "TBD"
  opponent: string;
  opponentSlug: string;
  home: boolean;
  venue: string;
  tv: string;
  completed: boolean;
  result: string | null; // "W 31–17" from this team's perspective
}

interface CfbdGame {
  id: number;
  week: number;
  startDate: string;
  startTimeTBD?: boolean;
  homeTeam: string;
  awayTeam: string;
  homePoints?: number | null;
  awayPoints?: number | null;
  completed?: boolean;
  venue?: string | null;
  tv?: string | null;
  outlet?: string | null;
}

export async function getTeamSchedule(school: string): Promise<TeamGame[]> {
  const games = await cfbd<CfbdGame[]>(`/games?year=${YEAR}&team=${encodeURIComponent(school)}&seasonType=regular`);
  if (!games) return [];
  return games
    .slice()
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .map((g) => {
      const home = g.homeTeam === school;
      const opponent = home ? g.awayTeam : g.homeTeam;
      const d = new Date(g.startDate);
      const dateLabel = d
        .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" })
        .replace(/,/g, "")
        .toUpperCase();
      const timeLabel = g.startTimeTBD
        ? "TBD"
        : `${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET`;
      let result: string | null = null;
      if (g.completed && g.homePoints != null && g.awayPoints != null) {
        const us = home ? g.homePoints : g.awayPoints;
        const them = home ? g.awayPoints : g.homePoints;
        result = `${us > them ? "W" : us < them ? "L" : "T"} ${us}–${them}`;
      }
      return {
        id: String(g.id),
        week: g.week,
        kickoff: g.startDate,
        dateLabel,
        timeLabel,
        opponent,
        opponentSlug: slugifyTeam(opponent),
        home,
        venue: g.venue ?? "",
        tv: g.tv ?? g.outlet ?? "",
        completed: g.completed === true,
        result,
      };
    });
}

// ---- records -------------------------------------------------------------

export interface SeasonRecord {
  year: number;
  wins: number;
  losses: number;
  confWins: number;
  confLosses: number;
}

interface CfbdRecord {
  year: number;
  total: { wins: number; losses: number };
  conferenceGames: { wins: number; losses: number };
}

/** Current-season record (real, 0–0 until games are played) and last
 * season's final record for context. */
export async function getRecords(school: string): Promise<{ current: SeasonRecord | null; last: SeasonRecord | null }> {
  const [cur, last] = await Promise.all([
    cfbd<CfbdRecord[]>(`/records?year=${YEAR}&team=${encodeURIComponent(school)}`),
    cfbd<CfbdRecord[]>(`/records?year=${YEAR - 1}&team=${encodeURIComponent(school)}`, 86400),
  ]);
  const shape = (r?: CfbdRecord): SeasonRecord | null =>
    r
      ? {
          year: r.year,
          wins: r.total?.wins ?? 0,
          losses: r.total?.losses ?? 0,
          confWins: r.conferenceGames?.wins ?? 0,
          confLosses: r.conferenceGames?.losses ?? 0,
        }
      : null;
  return { current: shape(cur?.[0]), last: shape(last?.[0]) };
}

// ---- roster --------------------------------------------------------------

export interface RosterPlayer {
  name: string;
  position: string;
  heightIn: number | null;
  weight: number | null;
  year: number | null;
  hometown: string;
}

const OFFENSE = new Set(["QB", "RB", "FB", "WR", "TE", "OL", "OT", "OG", "C"]);
const DEFENSE = new Set(["DL", "DE", "DT", "NT", "EDGE", "LB", "ILB", "OLB", "CB", "S", "DB"]);

export async function getRoster(school: string): Promise<{ offense: RosterPlayer[]; defense: RosterPlayer[]; special: RosterPlayer[]; total: number }> {
  interface CfbdPlayer {
    firstName?: string; lastName?: string; position?: string | null;
    height?: number | null; weight?: number | null; year?: number | null;
    homeCity?: string | null; homeState?: string | null;
  }
  const players = await cfbd<CfbdPlayer[]>(`/roster?team=${encodeURIComponent(school)}&year=${YEAR}`, 86400);
  if (!players) return { offense: [], defense: [], special: [], total: 0 };
  const shaped: RosterPlayer[] = players
    .filter((p) => p.firstName || p.lastName)
    .map((p) => ({
      name: [p.firstName, p.lastName].filter(Boolean).join(" "),
      position: p.position ?? "—",
      heightIn: p.height ?? null,
      weight: p.weight ?? null,
      year: p.year ?? null,
      hometown: [p.homeCity, p.homeState].filter(Boolean).join(", "),
    }))
    .sort((a, b) => a.position.localeCompare(b.position) || a.name.localeCompare(b.name));
  return {
    offense: shaped.filter((p) => OFFENSE.has(p.position)),
    defense: shaped.filter((p) => DEFENSE.has(p.position)),
    special: shaped.filter((p) => !OFFENSE.has(p.position) && !DEFENSE.has(p.position)),
    total: shaped.length,
  };
}

export function fmtHeight(inches: number | null): string {
  if (!inches) return "—";
  return `${Math.floor(inches / 12)}-${inches % 12}`;
}

export const CLASS_YEARS: Record<number, string> = { 1: "FR", 2: "SO", 3: "JR", 4: "SR", 5: "GR" };

// ---- transfer portal -----------------------------------------------------

export interface PortalMove {
  name: string;
  position: string;
  stars: number | null;
  from: string;
  to: string | null;
  date: string;
}

export async function getPortalMoves(school: string): Promise<{ incoming: PortalMove[]; outgoing: PortalMove[] }> {
  interface CfbdPortal {
    firstName?: string; lastName?: string; position?: string | null; stars?: number | null;
    origin?: string | null; destination?: string | null; transferDate?: string | null;
  }
  const all = await cfbd<CfbdPortal[]>(`/player/portal?year=${YEAR}`, 21600);
  if (!all) return { incoming: [], outgoing: [] };
  const shape = (p: CfbdPortal): PortalMove => ({
    name: [p.firstName, p.lastName].filter(Boolean).join(" "),
    position: p.position ?? "—",
    stars: p.stars ?? null,
    from: p.origin ?? "—",
    to: p.destination ?? null,
    date: p.transferDate ?? "",
  });
  const bySignif = (a: PortalMove, b: PortalMove) => (b.stars ?? 0) - (a.stars ?? 0);
  return {
    incoming: all.filter((p) => p.destination === school).map(shape).sort(bySignif).slice(0, 12),
    outgoing: all.filter((p) => p.origin === school).map(shape).sort(bySignif).slice(0, 12),
  };
}

// ---- recruiting (last completed cycle — labeled) -------------------------

export interface RecruitingClass {
  year: number;
  rank: number;
  points: number;
}

/** Most recent cycle with real data (2027 is empty on CFBD preseason; the
 * 2026 class is final). Always label the year at the render site. */
export async function getRecruitingClass(school: string): Promise<RecruitingClass | null> {
  for (const year of [YEAR + 1, YEAR]) {
    const rows = await cfbd<{ year: number; rank: number; team: string; points: number }[]>(
      `/recruiting/teams?year=${year}&team=${encodeURIComponent(school)}`,
      86400,
    );
    const r = rows?.[0];
    if (r) return { year: r.year, rank: r.rank, points: r.points };
  }
  return null;
}

// ---- Josh on this team (real receipts) -----------------------------------

export interface TeamQuote {
  quote: string;
  ytId: string;
  tsSeconds: number;
  topic: string;
}

export async function getTeamQuotes(slug: string, limit = 4): Promise<TeamQuote[]> {
  if (!isAdminConfigured) return [];
  try {
    const { data } = await createAdminClient()
      .from("josh_quotes")
      .select("quote, yt_id, ts_seconds, topic, heat, created_at")
      .contains("teams", [slug])
      .order("created_at", { ascending: false })
      .order("heat", { ascending: false })
      .limit(limit);
    return ((data as { quote: string; yt_id: string; ts_seconds: number; topic: string }[] | null) ?? []).map((r) => ({
      quote: r.quote,
      ytId: r.yt_id,
      tsSeconds: r.ts_seconds,
      topic: r.topic,
    }));
  } catch {
    return [];
  }
}

// ---- editorial by team ---------------------------------------------------

export async function getTeamArticles(slug: string, limit = 6): Promise<SanityArticle[]> {
  try {
    return await readClient.fetch(
      `*[_type == "article" && workflowState == "published" && (primaryTeam == $slug || $slug in teams)]
        | order(publishedAt desc)[0...$limit]{
          _id, headline, slug, dek, byline, publishedAt, "heroUrl": heroImage.asset->url,
          bodyMarkdown, workflowState
        }`,
      { slug, limit },
      { next: { revalidate: 300, tags: ["articles"] } } as never,
    );
  } catch {
    return [];
  }
}

export async function getTeamWire(slug: string, limit = 6): Promise<SanityWireItem[]> {
  try {
    return await readClient.fetch(
      `*[_type == "wireItem" && $slug in teams] | order(publishedAt desc)[0...$limit]{
        _id, headline, sub, category, teams, publishedAt,
        "storySlug": story->slug.current, "sourceUrl": sourceUrls[0]
      }`,
      { slug, limit },
      { next: { revalidate: 120, tags: ["wire"] } } as never,
    );
  } catch {
    return [];
  }
}

// ---- convenience ---------------------------------------------------------

export async function getTeamInfo(slug: string): Promise<TeamInfo | null> {
  const dir = await getTeamDirectory();
  return dir[slug] ?? null;
}
