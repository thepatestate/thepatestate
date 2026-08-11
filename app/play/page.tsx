import type { Metadata } from "next";
import Link from "next/link";
import { getCompetitions, getEntryCount, compLocked } from "@/lib/play";

export const metadata: Metadata = {
  title: "Play — Games & Competitions",
  description:
    "The Pate State games hub: Week 1 Pick'Em, the Playoff Challenge, and the competitions arriving through the season. Free forever.",
  alternates: { canonical: "/play" },
  // Thin hub until more of the roadmap ships (v2 brief §4.6 indexing
  // standard) — lift this once several competitions have run.
  robots: { index: false },
};

// /play — the games hub (v2 brief §5). Live cards come from the
// competition engine (competitions are rows, not code); the roadmap block
// carries the §5 build order honestly — no fake standings anywhere.

const TYPE_BLURBS: Record<string, string> = {
  pickem:
    "Ten marquee games, straight up, weighted by how sure you are — confidence 1 to 10, each used once. One lock, receipts forever.",
  bracket:
    "Call the 12-team field, seed it, crown your champion. +10 for every team that makes the real field, +25 per exact seed, +100 if your champ wins it all.",
};

const COMING = [
  { title: "Playoff Team Draft", body: "Draft the playoff field with your crew — snake draft, live draft room, AI personas to fill empty seats." },
  { title: "Saturday Slate Fantasy", body: "A fresh draft every week from the weekend's featured games. No season-long commitment, all season-long bragging." },
  { title: "Beat Pate", body: "Make Josh's exact weekly slate of picks, head-to-head. Records tracked all year, receipts kept." },
  { title: "Saturday Survivor", body: "One team a week. Must win. No reuse. Last citizen standing." },
] as const;

function lockLabel(iso: string): string {
  const d = new Date(iso);
  const day = d
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" })
    .replace(/,/g, "")
    .toUpperCase();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  return `${day} · ${time} ET`;
}

export default async function PlayPage() {
  const comps = await getCompetitions();
  const counts = await Promise.all(comps.map((c) => getEntryCount(c.slug)));

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
          <p className="eyebrow">Open Now — Enter Before Kickoff</p>
          <div className="duo" style={{ marginTop: 12 }}>
            {comps.map((c, i) => {
              const locked = compLocked(c);
              return (
                <div className="panel panel-accent-field" key={c.slug}>
                  <span className="fr fr-field">
                    {locked ? "LOCKED" : `LOCKS ${lockLabel(c.locks_at)}`}
                  </span>
                  <h3>{c.name}</h3>
                  <p>{TYPE_BLURBS[c.type] ?? ""}</p>
                  <p className="comp-count" style={{ margin: "0 0 14px" }}>
                    {counts[i]} {counts[i] === 1 ? "ENTRY" : "ENTRIES"} SO FAR
                  </p>
                  <Link className="btn" href={`/play/${c.slug}`}>
                    {locked ? "See the Board →" : "Make Your Picks →"}
                  </Link>
                </div>
              );
            })}
          </div>
          {comps.length === 0 && (
            <p className="note">Between competitions — the next one opens with the coming week.</p>
          )}
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
