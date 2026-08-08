import type { Metadata } from "next";
import PreseasonChip from "@/components/PreseasonChip";

export const metadata: Metadata = { title: "Porch Pick'Em" };

// --- Preseason-preview sample data ---------------------------------------
// Stands in for the picks engine (leaderboard) and the pundit-tracker feed.
// Swap for live queries when each engine ships; the JSX below only touches
// these arrays. The prize ladder further down is Josh's actual plan copy,
// not sample data, so it stays un-chipped.

const DEMO_LEADERBOARD = [
  { rank: "1.", name: "SicEmSaturdays", pts: "1,842 PTS", streak: "W14" },
  { rank: "2.", name: "PorchSwingProphet", pts: "1,791 PTS", streak: "W11" },
  { rank: "3.", name: "Josh Pate", pts: "1,764 PTS", streak: "W9" },
  { rank: "4.", name: "GroveGoblin", pts: "1,733 PTS", streak: null },
  { rank: "5.", name: "ChalkEater88", pts: "1,700 PTS", streak: null },
  { rank: "6.", name: "HailStateHattie", pts: "1,688 PTS", streak: null },
  { rank: "7.", name: "DesertSwarm", pts: "1,671 PTS", streak: null },
  { rank: "8.", name: "BuckeyeBev", pts: "1,660 PTS", streak: null },
  { rank: "9.", name: "UpsetUncle", pts: "1,655 PTS", streak: null },
  { rank: "10.", name: "FourthAndForever", pts: "1,649 PTS", streak: null },
] as const;

const DEMO_PRIZES = [
  { tier: "Weekly", title: "Merch + a shoutout on the show", body: "Best score of the week gets State Store gear and your handle read on Monday's episode." },
  { tier: "Monthly", title: "Signed Pate Report + Poll spotlight", body: "Top citizen each month gets a signed annual and their ballot featured on Poll Day." },
  { tier: "Top 10", title: "Game tickets", body: "Finish the season top 10 and pick a game — we cover the tickets." },
  { tier: "Champion", title: "Watch a game with Josh", body: "The season champ gets a seat next to Josh for a Saturday — plus their name on the Wall of Champions, forever." },
] as const;

const DEMO_PUNDITS = [
  { rk: 1, initials: "JP", name: "Josh Pate", aff: "THE PATE STATE", rec: "71–43", pct: "62.3%", josh: true },
  { rk: 2, initials: "CF", name: 'Chris "The Bear" Fallica', aff: "FOX · BIG NOON", rec: "69–45", pct: "60.5%", josh: false },
  { rk: 3, initials: "JK", name: "Joel Klatt", aff: "FOX", rec: "66–48", pct: "57.9%", josh: false },
  { rk: 4, initials: "KH", name: "Kirk Herbstreit", aff: "ESPN · GAMEDAY", rec: "65–49", pct: "57.0%", josh: false },
  { rk: 5, initials: "NS", name: "Nick Saban", aff: "ESPN · GAMEDAY", rec: "64–50", pct: "56.1%", josh: false },
  { rk: 6, initials: "BQ", name: "Brady Quinn", aff: "FOX · BIG NOON", rec: "62–52", pct: "54.4%", josh: false },
  { rk: 7, initials: "DH", name: "Desmond Howard", aff: "ESPN · GAMEDAY", rec: "61–53", pct: "53.5%", josh: false },
  { rk: 8, initials: "RD", name: "Rece Davis", aff: "ESPN · GAMEDAY", rec: "60–54", pct: "52.6%", josh: false },
  { rk: 9, initials: "UM", name: "Urban Meyer", aff: "FOX · BIG NOON", rec: "59–55", pct: "51.8%", josh: false },
  { rk: 10, initials: "TT", name: "Tim Tebow", aff: "ESPN · GAMEDAY", rec: "58–56", pct: "50.9%", josh: false },
  { rk: 11, initials: "ML", name: "Matt Leinart", aff: "FOX · BIG NOON", rec: "57–57", pct: "50.0%", josh: false },
  { rk: 12, initials: "PM", name: "Pat McAfee", aff: "ESPN · GAMEDAY", rec: "56–58", pct: "49.1%", josh: false },
  { rk: 13, initials: "GM", name: "Greg McElroy", aff: "ESPN · SEC NETWORK", rec: "56–58", pct: "49.1%", josh: false },
  { rk: 14, initials: "DK", name: 'Dan "Big Cat" Katz', aff: "BARSTOOL", rec: "55–59", pct: "48.2%", josh: false },
  { rk: 15, initials: "DKn", name: "Danny Kanell", aff: "CBS SPORTS", rec: "55–59", pct: "48.2%", josh: false },
  { rk: 16, initials: "MI", name: "Mark Ingram II", aff: "FOX · BIG NOON", rec: "54–60", pct: "47.4%", josh: false },
  { rk: 17, initials: "PF", name: "Paul Finebaum", aff: "ESPN · SEC NETWORK", rec: "53–61", pct: "46.5%", josh: false },
  { rk: 18, initials: "TL", name: "Taylor Lewan", aff: "BUSSIN' WITH THE BOYS", rec: "52–62", pct: "45.6%", josh: false },
  { rk: 19, initials: "WC", name: "Will Compton", aff: "BUSSIN' WITH THE BOYS", rec: "51–63", pct: "44.7%", josh: false },
  { rk: 20, initials: "DP", name: "Dave Portnoy", aff: "BARSTOOL", rec: "50–64", pct: "43.9%", josh: false },
] as const;

function Pundit({ p }: { p: (typeof DEMO_PUNDITS)[number] }) {
  return (
    <div className={p.josh ? "pundit josh" : "pundit"}>
      <div className="prk">{p.rk}</div>
      <div className="avatar">{p.initials}</div>
      <div className="who"><b>{p.name}</b><span className="aff">{p.aff}</span></div>
      <div className="rec">{p.rec}<span className="pct">{p.pct}</span></div>
    </div>
  );
}

export default function PickemPage() {
  return (
    <main>
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / Porch Pick&apos;Em</p>
          <h1>Porch Pick&apos;Em</h1>
          <p className="lede">Ten games a week against Josh and 48,000 citizens. Free forever. The prizes are real.</p>
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="duo">
            <div>
              <p className="eyebrow">How It Works</p>
              <h2 className="display" style={{ fontSize: 34 }}>Pick. Streak. Climb.</h2>
              <PreseasonChip />
              <p className="lede">
                Every Thursday the board drops — ten games, straight up or against the spread. Points for wins,
                bonuses for streaks and upsets, small-group leagues for your crew, and one big season leaderboard
                for the whole State.
              </p>
              <div style={{ marginTop: 22 }}>
                {DEMO_LEADERBOARD.map((row) => (
                  <div className="lb-row" key={row.rank}>
                    <span>{row.rank} {row.name}</span>
                    <span className="streak">{row.pts}{row.streak ? ` · 🔥 ${row.streak}` : ""}</span>
                  </div>
                ))}
                <div className="lb-row" style={{ background: "var(--field-lt)", borderRadius: 4, paddingLeft: 10, paddingRight: 10 }}>
                  <span><b>212. You</b></span>
                  <span className="streak"><b>1,214 PTS</b></span>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <a href="/#" style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--lamp-deep)", letterSpacing: ".06em" }}>
                  SEE THE FULL RANKINGS — ALL 48,112 CITIZENS →
                </a>
              </div>
              <div style={{ marginTop: 20, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <button className="btn solid" disabled>Make This Week&apos;s Picks</button>
                <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-dim)" }}>
                  YOUR SEASON: <b style={{ color: "var(--field)" }}>44–28 · 61.1% CORRECT</b>
                </span>
              </div>
            </div>
            <div>
              <p className="eyebrow">The Prize Ladder</p>
              <h2 className="display" style={{ fontSize: 34 }}>Win the Porch</h2>
              <div style={{ marginTop: 10 }}>
                {DEMO_PRIZES.map((p) => (
                  <div className="prize-row" key={p.tier}>
                    <div className="tier">{p.tier}</div>
                    <div className="what"><b>{p.title}</b><p>{p.body}</p></div>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 16, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)" }}>
                FREE TO PLAY · NO PURCHASE NECESSARY · PARTNER/SPONSOR SLOT LIVES HERE
              </p>
              <p style={{ marginTop: 10, fontSize: 14 }}>
                Want a second trophy chase?{" "}
                <a href="/playoffs" style={{ color: "var(--lamp-deep)", fontWeight: 600 }}>The Citizens&apos; Bracket Challenge →</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="on-soft">
        <div className="wrap">
          <p className="eyebrow">The Other Leaderboard</p>
          <h2 className="display" style={{ fontSize: 38 }}>Josh vs. The Pros</h2>
          <PreseasonChip />
          <p className="lede">
            Up top it&apos;s Josh against the citizens. Down here it&apos;s Josh against the pros — twenty of the
            biggest names on your TV, GameDay to FOX to Barstool to CBS — season records against the spread,
            tracked all year, receipts kept.
          </p>
          <div className="duo" style={{ marginTop: 26 }}>
            <div className="wire" style={{ padding: 22 }}>
              {DEMO_PUNDITS.slice(0, 7).map((p) => <Pundit p={p} key={p.rk} />)}
            </div>
            <div className="wire" style={{ padding: 22 }}>
              {DEMO_PUNDITS.slice(7).map((p) => <Pundit p={p} key={p.rk} />)}
            </div>
          </div>
          <p style={{ marginTop: 16, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)" }}>
            SEASON ATS · UPDATED EVERY SUNDAY NIGHT · SHARE GRAPHIC AUTO-GENERATES AFTER WEEK 6
          </p>
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
