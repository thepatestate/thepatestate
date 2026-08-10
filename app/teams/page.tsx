import type { Metadata } from "next";
import Link from "next/link";
import PreseasonChip from "@/components/PreseasonChip";
import { DEMO_MODE } from "@/lib/demo";

export const metadata: Metadata = {
  title: "All 136 Teams",
  description: "Every FBS program gets a page — poll history, Josh's picks record, recruiting, and the tailgate guide, one team at a time.",
  alternates: { canonical: "/teams" },
};

// --- Preseason-preview sample data ---------------------------------------
// Stands in for the full 136-team directory. Georgia is the only team page
// built so far (the template every other program's page will generalize
// from); the rest are dead tiles until they're generated. Swap this array
// for a live team-index query when the rest of the 136 ship.

const DEMO_TEAMS = [
  { name: "Georgia", note: "JP POLL: NO. 1 · The template page →", href: "/teams/georgia" },
  { name: "Ohio State", note: "JP POLL: NO. 2", href: null },
  { name: "Texas", note: "JP POLL: NO. 3", href: null },
  { name: "Oregon", note: "JP POLL: NO. 4", href: null },
  { name: "Penn State", note: "JP POLL: NO. 5", href: null },
  { name: "LSU", note: "JP POLL: NO. 6", href: null },
  { name: "Clemson", note: "JP POLL: NO. 7", href: null },
  { name: "Notre Dame", note: "JP POLL: NO. 8", href: null },
  { name: "Alabama", note: "JP POLL: NO. 9", href: null },
  { name: "Miami", note: "JP POLL: NO. 10", href: null },
  { name: "Indiana", note: "JP POLL: NO. 11", href: null },
  { name: "Michigan", note: "JP POLL: NO. 12", href: null },
] as const;

export default function TeamsPage() {
  return (
    <main>
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / Every Team</p>
          <h1>All 136 Teams</h1>
          <p className="lede">
            One page per program: its JP Poll history, Josh&apos;s picks record against it, its tailgate guide, and
            its recruiting class — the whole story in one place.
          </p>
          {DEMO_MODE && <PreseasonChip />}
        </div>
      </header>

      <section>
        <div className="wrap">
          <p className="eyebrow">Browse the State</p>
          <div className="team-grid">
            {DEMO_TEAMS.filter((t) => DEMO_MODE || t.href).map((t) =>
              t.href ? (
                <Link className="team-tile" href={t.href} key={t.name}>
                  {t.name}
                  <span className="m">{t.note}</span>
                </Link>
              ) : (
                <div className="team-tile" key={t.name} aria-disabled="true" style={{ opacity: 0.7 }}>
                  {t.name}
                  <span className="m">{t.note}</span>
                </div>
              )
            )}
          </div>
          <p style={{ marginTop: 18, fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-dim)" }}>
            {DEMO_MODE
              ? "Showing 12 of 136 · every FBS program gets a page"
              : "Team hubs roll out starting with the most active fanbases — every FBS program gets a page."}
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
