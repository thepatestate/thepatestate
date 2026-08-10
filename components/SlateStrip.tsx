import Image from "next/image";
import Link from "next/link";
import { DEMO_WATCHLIST } from "@/lib/scores-demo";
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

// Homepage-only Week 1 preview strip, directly under the nav and above the
// hero. Reuses the same DEMO_WATCHLIST games /scores builds its Watch List
// from (see lib/scores-demo) rather than a copy-pasted game list — the
// first five, in order.
export default function SlateStrip() {
  const games = DEMO_WATCHLIST.slice(0, 5);
  return (
    <div className="slate-strip">
      <div className="slate-strip-inner">
        <span className="slate-tag">WK 1 PREVIEW</span>
        {games.map((g) => (
          <Link href="/scores" className="slate-item" key={g.n}>
            <TeamMark team={g.teamA} code={g.codeA} flip />
            <span className="slate-at">@</span>
            <TeamMark team={g.teamB} code={g.codeB} />
            <span className="slate-names">
              {g.codeA} @ {g.codeB}
            </span>
            <span className="slate-meta">
              {g.date} · {g.tv}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
