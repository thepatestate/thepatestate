import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import PreseasonChip from "@/components/PreseasonChip";
import { TEAMS_TOP25, TEAMS_ALL } from "@/lib/teams";
import { slugifyTeam, teamLogoUrl, helmetUrl } from "@/lib/teams-meta";
import {
  DEMO_LIVE_SCORES,
  DEMO_UPCOMING_SCORES,
  DEMO_CONF_COL1,
  DEMO_CONF_COL2,
  DEMO_WATCHLIST,
  teamNameFromLabel,
  type ScoreCardData,
} from "@/lib/scores-demo";

export const metadata: Metadata = { title: "Scores & Schedule" };

// Simple 2026 CFB week date ranges for the week-selector strip below. Week 1
// spans the full opening slate (Thursday kickoffs through Labor Day); every
// week after runs a standard Tue-Mon slate. Live weekly data replaces this
// once the season engine ships.
const CFB_WEEKS = [
  { wk: 1, range: "AUG 29–SEP 7" },
  { wk: 2, range: "SEP 8–14" },
  { wk: 3, range: "SEP 15–21" },
  { wk: 4, range: "SEP 22–28" },
  { wk: 5, range: "SEP 29–OCT 5" },
  { wk: 6, range: "OCT 6–12" },
  { wk: 7, range: "OCT 13–19" },
  { wk: 8, range: "OCT 20–26" },
  { wk: 9, range: "OCT 27–NOV 2" },
  { wk: 10, range: "NOV 3–9" },
  { wk: 11, range: "NOV 10–16" },
  { wk: 12, range: "NOV 17–23" },
  { wk: 13, range: "NOV 24–30" },
  { wk: 14, range: "DEC 1–7" },
] as const;

function ScoreCard({ card }: { card: ScoreCardData }) {
  return (
    <div className="score-card">
      <div className="st">
        {card.live ? <span className="live">{card.st}</span> : <span>{card.st}</span>}
        <span>{card.net}</span>
      </div>
      {card.teams.map((t) => {
        const logoUrl = teamLogoUrl(slugifyTeam(teamNameFromLabel(t.label)));
        return (
          <div className={t.lead ? "tm lead" : "tm"} key={t.label}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {logoUrl && (
                <Image src={logoUrl} alt="" width={20} height={20} style={{ objectFit: "contain" }} />
              )}
              <b>{t.label}</b>
            </span>
            <span className="pts">{t.pts}</span>
          </div>
        );
      })}
    </div>
  );
}

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

// Fallback for any team not yet in lib/teams-meta's TEAM_LOGOS map — the
// wireframe's original mirrored pair of placeholder helmet SVGs, varying
// only the two teams' fill/mask colors.
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

// Real team logo when mapped in lib/teams-meta, ~20% larger than the old
// 38x30 Helmet placeholder it replaces; falls back to the Helmet SVG for
// any team not yet in TEAM_LOGOS.
function TeamIcon({ team, fill, mask, flip }: { team: string; fill: string; mask: string; flip?: boolean }) {
  const logoUrl = teamLogoUrl(slugifyTeam(team));
  if (logoUrl) {
    return <Image src={logoUrl} alt={`${team} logo`} width={46} height={36} style={{ objectFit: "contain" }} />;
  }
  return <Helmet fill={fill} mask={mask} flip={flip} />;
}

// Real blank-helmet studio photo for the Watch List matchups, noticeably
// larger than the plain TeamIcon logo it replaces. Every source photo faces
// LEFT in identical framing, so the home/right-side helmet (flip) is
// mirrored with scaleX(-1) to make the pair face each other like a matchup
// poster. Falls back to TeamIcon (real logo, or the placeholder SVG) for
// any team without a generated helmet yet.
function MatchupHelmet({ team, fill, mask, flip }: { team: string; fill: string; mask: string; flip?: boolean }) {
  const helmet = helmetUrl(slugifyTeam(team));
  if (helmet) {
    return (
      <span className="helmet-chip">
        <Image
          src={helmet}
          alt={`${team} helmet`}
          width={112}
          height={112}
          style={{ objectFit: "cover", transform: flip ? "scale(1.18) scaleX(-1)" : "scale(1.18)" }}
        />
      </span>
    );
  }
  return <TeamIcon team={team} fill={fill} mask={mask} flip={flip} />;
}

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
          <div className="week-strip" role="list" aria-label="Season week selector">
            {CFB_WEEKS.map((w) => (
              <span
                key={w.wk}
                role="listitem"
                className={w.wk === 1 ? "week-pill active" : "week-pill disabled"}
                aria-current={w.wk === 1 ? "true" : undefined}
                aria-disabled={w.wk !== 1}
              >
                WEEK {w.wk} · {w.range}
              </span>
            ))}
          </div>
          <span className="note" style={{ display: "inline-block" }}>Live weekly slates arrive with the season</span>
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
          <div className="banner-photo">
            <Image
              src="/img/matchup-helmets.jpg"
              alt="Blank navy and gold helmets facing off before kickoff"
              fill
              sizes="(max-width: 860px) 100vw, 860px"
              style={{ objectFit: "cover" }}
            />
            <div className="overlay" />
          </div>
          <p className="eyebrow">The Watch List</p>
          <h2 className="display" style={{ fontSize: 36 }}>Top 10 Games of the Week</h2>
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
                  <MatchupHelmet team={g.teamA} fill={g.left.fill} mask={g.left.mask} />
                  <span className="at">AT</span>
                  <MatchupHelmet team={g.teamB} fill={g.right.fill} mask={g.right.mask} flip />
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
