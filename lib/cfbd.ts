// CollegeFootballData.com integration (ops manual §1, §4) — real schedules
// and, on gamedays, real scores. Server-only; fail-soft everywhere: every
// helper returns [] / null on any failure so pages fall back to demo data.
import type { Conference, ScoreCardData } from "@/lib/scores-demo";
import { getEspnScoreboard, getEspnSlateGames, getEspnTeamDirectory } from "@/lib/espn";
import { slugifyTeam } from "@/lib/teams-meta";

const BASE = "https://api.collegefootballdata.com";
const YEAR = 2026;

export const isCfbdConfigured = Boolean(process.env.CFBD_API_KEY);

interface CfbdGame {
  id: number;
  week: number;
  startDate: string;
  startTimeTBD?: boolean;
  homeTeam: string;
  awayTeam: string;
  homeConference?: string | null;
  awayConference?: string | null;
  homePoints?: number | null;
  awayPoints?: number | null;
  completed?: boolean;
  tv?: string | null;
  outlet?: string | null;
  neutralSite?: boolean;
}

async function cfbd<T>(path: string, revalidate = 21600): Promise<T | null> {
  if (!isCfbdConfigured) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${process.env.CFBD_API_KEY}` },
      next: { revalidate, tags: ["cfbd"] },
    } as RequestInit);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    console.error("[cfbd]", path, err);
    return null;
  }
}

const CONF_MAP: Record<string, Conference> = {
  SEC: "SEC",
  "Big Ten": "BIG TEN",
  "Big 12": "BIG 12",
  ACC: "ACC",
  "FBS Independents": "IND",
};

function toConference(home?: string | null, away?: string | null): Conference {
  return CONF_MAP[home ?? ""] ?? CONF_MAP[away ?? ""] ?? "G5";
}

function kickoffLabel(iso: string, tbd?: boolean): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "America/New_York" }).toUpperCase();
  if (tbd) return `${day} · TBD`;
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });
  return `${day} ${time} ET`;
}

/** Real games for a week as scoreboard cards, kickoff-sorted. Falls back to
 * ESPN's free feed when CFBD is unavailable (e.g. quota); [] only when both
 * feeds fail. */
export async function getWeekScoreboard(week = 1): Promise<ScoreCardData[]> {
  const [games, dir] = await Promise.all([
    cfbd<CfbdGame[]>(`/games?year=${YEAR}&week=${week}&seasonType=regular&classification=fbs`),
    getTeamDirectory(),
  ]);
  if (!games) return getEspnScoreboard(week);
  return games
    .slice()
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .map((g) => {
      const done = g.completed === true;
      const hasScore = done && g.homePoints != null && g.awayPoints != null;
      const homeLead = hasScore && (g.homePoints ?? 0) > (g.awayPoints ?? 0);
      const awayLead = hasScore && (g.awayPoints ?? 0) > (g.homePoints ?? 0);
      const kickoff = new Date(g.startDate);
      const day = kickoff
        .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" })
        .replace(/,/g, "")
        .toUpperCase();
      const time = g.startTimeTBD
        ? "TBD"
        : `${kickoff.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET`;
      return {
        day,
        time,
        id: String(g.id),
        st: done ? "FINAL" : kickoffLabel(g.startDate, g.startTimeTBD),
        live: false,
        net: g.tv ?? g.outlet ?? "",
        conf: toConference(g.homeConference, g.awayConference),
        teams: [
          { label: g.awayTeam, pts: hasScore ? String(g.awayPoints) : "—", lead: awayLead, logo: dir[slugifyTeam(g.awayTeam)]?.logo ?? null },
          { label: g.homeTeam, pts: hasScore ? String(g.homePoints) : "—", lead: homeLead, logo: dir[slugifyTeam(g.homeTeam)]?.logo ?? null },
        ],
      } as ScoreCardData;
    });
}

// --- Team directory (v2 brief §1.4) ---------------------------------------
// All 136 FBS programs with real broadcast abbreviations, brand colors, and
// logo art. CFBD's team ids are ESPN's team ids, so logos come from the same
// ESPN CDN pattern the hand-built lib/teams-meta map already uses — one
// consistent source sitewide. Refreshes daily.

interface CfbdTeam {
  id: number;
  school: string;
  abbreviation?: string | null;
  conference?: string | null;
  color?: string | null;
  alternateColor?: string | null;
}

export interface TeamInfo {
  school: string;
  slug: string;
  abbrev: string;
  conference: string;
  color: string | null;
  logo: string;
  /** ESPN team id (CFBD's ids are the same ids) — for ESPN-side lookups. */
  espnId?: number;
}

/** Slug → team info for every FBS program. Falls back to ESPN's free feed
 * when CFBD is unavailable (quota); {} only when both feeds fail. */
export async function getTeamDirectory(): Promise<Record<string, TeamInfo>> {
  const teams = await cfbd<CfbdTeam[]>(`/teams/fbs?year=${YEAR}`, 604800);
  if (!teams) return getEspnTeamDirectory();
  const dir: Record<string, TeamInfo> = {};
  for (const t of teams) {
    const slug = slugifyTeam(t.school);
    dir[slug] = {
      school: t.school,
      slug,
      abbrev: t.abbreviation || t.school.slice(0, 4).toUpperCase(),
      conference: t.conference ?? "",
      color: t.color ?? null,
      logo: `https://a.espncdn.com/i/teamlogos/ncaa/500/${t.id}.png`,
      espnId: t.id,
    };
  }
  return dir;
}

// --- Recruiting team rankings (paid CFBD tier) ----------------------------

export interface RecruitingRank {
  rank: number;
  team: string;
  slug: string;
  points: number;
  logo: string | null;
  conference: string;
}

/** National team recruiting rankings (247Sports Composite via CFBD) for the
 * newest published cycle — tries the current class first, then falls back to
 * the last complete one. null when no cycle is available. */
export async function getRecruitingRankings(): Promise<{ year: number; ranks: RecruitingRank[] } | null> {
  for (const year of [2027, 2026]) {
    const rows = await cfbd<{ rank: number; team: string; points: number }[]>(
      `/recruiting/teams?year=${year}`,
      86400,
    );
    if (rows && rows.length >= 25) {
      const dir = await getTeamDirectory();
      return {
        year,
        ranks: rows.slice(0, 25).map((r) => {
          const slug = slugifyTeam(r.team);
          return {
            rank: r.rank,
            team: r.team,
            slug,
            points: r.points,
            logo: dir[slug]?.logo ?? null,
            conference: dir[slug]?.conference ?? "",
          };
        }),
      };
    }
  }
  return null;
}

export interface SlateGame {
  away: string;
  home: string;
  awayCode: string;
  homeCode: string;
  awayLogo: string | null;
  homeLogo: string | null;
  when: string;
  net: string;
}

/** Marquee real games for the homepage slate strip: both teams from a known
 * power set, earliest first. Falls back to ESPN's free feed when CFBD is
 * unavailable; [] only when both feeds fail. */
export async function getSlateGames(week = 1, limit = 5): Promise<SlateGame[]> {
  const [games, dir] = await Promise.all([
    cfbd<CfbdGame[]>(`/games?year=${YEAR}&week=${week}&seasonType=regular&classification=fbs`),
    getTeamDirectory(),
  ]);
  if (!games) return getEspnSlateGames(week, limit);
  const power = new Set(["SEC", "Big Ten", "Big 12", "ACC"]);
  const info = (name: string): TeamInfo | undefined => dir[slugifyTeam(name)];
  return games
    .filter((g) => power.has(g.homeConference ?? "") && power.has(g.awayConference ?? ""))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, limit)
    .map((g) => ({
      away: g.awayTeam,
      home: g.homeTeam,
      awayCode: info(g.awayTeam)?.abbrev ?? g.awayTeam.slice(0, 4).toUpperCase(),
      homeCode: info(g.homeTeam)?.abbrev ?? g.homeTeam.slice(0, 4).toUpperCase(),
      awayLogo: info(g.awayTeam)?.logo ?? null,
      homeLogo: info(g.homeTeam)?.logo ?? null,
      when: kickoffLabel(g.startDate, g.startTimeTBD),
      net: g.tv ?? g.outlet ?? "",
    }));
}
