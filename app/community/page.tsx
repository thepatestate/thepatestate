import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getBoards, getThreads } from "@/lib/community";
import { teamLogoUrl } from "@/lib/teams-meta";
import ThreadCard from "@/components/community/ThreadCard";
import EmptyState from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "The Porch — Community",
  description:
    "The Pate State's community boards: the national Front Porch, recruiting and portal talk, game threads, the Film Room, and a porch for every fanbase.",
  alternates: { canonical: "/community" },
};

// Community home (§3.1/§3.2): board directory + "Latest on the Porch".
// Dynamic (cookies) so staff see held threads inline.
export default async function CommunityPage() {
  const db = await createClient();
  const [boards, latest] = await Promise.all([getBoards(db), getThreads(db, { limit: 20 })]);
  const national = boards.filter((b) => b.kind !== "team");
  const teams = boards.filter((b) => b.kind === "team");
  const boardName = (slug: string) => boards.find((b) => b.slug === slug)?.name ?? slug;

  return (
    <main>
      <div className="board-bar">
        <div className="wrap">
          <p className="kicker">The Front Porch · The Pate State</p>
          <h1>Latest on the Porch</h1>
          <p className="sub">
            Argue in good faith, keep receipts, and don&apos;t pretend you have sources you don&apos;t have.
            Citizenship is free — that&apos;s the only ticket in.
          </p>
        </div>
      </div>

      <div className="porch-page">
        <div className="wrap">
          <p className="eyebrow" style={{ marginTop: 26 }}>The Boards</p>
          <div className="board-grid">
            {national.map((b) => (
              <Link key={b.slug} href={`/community/${b.slug}`} className="board-tile">
                <b>{b.name}</b>
                <p>{b.description}</p>
              </Link>
            ))}
          </div>

          <p className="eyebrow" style={{ marginTop: 26 }}>Team Porches</p>
          <div className="board-grid">
            {teams.map((b) => {
              const logo = b.team_slug ? teamLogoUrl(b.team_slug) : null;
              return (
                <Link key={b.slug} href={`/community/${b.slug}`} className="board-tile">
                  <b>
                    {logo && <Image src={logo} alt="" width={22} height={22} style={{ objectFit: "contain" }} />}
                    {b.name}
                  </b>
                  <p>{b.description}</p>
                </Link>
              );
            })}
          </div>
          <p style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--ink-dim)" }}>
            More team porches open as their fanbases show up — every FBS program eventually gets one.
          </p>

          <p className="eyebrow" style={{ marginTop: 30 }}>Fresh Threads</p>
          {latest.length === 0 ? (
            <div style={{ marginTop: 14, maxWidth: 720 }}>
              <EmptyState
                kicker="THE PORCH IS OPEN"
                title="Somebody has to say the first word"
                body="Pick a board above and start the first thread — the porch remembers its founders."
              />
            </div>
          ) : (
            <div className="thread-list">
              {latest.map((t) => (
                <ThreadCard thread={t} key={t.id} showBoard={boardName(t.board_slug)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="board-foot">
        <Link href="/community">View All Threads →</Link>
      </div>
    </main>
  );
}
