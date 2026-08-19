import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import PlayerRankBoard from "@/components/PlayerRankBoard";
import { getRecruitingPlayers } from "@/lib/cfbd";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Player Rankings — The Top 100",
  description:
    "The Top 100 recruits in the class, ranked by the 247Sports Composite — filterable by position, with height, weight, hometown, and commitment for every name.",
  alternates: { canonical: "/recruiting/players" },
};

// /recruiting/players — the Player Index's own page (Josh, 2026-08-19:
// player rankings "should ... lead to its own page. And of course be able
// to segment per position"). Real composite data only, never invented.
export default async function PlayerRankingsPage() {
  const index = await getRecruitingPlayers(100).catch(() => null);
  return (
    <main className="v5 pg-recruiting">
      <div className="phead"><div className="wrap">
        <p className="crumb"><Link href="/recruiting">Recruiting</Link> / <b>Player Rankings</b></p>
        <h1>The Player Index{index ? ` — Class of ${index.year}` : ""}</h1>
        <p className="sub">
          The Top 100, ranked by the 247Sports Composite. Filter by position; every commitment links
          the player to the class being built around him.
        </p>
      </div></div>
      <section className="pindex"><div className="wrap">
        {index ? (
          <>
            <PlayerRankBoard players={index.players} />
            <p className="srcline">
              Source: 247Sports Composite player rankings via the live data feed · updated daily.
            </p>
          </>
        ) : (
          <EmptyState
            kicker="PULLED DAILY"
            title="The player board goes live with the data feed"
            body="Player rankings from the 247Sports Composite, pulled from the live data feed — never invented."
            cta={{ href: "/recruiting", label: "Back to Recruiting" }}
          />
        )}
      </div></section>
    </main>
  );
}
