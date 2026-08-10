// CollegeFootballData.com integration (ops manual §1, §4) — real schedules
// and, on gamedays, real scores. Server-only; fail-soft everywhere: every
// helper returns [] / null on any failure so pages fall back to demo data.
import type { Conference, ScoreCardData } from "@/lib/scores-demo";

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
  const games = await cfbd<CfbdGame[]>(`/games?year=${YEAR}&week=${week}&seasonType=regular&classification=fbs`);
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
          { label: g.awayTeam, pts: hasScore ? String(g.awayPoints) : "—", lead: awayLead },
          { label: g.homeTeam, pts: hasScore ? String(g.homePoints) : "—", lead: homeLead },
        ],
      } as ScoreCardData;
    });
}

export interface SlateGame {
  away: string;
  home: string;
  awayCode: string;
  homeCode: string;
  when: string;
  net: string;
}

function code(team: string): string {
  return team.replace(/[^A-Za-z ]/g, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase() || team.slice(0, 3).toUpperCase();
}

/** Marquee real games for the homepage slate strip: both teams from a known
 * power set, earliest first. [] on failure (strip falls back to demo). */
export async function getSlateGames(week = 1, limit = 5): Promise<SlateGame[]> {
  const games = await cfbd<CfbdGame[]>(`/games?year=${YEAR}&week=${week}&seasonType=regular&classification=fbs`);
  if (!games) return [];
  const power = new Set(["SEC", "Big Ten", "Big 12", "ACC"]);
  return games
    .filter((g) => power.has(g.homeConference ?? "") && power.has(g.awayConference ?? ""))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, limit)
    .map((g) => ({
      away: g.awayTeam,
      home: g.homeTeam,
      awayCode: code(g.awayTeam),
      homeCode: code(g.homeTeam),
      when: kickoffLabel(g.startDate, g.startTimeTBD),
      net: g.tv ?? g.outlet ?? "",
    }));
}
