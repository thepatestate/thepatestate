import Image from "next/image";
import Link from "next/link";
import { DEMO_WATCHLIST } from "@/lib/scores-demo";
import { getSlateGames } from "@/lib/cfbd";
import { slugifyTeam, teamLogoUrl, helmetLightUrl } from "@/lib/teams-meta";

// Small helmet/logo mark for the slate strip's ~22px team icons. Uses the
// light (cream-background) helmet set on a cream chip — no dark navy disc
// behind it — per the client's color-rebalance pass. Every helmet in that
// set faces right, so the away/left-side helmet in a matchup is mirrored
// with scaleX(-1) to face back toward its opponent; the home/right-side
// helmet is left as-is. Falls back to a plain three-letter code chip for
// any team without generated helmet art or a mapped ESPN logo yet.
function TeamMark({ team, code, flip }: { team: string; code: string; flip?: boolean }) {
  const slug = slugifyTeam(team);
  const src = helmetLightUrl(slug) ?? teamLogoUrl(slug);
  if (!src) return <span className="slate-code">{code}</span>;
  return (
    <span className="slate-hel">
      <Image
        src={src}
        alt={`${team} helmet`}
        width={22}
        height={22}
        style={{ objectFit: "cover", transform: flip ? "scaleX(-1)" : undefined }}
        priority
      />
    </span>
  );
}

// Homepage-only Week 1 strip, directly under the nav and above the hero.
// Prefers the REAL Week 1 slate from CollegeFootballData (marquee power-4
// matchups, kickoff order); falls back to the shared DEMO_WATCHLIST games
// when the API is unconfigured or down.
export default async function SlateStrip() {
  const real = await getSlateGames(1, 5).catch(() => []);
  const items =
    real.length >= 3
      ? real.map((g, i) => ({
          key: `r${i}`, teamA: g.away, codeA: g.awayCode, teamB: g.home, codeB: g.homeCode,
          meta: `${g.when}${g.net ? ` · ${g.net}` : ""}`,
        }))
      : DEMO_WATCHLIST.slice(0, 5).map((g) => ({
          key: g.n, teamA: g.teamA, codeA: g.codeA, teamB: g.teamB, codeB: g.codeB,
          meta: `${g.date} · ${g.tv}`,
        }));
  return (
    <div className="slate-strip">
      <div className="slate-strip-inner">
        <span className="slate-tag">{real.length >= 3 ? "WK 1 SLATE" : "WK 1 PREVIEW"}</span>
        {items.map((g) => (
          <Link href="/scores" className="slate-item" key={g.key}>
            <TeamMark team={g.teamA} code={g.codeA} flip />
            <span className="slate-at">@</span>
            <TeamMark team={g.teamB} code={g.codeB} />
            <span className="slate-names">
              {g.codeA} @ {g.codeB}
            </span>
            <span className="slate-meta">{g.meta}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
