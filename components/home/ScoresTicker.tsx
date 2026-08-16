import Link from "next/link";
import Image from "next/image";
import type { SlateGame } from "@/lib/cfbd";
import { DEMO_MODE } from "@/lib/demo";
import { DEMO_WATCHLIST } from "@/lib/scores-demo";
import { slugifyTeam, teamLogoUrl } from "@/lib/teams-meta";

// v5 white scores bar under the masthead. Real slate from CFBD/ESPN; the
// fictional preview watchlist only ever renders in demo mode (§0.1).
export default function ScoresTicker({ games }: { games: SlateGame[] }) {
  const real = games.length >= 3;
  if (!real && !DEMO_MODE) return null;
  const items = real
    ? games.map((g, i) => ({ key: `r${i}`, aCode: g.awayCode, aLogo: g.awayLogo, hCode: g.homeCode, hLogo: g.homeLogo, meta: g.when }))
    : DEMO_WATCHLIST.slice(0, 6).map((g) => ({
        key: g.n, aCode: g.codeA, aLogo: teamLogoUrl(slugifyTeam(g.teamA)),
        hCode: g.codeB, hLogo: teamLogoUrl(slugifyTeam(g.teamB)), meta: g.date,
      }));
  return (
    <div className="scores">
      <div className="wrap">
        <span className="lbl">WK 1 SLATE</span>
        {items.map((g) => (
          <Link className="game" href="/scores" key={g.key}>
            {g.aLogo && <Image src={g.aLogo} alt="" width={18} height={18} />}
            {g.aCode} <span className="at">@</span>
            {g.hLogo && <Image src={g.hLogo} alt="" width={18} height={18} />}
            {g.hCode} <span className="time">{g.meta}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
