import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import PreseasonChip from "@/components/PreseasonChip";
import { DEMO_MODE } from "@/lib/demo";
import { teamLogoUrl } from "@/lib/teams-meta";

export const metadata: Metadata = {
  title: "Pate Tailgate",
  description: "The field guide to college football Saturdays — stadium guides, tailgate plans, traditions, and the tailgate cookbook.",
  alternates: { canonical: "/tailgate" },
};

// --- Preseason-preview sample data ---------------------------------------
// Stands in for the 136-stadium guide index (this week's featured matchup +
// the guide grid). Swap for a real CMS/schedule query when it ships; the
// JSX below only touches this array.

type TailgateGuide = { emoji: string; bg: string; name: string; meta: string; photo: string | null; alt: string | null; team: string | null };

// The four stadiums below don't have location-specific tailgate photography
// yet (see the LSU/Ole Miss/Ohio State/Wisconsin rows, which do). Rather
// than stand them in with a color-gradient-plus-emoji swatch, each uses the
// real studio helmet photo for its team (all four are in
// lib/teams-meta's HELMET_SLUGS) via the `team` field below, which also
// unlocks the small logo team-chip badge every other card already gets.
const DEMO_GUIDES: readonly TailgateGuide[] = [
  { emoji: "🌭", bg: "linear-gradient(135deg,#BA0C2F 0%,#000000 100%)", name: "Sanford Stadium", meta: "THE FULL GUIDE · BY THE CITIZENS OF THE STATE", photo: "/img/helmets/georgia.jpg", alt: "Georgia helmet studio photo", team: "georgia" },
  { emoji: "🌙", bg: "linear-gradient(135deg,#461D7C 0%,#FDD023 100%)", name: "Tiger Stadium", meta: "LSU · NIGHT GAME SURVIVAL", photo: "/img/tailgate-night.jpg", alt: "LSU fans in purple and gold packing Tiger Stadium's night tailgate lot", team: "lsu" },
  { emoji: "🥂", bg: "linear-gradient(135deg,#14213D 0%,#CE1126 100%)", name: "The Grove", meta: "OLE MISS · MASTERCLASS", photo: "/img/tailgate-grove.jpg", alt: "Ole Miss fans tailgating under the oaks of The Grove", team: "ole-miss" },
  { emoji: "🏟️", bg: "linear-gradient(135deg,#BB0000 0%,#666666 100%)", name: "The Horseshoe", meta: "OHIO STATE · FIRST-TIMER", photo: "/img/tailgate-horseshoe.jpg", alt: "Ohio State fans packing The Horseshoe for kickoff", team: "ohio-state" },
  { emoji: "🦡", bg: "linear-gradient(135deg,#C5050C 0%,#FFFFFF 100%)", name: "Camp Randall", meta: "WISCONSIN · JUMP AROUND", photo: "/img/tailgate-jump.jpg", alt: "Wisconsin fans jumping around at Camp Randall", team: "wisconsin" },
  { emoji: "📣", bg: "linear-gradient(135deg,#500000 0%,#FFFFFF 100%)", name: "Kyle Field", meta: "TEXAS A&M · MIDNIGHT YELL", photo: "/img/helmets/texas-am.jpg", alt: "Texas A&M helmet studio photo", team: "texas-am" },
  { emoji: "🦆", bg: "linear-gradient(135deg,#154733 0%,#FEE123 100%)", name: "Autzen Stadium", meta: "OREGON · LOUDEST PER CAPITA", photo: "/img/helmets/oregon.jpg", alt: "Oregon helmet studio photo", team: "oregon" },
  { emoji: "⛪", bg: "linear-gradient(135deg,#0C2340 0%,#C99700 100%)", name: "Notre Dame Stadium", meta: "THE PILGRIMAGE PLAN", photo: "/img/helmets/notre-dame.jpg", alt: "Notre Dame helmet studio photo", team: "notre-dame" },
];

export default function TailgatePage() {
  return (
    <main className="v5-lite">
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / Pate Tailgate</p>
          <h1>Pate Tailgate</h1>
          <p className="lede">
            136 stadiums. Every tradition, parking lot, and pregame plate — written by citizens who&apos;ve been
            there, verified by the Quad.
          </p>
        </div>
      </header>

      <section className="on-soft">
        <div className="wrap">
          {DEMO_MODE ? (
            <>
              <p className="eyebrow">Featured This Week</p>
              <h2 className="display" style={{ fontSize: 38 }}>Week 1: Athens, Georgia</h2>
              <PreseasonChip />
              <p className="lede">
                Georgia hosts a top-10 opponent under the lights. The citizens&apos; complete plan: park by 2, Milledge
                Avenue by 3, the Dawg Walk at 5:10, and don&apos;t you dare leave before the fourth-quarter light show.
              </p>
            </>
          ) : (
            <>
              <p className="eyebrow">The Field Guide</p>
              <h2 className="display" style={{ fontSize: 38 }}>The Great American Tailgate</h2>
              <p className="lede">
                Where to park, where to eat, what time to arrive, which traditions you can&apos;t miss — a featured
                stadium guide every week of the season, written by the people who actually go.
              </p>
            </>
          )}
          <div className="guide-grid">
            {DEMO_GUIDES.map((g) => {
              const badgeUrl = g.team ? teamLogoUrl(g.team) : null;
              return (
                <div className="guide" key={g.name}>
                  <div className="ph" style={g.photo ? undefined : { background: g.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52 }}>
                    {g.photo ? (
                      <Image src={g.photo} alt={g.alt ?? g.name} fill sizes="(max-width: 900px) 50vw, 280px" style={{ objectFit: "cover" }} />
                    ) : (
                      g.emoji
                    )}
                    {badgeUrl && (
                      <span className="team-chip">
                        <Image src={badgeUrl} alt={`${g.name} team logo`} width={26} height={26} style={{ objectFit: "contain" }} />
                      </span>
                    )}
                  </div>
                  <div className="body">
                    <h4>{g.name}</h4>
                    <div className="meta">{g.meta}</div>
                  </div>
                </div>
              );
            })}
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
              <h3>The Tailgate Cookbook</h3>
              <p>
                Smoked wings for a noon kick. Brisket for a 7:30. A different citizen-tested recipe every week of
                the season, with the make-ahead timeline that actually works in a parking lot.
              </p>
              <p style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".08em", color: "var(--ink-dim)" }}>RECIPES DROP WEEKLY IN SEASON</p>
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
