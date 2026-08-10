import type { Metadata } from "next";
import Link from "next/link";
import PreseasonChip from "@/components/PreseasonChip";

export const metadata: Metadata = { title: "The Season Ledger" };

// --- Preseason-preview sample data ---------------------------------------
// Stands in for a citizen's real logged-game history (career totals + the
// recent-entries strip). Swap for a live per-user query once citizenship
// and the log-a-game engine ship; the JSX below only touches this array.

const DEMO_STATS = [
  { num: "214", lbl: "Games Logged" },
  { num: "17", lbl: "Stadiums Visited" },
  { num: "★4.1", lbl: "Avg Rating This Season" },
] as const;

const DEMO_ENTRIES = [
  { g: "Georgia 31, Bama 28", stars: "★★★★★", note: '"Watched on the porch with Dad. Instant classic."' },
  { g: "Oregon 45, UW 42", stars: "★★★★☆", note: '"Stayed up till 2am ET. Worth it."' },
  { g: "Army 17, Navy 14", stars: "★★★★★", note: '"Attended. Bucket list, checked."' },
  { g: "Vandy 24, UT 21", stars: "★★★☆☆", note: '"Chaos. Beautiful chaos."' },
] as const;

export default function LedgerPage() {
  return (
    <main>
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / The Season Ledger</p>
          <h1>The Season Ledger</h1>
          <p className="lede">
            Log every game you watch. Rate it. Say your piece. Build a lifetime record of your Saturdays — and pin
            every stadium you&apos;ve set foot in.
          </p>
        </div>
      </header>

      <section>
        <div className="wrap">
          <PreseasonChip />
          <div className="record">
            {DEMO_STATS.map((s) => (
              <div className="stat" key={s.lbl}>
                <div className="num">{s.num}</div>
                <div className="lbl">{s.lbl}</div>
              </div>
            ))}
          </div>
          <p className="eyebrow">Your Recent Entries</p>
          <div className="log-strip">
            {DEMO_ENTRIES.map((e) => (
              <div className="log-card" key={e.g}>
                <div className="g">{e.g}</div>
                <div className="stars">{e.stars}</div>
                <p>{e.note}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="btn solid" disabled>Log a Game</button>
            <Link href="/tailgate" className="btn">Open Your Stadium Passport</Link>
          </div>
        </div>
      </section>

      <section className="on-soft tight">
        <div className="wrap">
          <p className="eyebrow">Coming This Season</p>
          <h2 className="display" style={{ fontSize: 32 }}>Year-End Wrapped, For Football</h2>
          <p className="lede">
            Every December: your season in review — hours watched, best game you saw, stadiums pinned, and how
            your ratings compared to the State&apos;s. Made to share.
          </p>
        </div>
      </section>

      <div className="cta-band">
        <div className="wrap row">
          <div>
            <h3>Who&apos;s In? See the Playoff Picture.</h3>
            <p>THE BRACKET, THE RANKINGS, JOSH&apos;S PICKS — AND AN AI TO RUN YOUR OWN</p>
          </div>
          <Link href="/playoffs" className="btn" style={{ borderColor: "var(--lamp)", color: "var(--lamp)" }}>
            Open the Playoffs Page →
          </Link>
        </div>
      </div>
    </main>
  );
}
