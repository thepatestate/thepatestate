import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getTeamDirectory } from "@/lib/cfbd";
import { LAUNCH_TEAMS } from "@/lib/team-data";

export const metadata: Metadata = {
  title: "All 136 Teams",
  description:
    "Every FBS program in The Pate State — deep team hubs for the biggest fanbases, with schedule, roster, portal moves, Josh's receipts, and each team's porch.",
  alternates: { canonical: "/teams" },
};

export const revalidate = 3600;

// Team directory (v2 §4.6): launch hubs are live links; every other FBS
// program is listed (real names from the live directory) and unlocks as its
// hub ships. No fake poll placements — nothing here invents a number.
export default async function TeamsPage() {
  const dir = await getTeamDirectory();
  const all = Object.values(dir).sort((a, b) => a.school.localeCompare(b.school));
  const launched = all.filter((t) => LAUNCH_TEAMS.includes(t.slug));
  const rest = all.filter((t) => !LAUNCH_TEAMS.includes(t.slug));

  return (
    <main>
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / Every Team</p>
          <h1>All 136 Teams</h1>
          <p className="lede">
            One hub per program: the real schedule and roster, portal moves, what Josh has actually said, and the
            team&apos;s own porch. The biggest fanbases are live — the rest unlock as their hubs ship.
          </p>
        </div>
      </header>

      <section>
        <div className="wrap">
          <p className="eyebrow">Live Team Hubs ({launched.length})</p>
          <div className="team-grid">
            {launched.map((t) => (
              <Link className="team-tile" href={`/teams/${t.slug}`} key={t.slug}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <Image src={t.logo} alt="" width={26} height={26} style={{ objectFit: "contain" }} />
                  {t.school}
                </span>
                <span className="m">{t.conference} · OPEN THE HUB →</span>
              </Link>
            ))}
          </div>

          <p className="eyebrow" style={{ marginTop: 34 }}>The Rest of the 136 — Hubs on the Way</p>
          <div className="team-grid">
            {rest.map((t) => (
              <div className="team-tile" key={t.slug} aria-disabled="true" style={{ opacity: 0.65 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <Image src={t.logo} alt="" width={22} height={22} style={{ objectFit: "contain" }} />
                  {t.school}
                </span>
                <span className="m">{t.conference}</span>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 18, fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-dim)" }}>
            Team list via CollegeFootballData · hubs expand conference by conference — want yours next?
            Make noise on <Link href="/community" style={{ color: "var(--lamp-deep)" }}>the Porch</Link>.
          </p>
        </div>
      </section>

      <div className="cta-band">
        <div className="wrap row">
          <div>
            <h3>Follow your teams, get your porch.</h3>
            <p>CITIZENSHIP IS FREE — YOUR PROGRAMS&apos; NEWS, GAMES, AND THREADS, FIRST</p>
          </div>
          <Link className="btn" href="/join" style={{ borderColor: "var(--lamp)", color: "var(--lamp)" }}>
            Become a Citizen — Free
          </Link>
        </div>
      </div>
    </main>
  );
}
