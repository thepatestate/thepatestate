import type { Metadata } from "next";
import Link from "next/link";
import PreseasonChip from "@/components/PreseasonChip";
import { TEAMS_TOP25, TEAMS_ALL } from "@/lib/teams";

export const metadata: Metadata = { title: "Scores & Schedule" };

// --- Preseason-preview sample data ---------------------------------------
// Stands in for the CFBD live-scores engine. Swap for a real feed when it
// ships; the JSX below only touches these arrays.

type ScoreTeam = { label: string; pts: string; lead: boolean };
type ScoreCardData = { st: string; live: boolean; net: string; teams: readonly [ScoreTeam, ScoreTeam] };

const DEMO_LIVE_SCORES: readonly ScoreCardData[] = [
  { st: "LIVE · Q3 8:42", live: true, net: "CBS", teams: [{ label: "#1 Georgia", pts: "24", lead: true }, { label: "#9 Alabama", pts: "17", lead: false }] },
  { st: "LIVE · Q2 0:38", live: true, net: "FOX", teams: [{ label: "#6 Oregon", pts: "14", lead: false }, { label: "#12 Michigan", pts: "17", lead: true }] },
  { st: "LIVE · Q4 3:12", live: true, net: "ESPN", teams: [{ label: "#11 Indiana", pts: "31", lead: true }, { label: "Iowa", pts: "13", lead: false }] },
  { st: "FINAL", live: false, net: "SECN", teams: [{ label: "#8 LSU", pts: "38", lead: true }, { label: "Ole Miss", pts: "35", lead: false }] },
] as const;

const DEMO_UPCOMING_SCORES: readonly ScoreCardData[] = [
  { st: "7:30 PM ET", live: false, net: "NBC", teams: [{ label: "#8 Notre Dame", pts: "—", lead: false }, { label: "USC", pts: "—", lead: false }] },
  { st: "7:00 PM ET", live: false, net: "ACCN", teams: [{ label: "#7 Clemson", pts: "—", lead: false }, { label: "Florida State", pts: "—", lead: false }] },
  { st: "10:15 PM ET", live: false, net: "ESPN", teams: [{ label: "Boise State", pts: "—", lead: false }, { label: "UNLV", pts: "—", lead: false }] },
  { st: "FINAL — NOON", live: false, net: "BIG NOON", teams: [{ label: "#2 Ohio State", pts: "41", lead: true }, { label: "Penn State", pts: "20", lead: false }] },
] as const;

function ScoreCard({ card }: { card: ScoreCardData }) {
  return (
    <div className="score-card">
      <div className="st">
        {card.live ? <span className="live">{card.st}</span> : <span>{card.st}</span>}
        <span>{card.net}</span>
      </div>
      {card.teams.map((t) => (
        <div className={t.lead ? "tm lead" : "tm"} key={t.label}>
          <b>{t.label}</b>
          <span className="pts">{t.pts}</span>
        </div>
      ))}
    </div>
  );
}

const DEMO_CONF_COL1 = [
  { conf: "SEC", aRank: "#1", aName: "Georgia", sep: "vs", bRank: "#9", bRest: "Alabama · 7:30 CBS" },
  { conf: "Big Ten", aRank: "#6", aName: "Oregon", sep: "at", bRank: "#12", bRest: "Michigan · 3:30 FOX" },
  { conf: "ACC", aRank: "#7", aName: "Clemson", sep: "at", bRank: null, bRest: "Florida State · 7:00 ACCN" },
] as const;

const DEMO_CONF_COL2 = [
  { conf: "Big 12", aRank: null, aName: "Texas Tech", sep: "at", bRank: null, bRest: "Oklahoma State · 4:00 ESPN2" },
  { conf: "G5 Game of the Week", aRank: "#4", aName: "Boise State", sep: "at", bRank: null, bRest: "UNLV · 10:15 ESPN" },
] as const;

const MATCHUP_STYLE = { background: "var(--navy-2)", borderColor: "var(--line-d)", color: "var(--chalk)" } as const;

function ConfMatchups({ rows }: { rows: typeof DEMO_CONF_COL1 | typeof DEMO_CONF_COL2 }) {
  return (
    <>
      {rows.map((r) => (
        <div key={r.conf}>
          <div className="conf-head">{r.conf}</div>
          <div className="matchup" style={MATCHUP_STYLE}>
            <span>{r.aRank && <b>{r.aRank}</b>} {r.aName}</span>
            <span>{r.sep}</span>
            <span>{r.bRank && <b>{r.bRank}</b>} {r.bRest}</span>
          </div>
        </div>
      ))}
    </>
  );
}

// DEMO_TEAM_TOP25 / DEMO_TEAM_ALL used to live here as local consts; the
// canonical (unsuffixed) team lists now live in lib/teams.ts, shared with
// the /welcome favorite-team picker.

// Values are re-suffixed here (locally, for this page only) to stay distinct
// from DEMO_TEAM_TOP25 even though six of these teams also appear there
// (matching the wireframe's quick-pick + full-alphabetical groups) —
// otherwise React's uncontrolled <select> would mark every same-valued
// <option> across both groups as selected at once.
const DEMO_TEAM_TOP25 = TEAMS_TOP25;
const DEMO_TEAM_ALL: ReadonlyArray<{ value: string | null; label: string }> = [
  { value: `${TEAMS_ALL[0].value}-all`, label: TEAMS_ALL[0].label },
  { value: null, label: "Air Force · Akron · App State … (all 136 in production)" },
  ...TEAMS_ALL.slice(1).map((t) => ({ value: `${t.value}-all`, label: t.label })),
];

// The wireframe repeats a mirrored pair of placeholder helmet SVGs per
// watch-list row, varying only the two teams' fill/mask colors.
function Helmet({ fill, mask, flip }: { fill: string; mask: string; flip?: boolean }) {
  return (
    <svg width="38" height="30" viewBox="0 0 40 32" aria-hidden="true">
      <g transform={flip ? "scale(-1,1) translate(-40,0)" : undefined}>
        <path
          d="M4,17 C4,8 10,3 18,3 C27,3 33,9 33,17 L33,23 C33,25 31,26 29,26 L24,26 L24,29 L14,29 C8,29 4,24 4,17 Z"
          fill={fill}
        />
        <rect x="15" y="3" width="6" height="23" rx="3" fill={mask} />
        <path d="M27,15 L38,15 M27,21 L38,21 M33,12 L33,24" stroke="#9AA0A8" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

const DEMO_WATCHLIST = [
  { n: "01", left: { fill: "#BA0C2F", mask: "#000000" }, right: { fill: "#9E1B32", mask: "#FFFFFF" }, title: "#1 Georgia at #9 Alabama", meta: "THE STANDARD VS. THE STANDARD · BRYANT-DENNY", tv: "CBS · 7:30" },
  { n: "02", left: { fill: "#154733", mask: "#FEE123" }, right: { fill: "#00274C", mask: "#FFCB05" }, title: "#6 Oregon at #12 Michigan", meta: "WINNER CONTROLS THE BIG TEN RACE", tv: "FOX · 3:30" },
  { n: "03", left: { fill: "#BB0000", mask: "#B0B7BF" }, right: { fill: "#041E42", mask: "#FFFFFF" }, title: "#2 Ohio State vs Penn State", meta: "WHITE OUT ENERGY, COLUMBUS EDITION", tv: "FOX · NOON" },
  { n: "04", left: { fill: "#F56600", mask: "#FFFFFF" }, right: { fill: "#782F40", mask: "#CEB888" }, title: "#7 Clemson at Florida State", meta: "THE ACC RUNS THROUGH ONE OF THESE", tv: "ACCN · 7:00" },
  { n: "05", left: { fill: "#0C2340", mask: "#C99700" }, right: { fill: "#990000", mask: "#FFC72C" }, title: "#8 Notre Dame vs USC", meta: "THE CROSS-COUNTRY CLASSIC, UNDER THE LIGHTS", tv: "NBC · 7:30" },
  { n: "06", left: { fill: "#461D7C", mask: "#FDD023" }, right: { fill: "#14213D", mask: "#CE1126" }, title: "#8 LSU at Ole Miss", meta: "MAGNOLIA STATE CHAOS GUARANTEED", tv: "SECN · NOON" },
  { n: "07", left: { fill: "#990000", mask: "#FFFFFF" }, right: { fill: "#000000", mask: "#FFCD00" }, title: "#11 Indiana vs Iowa", meta: "THE CINDERELLA AUDIT CONTINUES", tv: "BTN · 4:00" },
  { n: "08", left: { fill: "#CC0000", mask: "#000000" }, right: { fill: "#FF7300", mask: "#000000" }, title: "Texas Tech at Oklahoma State", meta: "BIG 12 ELIMINATION STAKES", tv: "ESPN2 · 4:00" },
  { n: "09", left: { fill: "#0033A0", mask: "#D64309" }, right: { fill: "#CF0A2C", mask: "#666666" }, title: "#4 Boise State at UNLV", meta: "THE G5 BYE ON THE LINE, LATE NIGHT", tv: "ESPN · 10:15" },
  { n: "10", left: { fill: "#CC0000", mask: "#FFFFFF" }, right: { fill: "#512888", mask: "#D1D1D1" }, title: "Utah at Kansas State", meta: "SLEEPER OF THE WEEK — DVR INSURANCE", tv: "FS1 · 8:00" },
] as const;

export default function ScoresPage() {
  return (
    <main>
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / Scores &amp; Schedule</p>
          <h1>Scores &amp; Schedule</h1>
          <p className="lede">Every game, live — plus the full season map and the best game in every conference, every week.</p>
        </div>
      </header>

      <section>
        <div className="wrap">
          <p className="eyebrow">Live Now — Saturday Slate</p>
          <h2 className="display" style={{ fontSize: 38 }}>The Scoreboard</h2>
          <PreseasonChip />
          <div className="score-strip">
            {DEMO_LIVE_SCORES.map((c) => <ScoreCard card={c} key={c.st + c.net} />)}
          </div>
          <div className="score-strip" style={{ marginTop: 12 }}>
            {DEMO_UPCOMING_SCORES.map((c) => <ScoreCard card={c} key={c.st + c.net} />)}
          </div>
          <div style={{ marginTop: 18 }}><Link className="btn" href="/teams">Full Scoreboard — All 136 Teams</Link></div>
        </div>
      </section>

      <section className="on-dark">
        <div className="wrap">
          <p className="eyebrow">The Porch Guide to the Week</p>
          <h2 className="display" style={{ fontSize: 36 }}>The Best Game in Every Conference</h2>
          <PreseasonChip />
          <div className="duo" style={{ marginTop: 20 }}>
            <div><ConfMatchups rows={DEMO_CONF_COL1} /></div>
            <div>
              <ConfMatchups rows={DEMO_CONF_COL2} />
              <div className="conf-head">Josh&apos;s Watch Order</div>
              <p className="lede" style={{ fontSize: 15 }}>
                Noon: stay flexible. 3:30: Oregon–Michigan, no debate. Night: Georgia–Bama on the main TV, Clemson on
                the second, Boise for dessert. Pace yourself — it&apos;s a marathon.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="on-soft">
        <div className="wrap">
          <p className="eyebrow">Find Your Team</p>
          <h2 className="display" style={{ fontSize: 36 }}>Every Schedule, One Tap</h2>
          <PreseasonChip />
          <p className="lede">
            Pick your program and get the full slate — home games in gold, ranked opponents flagged. All 136 teams
            in production; six shown in this demo.
          </p>
          <div className="tool" style={{ margin: "20px 0 0", maxWidth: 820 }}>
            <label htmlFor="teamSel">Your team</label>
            <select id="teamSel" disabled defaultValue="georgia">
              <optgroup label="THE JP TOP 25">
                {DEMO_TEAM_TOP25.map((o) => (
                  <option value={o.value} key={o.value}>{o.label}</option>
                ))}
              </optgroup>
              <optgroup label="ALL 136 TEAMS, A–Z">
                {DEMO_TEAM_ALL.map((o) => (
                  <option value={o.value ?? undefined} disabled={o.value === null} key={o.label}>{o.label}</option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ maxWidth: 860 }}>
          <p className="eyebrow">The Watch List</p>
          <h2 className="display" style={{ fontSize: 36 }}>Top 10 Games of the Week, In Watch Order</h2>
          <PreseasonChip />
          <p className="lede">
            Not the biggest brands — the games most worth your Saturday this week, ranked by the porch. Re-ranked
            every Thursday. Argue accordingly.
          </p>
          <div style={{ marginTop: 6 }}>
            {DEMO_WATCHLIST.map((g) => (
              <div className="wk" key={g.n}>
                <div className="n">{g.n}</div>
                <div className="helms">
                  <Helmet fill={g.left.fill} mask={g.left.mask} />
                  <span className="at">AT</span>
                  <Helmet fill={g.right.fill} mask={g.right.mask} flip />
                </div>
                <div className="who"><b>{g.title}</b><div className="meta">{g.meta}</div></div>
                <div className="tv">{g.tv}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="cta-band">
        <div className="wrap row">
          <div>
            <h3>Who&apos;s In? See the Playoff Picture.</h3>
            <p>THE BRACKET, THE RANKINGS, JOSH&apos;S PICKS — AND AN AI TO RUN YOUR OWN</p>
          </div>
          <Link className="btn" href="/playoffs" style={{ borderColor: "var(--lamp)", color: "var(--lamp)" }}>
            Open the Playoffs Page →
          </Link>
        </div>
      </div>
    </main>
  );
}
