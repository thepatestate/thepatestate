import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient, getCitizen } from "@/lib/supabase/server";
import { getBoards, getThreads } from "@/lib/community";
import { teamLogoUrl } from "@/lib/teams-meta";
import ThreadCard from "@/components/community/ThreadCard";
import NewThreadForm from "@/components/community/NewThreadForm";
import GateCard from "@/components/GateCard";
import { teamHubHref, LAUNCH_TEAMS } from "@/lib/launch-teams";
import EmptyState from "@/components/EmptyState";

export async function generateMetadata({ params }: { params: Promise<{ board: string }> }): Promise<Metadata> {
  const { board } = await params;
  const boards = await getBoards();
  const b = boards.find((x) => x.slug === board);
  if (!b) return { title: "The Porch" };
  return {
    title: `${b.name} — The Porch`,
    description: b.description,
    alternates: { canonical: `/community/${b.slug}` },
  };
}

export default async function BoardPage({ params }: { params: Promise<{ board: string }> }) {
  const { board } = await params;
  const db = await createClient();
  const [boards, citizen] = await Promise.all([getBoards(db), getCitizen()]);
  const b = boards.find((x) => x.slug === board);
  if (!b) notFound();
  const threads = await getThreads(db, { board, limit: 50 });
  const logo = b.team_slug ? teamLogoUrl(b.team_slug) : null;

  return (
    <main>
      <div className={b.kind === "team" ? "board-bar team" : "board-bar"}>
        <div className="wrap">
          <p className="kicker">The Front Porch · The Pate State</p>
          <h1 style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {logo && (
              <span style={{ background: "#fff", borderRadius: "50%", padding: 5, display: "inline-flex" }}>
                <Image src={logo} alt="" width={38} height={38} style={{ objectFit: "contain" }} />
              </span>
            )}
            {b.name}
          </h1>
          <p className="sub">{b.description}</p>
          {b.team_slug && LAUNCH_TEAMS.includes(b.team_slug) && (
            <p style={{ marginTop: 10 }}>
              <Link href={teamHubHref(b.team_slug)} style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--lamp)", textDecoration: "none" }}>
                Open the team hub →
              </Link>
            </p>
          )}
        </div>
      </div>

      <div className="porch-page">
        <div className="wrap">
          <p style={{ marginTop: 20 }}>
            <Link href="/community" style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--lamp-deep)", textDecoration: "none" }}>
              ← All boards
            </Link>
          </p>

          {citizen ? (
            <NewThreadForm board={b.slug} isStaff={citizen.role === "staff"} />
          ) : (
            <div style={{ marginTop: 18 }}>
              <GateCard next={`/community/${b.slug}`} />
            </div>
          )}

          {threads.length === 0 ? (
            <div style={{ marginTop: 18, maxWidth: 720 }}>
              <EmptyState
                kicker="FIRST CHAIR IS OPEN"
                title={`Nobody's said a word on ${b.name} yet`}
                body="Start the first thread — a take, a question, a prediction. The porch remembers its founders."
              />
            </div>
          ) : (
            <div className="thread-list">
              {threads.map((t) => (
                <ThreadCard thread={t} key={t.id} />
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
