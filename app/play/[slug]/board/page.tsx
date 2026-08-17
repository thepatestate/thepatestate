import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  getCompetition,
  getEntryCount,
  getLeaderboard,
  getMyLeagues,
  getPickemConsensus,
  getBracketConsensus,
  compLocked,
} from "@/lib/play";
import { getTeamDirectory } from "@/lib/cfbd";
import { createClient as createServerClient, getCitizen } from "@/lib/supabase/server";
import EmptyState from "@/components/EmptyState";

// Competition leaderboard + citizen consensus (v2 brief §5.2). Entries are
// RLS-hidden until lock, so pre-lock this page shows the honest state: how
// many are in, when boards go live. Post-lock: the national board and the
// consensus read straight from real entries — never invented.

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const comp = await getCompetition(slug);
  return {
    title: comp ? `${comp.name} — Leaderboard` : "Leaderboard",
    alternates: { canonical: `/play/${slug}/board` },
    robots: { index: false },
  };
}

export default async function BoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const comp = await getCompetition(slug);
  if (!comp) notFound();
  const locked = compLocked(comp);

  const citizen = await getCitizen();
  const db = citizen ? await createServerClient() : null;
  const [entryCount, board, myLeagues] = await Promise.all([
    getEntryCount(slug),
    locked ? getLeaderboard(slug, { limit: 100 }) : [],
    citizen && db ? getMyLeagues(db, citizen.id, slug) : [],
  ]);
  const pickemConsensus = locked && comp.type === "pickem" ? await getPickemConsensus(slug) : null;
  const bracketConsensus = locked && comp.type === "bracket" ? await getBracketConsensus(slug) : null;
  const dir = comp.type === "bracket" && locked ? await getTeamDirectory() : {};

  const scored = board.some((e) => e.points != null);

  return (
    <main className="v5-lite">
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">
            <Link href={`/play/${slug}`} style={{ color: "inherit" }}>The Pate State / Play / {comp.name}</Link> / Leaderboard
          </p>
          <h1>The Board</h1>
          <p className="lede">{comp.name} — national standings and the citizen consensus.</p>
        </div>
      </header>

      <section>
        <div className="wrap" style={{ maxWidth: 860 }}>
          {myLeagues.length > 0 && (
            <p className="play-note" style={{ marginBottom: 14 }}>
              Your groups:{" "}
              {myLeagues.map((l, i) => (
                <span key={l.id}>
                  {i > 0 && " · "}
                  <Link href={`/play/groups/${l.id}`}>{l.name}</Link>
                </span>
              ))}
            </p>
          )}

          {!locked ? (
            <EmptyState
              kicker={`${entryCount} ${entryCount === 1 ? "ENTRY" : "ENTRIES"} AND COUNTING`}
              title="Boards go live at lock"
              body="Every entry stays sealed until picks lock — then the full national board, every group board, and the citizen consensus all open at once. Nobody sees your picks early, and nobody edits after."
              cta={{ href: `/play/${slug}`, label: locked ? "View the competition →" : "Make your picks →" }}
            />
          ) : (
            <>
              <p className="eyebrow">National Board</p>
              <h2 className="display" style={{ fontSize: 30 }}>
                {scored ? "Standings" : "The Field — Scoring Begins With Results"}
              </h2>
              <table style={{ marginTop: 14 }}>
                <thead>
                  <tr>
                    <th>RK</th>
                    <th>CITIZEN</th>
                    <th style={{ textAlign: "right" }}>{scored ? "PTS" : "ENTERED"}</th>
                  </tr>
                </thead>
                <tbody>
                  {board.map((e, i) => (
                    <tr key={e.id}>
                      <td className="rk">{String(i + 1).padStart(2, "0")}</td>
                      <td><b>{e.display_name}</b></td>
                      <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}>
                        {scored
                          ? (e.points ?? 0)
                          : new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {board.length === 0 && <p className="play-note">No entries made it in before lock.</p>}
            </>
          )}

          {pickemConsensus && (
            <div style={{ marginTop: 34 }}>
              <p className="eyebrow">The Citizen Consensus</p>
              <h2 className="display" style={{ fontSize: 26 }}>How the State Picked</h2>
              {(comp.config.games ?? []).map((g) => {
                const c = pickemConsensus.byGame[g.id];
                const total = c ? c.away + c.home : 0;
                const awayPct = total > 0 ? Math.round((c!.away / total) * 100) : 0;
                return (
                  <div className="cons-row" key={g.id}>
                    <span className="cons-team">
                      <Image src={g.awayLogo} alt="" width={20} height={20} style={{ objectFit: "contain" }} /> {g.awayAbbrev}
                    </span>
                    <span className="cons-bar">
                      <span className="cons-fill" style={{ width: `${awayPct}%` }} />
                    </span>
                    <span className="cons-team">
                      <Image src={g.homeLogo} alt="" width={20} height={20} style={{ objectFit: "contain" }} /> {g.homeAbbrev}
                    </span>
                    <span className="cons-pct">{awayPct}% / {100 - awayPct}%</span>
                  </div>
                );
              })}
            </div>
          )}

          {bracketConsensus && bracketConsensus.entries > 0 && (
            <div style={{ marginTop: 34 }}>
              <p className="eyebrow">The Citizen Consensus</p>
              <h2 className="display" style={{ fontSize: 26 }}>The State&apos;s Field</h2>
              <div className="duo" style={{ marginTop: 14 }}>
                <div>
                  <p className="eyebrow" style={{ marginBottom: 6 }}>Most-Picked Field Teams</p>
                  {bracketConsensus.field.map((t) => (
                    <div className="cons-row" key={t.slug}>
                      <span className="cons-team">{dir[t.slug]?.school ?? t.slug}</span>
                      <span className="cons-bar"><span className="cons-fill" style={{ width: `${t.pct}%` }} /></span>
                      <span className="cons-pct">{t.pct}%</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="eyebrow" style={{ marginBottom: 6 }}>Champion Picks</p>
                  {bracketConsensus.champions.map((t) => (
                    <div className="cons-row" key={t.slug}>
                      <span className="cons-team">{dir[t.slug]?.school ?? t.slug}</span>
                      <span className="cons-bar"><span className="cons-fill" style={{ width: `${t.pct}%` }} /></span>
                      <span className="cons-pct">{t.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
