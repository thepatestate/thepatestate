import Image from "next/image";
import type { BGame, BRound } from "@/lib/bracket-rounds";
import { slugifyTeam, teamLogoUrl } from "@/lib/teams-meta";

// The two-sided playoff bracket (styles: app/globals.css .tourney7). Shared
// by the rankings page, the playoffs page, and the Play bracket builder so
// every bracket on the site is the same bracket.

function BracketHelmet({ team }: { team: string }) {
  if (team === "TBD") return null;
  const logo = teamLogoUrl(slugifyTeam(team));
  if (!logo) return null;
  return (
    <span className="bracket-helmet" style={{ background: "#fff" }}>
      <Image src={logo} alt="" width={56} height={56} style={{ objectFit: "contain", padding: 4 }} />
    </span>
  );
}

function GameBox({ g }: { g: BGame }) {
  return (
    <div className="game">
      <div className={g.winA ? "tm w" : "tm"}><span className="sd">{g.seedA}</span><BracketHelmet team={g.teamA} />{g.teamA}</div>
      <div className={g.winB ? "tm w" : "tm"}><span className="sd">{g.seedB}</span><BracketHelmet team={g.teamB} />{g.teamB}</div>
      <div className="tag2">{g.tag}</div>
    </div>
  );
}

export default function TourneyBracket({
  rounds, champTitle, champName,
}: { rounds: readonly BRound[]; champTitle: string; champName: string }) {
  return (
    <div className="tourney-wrap">
      <div className="tourney7">
        {rounds.map((r, i) => (
          <div className={r.center ? "round center" : "round"} key={`${r.title}-${i}`}>
            <h5>{r.title}</h5>
            {r.games.map((g, gi) => <GameBox g={g} key={gi} />)}
            {r.center && (
              <div className="champ">
                <div className="t">{champTitle}</div>
                <div className="n">{champName || "—"}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
