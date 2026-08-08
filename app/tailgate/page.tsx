import type { Metadata } from "next";
import Link from "next/link";
import PreseasonChip from "@/components/PreseasonChip";

export const metadata: Metadata = { title: "Pate Tailgate" };

// --- Preseason-preview sample data ---------------------------------------
// Stands in for the 136-stadium guide index (this week's featured matchup +
// the guide grid). Swap for a real CMS/schedule query when it ships; the
// JSX below only touches this array.

const DEMO_GUIDES = [
  { emoji: "🌭", bg: "linear-gradient(135deg,#BA0C2F 0%,#000000 100%)", name: "Sanford Stadium", meta: "THE FULL GUIDE · BY THE CITIZENS OF THE STATE" },
  { emoji: "🌙", bg: "linear-gradient(135deg,#461D7C 0%,#FDD023 100%)", name: "Tiger Stadium", meta: "LSU · NIGHT GAME SURVIVAL" },
  { emoji: "🥂", bg: "linear-gradient(135deg,#14213D 0%,#CE1126 100%)", name: "The Grove", meta: "OLE MISS · MASTERCLASS" },
  { emoji: "🏟️", bg: "linear-gradient(135deg,#BB0000 0%,#666666 100%)", name: "The Horseshoe", meta: "OHIO STATE · FIRST-TIMER" },
  { emoji: "🦡", bg: "linear-gradient(135deg,#C5050C 0%,#FFFFFF 100%)", name: "Camp Randall", meta: "WISCONSIN · JUMP AROUND" },
  { emoji: "📣", bg: "linear-gradient(135deg,#500000 0%,#FFFFFF 100%)", name: "Kyle Field", meta: "TEXAS A&M · MIDNIGHT YELL" },
  { emoji: "🦆", bg: "linear-gradient(135deg,#154733 0%,#FEE123 100%)", name: "Autzen Stadium", meta: "OREGON · LOUDEST PER CAPITA" },
  { emoji: "⛪", bg: "linear-gradient(135deg,#0C2340 0%,#C99700 100%)", name: "Notre Dame Stadium", meta: "THE PILGRIMAGE PLAN" },
] as const;

export default function TailgatePage() {
  return (
    <main>
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / Pate Tailgate</p>
          <h1>Pate Tailgate</h1>
          <p className="lede">
            136 stadiums. Every tradition, parking lot, and pregame plate — written by citizens who&apos;ve been
            there, verified by the porch.
          </p>
        </div>
      </header>

      <section className="on-field">
        <div className="wrap">
          <p className="eyebrow">Featured This Week</p>
          <h2 className="display" style={{ fontSize: 38 }}>Week 1: Athens, Georgia</h2>
          <PreseasonChip />
          <p className="lede">
            Georgia hosts a top-10 opponent under the lights. The citizens&apos; complete plan: park by 2, Milledge
            Avenue by 3, the Dawg Walk at 5:10, and don&apos;t you dare leave before the fourth-quarter light show.
          </p>
          <div className="guide-grid">
            {DEMO_GUIDES.map((g) => (
              <a className="guide" href="/#" key={g.name}>
                <div className="ph" style={{ background: g.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52 }}>
                  {g.emoji}
                </div>
                <div className="body">
                  <h4>{g.name}</h4>
                  <div className="meta">{g.meta}</div>
                </div>
              </a>
            ))}
          </div>
          <div style={{ marginTop: 24 }}>
            <Link href="/teams" className="btn">All 136 Stadium Guides</Link>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="duo">
            <div className="panel">
              <p className="eyebrow">The Menu</p>
              <h3>The Porch Cookbook</h3>
              <p>
                Smoked wings for a noon kick. Brisket for a 7:30. A different citizen-tested recipe every week of
                the season, with the make-ahead timeline that actually works in a parking lot.
              </p>
              <a className="btn" href="/#" style={{ borderColor: "var(--navy)", color: "var(--navy)" }}>This Week&apos;s Recipe</a>
            </div>
            <div className="panel">
              <p className="eyebrow">The Map</p>
              <h3>Your Stadium Passport</h3>
              <p>
                Pin every stadium you&apos;ve visited. Earn the patches — all 16 SEC barns, every Big Ten trip, the
                service academies. Chase all 136 and get your name on the Travelers&apos; Wall.
              </p>
              <Link href="/ledger" className="btn" style={{ borderColor: "var(--navy)", color: "var(--navy)" }}>Open Your Passport</Link>
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
          <Link href="/playoffs" className="btn" style={{ borderColor: "var(--lamp)", color: "var(--lamp)" }}>
            Open the Playoffs Page →
          </Link>
        </div>
      </div>
    </main>
  );
}
