import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCompetition,
  getLeague,
  getLeaderboard,
  compLocked,
  playClient,
} from "@/lib/play";
import { createClient as createServerClient, getCitizen } from "@/lib/supabase/server";
import { removeMember } from "@/app/play/actions";
import { CopyInviteLink } from "@/components/play/LeagueForms";

// Group (league) page — v2 brief §5.2 private groups: members, the invite
// link, commissioner controls (remove pre-lock), and the group board using
// the IDENTICAL leaderboard query as the national one, just filtered to
// members. RLS decides what the viewer can see.

export const metadata: Metadata = { title: "Group — Play", robots: { index: false } };

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const citizen = await getCitizen();
  // Server client for members; anon for public leagues.
  const db = citizen ? await createServerClient() : playClient();
  const found = await getLeague(db, id);
  if (!found) notFound();
  const { league, members } = found;
  const comp = await getCompetition(league.competition_slug);
  if (!comp) notFound();
  const locked = compLocked(comp);

  const me = citizen ? members.find((m) => m.user_id === citizen.id) : null;
  const isCommissioner = me?.role === "commissioner";
  const memberIds = members.map((m) => m.user_id);
  const board = locked && memberIds.length > 0 ? await getLeaderboard(league.competition_slug, { memberIds }) : [];
  const scored = board.some((e) => e.points != null);

  return (
    <main className="v5-lite">
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">
            <Link href={`/play/${comp.slug}`} style={{ color: "inherit" }}>The Pate State / Play / {comp.name}</Link> / Group
          </p>
          <h1>{league.name}</h1>
          {league.description && <p className="lede">{league.description}</p>}
        </div>
      </header>

      <section>
        <div className="wrap" style={{ maxWidth: 860 }}>
          <div className="comp-status">
            <span className="fr fr-field">{league.is_private ? "PRIVATE GROUP" : "PUBLIC GROUP"}</span>
            <span className="comp-count">{members.length} {members.length === 1 ? "MEMBER" : "MEMBERS"}</span>
            <Link href={`/play/${comp.slug}`} className="comp-board-link">The competition →</Link>
          </div>

          {me && !locked && (
            <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <CopyInviteLink code={league.invite_code} />
              <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-dim)" }}>
                CODE: {league.invite_code}
              </span>
            </div>
          )}

          <div style={{ marginTop: 26 }}>
            <p className="eyebrow">Members</p>
            <table style={{ marginTop: 10 }}>
              <thead>
                <tr>
                  <th>CITIZEN</th>
                  <th>ROLE</th>
                  <th>JOINED</th>
                  {isCommissioner && !locked && <th></th>}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.user_id}>
                    <td><b>{m.citizens?.display_handle ?? "citizen"}</b></td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                      {m.role === "commissioner" ? "COMMISSIONER" : "MEMBER"}
                    </td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                      {new Date(m.joined_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}
                    </td>
                    {isCommissioner && !locked && (
                      <td style={{ textAlign: "right" }}>
                        {m.user_id !== citizen?.id && (
                          <form
                            action={async () => {
                              "use server";
                              await removeMember(league.id, m.user_id);
                            }}
                          >
                            <button type="submit" className="link-danger">remove</button>
                          </form>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 30 }}>
            <p className="eyebrow">Group Board</p>
            {locked ? (
              board.length > 0 ? (
                <table style={{ marginTop: 10 }}>
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
                          {scored ? (e.points ?? 0) : "✓"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="play-note">Nobody in this group locked in an entry.</p>
              )
            ) : (
              <p className="play-note">
                Sealed until lock — every member&apos;s picks (and the group board) open the moment the
                competition locks. Same scoring as the national board.
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
