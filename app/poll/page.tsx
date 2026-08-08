import type { Metadata } from "next";
import Link from "next/link";
import PreseasonChip from "@/components/PreseasonChip";

export const metadata: Metadata = { title: "The JP Poll" };

// --- Preseason-preview sample data ---------------------------------------
// Stands in for the ballot-tabulation engine (Top 5 rankcards, the JP-vs-
// consensus comparison tables). Swap for live queries when the engine
// ships; the JSX below only touches these arrays.

const DEMO_TOP5 = [
  { rank: "01", code: "UGA", team: "Georgia", rec: "PRESEASON · SEC", off: 95, def: 97, sos: 8, rating: "96.4", delta: "up", deltaVal: "1" },
  { rank: "02", code: "OSU", team: "Ohio State", rec: "PRESEASON · B1G", off: 98, def: 94, sos: 12, rating: "95.8", delta: "dn", deltaVal: "1" },
  { rank: "03", code: "TEX", team: "Texas", rec: "PRESEASON · SEC", off: 96, def: 92, sos: 5, rating: "94.1", delta: null, deltaVal: null },
  { rank: "04", code: "ORE", team: "Oregon", rec: "PRESEASON · B1G", off: 94, def: 90, sos: 14, rating: "92.7", delta: "up", deltaVal: "2" },
  { rank: "05", code: "PSU", team: "Penn State", rec: "PRESEASON · B1G", off: 91, def: 93, sos: 18, rating: "91.9", delta: null, deltaVal: null },
] as const;

type Delta = { sym: string; cls: "up" | "dn" | null };
const UP = (n: number): Delta => ({ sym: `▲${n}`, cls: "up" });
const DN = (n: number): Delta => ({ sym: `▼${n}`, cls: "dn" });
const SAME: Delta = { sym: "↔", cls: null };

const DEMO_DISAGREE = [
  { rk: "01", team: "Georgia", ap: SAME, coaches: SAME, cfp: SAME, star: false },
  { rk: "02", team: "Ohio State", ap: SAME, coaches: DN(1), cfp: SAME, star: false },
  { rk: "03", team: "Texas", ap: UP(2), coaches: UP(1), cfp: UP(2), star: true },
  { rk: "04", team: "Oregon", ap: DN(1), coaches: SAME, cfp: DN(1), star: false },
  { rk: "05", team: "Penn State", ap: UP(1), coaches: UP(2), cfp: UP(3), star: true },
  { rk: "06", team: "LSU", ap: UP(3), coaches: UP(2), cfp: UP(4), star: true },
  { rk: "07", team: "Clemson", ap: DN(2), coaches: DN(1), cfp: DN(2), star: false },
  { rk: "08", team: "Notre Dame", ap: SAME, coaches: SAME, cfp: UP(1), star: false },
  { rk: "09", team: "Alabama", ap: DN(3), coaches: DN(4), cfp: DN(2), star: true },
  { rk: "10", team: "Miami", ap: UP(2), coaches: UP(1), cfp: SAME, star: false },
  { rk: "11", team: "Indiana", ap: UP(4), coaches: UP(5), cfp: UP(3), star: true },
  { rk: "12", team: "Michigan", ap: DN(1), coaches: SAME, cfp: DN(1), star: false },
] as const;

const DEMO_FOUR_BOARDS = [
  { rk: "01", jp: "Georgia", jpGold: false, cfp: "Georgia", coaches: "Georgia", ap: "Georgia" },
  { rk: "02", jp: "Ohio State", jpGold: false, cfp: "Ohio State", coaches: "Ohio State", ap: "Ohio State" },
  { rk: "03", jp: "Texas", jpGold: true, cfp: "Oregon", coaches: "Oregon", ap: "Oregon" },
  { rk: "04", jp: "Oregon", jpGold: true, cfp: "Texas", coaches: "Texas", ap: "Texas" },
  { rk: "05", jp: "Penn State", jpGold: false, cfp: "Penn State", coaches: "Penn State", ap: "Penn State" },
  { rk: "06", jp: "LSU", jpGold: true, cfp: "Clemson", coaches: "Clemson", ap: "Notre Dame" },
  { rk: "07", jp: "Clemson", jpGold: true, cfp: "Notre Dame", coaches: "LSU", ap: "Clemson" },
  { rk: "08", jp: "Notre Dame", jpGold: false, cfp: "LSU", coaches: "Notre Dame", ap: "LSU" },
  { rk: "09", jp: "Alabama", jpGold: true, cfp: "Miami", coaches: "Alabama", ap: "Miami" },
  { rk: "10", jp: "Miami", jpGold: true, cfp: "Alabama", coaches: "Indiana", ap: "Alabama" },
] as const;

const DEMO_BALLOT_ITEMS = [
  "Your No. 1 team",
  "Most overrated in the AP",
  "Best win of the week",
  "Best atmosphere you attended",
] as const;

export default function PollPage() {
  return (
    <main>
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / The JP Poll</p>
          <h1>The JP Poll</h1>
          <p className="lede">
            The power ranking of the Pate State — the top 25 voted by the people who actually watch, with every
            disagreement against the AP, Coaches, and CFP polls marked in gold.
          </p>
        </div>
      </header>

      <section className="on-soft">
        <div className="wrap">
          <span className="fr">🗳 THE JP POLL</span>
          <p className="eyebrow">This Week&apos;s Board</p>
          <h2 className="display" style={{ fontSize: 38 }}>The Top Five</h2>
          <PreseasonChip />
          <div style={{ maxWidth: 860, marginTop: 16 }}>
            {DEMO_TOP5.map((t) => (
              <div className="rankcard" key={t.rank}>
                <div className="rk-num">{t.rank}</div>
                <div className="logo-box">{t.code}</div>
                <div className="rk-main">
                  <b>{t.team}</b>
                  <span className="rk-rec">{t.rec}</span>
                  <div className="pills">
                    <span className="pill">OFF {t.off}</span>
                    <span className="pill">DEF {t.def}</span>
                    <span className="pill">SOS {t.sos}</span>
                  </div>
                </div>
                <div className="rk-score">
                  <span className="val">{t.rating}</span>
                  {t.delta && (
                    <span className={`dl ${t.delta}`}>{t.delta === "up" ? "▲" : "▼"} {t.deltaVal}</span>
                  )}
                  <span className="lbl">JP RATING</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8 }}><Link className="btn" href="/teams">VIEW ALL 136 →</Link></div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <p className="eyebrow">Week 1 — The JP Top 25 vs. Everybody</p>
          <h2 className="display" style={{ fontSize: 36 }}>Where the Porch Disagrees</h2>
          <PreseasonChip />
          <table style={{ marginTop: 18 }}>
            <thead>
              <tr><th>JP</th><th>TEAM</th><th>VS. AP</th><th>VS. COACHES</th><th>VS. CFP</th><th></th></tr>
            </thead>
            <tbody>
              {DEMO_DISAGREE.map((r) => (
                <tr key={r.rk}>
                  <td className="rk">{r.rk}</td>
                  <td><b>{r.team}</b></td>
                  <td className={r.ap.cls ?? undefined}>{r.ap.sym}</td>
                  <td className={r.coaches.cls ?? undefined}>{r.coaches.sym}</td>
                  <td className={r.cfp.cls ?? undefined}>{r.cfp.sym}</td>
                  <td className={r.star ? "star" : undefined}>{r.star ? "★" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 44 }}>
            <p className="eyebrow">Four Boards, Side by Side</p>
            <h2 className="display" style={{ fontSize: 34 }}>JP Poll vs. CFP vs. Coaches vs. AP</h2>
            <PreseasonChip />
            <p className="lede">
              Same week, four top tens. The gold cells are where the citizens see it differently than everyone else.
            </p>
            <table style={{ marginTop: 16 }}>
              <thead>
                <tr><th>RK</th><th>THE JP POLL</th><th>CFP</th><th>COACHES</th><th>AP</th></tr>
              </thead>
              <tbody>
                {DEMO_FOUR_BOARDS.map((r) => (
                  <tr key={r.rk}>
                    <td className="rk">{r.rk}</td>
                    <td><b style={r.jpGold ? { color: "var(--lamp-deep)" } : undefined}>{r.jp}</b></td>
                    <td>{r.cfp}</td>
                    <td>{r.coaches}</td>
                    <td>{r.ap}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ marginTop: 12, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)" }}>
              GOLD = JP POLL DISAGREES WITH THE CONSENSUS AT THAT SPOT · UPDATED EVERY TUESDAY AFTER THE REVEAL
            </p>
          </div>

          <div className="legend">
            <span><b>▲▼</b> spots higher / lower than that poll</span>
            <span><b>↔</b> same spot</span>
            <span><b>★</b> biggest disagreement of the week</span>
          </div>
          <div style={{ marginTop: 16, fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-dim)" }}>
            Showing 1–12 of 25 · <Link href="/#" style={{ color: "var(--lamp-deep)" }}>See 13–25 →</Link> ·{" "}
            <Link href="/#" style={{ color: "var(--lamp-deep)" }}>All 136 Teams Rated</Link> ·{" "}
            <Link href="/#" style={{ color: "var(--lamp-deep)" }}>Poll Archive</Link>
          </div>
        </div>
      </section>

      <section className="on-soft tight">
        <div className="wrap">
          <div className="duo">
            <div className="art" style={{ height: "100%" }}>
              <span className="kick">THIS WEEK&apos;S COLUMN · TUESDAYS</span>
              <h4 style={{ fontSize: 28 }}>Poll Day, Explained</h4>
              <p style={{ fontSize: 15 }}>
                Why Texas jumped to 3, why the citizens still don&apos;t trust Alabama, and the Indiana argument
                Josh lost to his own audience — the written breakdown of every move on the board.
              </p>
              <span className="meta">JOSH PATE · 7 MIN READ</span>
              <div style={{ marginTop: 14 }}><Link className="btn gold" href="/notebook">Read the Column</Link></div>
            </div>
            <div>
              <p className="eyebrow" style={{ marginBottom: 10 }}>The Reveal · Watch</p>
              <div className="video-slot">
                <span
                  className="tag"
                  style={{ position: "absolute", top: 14, left: 14, fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".12em", background: "var(--lamp)", color: "var(--navy)", padding: "4px 10px", borderRadius: 2 }}
                >
                  POLL DAY SHOW
                </span>
                <button className="playbtn" aria-label="Play the poll reveal" disabled>▶</button>
                <span style={{ position: "absolute", bottom: 14, right: 14, fontFamily: "var(--mono)", fontSize: 12, color: "var(--chalk-dim)" }}>39:12</span>
              </div>
              <p style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)" }}>
                EVERY TUESDAY — THE FULL TOP 25 REVEAL, ARGUED OUT
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="on-dark tight">
        <div className="wrap">
          <div className="panel panel-dark" style={{ maxWidth: 640, margin: "0 auto" }}>
            <p className="eyebrow">Ballots Open Sunday 8PM ET</p>
            <h3>Cast This Week&apos;s Ballot</h3>
            <p>Rank your top 10. See where the State disagrees with the AP — and with Josh.</p>
            {DEMO_BALLOT_ITEMS.map((label) => (
              <div className="vote-row" key={label}>
                <span>{label}</span>
                <button disabled>Vote</button>
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
