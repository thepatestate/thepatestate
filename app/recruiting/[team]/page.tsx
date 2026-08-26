import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecruitingRankings, getRecruitingPlayers, getTeamDirectory, type RecruitPlayer } from "@/lib/cfbd";
import { teamLogoUrl } from "@/lib/teams-meta";

export const revalidate = 3600;

// Team recruiting page (Josh, 2026-08-26): click a team on the class board
// and see its class rank plus every ranked commit in ranking order. Data is
// the 247Sports Composite via CFBD — the same feed as the boards, never
// invented. (The Composite already blends 247, On3, Rivals and ESPN; a
// separate On3 feed would need a data license.)

export async function generateMetadata({ params }: { params: Promise<{ team: string }> }): Promise<Metadata> {
  const { team } = await params;
  const dir = await getTeamDirectory().catch(() => ({}) as Awaited<ReturnType<typeof getTeamDirectory>>);
  const school = dir[team]?.school ?? team.replace(/-/g, " ");
  return {
    title: `${school} Recruiting — Class Rank and Every Commit`,
    description: `${school}'s recruiting class: national class rank, composite points, and every ranked commit in order.`,
    alternates: { canonical: `/recruiting/${team}` },
  };
}

function height(inches: number | null): string {
  if (!inches) return "—";
  return `${Math.floor(inches / 12)}-${inches % 12}`;
}

export default async function TeamRecruitingPage({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params;
  const [dir, board, index] = await Promise.all([
    getTeamDirectory().catch(() => ({}) as Awaited<ReturnType<typeof getTeamDirectory>>),
    getRecruitingRankings().catch(() => null),
    // Every ranked player in the cycle — the team's commits are filtered
    // out of the national index so the numbers match the Top 100 page.
    getRecruitingPlayers(10000).catch(() => null),
  ]);
  const info = dir[team];
  if (!info) notFound();

  const rank = board?.ranks.find((r) => r.slug === team) ?? null;
  const commits: RecruitPlayer[] = (index?.players ?? [])
    .filter((p) => p.committedSlug === team)
    .sort((a, b) => a.ranking - b.ranking);
  const year = index?.year ?? board?.year ?? null;
  const logo = info.logo ?? teamLogoUrl(team);
  const avgStars = commits.length ? (commits.reduce((s, p) => s + p.stars, 0) / commits.length).toFixed(2) : null;
  const blueChips = commits.filter((p) => p.stars >= 4).length;

  return (
    <main className="v5 pg-recruiting">
      <div className="phead">
        <div className="wrap">
          <div className="crumb">
            <Link href="/">The Pate State</Link> / <Link href="/recruiting">Recruiting</Link> / <b>{info.school}</b>
          </div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {logo && <Image src={logo} alt="" width={44} height={44} style={{ objectFit: "contain" }} />}
            {info.school} Recruiting{year ? ` · Class of ${year}` : ""}
          </h1>
          <p className="sub">
            {rank
              ? `No. ${rank.rank} nationally in the ${board?.year} class rankings with ${rank.points.toFixed(2)} composite points`
              : "Not yet ranked in the national class rankings"}
            {info.conference ? ` · ${info.conference}` : ""}
            {commits.length ? ` · ${commits.length} ranked commit${commits.length === 1 ? "" : "s"}` : ""}
            {avgStars ? ` · ${avgStars} average stars` : ""}
            {blueChips ? ` · ${blueChips} four- and five-stars` : ""}
          </p>
        </div>
      </div>

      <section className="fullrank" id="commits">
        <div className="wrap">
          <p className="fh2">Every Ranked Commit, in Ranking Order</p>
          {commits.length > 0 ? (
            <table className="rank-table">
              <thead>
                <tr>
                  <th>NAT</th><th>Player</th><th>POS</th><th>Stars</th><th style={{ textAlign: "right" }}>Rating</th><th>HT / WT</th><th>Hometown</th><th>High School</th>
                </tr>
              </thead>
              <tbody>
                {commits.map((p) => (
                  <tr key={`${p.ranking}-${p.name}`}>
                    <td className="rk">{String(p.ranking).padStart(3, "0")}</td>
                    <td><span className="tcell">{p.name}</span></td>
                    <td className="conf">{p.position}</td>
                    <td className="conf">{"★".repeat(Math.max(0, Math.min(5, p.stars)))}</td>
                    <td className="pts">{p.rating ? p.rating.toFixed(4) : "—"}</td>
                    <td className="conf">{height(p.heightIn)}{p.weightLb ? ` / ${p.weightLb}` : ""}</td>
                    <td className="conf">{[p.city, p.state].filter(Boolean).join(", ") || "—"}</td>
                    <td className="conf">{p.highSchool || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="srcline">
              No ranked commits in the {year ?? "current"} cycle yet on the composite index. Commitments land on the Wire first.
            </p>
          )}
          <p className="srcline">
            Source: 247Sports Composite player and team rankings via the live data feed. The Composite is the industry
            blend of 247Sports, On3, Rivals and ESPN evaluations.{" "}
            <Link href="/recruiting#full-top-25">Back to the full class board →</Link>
            {" · "}
            <Link href={`/teams/${team}`}>{info.school} team page →</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
