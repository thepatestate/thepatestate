import Image from "next/image";
import Link from "next/link";
import { DEMO_WATCHLIST } from "@/lib/scores-demo";
import { slugifyTeam, teamLogoUrl, helmetUrl } from "@/lib/teams-meta";

// Small helmet/logo mark for the slate strip's ~22px team icons. Falls back
// to a plain three-letter code chip for any team without generated helmet
// art or a mapped ESPN logo yet (see lib/teams-meta).
function TeamMark({ team, code }: { team: string; code: string }) {
  const slug = slugifyTeam(team);
  const src = helmetUrl(slug) ?? teamLogoUrl(slug);
  if (!src) return <span className="slate-code">{code}</span>;
  return (
    <span className="slate-hel">
      <Image src={src} alt={`${team} helmet`} width={22} height={22} style={{ objectFit: "cover" }} priority />
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
            <TeamMark team={g.teamA} code={g.codeA} />
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
