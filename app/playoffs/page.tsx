import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import PreseasonChip from "@/components/PreseasonChip";
import { slugifyTeam, teamLogoUrl, helmetLightUrl } from "@/lib/teams-meta";
import { createArtPicker } from "@/lib/editorial-art";

export const metadata: Metadata = { title: "The Playoffs" };

// --- Preseason-preview sample data ---------------------------------------
// Stands in for the bracket-seeding engine (both brackets, current
// rankings) and the AI Playoff Predictor. Swap for live queries/API calls
// when each engine ships; the JSX below only touches these arrays.

type BGame = { seedA: number; teamA: string; winA: boolean; seedB: number; teamB: string; winB: boolean; tag: string };
type BRound = { title: string; center?: boolean; games: readonly BGame[] };

const DEMO_AI_BRACKET: readonly BRound[] = [
  { title: "First Round", games: [
    { seedA: 9, teamA: "Notre Dame", winA: false, seedB: 8, teamB: "LSU", winB: true, tag: "AT BATON ROUGE" },
    { seedA: 12, teamA: "Indiana", winA: false, seedB: 5, teamB: "Texas", winB: true, tag: "AT AUSTIN" },
  ] },
  { title: "Quarterfinals", games: [
    { seedA: 1, teamA: "Georgia", winA: true, seedB: 8, teamB: "LSU", winB: false, tag: "SUGAR" },
    { seedA: 4, teamA: "Boise State", winA: false, seedB: 5, teamB: "Texas", winB: true, tag: "FIESTA" },
  ] },
  { title: "Semifinal", games: [
    { seedA: 1, teamA: "Georgia", winA: false, seedB: 5, teamB: "Texas", winB: true, tag: "COTTON" },
  ] },
  { title: "National Championship", center: true, games: [
    { seedA: 5, teamA: "Texas", winA: true, seedB: 2, teamB: "Ohio State", winB: false, tag: "JAN 18 · MIAMI" },
  ] },
  { title: "Semifinal", games: [
    { seedA: 2, teamA: "Ohio State", winA: true, seedB: 6, teamB: "Oregon", winB: false, tag: "ORANGE" },
  ] },
  { title: "Quarterfinals", games: [
    { seedA: 2, teamA: "Ohio State", winA: true, seedB: 7, teamB: "Penn State", winB: false, tag: "ROSE" },
    { seedA: 3, teamA: "Clemson", winA: false, seedB: 6, teamB: "Oregon", winB: true, tag: "PEACH" },
  ] },
  { title: "First Round", games: [
    { seedA: 10, teamA: "Alabama", winA: false, seedB: 7, teamB: "Penn State", winB: true, tag: "AT STATE COLLEGE" },
    { seedA: 11, teamA: "Miami", winA: false, seedB: 6, teamB: "Oregon", winB: true, tag: "AT EUGENE" },
  ] },
] as const;

const DEMO_JOSH_BRACKET: readonly BRound[] = [
  { title: "First Round", games: [
    { seedA: 9, teamA: "Notre Dame", winA: false, seedB: 8, teamB: "LSU", winB: true, tag: "AT BATON ROUGE" },
    { seedA: 12, teamA: "Indiana", winA: true, seedB: 5, teamB: "Texas", winB: false, tag: "AT AUSTIN" },
  ] },
  { title: "Quarterfinals", games: [
    { seedA: 1, teamA: "Georgia", winA: true, seedB: 8, teamB: "LSU", winB: false, tag: "SUGAR" },
    { seedA: 4, teamA: "Boise State", winA: false, seedB: 12, teamB: "Indiana", winB: true, tag: "FIESTA" },
  ] },
  { title: "Semifinal", games: [
    { seedA: 1, teamA: "Georgia", winA: true, seedB: 12, teamB: "Indiana", winB: false, tag: "COTTON" },
  ] },
  { title: "National Championship", center: true, games: [
    { seedA: 1, teamA: "Georgia", winA: true, seedB: 2, teamB: "Ohio State", winB: false, tag: "JAN 18 · MIAMI" },
  ] },
  { title: "Semifinal", games: [
    { seedA: 2, teamA: "Ohio State", winA: true, seedB: 6, teamB: "Oregon", winB: false, tag: "ORANGE" },
  ] },
  { title: "Quarterfinals", games: [
    { seedA: 2, teamA: "Ohio State", winA: true, seedB: 7, teamB: "Penn State", winB: false, tag: "ROSE" },
    { seedA: 3, teamA: "Clemson", winA: false, seedB: 6, teamB: "Oregon", winB: true, tag: "PEACH" },
  ] },
  { title: "First Round", games: [
    { seedA: 10, teamA: "Alabama", winA: false, seedB: 7, teamB: "Penn State", winB: true, tag: "AT STATE COLLEGE" },
    { seedA: 11, teamA: "Miami", winA: false, seedB: 6, teamB: "Oregon", winB: true, tag: "AT EUGENE" },
  ] },
] as const;

// Small circular helmet thumbnail beside a bracket-row team name; renders
// nothing when the team has no generated helmet yet (the row layout is
// unaffected either way since the .tm flex row already has a gap).
function BracketHelmet({ team }: { team: string }) {
  const helmet = helmetLightUrl(slugifyTeam(team));
  if (!helmet) return null;
  return (
    <span className="bracket-helmet">
      <Image src={helmet} alt="" width={56} height={56} style={{ objectFit: "cover" }} />
    </span>
  );
}

function GameBox({ g }: { g: BGame }) {
  return (
    <div className="game">
      <div className={g.winA ? "tm w" : "tm"}><span className="sd">{g.seedA}</span><BracketHelmet team={g.teamA} />{g.teamA}</div>
      <div className={g.winB ? "tm w" : "tm"}><span className="sd">{g.seedB}</span><BracketHelmet team={g.teamB} />{g.teamB}</div>
      <div className="tag2">{g.tag}</div>
    </div>
  );
}

function TourneyBracket({ rounds, champTitle, champName }: { rounds: readonly BRound[]; champTitle: string; champName: string }) {
  return (
    <div className="tourney-wrap">
      <div className="tourney7">
        {rounds.map((r, i) => (
          <div className={r.center ? "round center" : "round"} key={`${r.title}-${i}`}>
            <h5>{r.title}</h5>
            {r.games.map((g, gi) => <GameBox g={g} key={gi} />)}
            {r.center && (
              <div className="champ">
                <div className="t">{champTitle}</div>
                <div className="n">{champName}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const DEMO_SEEDS_COL1 = [
  { seed: "01", team: "Georgia", note: "SEC champ · bye" },
  { seed: "02", team: "Ohio State", note: "Big Ten champ · bye" },
  { seed: "03", team: "Clemson", note: "ACC champ · bye" },
  { seed: "04", team: "Boise State", note: "G5 champ · bye" },
  { seed: "05", team: "Texas", note: "Hosts first round" },
  { seed: "06", team: "Oregon", note: "Hosts first round" },
] as const;

const DEMO_SEEDS_COL2 = [
  { seed: "07", team: "Penn State", note: "Hosts first round" },
  { seed: "08", team: "LSU", note: "Hosts first round" },
  { seed: "09", team: "Notre Dame", note: "At No. 8" },
  { seed: "10", team: "Alabama", note: "At No. 7" },
  { seed: "11", team: "Miami", note: "At No. 6" },
  { seed: "12", team: "Indiana", note: "At No. 5" },
] as const;

function SeedTable({ rows }: { rows: typeof DEMO_SEEDS_COL1 | typeof DEMO_SEEDS_COL2 }) {
  return (
    <table>
      <thead><tr><th>SEED</th><th>TEAM</th><th>NOTE</th></tr></thead>
      <tbody>
        {rows.map((r) => {
          const logoUrl = teamLogoUrl(slugifyTeam(r.team));
          return (
            <tr key={r.seed}>
              <td className="rk">{r.seed}</td>
              <td>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {logoUrl && (
                    <Image src={logoUrl} alt={`${r.team} logo`} width={24} height={24} style={{ objectFit: "contain" }} />
                  )}
                  <b>{r.team}</b>
                </span>
              </td>
              <td>{r.note}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// Playoff Predictor percentages — same 16 teams as the seed tables above
// (the 12 seeds plus the 4 "First Four Out" already named in that section's
// footnote), in descending JP Poll order. Demo numbers only; PreseasonChip
// labels the whole section.
const DEMO_PREDICTOR_PCTS = [
  { team: "Georgia", pct: 97 },
  { team: "Ohio State", pct: 95 },
  { team: "Clemson", pct: 91 },
  { team: "Boise State", pct: 88 },
  { team: "Texas", pct: 82 },
  { team: "Oregon", pct: 79 },
  { team: "Penn State", pct: 74 },
  { team: "LSU", pct: 68 },
  { team: "Notre Dame", pct: 61 },
  { team: "Alabama", pct: 54 },
  { team: "Miami", pct: 47 },
  { team: "Indiana", pct: 41 },
  { team: "Michigan", pct: 34 },
  { team: "Utah", pct: 27 },
  { team: "Tennessee", pct: 21 },
  { team: "Texas Tech", pct: 16 },
] as const;

// "Read the Room" articles strip — the secondary tiles below are still
// sample teasers, never linked to a real article route (matches the site's
// established demo-card pattern). The lead card is the exception: it links
// to Josh's real, published bracket column (see
// docs/content/josh-playoff-bracket-2026.md, published via
// scripts/publish-josh-bracket.mts at /notebook/my-2026-playoff-bracket-on-the-record).
// Art categories deliberately avoid "playoffs" a second time — its fallback
// candidate is matchup-helmets.jpg, and this page must show zero references
// to that banner image now that the top-of-page banner is gone.
const DEMO_READ_ROOM = [
  { title: "Why the AI Predictor Still Has Texas", meta: "THE MACHINE'S CASE · STAFF", art: "media" as const },
  { title: "The Case for Indiana's Cinderella Run", meta: "UPSET WATCH · STAFF", art: "rankings-movement" as const },
  { title: "First Four Out: The Committee Explains the Snubs", meta: "THE SELECTION SHOW · STAFF", art: "state" as const },
] as const;

const DEMO_CHAMP_OPTIONS = ["Georgia", "Ohio State", "Texas", "Oregon", "Penn State", "LSU", "Clemson", "Notre Dame", "Alabama", "Miami", "Indiana", "Boise State"] as const;
const DEMO_DARKHORSE_OPTIONS = ["Indiana", "Missouri", "Texas Tech", "Utah", "Tennessee", "Michigan", "Vanderbilt", "Iowa State"] as const;
const DEMO_PREDICTOR_WEEKS = ["Preseason — project from talent & schedules", "Mid-October — contenders separating", "Selection Sunday — final field"] as const;

export default function PlayoffsPage() {
  const art = createArtPicker();
  const readRoomLead = art.pick("playoffs", "Josh Pate breaking down his 2026 playoff bracket on the show");
  return (
    <main>
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / Playoffs</p>
          <h1>The Playoffs</h1>
          <p className="lede">
            The playoff picture, four ways: the bracket as it stands, Josh&apos;s bracket, the machine&apos;s — and
            a predictor to run your own season.
          </p>
        </div>
      </header>

      <section>
        <div className="wrap">
          <p className="eyebrow">If the Season Ended Today</p>
          <h2 className="display" style={{ fontSize: 38 }}>Two Brackets. One January.</h2>
          <PreseasonChip />
          <p className="lede">
            The full 12-team field, seeded from the JP Poll — both sides of the bracket funneling to the champion
            in the middle. First the AI Predictor&apos;s path, then Josh&apos;s. Both are locked and graded publicly.
          </p>

          <div className="bracket-title">
            <div className="avatar" style={{ background: "var(--field)", borderColor: "var(--field)" }}>AI</div>
            <h3>The AI Predictor&apos;s Bracket</h3>
          </div>
          <PreseasonChip />
          <TourneyBracket rounds={DEMO_AI_BRACKET} champTitle="AI PREDICTOR'S CHAMPION" champName="Texas" />

          <div className="bracket-title">
            <div className="avatar" style={{ background: "var(--lamp)", color: "var(--navy)", borderColor: "var(--lamp)" }}>JP</div>
            <h3>Josh&apos;s Bracket</h3>
          </div>
          <PreseasonChip />
          <TourneyBracket rounds={DEMO_JOSH_BRACKET} champTitle="JOSH'S CHAMPION" champName="Georgia" />

          <div style={{ marginTop: 30 }}>
            <p className="eyebrow">The Committee of the Citizens</p>
            <h2 className="display" style={{ fontSize: 34 }}>Current Playoff Rankings</h2>
            <PreseasonChip />
            <div className="duo" style={{ marginTop: 18 }}>
              <SeedTable rows={DEMO_SEEDS_COL1} />
              <SeedTable rows={DEMO_SEEDS_COL2} />
            </div>
            <p style={{ marginTop: 14, fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-dim)" }}>
              FIRST FOUR OUT: Michigan · Utah · Tennessee · Texas Tech — SEEDED FROM THE JP POLL + CONFERENCE
              STANDINGS · UPDATES SUNDAY NIGHTS
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <span className="fr fr-field">🏆 THE CITIZENS&apos; BRACKET CHALLENGE</span>
          <p className="eyebrow">Free for Every Citizen · Two Windows, One Champion</p>
          <h2 className="display" style={{ fontSize: 38 }}>Build Yours. Beat Everybody.</h2>
          <PreseasonChip />
          <p className="lede">
            Call the field before anyone kicks off, then prove it again when the real bracket drops. Scored all
            season, standings live on the porch, receipts forever.
          </p>
          <div className="feat-grid" style={{ marginTop: 26 }}>
            <div className="panel panel-accent-field">
              <p className="eyebrow">Window 1 — August</p>
              <h3>The Preseason Bracket</h3>
              <p>
                Pick your 12, seed your byes, crown a champion — locked at Week 1 kickoff.{" "}
                <b style={{ color: "var(--lamp-deep)" }}>+10</b> for every team that makes the field,{" "}
                <b style={{ color: "var(--lamp-deep)" }}>+25</b> for an exact seed,{" "}
                <b style={{ color: "var(--lamp-deep)" }}>+100</b> if your champ wins it all.
              </p>
            </div>
            <div className="panel panel-accent-field">
              <p className="eyebrow">Window 2 — December</p>
              <h3>The Real Bracket</h3>
              <p>
                Selection Sunday, the field is set — fill out the actual bracket, round by round. Points double as
                you go: <b style={{ color: "var(--lamp-deep)" }}>10 · 20 · 40 · 80</b>. Your August foresight plus your
                December nerve, one combined score.
              </p>
            </div>
            <div className="panel panel-accent-field">
              <p className="eyebrow">The Payout</p>
              <h3>Real Prizes</h3>
              <p>
                Monthly leaders: merch + a shoutout on the show. Top 10 combined: signed Pate Report.{" "}
                <b style={{ color: "var(--lamp-deep)" }}>The champion watches the National Championship with Josh</b> —
                and goes on the Wall of Champions, forever.
              </p>
            </div>
          </div>
          <div className="tool" style={{ marginTop: 26, background: "var(--paper)", borderColor: "var(--line-l)" }}>
            <p className="eyebrow">Start Now — 30 Seconds</p>
            <label htmlFor="bkChamp">Your national champion</label>
            <select id="bkChamp" disabled defaultValue={DEMO_CHAMP_OPTIONS[0]}>
              {DEMO_CHAMP_OPTIONS.map((t) => <option key={t}>{t}</option>)}
            </select>
            <label htmlFor="bkDark">Your dark horse to crash the field</label>
            <select id="bkDark" disabled defaultValue={DEMO_DARKHORSE_OPTIONS[0]}>
              {DEMO_DARKHORSE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
            </select>
            <div style={{ marginTop: 16 }}>
              <button className="btn solid" id="bkLock" disabled>Lock My Picks — Start My Bracket</button>
            </div>
          </div>
        </div>
      </section>

      <section className="on-dark tight">
        <div className="wrap">
          <div className="duo">
            <div className="panel panel-dark">
              <p className="eyebrow">Josh&apos;s Playoff Picks</p>
              <h3>Where Josh Has It</h3>
              <p>
                Josh&apos;s bracket, on the record since August:{" "}
                <b style={{ color: "var(--chalk)" }}>Georgia over Ohio State</b> in the final — with{" "}
                <b style={{ color: "var(--chalk)" }}>Indiana</b> winning at Texas in the first round and crashing
                all the way to the Cotton Bowl semifinal.
              </p>
              <Link className="btn" href="/show">Hear the Full Argument</Link>
            </div>
            <div className="panel panel-dark">
              <p className="eyebrow">The AI Predictor&apos;s Board</p>
              <h3>Where the AI Predictor Has It</h3>
              <p>
                The AI Predictor has <b style={{ color: "var(--chalk)" }}>Texas</b> upsetting Georgia in the
                Cotton Bowl semifinal and beating Ohio State for the title. Josh vs. the AI Predictor gets settled
                in January — both brackets are locked and graded publicly.
              </p>
              <a className="btn" href="#tool">Run Your Own Projection ↓</a>
            </div>
          </div>
        </div>
      </section>

      <section className="on-soft" id="tool">
        <div className="wrap">
          <p className="eyebrow">Your Turn</p>
          <h2 className="display" style={{ fontSize: 36 }}>Run the AI Playoff Predictor</h2>
          <PreseasonChip />
          <div className="tool" style={{ marginTop: 20 }}>
            <p className="eyebrow">Set the Scene</p>
            <label htmlFor="pWeek">Point in the season</label>
            <select id="pWeek" disabled defaultValue={DEMO_PREDICTOR_WEEKS[1]}>
              {DEMO_PREDICTOR_WEEKS.map((w) => <option key={w}>{w}</option>)}
            </select>
            <label htmlFor="pInput">What&apos;s happened so far? (teams, records, big results — or just ask &quot;what if...&quot;)</label>
            <textarea
              id="pInput"
              disabled
              placeholder='e.g. Georgia 7-0, beat Bama by 3. Ohio State 6-1, lost to Oregon. Indiana undefeated again somehow. What does the field look like?'
            />
            <div style={{ marginTop: 18 }}>
              <button className="btn solid" id="predictBtn" disabled>Project the Field</button>
            </div>
            <p className="note" style={{ marginTop: 14 }}>Predictor arrives with the season.</p>
          </div>
        </div>
      </section>

      <section className="tight">
        <div className="wrap">
          <p className="eyebrow">The Field, Ranked by Odds</p>
          <h2 className="display" style={{ fontSize: 34 }}>Playoff Predictor</h2>
          <PreseasonChip />
          <p className="lede">
            Every team still alive for the 12-team field, seeded from the JP Poll, with the machine&apos;s current
            chance to make it.
          </p>
          <div className="predictor-grid">
            {DEMO_PREDICTOR_PCTS.map((r, i) => {
              const logoUrl = teamLogoUrl(slugifyTeam(r.team));
              return (
                <div className="predictor-row" key={r.team}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)", width: 20 }}>{i + 1}</span>
                  <span className="pr-hel">
                    {logoUrl && <Image src={logoUrl} alt={`${r.team} logo`} width={30} height={30} style={{ objectFit: "contain" }} />}
                  </span>
                  <span className="pr-name">{r.team}</span>
                  <span className="pr-bar-track">
                    <span className="pr-bar-fill" style={{ width: `${r.pct}%` }} />
                  </span>
                  <span className="pr-pct">{r.pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="on-soft tight">
        <div className="wrap">
          <p className="eyebrow">Read the Room</p>
          <h2 className="display" style={{ fontSize: 34 }}>More on the Bracket</h2>
          <PreseasonChip />
          <div className="bento" style={{ marginTop: 18 }}>
            <Link href="/notebook/my-2026-playoff-bracket-on-the-record" className="tile tile-lead">
              <div className="tile-media">
                <Image src={readRoomLead.src} alt={readRoomLead.alt} fill sizes="(max-width: 900px) 100vw, 640px" style={{ objectFit: "cover" }} />
              </div>
              <div className="tile-scrim" />
              <div className="tile-body">
                <span className="tile-kicker">Josh Pate · On the Record</span>
                <h3 className="tile-headline">My 2026 Playoff Bracket, On the Record</h3>
                <span className="tile-meta">JOSH PATE · READ THE FULL COLUMN →</span>
              </div>
            </Link>
            <div className="bento-stack">
              {DEMO_READ_ROOM.map((item) => {
                const img = art.pick(item.art, item.title);
                return (
                  <Link href="/notebook" className="tile" key={item.title}>
                    <div className="tile-media">
                      <Image src={img.src} alt={img.alt} fill sizes="(max-width: 900px) 100vw, 320px" style={{ objectFit: "cover" }} />
                    </div>
                    <div className="tile-scrim" />
                    <div className="tile-body">
                      <h4 className="tile-headline" style={{ fontSize: "clamp(15px,1.6vw,19px)" }}>{item.title}</h4>
                      <span className="tile-meta">{item.meta}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
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
