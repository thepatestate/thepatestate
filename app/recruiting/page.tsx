import type { Metadata } from "next";
import PreseasonChip from "@/components/PreseasonChip";

export const metadata: Metadata = { title: "Recruiting — The Next Wave" };

// --- Preseason-preview sample data ---------------------------------------
// Stands in for the Pate Recruiting Index (247Sports Composite + On3/Rivals
// Industry, averaged nightly) and the recruiting wire. Swap for live
// queries/API calls when the engine ships; the JSX below only touches
// these arrays.

const DEMO_TEAM_INDEX = [
  { rk: "01", code: "A&M", team: "Texas A&M", commits: "26 COMMITS", stars: "6 FIVE★", chip: "19 BLUE-CHIP", val: "315.5" },
  { rk: "02", code: "ND", team: "Notre Dame", commits: "23 COMMITS", stars: "4 FIVE★", chip: null, val: "302.5" },
  { rk: "03", code: "MIA", team: "Miami", commits: "21 COMMITS", stars: "5 FIVE★", chip: null, val: "298.0" },
  { rk: "04", code: "ORE", team: "Oregon", commits: "24 COMMITS", stars: "2 FIVE★", chip: null, val: "295.6" },
  { rk: "05", code: "OSU", team: "Ohio State", commits: "19 COMMITS", stars: "3 FIVE★", chip: null, val: "282.4" },
] as const;

const DEMO_FULL_INDEX = [
  { rk: "01", team: "Texas A&M", c247: "1", on3: "1", commits: "26", stars: "6", rating: "315.48 / 94.17" },
  { rk: "02", team: "Notre Dame", c247: "2", on3: "2", commits: "23", stars: "4", rating: "302.50 / 93.17" },
  { rk: "03", team: "Miami", c247: "3", on3: "3", commits: "21", stars: "5", rating: "298.03 / 93.06" },
  { rk: "04", team: "Oregon", c247: "4", on3: "4", commits: "24", stars: "2", rating: "295.59 / 92.51" },
  { rk: "05", team: "Ohio State", c247: "7", on3: "5", commits: "19", stars: "3", rating: "282.41 / 92.19" },
  { rk: "06", team: "Texas", c247: "6", on3: "6", commits: "22", stars: "3", rating: "288.01 / 92.04" },
  { rk: "07", team: "Oklahoma", c247: "5", on3: "7", commits: "27", stars: "3", rating: "289.68 / 92.03" },
  { rk: "08", team: "Florida", c247: "8", on3: "8", commits: "25", stars: "1", rating: "280.97 / 91.72" },
  { rk: "09", team: "Texas Tech", c247: "9", on3: "9", commits: "19", stars: "2", rating: "279.90 / 91.41" },
  { rk: "10", team: "Michigan", c247: "11", on3: "11", commits: "21", stars: "0", rating: "266.16 / 90.88" },
  { rk: "11", team: "Auburn", c247: "10", on3: "12", commits: "25", stars: "0", rating: "270.07 / 90.86" },
  { rk: "12", team: "LSU", c247: "15", on3: "10", commits: "16", stars: "1", rating: "257.92 / 90.91" },
  { rk: "13", team: "Georgia", c247: "12", on3: "14", commits: "20", stars: "2", rating: "262.42 / 90.68" },
  { rk: "14", team: "Ole Miss", c247: "14", on3: "15", commits: "22", stars: "0", rating: "258.88 / 90.55" },
  { rk: "15", team: "Clemson", c247: "13", on3: "16", commits: "25", stars: "0", rating: "258.89 / 90.54" },
] as const;

const DEMO_PLAYERS = [
  { rk: "01", name: "DJ Jacobs", pos: "EDGE", size: "6-5 / 240", hometown: "Roswell, GA", team: "Ohio State" },
  { rk: "02", name: "Maxwell Hiller", pos: "IOL", size: "6-5 / 300", hometown: "Coatesville, PA", team: "Florida" },
  { rk: "03", name: "Mark Matthews", pos: "OT", size: "6-5.5 / 300", hometown: "Ft. Lauderdale, FL", team: "Texas A&M" },
  { rk: "04", name: "Jalen Brewster", pos: "DL", size: "6-3 / 302", hometown: "Cedar Hill, TX", team: "Texas Tech" },
  { rk: "05", name: "KJ Green", pos: "EDGE", size: "6-4 / 230", hometown: "Stone Mountain, GA", team: "LSU" },
  { rk: "06", name: "Donte Wright", pos: "CB", size: "6-1 / 170", hometown: "Long Beach, CA", team: "Miami" },
  { rk: "07", name: "Trae Taylor", pos: "QB", size: "6-3 / 203", hometown: "Omaha, NE", team: "Nebraska" },
  { rk: "08", name: "Israel Abrams", pos: "QB", size: "6-4 / 187", hometown: "Arlington Hts., IL", team: "Miami" },
  { rk: "09", name: "Elijah Haven", pos: "QB", size: "6-5 / 235", hometown: "Baton Rouge, LA", team: "Alabama" },
  { rk: "10", name: "Kemon Spell", pos: "RB", size: "5-9 / 205", hometown: "McKeesport, PA", team: "Georgia" },
  { rk: "11", name: "David Gabriel Georges", pos: "RB", size: "6-0 / 210", hometown: "Chattanooga, TN", team: "Tennessee" },
  { rk: "12", name: "Monshun Sales", pos: "WR", size: "6-5 / 195", hometown: "Indianapolis, IN", team: "Indiana" },
] as const;

const DEMO_RECRUITING_NEWS = [
  {
    headline: "The last 2027 five-stars are off the board",
    body: "The final two uncommitted five-stars made their calls: a five-star WR chose Indiana and a five-star RB stayed home with Tennessee — pivotal in-state wins that moved both classes up the rankings.",
    src: "VIA ESPN RECRUITING · THIS WEEK",
  },
  {
    headline: "A&M is building a monster",
    body: "Texas A&M sits No. 1 on both major services with 26 commits — six five-stars and 19 blue-chips — putting Mike Elko in position for his second top-five class in three cycles.",
    src: "VIA 247SPORTS & ON3 · UPDATED TODAY",
  },
  {
    headline: "Blue bloods lurking, not leading",
    body: "Georgia (13th on the Pate Index), Alabama (outside the top 30 on both services), and Texas (6th) are unusually quiet this cycle — which historically means a December surge is coming.",
    src: "THE PATE READ · AUG 6",
  },
] as const;

export default function RecruitingPage() {
  return (
    <main>
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / Recruiting</p>
          <h1>The Next Wave</h1>
          <p className="lede">
            Recruiting and the portal without the message-board panic. The Pate Index below is real: it averages
            the 247Sports Composite and the On3/Rivals Industry rankings, pulled live.
          </p>
        </div>
      </header>

      <section>
        <div className="wrap">
          <p className="eyebrow">The Pate Recruiting Index — Class of 2027</p>
          <h2 className="display" style={{ fontSize: 38 }}>Two Services. One Honest Number.</h2>
          <PreseasonChip />
          <p className="lede">
            Every outlet ranks classes a little differently. We average the two biggest — 247Sports&apos;
            Composite and On3/Rivals&apos; Industry ranking — into one index, and show you both, so nobody can
            accuse the number of wearing team colors.
          </p>

          <div style={{ maxWidth: 860, marginTop: 20 }}>
            {DEMO_TEAM_INDEX.map((t) => (
              <div className="rankcard" key={t.rk}>
                <div className="rk-num">{t.rk}</div>
                <div className="logo-box">{t.code}</div>
                <div className="rk-main">
                  <b>{t.team}</b>
                  <span className="rk-rec">2027 CLASS</span>
                  <div className="pills">
                    <span className="pill">{t.commits}</span>
                    <span className="pill">{t.stars}</span>
                    {t.chip && <span className="pill">{t.chip}</span>}
                  </div>
                </div>
                <div className="rk-score">
                  <span className="val">{t.val}</span>
                  <span className="lbl">247 PTS</span>
                </div>
              </div>
            ))}
          </div>

          <p className="eyebrow" style={{ marginTop: 30 }}>The Full Index</p>
          <table style={{ marginTop: 20 }}>
            <thead>
              <tr>
                <th>PATE IDX</th><th>TEAM</th><th>247 COMP</th><th>ON3/RIVALS</th><th>COMMITS</th><th>5★</th>
                <th style={{ textAlign: "right" }}>247 PTS / ON3 SCORE</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_FULL_INDEX.map((r) => (
                <tr key={r.rk}>
                  <td className="rk">{r.rk}</td>
                  <td><b>{r.team}</b></td>
                  <td>{r.c247}</td>
                  <td>{r.on3}</td>
                  <td>{r.commits}</td>
                  <td>{r.stars}</td>
                  <td className="rating">{r.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: 12, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)" }}>
            Pate Index = average of the two service ranks; ties broken by scores. Sources: 247Sports Composite &amp;
            On3/Rivals Industry team rankings.
          </p>

          <div style={{ marginTop: 44 }}>
            <p className="eyebrow">The Pate Player Index — Class of 2027</p>
            <h2 className="display" style={{ fontSize: 34 }}>The Top Players in America</h2>
            <PreseasonChip />
            <p className="lede">
              The nation&apos;s best, per 247Sports&apos; Top247 — pulled live today. On production, On3/Rivals
              industry player ranks merge in nightly to complete the index.
            </p>
            <table style={{ marginTop: 18 }}>
              <thead>
                <tr><th>RK</th><th>PLAYER</th><th>POS</th><th>HT/WT</th><th>HOMETOWN</th><th>COMMITTED</th></tr>
              </thead>
              <tbody>
                {DEMO_PLAYERS.map((p) => (
                  <tr key={p.rk}>
                    <td className="rk">{p.rk}</td>
                    <td><b>{p.name}</b></td>
                    <td>{p.pos}</td>
                    <td>{p.size}</td>
                    <td>{p.hometown}</td>
                    <td>{p.team}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 14, fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-dim)" }}>
              Showing 1–12 · <a href="/#" style={{ color: "var(--lamp-deep)" }}>Top 100 →</a> ·{" "}
              <a href="/#" style={{ color: "var(--lamp-deep)" }}>By Position</a> ·{" "}
              <a href="/#" style={{ color: "var(--lamp-deep)" }}>By State</a>
            </div>
          </div>
        </div>
      </section>

      <section className="on-field">
        <div className="wrap">
          <div className="duo">
            <div>
              <p className="eyebrow">The Wire — What Just Happened</p>
              <h2 className="display" style={{ fontSize: 34 }}>Recruiting News</h2>
              <div style={{ marginTop: 18 }}>
                {DEMO_RECRUITING_NEWS.map((n) => (
                  <div className="news-item" style={{ borderColor: "var(--lamp)" }} key={n.headline}>
                    <b style={{ color: "var(--chalk)" }}>{n.headline}</b>
                    <p>{n.body}</p>
                    <div className="src">{n.src}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel">
              <p className="eyebrow">The Pate Read</p>
              <h3>What It Means, Not Just Who Signed</h3>
              <p>
                Every class graded not by stars alone but by roster fit: what the team needed, what they got, and
                the one signing nobody&apos;s talking about that matters most. Weekly portal tracker in season, with
                Josh&apos;s &quot;keep an eye on this&quot; flags.
              </p>
              <p>
                On the live site this page auto-refreshes each morning: rankings re-scraped, the index recomputed,
                and the wire updated — so the Pate Index is always current without anyone touching it.
              </p>
              <a className="btn" href="/show" style={{ borderColor: "var(--navy)", color: "var(--navy)" }}>
                Watch the Recruiting Breakdown
              </a>
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
          <a className="btn" href="/playoffs" style={{ borderColor: "var(--lamp)", color: "var(--lamp)" }}>
            Open the Playoffs Page →
          </a>
        </div>
      </div>
    </main>
  );
}
