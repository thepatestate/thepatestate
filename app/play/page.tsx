import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Play — Games & Competitions",
  description:
    "The Pate State games hub: Porch Pick'Em, the Citizens' Bracket Challenge, and the competitions arriving through the season.",
  alternates: { canonical: "/play" },
  // Thin hub until the competition engine ships (v2 brief §4.6 indexing
  // standard applies to incomplete surfaces) — lift this when games are live.
  robots: { index: false },
};

// /play — the games hub (v2 brief §5). Every card is honest about its
// status: two products have real pages today; the rest carry their §5
// roadmap order, no fake standings anywhere. All competitions share one
// identity system — citizenship.

const LIVE = [
  {
    title: "Porch Pick'Em",
    href: "/pickem",
    tag: "OPENS WEEK 1",
    body: "Ten games a week against Josh and the whole State — straight up or against the spread, streaks and patches, one big season leaderboard. Season champ watches a game with Josh.",
    cta: "See the prizes →",
  },
  {
    title: "The Citizens' Bracket Challenge",
    href: "/playoffs",
    tag: "TWO WINDOWS",
    body: "Call the 12-team field in August, then prove it again when the real bracket drops in December. Both scores count. The champion watches the title game with Josh.",
    cta: "How it works →",
  },
] as const;

const COMING = [
  { title: "Playoff Team Draft", body: "Draft the playoff field with your crew — snake draft, live draft room, AI personas to fill empty seats." },
  { title: "Saturday Slate Fantasy", body: "A fresh draft every week from the weekend's featured games. No season-long commitment, all season-long bragging." },
  { title: "Beat Pate", body: "Make Josh's exact weekly slate of picks, head-to-head. Records tracked all year, receipts kept." },
  { title: "Saturday Survivor", body: "One team a week. Must win. No reuse. Last citizen standing." },
] as const;

export default function PlayPage() {
  return (
    <main>
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / Play</p>
          <h1>Play</h1>
          <p className="lede">
            Free games, real prizes, one citizenship. Everything here runs on the same account, the same
            leaderboards, the same reputation — and none of it costs a dime.
          </p>
        </div>
      </header>

      <section>
        <div className="wrap">
          <p className="eyebrow">Open Now</p>
          <div className="duo" style={{ marginTop: 12 }}>
            {LIVE.map((g) => (
              <div className="panel panel-accent-field" key={g.title}>
                <span className="fr fr-field">{g.tag}</span>
                <h3>{g.title}</h3>
                <p>{g.body}</p>
                <Link className="btn" href={g.href}>{g.cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="on-soft">
        <div className="wrap">
          <p className="eyebrow">On the Way — In This Order</p>
          <h2 className="display" style={{ fontSize: 32 }}>The Competition Roadmap</h2>
          <div className="feat-grid" style={{ marginTop: 18 }}>
            {COMING.map((g, i) => (
              <div className="panel" key={g.title}>
                <p className="eyebrow">NO. {i + 1}</p>
                <h3>{g.title}</h3>
                <p>{g.body}</p>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 16, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)" }}>
            FREE TO PLAY · NO PAID ENTRY, EVER · NO REAL-MONEY WAGERING
          </p>
        </div>
      </section>

      <div className="cta-band">
        <div className="wrap row">
          <div>
            <h3>One citizenship. Every game.</h3>
            <p>JOIN FREE AND YOU&apos;RE IN FROM GAME ONE — PICKS, BRACKETS, AND EVERYTHING THAT FOLLOWS</p>
          </div>
          <Link className="btn" href="/join" style={{ borderColor: "var(--lamp)", color: "var(--lamp)" }}>
            Become a Citizen — Free
          </Link>
        </div>
      </div>
    </main>
  );
}
