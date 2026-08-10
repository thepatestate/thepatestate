// CollegeFootballData.com integration (ops manual §1, §4) — real schedules
// and, on gamedays, real scores. Server-only; fail-soft everywhere: every
// helper returns [] / null on any failure so pages fall back to demo data.
import type { Conference, ScoreCardData } from "@/lib/scores-demo";
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

async function cfbd<T>(path: string, revalidate = 3600): Promise<T | null> {
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

/** Real games for a week as scoreboard cards, kickoff-sorted. [] on failure. */
export async function getWeekScoreboard(week = 1): Promise<ScoreCardData[]> {
  const [games, dir] = await Promise.all([
    cfbd<CfbdGame[]>(`/games?year=${YEAR}&week=${week}&seasonType=regular&classification=fbs`),
    getTeamDirectory(),
  ]);
  if (!games) return [];
  return games
    .slice()
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .map((g) => {
      const done = g.completed === true;
      const hasScore = done && g.homePoints != null && g.awayPoints != null;
      const homeLead = hasScore && (g.homePoints ?? 0) > (g.awayPoints ?? 0);
      const awayLead = hasScore && (g.awayPoints ?? 0) > (g.homePoints ?? 0);
      return {
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
}

/** Slug → team info for every FBS program; {} on failure. */
export async function getTeamDirectory(): Promise<Record<string, TeamInfo>> {
  const teams = await cfbd<CfbdTeam[]>(`/teams/fbs?year=${YEAR}`, 86400);
  if (!teams) return {};
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
    };
  }
  return dir;
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
 * power set, earliest first. [] on failure (strip falls back to demo). */
export async function getSlateGames(week = 1, limit = 5): Promise<SlateGame[]> {
  const [games, dir] = await Promise.all([
    cfbd<CfbdGame[]>(`/games?year=${YEAR}&week=${week}&seasonType=regular&classification=fbs`),
    getTeamDirectory(),
  ]);
  if (!games) return [];
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
