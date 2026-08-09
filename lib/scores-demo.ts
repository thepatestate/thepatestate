// --- Preseason-preview sample data ---------------------------------------
// Stands in for the CFBD live-scores engine. Shared by /scores (the full
// scoreboard, conference matchups, and Watch List) and the homepage's Week 1
// slate strip, so both call sites read the same games instead of
// copy-pasting them. Swap for a real feed when the season engine ships; the
// JSX at each call site only touches these arrays.

export type ScoreTeam = { label: string; pts: string; lead: boolean };
export type ScoreCardData = { st: string; live: boolean; net: string; teams: readonly [ScoreTeam, ScoreTeam] };

export const DEMO_LIVE_SCORES: readonly ScoreCardData[] = [
  { st: "LIVE · Q3 8:42", live: true, net: "CBS", teams: [{ label: "#1 Georgia", pts: "24", lead: true }, { label: "#9 Alabama", pts: "17", lead: false }] },
  { st: "LIVE · Q2 0:38", live: true, net: "FOX", teams: [{ label: "#6 Oregon", pts: "14", lead: false }, { label: "#12 Michigan", pts: "17", lead: true }] },
  { st: "LIVE · Q4 3:12", live: true, net: "ESPN", teams: [{ label: "#11 Indiana", pts: "31", lead: true }, { label: "Iowa", pts: "13", lead: false }] },
  { st: "FINAL", live: false, net: "SECN", teams: [{ label: "#8 LSU", pts: "38", lead: true }, { label: "Ole Miss", pts: "35", lead: false }] },
] as const;

export const DEMO_UPCOMING_SCORES: readonly ScoreCardData[] = [
  { st: "7:30 PM ET", live: false, net: "NBC", teams: [{ label: "#8 Notre Dame", pts: "—", lead: false }, { label: "USC", pts: "—", lead: false }] },
  { st: "7:00 PM ET", live: false, net: "ACCN", teams: [{ label: "#7 Clemson", pts: "—", lead: false }, { label: "Florida State", pts: "—", lead: false }] },
  { st: "10:15 PM ET", live: false, net: "ESPN", teams: [{ label: "Boise State", pts: "—", lead: false }, { label: "UNLV", pts: "—", lead: false }] },
  { st: "FINAL — NOON", live: false, net: "BIG NOON", teams: [{ label: "#2 Ohio State", pts: "41", lead: true }, { label: "Penn State", pts: "20", lead: false }] },
] as const;

// Score-card labels carry a "#<rank> " prefix (e.g. "#1 Georgia"); strip it
// before slugifying so the lookup matches lib/teams-meta's plain team names.
export function teamNameFromLabel(label: string): string {
  return label.replace(/^#\d+\s+/, "");
}

export const DEMO_CONF_COL1 = [
  { conf: "SEC", aRank: "#1", aName: "Georgia", sep: "vs", bRank: "#9", bRest: "Alabama · 7:30 CBS" },
  { conf: "Big Ten", aRank: "#6", aName: "Oregon", sep: "at", bRank: "#12", bRest: "Michigan · 3:30 FOX" },
  { conf: "ACC", aRank: "#7", aName: "Clemson", sep: "at", bRank: null, bRest: "Florida State · 7:00 ACCN" },
] as const;

export const DEMO_CONF_COL2 = [
  { conf: "Big 12", aRank: null, aName: "Texas Tech", sep: "at", bRank: null, bRest: "Oklahoma State · 4:00 ESPN2" },
  { conf: "G5 Game of the Week", aRank: "#4", aName: "Boise State", sep: "at", bRank: null, bRest: "UNLV · 10:15 ESPN" },
] as const;

export type WatchlistGame = {
  n: string;
  teamA: string;
  codeA: string;
  teamB: string;
  codeB: string;
  left: { fill: string; mask: string };
  right: { fill: string; mask: string };
  title: string;
  meta: string;
  tv: string;
  date: string;
};

// Top 10 games of the Watch List, in order. The homepage's slate strip
// slices the first five as its "Week 1 preview" — same games, no
// copy-pasted data.
export const DEMO_WATCHLIST: readonly WatchlistGame[] = [
  { n: "01", teamA: "Georgia", codeA: "UGA", teamB: "Alabama", codeB: "ALA", left: { fill: "#BA0C2F", mask: "#000000" }, right: { fill: "#9E1B32", mask: "#FFFFFF" }, title: "#1 Georgia at #9 Alabama", meta: "THE STANDARD VS. THE STANDARD · BRYANT-DENNY", tv: "CBS · 7:30", date: "SAT AUG 29" },
  { n: "02", teamA: "Oregon", codeA: "ORE", teamB: "Michigan", codeB: "MICH", left: { fill: "#154733", mask: "#FEE123" }, right: { fill: "#00274C", mask: "#FFCB05" }, title: "#6 Oregon at #12 Michigan", meta: "WINNER CONTROLS THE BIG TEN RACE", tv: "FOX · 3:30", date: "SAT AUG 29" },
  { n: "03", teamA: "Ohio State", codeA: "OSU", teamB: "Penn State", codeB: "PSU", left: { fill: "#BB0000", mask: "#B0B7BF" }, right: { fill: "#041E42", mask: "#FFFFFF" }, title: "#2 Ohio State vs Penn State", meta: "WHITE OUT ENERGY, COLUMBUS EDITION", tv: "FOX · NOON", date: "SAT AUG 29" },
  { n: "04", teamA: "Clemson", codeA: "CLEM", teamB: "Florida State", codeB: "FSU", left: { fill: "#F56600", mask: "#FFFFFF" }, right: { fill: "#782F40", mask: "#CEB888" }, title: "#7 Clemson at Florida State", meta: "THE ACC RUNS THROUGH ONE OF THESE", tv: "ACCN · 7:00", date: "SUN AUG 30" },
  { n: "05", teamA: "Notre Dame", codeA: "ND", teamB: "USC", codeB: "USC", left: { fill: "#0C2340", mask: "#C99700" }, right: { fill: "#990000", mask: "#FFC72C" }, title: "#8 Notre Dame vs USC", meta: "THE CROSS-COUNTRY CLASSIC, UNDER THE LIGHTS", tv: "NBC · 7:30", date: "SAT AUG 29" },
  { n: "06", teamA: "LSU", codeA: "LSU", teamB: "Ole Miss", codeB: "MISS", left: { fill: "#461D7C", mask: "#FDD023" }, right: { fill: "#14213D", mask: "#CE1126" }, title: "#8 LSU at Ole Miss", meta: "MAGNOLIA STATE CHAOS GUARANTEED", tv: "SECN · NOON", date: "SAT AUG 29" },
  { n: "07", teamA: "Indiana", codeA: "IU", teamB: "Iowa", codeB: "IOWA", left: { fill: "#990000", mask: "#FFFFFF" }, right: { fill: "#000000", mask: "#FFCD00" }, title: "#11 Indiana vs Iowa", meta: "THE CINDERELLA AUDIT CONTINUES", tv: "BTN · 4:00", date: "SAT AUG 29" },
  { n: "08", teamA: "Texas Tech", codeA: "TTU", teamB: "Oklahoma State", codeB: "OKST", left: { fill: "#CC0000", mask: "#000000" }, right: { fill: "#FF7300", mask: "#000000" }, title: "Texas Tech at Oklahoma State", meta: "BIG 12 ELIMINATION STAKES", tv: "ESPN2 · 4:00", date: "THU AUG 27" },
  { n: "09", teamA: "Boise State", codeA: "BSU", teamB: "UNLV", codeB: "UNLV", left: { fill: "#0033A0", mask: "#D64309" }, right: { fill: "#CF0A2C", mask: "#666666" }, title: "#4 Boise State at UNLV", meta: "THE G5 BYE ON THE LINE, LATE NIGHT", tv: "ESPN · 10:15", date: "FRI AUG 28" },
  { n: "10", teamA: "Utah", codeA: "UTAH", teamB: "Kansas State", codeB: "KSU", left: { fill: "#CC0000", mask: "#FFFFFF" }, right: { fill: "#512888", mask: "#D1D1D1" }, title: "Utah at Kansas State", meta: "SLEEPER OF THE WEEK — DVR INSURANCE", tv: "FS1 · 8:00", date: "MON SEP 7" },
] as const;
