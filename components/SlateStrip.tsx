import Link from "next/link";
import { DEMO_WATCHLIST } from "@/lib/scores-demo";
import { getSlateGames } from "@/lib/cfbd";
import { slugifyTeam, teamLogoUrl } from "@/lib/teams-meta";
import TeamMark from "@/components/TeamMark";

// Homepage-only Week 1 strip, directly under the nav and above the hero.
// Prefers the REAL Week 1 slate from CollegeFootballData (marquee power-4
// matchups, kickoff order) with real broadcast abbreviations from the team
// directory — the old initials-based codes produced garbled matchups like
// "NC @ T" (v2 brief §8). Team marks are official logos per §1.4, not
// helmets. Falls back to the shared DEMO_WATCHLIST games when the API is
// unconfigured or down.
export default async function SlateStrip() {
  const real = await getSlateGames(1, 5).catch(() => []);
  const items =
    real.length >= 3
      ? real.map((g, i) => ({
          key: `r${i}`, teamA: g.away, codeA: g.awayCode, logoA: g.awayLogo, teamB: g.home, codeB: g.homeCode, logoB: g.homeLogo,
          meta: `${g.when}${g.net ? ` · ${g.net}` : ""}`,
        }))
      : DEMO_WATCHLIST.slice(0, 5).map((g) => ({
          key: g.n, teamA: g.teamA, codeA: g.codeA, logoA: teamLogoUrl(slugifyTeam(g.teamA)), teamB: g.teamB, codeB: g.codeB, logoB: teamLogoUrl(slugifyTeam(g.teamB)),
          meta: `${g.date} · ${g.tv}`,
        }));
  return (
    <div className="slate-strip">
      <div className="slate-strip-inner">
        <span className="slate-tag">{real.length >= 3 ? "WK 1 SLATE" : "WK 1 PREVIEW"}</span>
        {items.map((g) => (
          <Link href="/scores" className="slate-item" key={g.key}>
            <TeamMark name={g.teamA} logo={g.logoA} abbrev={g.codeA} size={22} tile />
            <span className="slate-names">{g.codeA}</span>
            <span className="slate-at">@</span>
            <TeamMark name={g.teamB} logo={g.logoB} abbrev={g.codeB} size={22} tile />
            <span className="slate-names">{g.codeB}</span>
            <span className="slate-meta">{g.meta}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
