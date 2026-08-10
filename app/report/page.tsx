import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import PreseasonChip from "@/components/PreseasonChip";

export const metadata: Metadata = {
  title: "The Pate Report — The Preseason Annual",
  description: "The annual preseason magazine: the Top 40 ranked and explained, the playoff picture, and the season's X-factors.",
  alternates: { canonical: "/report" },
};

// --- Preseason-preview sample data ---------------------------------------
// Stands in for the annual Pate Report magazine listing (table of contents,
// sample spreads). Swap for a live product/CMS query when the 2026 edition
// actually ships. Note: the wireframe's cover art (pate-report-cover.svg)
// doesn't exist as an asset anywhere in wireframes/ or public/ — unlike
// citizen-gift-cover.png, which is real and used elsewhere via next/image —
// so the cover renders as an editorial photo (goalpost, navy overlay) with
// the report's own title text standing in as a dignified "cover," same
// treatment as the matching tile on /shop.

const DEMO_TOC = [
  { label: "The Top 40, ranked and X-rayed — roster, schedule, ceiling, floor", page: "P. 12" },
  { label: "The JP Poll preseason board — all 136 teams ranked", page: "P. 96" },
  { label: "The 10 games that will decide the playoff", page: "P. 118" },
  { label: "Portal winners & losers — the honest audit", page: "P. 134" },
  { label: "Coordinator changes nobody's pricing in", page: "P. 152" },
  { label: "Every conference, bottom to top, with win projections", page: "P. 168" },
] as const;

const DEMO_SPREADS = [
  { title: "No. 1: Georgia, X-Rayed", meta: "8-PAGE TEAM CAPSULE", photo: "/img/helmets/georgia.jpg", alt: "Georgia helmet studio photo" },
  { title: "The 10 Games That Decide It", meta: "FOLD-OUT SCHEDULE MAP", photo: "/img/matchup-helmets.jpg", alt: "Blank navy and gold helmets facing off before kickoff" },
  { title: "All 136, One Page Each", meta: "THE JP POLL PRESEASON BOARD", photo: "/img/cfb-typewriter.jpg", alt: "A sportswriter's desk, typewriter mid-page" },
] as const;

export default function ReportPage() {
  return (
    <main>
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / The Pate Report</p>
          <h1>The Pate Report</h1>
          <p className="lede">
            The annual preseason bible — a Top 40 magazine that goes a level beyond anything on the newsstand.
            Print and digital, every July.
          </p>
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="mag">
            <div>
              <div className="cover-img" style={{ aspectRatio: "3 / 4", position: "relative", overflow: "hidden" }}>
                <Image
                  src="/img/editorial-goalpost.jpg"
                  alt="A goalpost silhouetted in fog against the sunrise"
                  fill
                  sizes="(max-width: 860px) 100vw, 360px"
                  style={{ objectFit: "cover" }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(150deg,rgba(15,27,45,.78) 0%,rgba(26,46,71,.58) 55%,rgba(30,59,46,.72) 100%)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    padding: 24,
                    fontFamily: "var(--mono)",
                    fontSize: 12,
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                    color: "var(--chalk)",
                  }}
                >
                  The Pate Report 2026 — Smith · Manning · Carr
                </div>
              </div>
            </div>
            <div>
              <p className="eyebrow">Inside the 2026 Edition</p>
              <h2 className="display" style={{ fontSize: 36 }}>
                Smith. Manning. Carr.<br />The Faces of the Fall.
              </h2>
              <PreseasonChip />
              <p className="lede" style={{ marginBottom: 16 }}>
                The cover tells you the story: the best receiver of his generation in Columbus, the most famous
                name in the sport in Austin, and the quarterback in South Bend everyone&apos;s picking for the
                Heisman. Inside, all 40 contenders get the X-ray.
              </p>
              {DEMO_TOC.map((t) => (
                <div className="toc-row" key={t.label}>
                  <span>{t.label}</span>
                  <span className="pg">{t.page}</span>
                </div>
              ))}
              <div style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link className="btn solid" href="/shop">Pre-Order Print — $24.99</Link>
                <button className="btn" disabled>Digital Edition — $14.99</button>
              </div>
              <p style={{ marginTop: 16, fontSize: 14, color: "var(--ink-dim)" }}>
                Print ships every July. The digital edition is free for every citizen — join the Playbook and it
                lands in your inbox.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <p className="eyebrow">Inside the Pages</p>
          <h2 className="display" style={{ fontSize: 34 }}>Sample Spreads</h2>
          <PreseasonChip />
          <div className="guide-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
            {DEMO_SPREADS.map((s) => (
              <Link className="guide on-light-guide" href="/#" key={s.title}>
                <div className="ph" style={{ position: "relative" }}>
                  <Image src={s.photo} alt={s.alt} fill sizes="(max-width: 900px) 33vw, 280px" style={{ objectFit: "cover" }} />
                </div>
                <div className="body">
                  <h4>{s.title}</h4>
                  <div className="meta">{s.meta}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="on-soft tight">
        <div className="wrap">
          <p className="eyebrow">Beyond the Newsstand</p>
          <h2 className="display" style={{ fontSize: 32 }}>The Next Level Past Phil Steele</h2>
          <p className="lede">
            Same obsessive depth, none of the eye-chart. Every number explained, every projection accountable —
            graded publicly against results in December, because the porch keeps receipts.
          </p>
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
