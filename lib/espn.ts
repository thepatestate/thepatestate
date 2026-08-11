// ESPN public JSON API — the site's quota-free data lane. CFBD (lib/cfbd.ts)
// remains the primary feed, but its free tier has a monthly call quota; when
// it's exhausted these helpers keep national rankings, the weekly scoreboard,
// the team directory, and team schedules live. No key, no quota — the same
// unauthenticated endpoints ESPN's own site reads. Server-only; fail-soft
// everywhere ([] / {} / null on any failure), same contract as lib/cfbd.ts.
import type { Conference, ScoreCardData } from "@/lib/scores-demo";
import type { SlateGame, TeamInfo } from "@/lib/cfbd";
import type { TeamGame } from "@/lib/team-data";
import { slugifyTeam } from "@/lib/teams-meta";

const BASE = "https://site.api.espn.com/apis/site/v2/sports/football/college-football";
const YEAR = 2026;

async function espn<T>(path: string, revalidate = 3600): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      next: { revalidate, tags: ["espn"] },
    } as RequestInit);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    console.error("[espn]", path, err);
    return null;
  }
}

// ESPN conference (group) ids → CFBD-style display names + the site's
// scoreboard filter tag. Ids verified against live 2026 scoreboard data.
const CONFS: Record<string, { name: string; tag: Conference }> = {
  "1": { name: "ACC", tag: "ACC" },
  "4": { name: "Big 12", tag: "BIG 12" },
  "5": { name: "Big Ten", tag: "BIG TEN" },
  "8": { name: "SEC", tag: "SEC" },
  "9": { name: "Pac-12", tag: "G5" },
  "12": { name: "Conference USA", tag: "G5" },
  "15": { name: "Mid-American", tag: "G5" },
  "17": { name: "Mountain West", tag: "G5" },
  "18": { name: "FBS Independents", tag: "IND" },
  "37": { name: "Sun Belt", tag: "G5" },
  "151": { name: "American Athletic", tag: "G5" },
};
const POWER_IDS = new Set(["1", "4", "5", "8"]);

function confTag(...ids: (string | number | undefined)[]): Conference {
  for (const id of ids) {
    const c = CONFS[String(id ?? "")];
    if (c) return c.tag;
  }
  return "G5";
}

function dayLabel(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" })
    .replace(/,/g, "")
    .toUpperCase();
}

function timeLabel(iso: string, tbd?: boolean): string {
  if (tbd) return "TBD";
  const t = new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });
  return `${t} ET`;
}

function kickoffLabel(iso: string, tbd?: boolean): string {
  const day = new Date(iso)
    .toLocaleDateString("en-US", { weekday: "short", timeZone: "America/New_York" })
    .toUpperCase();
  return tbd ? `${day} · TBD` : `${day} ${timeLabel(iso, false).replace(" ET", "")} ET`;
}

// ---- national rankings ---------------------------------------------------

export interface PollRank {
  rank: number;
  school: string;
  slug: string;
  abbrev: string;
  record: string;
  points: number | null;
  firstPlace: number | null;
  logo: string | null;
}

export interface NationalPoll {
  name: string;
  week: string; // "Preseason", "Week 3", …
  season: number;
  ranks: PollRank[];
}

interface EspnRankingsResponse {
  rankings?: {
    name?: string;
    occurrence?: { displayValue?: string };
    season?: { year?: number };
    ranks?: {
      current?: number;
      recordSummary?: string;
      points?: number;
      firstPlaceVotes?: number;
      team?: { location?: string; abbreviation?: string; logo?: string };
    }[];
  }[];
}

/** Every national poll ESPN currently publishes with a filled top 25 —
 * Coaches now, AP when it drops, CFP from late October. [] on failure. */
export async function getNationalRankings(): Promise<NationalPoll[]> {
  const data = await espn<EspnRankingsResponse>("/rankings", 3600);
  if (!data?.rankings) return [];
  return data.rankings
    .filter((p) => (p.ranks?.length ?? 0) >= 10)
    .map((p) => ({
      name: p.name ?? "National Poll",
      week: p.occurrence?.displayValue ?? "",
      season: p.season?.year ?? YEAR,
      ranks: (p.ranks ?? []).map((r) => ({
        rank: r.current ?? 0,
        school: r.team?.location ?? "",
        slug: slugifyTeam(r.team?.location ?? ""),
        abbrev: r.team?.abbreviation ?? "",
        record: r.recordSummary ?? "",
        points: r.points ?? null,
        firstPlace: r.firstPlaceVotes ?? null,
        logo: r.team?.logo ?? null,
      })),
    }));
}

/** A team's placement across every published poll (e.g. for team hubs).
 * Empty array = every poll is out but the team is unranked; null = no polls
 * published at all (can't say anything honest yet). */
export async function getTeamPollRanks(slug: string): Promise<{ poll: string; week: string; rank: number }[] | null> {
  const polls = await getNationalRankings();
  if (polls.length === 0) return null;
  const out: { poll: string; week: string; rank: number }[] = [];
  for (const p of polls) {
    const hit = p.ranks.find((r) => r.slug === slug);
    if (hit) out.push({ poll: p.name, week: p.week, rank: hit.rank });
  }
  return out;
}

// ---- weekly scoreboard ---------------------------------------------------

interface EspnEvent {
  id: string;
  date: string;
  week?: { number?: number };
  competitions?: {
    neutralSite?: boolean;
    timeValid?: boolean;
    venue?: { fullName?: string };
    broadcasts?: { names?: string[]; media?: { shortName?: string } }[];
    status?: { type?: { state?: string; completed?: boolean; shortDetail?: string } };
    competitors?: {
      homeAway?: string;
      score?: string | { value?: number; displayValue?: string };
      curatedRank?: { current?: number };
      winner?: boolean;
      team?: {
        id?: string;
        location?: string;
        abbreviation?: string;
        conferenceId?: string | number;
        color?: string;
        logo?: string;
        logos?: { href?: string }[];
      };
    }[];
  }[];
  status?: { type?: { state?: string; completed?: boolean; shortDetail?: string } };
}

interface EspnScoreboard {
  events?: EspnEvent[];
}

async function weekEvents(week: number, revalidate: number): Promise<EspnEvent[]> {
  const data = await espn<EspnScoreboard>(
    `/scoreboard?year=${YEAR}&seasontype=2&week=${week}&limit=400&groups=80`,
    revalidate,
  );
  return data?.events ?? [];
}

function scoreNum(s: string | { value?: number; displayValue?: string } | undefined): number | null {
  if (s == null) return null;
  if (typeof s === "object") return s.value ?? null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Real games for a week as scoreboard cards, kickoff-sorted, with live
 * scores once games kick off. Same shape as cfbd.getWeekScoreboard. */
export async function getEspnScoreboard(week = 1): Promise<ScoreCardData[]> {
  const events = await weekEvents(week, 300);
  return events
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .flatMap((e) => {
      const comp = e.competitions?.[0];
      const away = comp?.competitors?.find((c) => c.homeAway === "away");
      const home = comp?.competitors?.find((c) => c.homeAway === "home");
      if (!comp || !away?.team?.location || !home?.team?.location) return [];
      const state = comp.status?.type?.state ?? "pre";
      const done = comp.status?.type?.completed === true;
      const awayPts = scoreNum(away.score);
      const homePts = scoreNum(home.score);
      const showScore = state !== "pre" && awayPts != null && homePts != null;
      const tbd = comp.timeValid === false;
      const label = (c: NonNullable<typeof away>): string => {
        const rank = c.curatedRank?.current;
        const name = c.team?.location ?? "";
        return rank && rank <= 25 ? `#${rank} ${name}` : name;
      };
      return [{
        id: e.id,
        st: done ? "FINAL" : state === "in" ? (comp.status?.type?.shortDetail ?? "LIVE") : kickoffLabel(e.date, tbd),
        live: state === "in",
        net: comp.broadcasts?.[0]?.names?.[0] ?? comp.broadcasts?.[0]?.media?.shortName ?? "",
        conf: confTag(home.team?.conferenceId, away.team?.conferenceId),
        day: dayLabel(e.date),
        time: timeLabel(e.date, tbd),
        teams: [
          { label: label(away), pts: showScore ? String(awayPts) : "—", lead: showScore && awayPts! > homePts!, logo: away.team?.logo ?? null },
          { label: label(home), pts: showScore ? String(homePts) : "—", lead: showScore && homePts! > awayPts!, logo: home.team?.logo ?? null },
        ],
      } as ScoreCardData];
    });
}

/** Marquee power-conference games for the homepage slate strip. Same shape
 * as cfbd.getSlateGames. */
export async function getEspnSlateGames(week = 1, limit = 5): Promise<SlateGame[]> {
  const events = await weekEvents(week, 300);
  return events
    .filter((e) => {
      const comps = e.competitions?.[0]?.competitors ?? [];
      return comps.length === 2 && comps.every((c) => POWER_IDS.has(String(c.team?.conferenceId ?? "")));
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, limit)
    .flatMap((e) => {
      const comp = e.competitions?.[0];
      const away = comp?.competitors?.find((c) => c.homeAway === "away")?.team;
      const home = comp?.competitors?.find((c) => c.homeAway === "home")?.team;
      if (!comp || !away?.location || !home?.location) return [];
      return [{
        away: away.location,
        home: home.location,
        awayCode: away.abbreviation ?? away.location.slice(0, 4).toUpperCase(),
        homeCode: home.abbreviation ?? home.location.slice(0, 4).toUpperCase(),
        awayLogo: away.logo ?? null,
        homeLogo: home.logo ?? null,
        when: kickoffLabel(e.date, comp.timeValid === false),
        net: comp.broadcasts?.[0]?.names?.[0] ?? comp.broadcasts?.[0]?.media?.shortName ?? "",
      }];
    });
}

// ---- raw week games (for slate building) ---------------------------------

export interface EspnWeekGame {
  id: string;
  away: string;
  home: string;
  awayAbbrev: string;
  homeAbbrev: string;
  awayLogo: string;
  homeLogo: string;
  awaySlug: string;
  homeSlug: string;
  awayPower: boolean;
  homePower: boolean;
  kickoff: string;
  net: string;
}

/** A week's FBS games in slate-building form (power flags + slugs). Used by
 * the weekly Pick'Em auto-creator. [] on failure. */
export async function getEspnWeekGames(week: number): Promise<EspnWeekGame[]> {
  const events = await weekEvents(week, 3600);
  return events.flatMap((e) => {
    const comp = e.competitions?.[0];
    const away = comp?.competitors?.find((c) => c.homeAway === "away")?.team;
    const home = comp?.competitors?.find((c) => c.homeAway === "home")?.team;
    if (!comp || !away?.location || !home?.location) return [];
    return [{
      id: e.id,
      away: away.location,
      home: home.location,
      awayAbbrev: away.abbreviation ?? away.location.slice(0, 4).toUpperCase(),
      homeAbbrev: home.abbreviation ?? home.location.slice(0, 4).toUpperCase(),
      awayLogo: away.logo ?? "",
      homeLogo: home.logo ?? "",
      awaySlug: slugifyTeam(away.location),
      homeSlug: slugifyTeam(home.location),
      awayPower: POWER_IDS.has(String(away.conferenceId ?? "")),
      homePower: POWER_IDS.has(String(home.conferenceId ?? "")),
      kickoff: e.date,
      net: comp.broadcasts?.[0]?.names?.[0] ?? comp.broadcasts?.[0]?.media?.shortName ?? "",
    }];
  });
}

// ---- team directory ------------------------------------------------------

/** Slug → team info for every FBS program, assembled from the first two
 * weeks of the season schedule (every FBS team appears in at least one).
 * Same shape as cfbd.getTeamDirectory; {} on failure. */
export async function getEspnTeamDirectory(): Promise<Record<string, TeamInfo>> {
  const [w1, w2] = await Promise.all([weekEvents(1, 86400), weekEvents(2, 86400)]);
  const dir: Record<string, TeamInfo> = {};
  for (const e of [...w1, ...w2]) {
    for (const c of e.competitions?.[0]?.competitors ?? []) {
      const t = c.team;
      const confId = String(t?.conferenceId ?? "");
      if (!t?.location || !t.id || !CONFS[confId]) continue; // FBS only
      const slug = slugifyTeam(t.location);
      if (dir[slug]) continue;
      dir[slug] = {
        school: t.location,
        slug,
        abbrev: t.abbreviation || t.location.slice(0, 4).toUpperCase(),
        conference: CONFS[confId].name,
        color: t.color ? `#${t.color}` : null,
        logo: t.logo ?? `https://a.espncdn.com/i/teamlogos/ncaa/500/${t.id}.png`,
        espnId: Number(t.id),
      };
    }
  }
  return dir;
}

// ---- team schedule -------------------------------------------------------

interface EspnTeamSchedule {
  events?: EspnEvent[];
}

/** A team's full regular-season schedule. Same shape as
 * team-data.getTeamSchedule; [] on failure. */
export async function getEspnTeamSchedule(espnId: number, school: string): Promise<TeamGame[]> {
  const data = await espn<EspnTeamSchedule>(`/teams/${espnId}/schedule?season=${YEAR}&seasontype=2`, 21600);
  if (!data?.events) return [];
  return data.events
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .flatMap((e) => {
      const comp = e.competitions?.[0];
      const us = comp?.competitors?.find((c) => String(c.team?.id) === String(espnId));
      const them = comp?.competitors?.find((c) => String(c.team?.id) !== String(espnId));
      if (!comp || !us || !them?.team?.location) return [];
      const tbd = comp.timeValid === false;
      const done = comp.status?.type?.completed === true;
      const usPts = scoreNum(us.score);
      const themPts = scoreNum(them.score);
      let result: string | null = null;
      if (done && usPts != null && themPts != null) {
        result = `${usPts > themPts ? "W" : usPts < themPts ? "L" : "T"} ${usPts}–${themPts}`;
      }
      return [{
        id: e.id,
        week: e.week?.number ?? 0,
        kickoff: e.date,
        dateLabel: dayLabel(e.date),
        timeLabel: timeLabel(e.date, tbd),
        opponent: them.team.location,
        opponentSlug: slugifyTeam(them.team.location),
        home: us.homeAway === "home",
        venue: comp.venue?.fullName ?? "",
        tv: comp.broadcasts?.[0]?.media?.shortName ?? comp.broadcasts?.[0]?.names?.[0] ?? "",
        completed: done,
        result,
      } as TeamGame];
    });
}
