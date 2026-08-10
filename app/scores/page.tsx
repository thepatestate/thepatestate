import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import PreseasonChip from "@/components/PreseasonChip";
import EmptyState from "@/components/EmptyState";
import { DEMO_MODE } from "@/lib/demo";
import EpisodeLead from "@/components/EpisodeLead";
import ScoreboardTabs from "@/components/ScoreboardTabs";
import TeamMark from "@/components/TeamMark";
import { TEAMS_TOP25, TEAMS_ALL } from "@/lib/teams";
import { slugifyTeam, helmetLightUrl } from "@/lib/teams-meta";
import { getVideos } from "@/lib/youtube";
import { getWeekScoreboard } from "@/lib/cfbd";
import { createArtPicker } from "@/lib/editorial-art";
import {
  DEMO_SCOREBOARD_GAMES,
  DEMO_CONF_COL1,
  DEMO_CONF_COL2,
  DEMO_WATCHLIST,
  type WatchlistGame,
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

// Watch List matchup mark — the ONE place helmets remain (v2 brief §1.4's
// Top 10 Games exception); everywhere else on this page renders official
// logos via TeamMark. The light helmet set faces RIGHT, so the home/right
// helmet is mirrored to face LEFT — the two helmets face each other across
// the "AT". Falls back to the team logo (never a blank shell) for any team
// without helmet art.
function MatchupHelmet({ team, flip }: { team: string; flip?: boolean }) {
  const slug = slugifyTeam(team);
  const helmet = helmetLightUrl(slug);
  if (helmet) {
    return (
      <span className="helmet-chip">
        <Image
          src={helmet}
          alt={`${team} helmet`}
          width={148}
          height={148}
          style={{ objectFit: "cover", transform: flip ? "scale(1.18) scaleX(-1)" : "scale(1.18)" }}
        />
      </span>
    );
  }
  return <TeamMark name={team} slug={slug} size={52} />;
}

// Small circular logo mark for the "This Week's Slate" day-by-day rows —
// official logos per §1.4 (helmets stay exclusive to the Watch List above).
function SlateLogo({ team }: { team: string }) {
  return (
    <span className="dr-hel">
      <TeamMark name={team} slug={slugifyTeam(team)} size={26} />
    </span>
  );
}

// This Week's Slate groups the same 10 Watch List games (lib/scores-demo's
// DEMO_WATCHLIST) by kickoff day/session instead of the Watch List's
// ranked-by-quality order — a day-by-day view of the same real demo
// schedule, not a second copy-pasted game list. Grouped by each game's `n`
// so both sections stay driven from one source of truth.
const SLATE_DAYPARTS: { label: string; gameNs: readonly WatchlistGame["n"][] }[] = [
  { label: "THU AUG 27", gameNs: ["08"] },
  { label: "FRI AUG 28", gameNs: ["09"] },
  { label: "SAT AUG 29 — MORNING / AFTERNOON", gameNs: ["03", "06", "02", "07"] },
  { label: "SAT AUG 29 — NIGHT", gameNs: ["01", "05"] },
  { label: "SUN AUG 30", gameNs: ["04"] },
  { label: "MON SEP 7", gameNs: ["10"] },
];

export default async function ScoresPage() {
  const videos = await getVideos();
  // Real Week 1 slate from CollegeFootballData; demo cards only as fallback.
  const realGames = await getWeekScoreboard(1);
  const scoreboardGames = realGames.length > 0 ? realGames : DEMO_MODE ? DEMO_SCOREBOARD_GAMES : [];
  const latestVideo = videos[0] ?? null;
  const art = createArtPicker();
  const filmTeaser = art.pick("schedule", "A stadium lit up at night, seen from above");

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
          <p className="eyebrow">{realGames.length > 0 ? "Week 1 — The Real Slate" : "Live Now — Saturday Slate"}</p>
          <h2 className="display" style={{ fontSize: 38 }}>The Scoreboard</h2>
          {realGames.length > 0 ? (
            <span className="note">Live schedule data · scores flow in on gameday</span>
          ) : DEMO_MODE ? (
            <PreseasonChip />
          ) : null}
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
          {scoreboardGames.length > 0 ? (
            <ScoreboardTabs games={scoreboardGames} />
          ) : (
            <div style={{ marginTop: 16, maxWidth: 720 }}>
              <EmptyState
                kicker="LIVE FROM THE FEED"
                title="The Week 1 scoreboard is loading"
                body="Real schedule data flows in from the live feed — check back in a moment."
              />
            </div>
          )}
          <div style={{ marginTop: 14 }}><Link className="btn" href="/teams">Full Scoreboard — All 136 Teams</Link></div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <p className="eyebrow">Plan Your Saturday (and Thursday, and Monday)</p>
          <h2 className="display" style={{ fontSize: 34 }}>This Week&apos;s Slate</h2>
          {realGames.length > 0 ? (
            <div className="dayslate">
              {Array.from(new Set(realGames.map((g) => g.day).filter(Boolean))).map((day) => (
                <div key={day} style={{ marginBottom: 18 }}>
                  <div className="dayslate-day">{day}</div>
                  {realGames.filter((g) => g.day === day).map((g) => (
                    <div className="dayslate-row" key={g.id}>
                      <SlateLogo team={g.teams[0].label} />
                      <div className="dr-teams">
                        {g.teams[0].label} <span className="at">at</span> {g.teams[1].label}
                      </div>
                      <SlateLogo team={g.teams[1].label} />
                      <span className="dr-net">{g.net}</span>
                      <span className="dr-time">{g.time ?? ""}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : DEMO_MODE ? (
            <>
            <PreseasonChip />
            <div className="dayslate">
              {SLATE_DAYPARTS.map((part) => (
                <div key={part.label} style={{ marginBottom: 18 }}>
                  <div className="dayslate-day">{part.label}</div>
                  {part.gameNs.map((n) => {
                    const g = DEMO_WATCHLIST.find((game) => game.n === n);
                    if (!g) return null;
                    return (
                      <div className="dayslate-row" key={g.n}>
                        <SlateLogo team={g.teamA} />
                        <div className="dr-teams">
                          {g.teamA} <span className="at">at</span> {g.teamB}
                        </div>
                        <SlateLogo team={g.teamB} />
                        <span className="dr-net">{g.tv.split(" · ")[0]}</span>
                        <span className="dr-time">{g.tv.split(" · ")[1] ?? g.tv}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            </>
          ) : (
            <div style={{ marginTop: 14, maxWidth: 720 }}>
              <EmptyState
                kicker="LIVE FROM THE FEED"
                title="The weekly slate is loading"
                body="Every game, grouped by kickoff day, straight from the live schedule feed."
              />
            </div>
          )}
        </div>
      </section>

      <section className="on-dark tight">
        <div className="wrap">
          <p className="eyebrow">The Porch Guide to the Week</p>
          <h2 className="display" style={{ fontSize: 36 }}>The Best Game in Every Conference</h2>
          {!DEMO_MODE && (
            <div style={{ marginTop: 14, maxWidth: 720 }}>
              <EmptyState
                dark
                kicker="RE-RANKED EVERY THURSDAY"
                title="Josh's conference picks drop each week in season"
                body="The one game worth your time in every league — straight from Thursday's show."
              />
            </div>
          )}
          {DEMO_MODE && (
          <div className="duo" style={{ marginTop: 18 }}>
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
          )}
        </div>
      </section>

      <section className="on-soft tight">
        <div className="wrap">
          <p className="eyebrow">Find Your Team</p>
          <h2 className="display" style={{ fontSize: 36 }}>Every Schedule, One Tap</h2>
          {DEMO_MODE && <PreseasonChip />}
          <p className="lede">
            Pick your program and get the full slate — home games in gold, ranked opponents flagged. Team schedule
            pages arrive with the team hubs.
          </p>
          <div className="tool" style={{ margin: "18px 0 0", maxWidth: 820 }}>
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
          {DEMO_MODE && <PreseasonChip />}
          <p className="lede">
            Not the biggest brands — the games most worth your Saturday this week, ranked by the porch. Re-ranked
            every Thursday. Argue accordingly.
          </p>
          {!DEMO_MODE && (
            <div style={{ marginTop: 14 }}>
              <EmptyState
                kicker="RANKED BY THE PORCH"
                title="The Week 1 Watch List drops Thursday of opening week"
                body="Josh ranks the ten games most worth your Saturday — not the biggest brands, the best football."
              />
            </div>
          )}
          <div style={{ marginTop: 6 }}>
            {(DEMO_MODE ? DEMO_WATCHLIST : []).map((g) => (
              <div className="wk" key={g.n}>
                <div className="n">{g.n}</div>
                <div className="helms">
                  <MatchupHelmet team={g.teamA} />
                  <span className="at">AT</span>
                  <MatchupHelmet team={g.teamB} flip />
                </div>
                <div className="who"><b>{g.title}</b><div className="meta">{g.meta}</div></div>
                <div className="tv">{g.tv}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="on-soft">
        <div className="wrap">
          <p className="eyebrow">Catch Up</p>
          <h2 className="display" style={{ fontSize: 34 }}>The Film Room</h2>
          <PreseasonChip />
          <div className="duo" style={{ marginTop: 18 }}>
            {latestVideo ? (
              <EpisodeLead video={latestVideo} tag="LATEST FROM THE SHOW" />
            ) : (
              <div className="art">
                <span className="kick">Latest From the Show</span>
                <h4>New Episodes Every Week</h4>
                <p>Video loads live from the channel — check back once the feed is connected.</p>
              </div>
            )}
            <Link href="/notebook" className="art" style={{ textDecoration: "none" }}>
              <div className="bleed-thumb" style={{ position: "relative", height: 160 }}>
                <Image src={filmTeaser.src} alt={filmTeaser.alt} fill sizes="(max-width: 860px) 100vw, 400px" style={{ objectFit: "cover" }} />
              </div>
              <span className="kick">The Written Companion</span>
              <h4>Poll Day, Explained</h4>
              <p>
                Every ranked score, every kickoff window, every network — the week&apos;s full slate broken down in
                writing, the same day the games are decided.
              </p>
              <span className="meta">JOSH PATE · READ IN THE NOTEBOOK →</span>
            </Link>
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
