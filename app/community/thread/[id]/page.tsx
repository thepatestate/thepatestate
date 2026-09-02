import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, getCitizen } from "@/lib/supabase/server";
import { getBoards, getThread, getPosts, getUpvotes, getMutedIds, THREAD_TYPE_LABELS } from "@/lib/community";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { toggleUpvote, staffThreadAction, staffPostAction, muteUser } from "@/app/community/actions";
import ReplyForm from "@/components/community/ReplyForm";
import ReportBox from "@/components/community/ReportBox";
import RelTime from "@/components/RelTime";
import { AvatarDisc } from "@/components/community/ThreadCard";

// Thread pages start noindex (v2 §8 indexing policy — quality thresholds
// come later; nothing thin gets indexed meanwhile).
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const db = await createClient();
  const thread = await getThread(db, id).catch(() => null);
  return {
    title: thread ? `${thread.title} — The Quad` : "The Quad",
    robots: { index: false },
  };
}

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await createClient();
  const [thread, citizen, boards] = await Promise.all([getThread(db, id), getCitizen(), getBoards(db)]);
  if (!thread) notFound();
  const board = boards.find((b) => b.slug === thread.board_slug);
  const posts = await getPosts(db, id);
  const muted = citizen ? await getMutedIds(db) : new Set<string>();
  const { counts: postVotes, mine: myPostVotes } = await getUpvotes(db, "post", posts.map((p) => p.id), citizen?.id);
  const { counts: threadVotes, mine: myThreadVotes } = await getUpvotes(db, "thread", [id], citizen?.id);
  const isStaff = citizen?.role === "staff";

  // Best-effort view counter (service role; users can't update threads).
  if (isAdminConfigured) {
    createAdminClient()
      .from("threads")
      .update({ view_count: thread.view_count + 1 })
      .eq("id", id)
      .then(() => {}, () => {});
  }

  const author = thread.citizens?.display_handle ?? thread.author_label ?? "The Quad Desk";
  const authorStaff = thread.citizens?.role === "staff" || !thread.citizens;

  return (
    <main className="v5-lite">
      <div className={board?.kind === "team" ? "board-bar team" : "board-bar"}>
        <div className="wrap">
          <p className="kicker">
            The Pate State · <Link href={`/community/${thread.board_slug}`} style={{ color: "var(--lamp)" }}>{board?.name ?? thread.board_slug}</Link>
          </p>
          <h1 style={{ fontSize: "clamp(24px,3.4vw,38px)" }}>
            {thread.title}
          </h1>
          <p className="sub" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="tflag" style={{ background: "rgba(255,255,255,.1)", borderColor: "rgba(255,255,255,.2)", color: "var(--chalk)" }}>
              {THREAD_TYPE_LABELS[thread.thread_type] ?? thread.thread_type}
            </span>
            {thread.locked && <span className="tflag lock">Locked</span>}
            {thread.hidden && <span className="tflag lock">Hidden — under review</span>}
            <b style={{ color: "#fff" }}>{author}</b>
            <span>started <RelTime iso={thread.created_at} /></span>
            <span>· 💬 {thread.reply_count} · 👁 {thread.view_count.toLocaleString("en-US")}</span>
          </p>
        </div>
      </div>

      <div className="quad-page">
        <div className="wrap" style={{ maxWidth: 880 }}>
          <div className="post-card" style={{ marginTop: 20 }}>
            <div className="post-head">
              <AvatarDisc handle={author} staff={authorStaff} />
              <b>{author}</b>
              {authorStaff && <span className="tflag pin">Staff</span>}
              <span><RelTime iso={thread.created_at} /></span>
            </div>
            {thread.body && <div className="post-body">{thread.body}</div>}
            {thread.source_url && (
              <p style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 12 }}>
                Source:{" "}
                <a href={thread.source_url} target="_blank" rel="noopener nofollow" style={{ color: "var(--lamp-deep)" }}>
                  {new URL(thread.source_url).hostname.replace(/^www\./, "")}
                </a>
              </p>
            )}
            <div className="post-tools">
              <form action={toggleUpvote.bind(null, "thread", thread.id, thread.id)}>
                <button className={myThreadVotes.has(thread.id) ? "upvote-btn on" : "upvote-btn"} type="submit">
                  ▲ {threadVotes[thread.id] ?? 0}
                </button>
              </form>
              {citizen && <ReportBox targetType="thread" targetId={thread.id} />}
            </div>
            {isStaff && (
              <div className="staff-tools">
                <form action={staffThreadAction.bind(null, thread.id, thread.pinned ? "unpin" : "pin")}><button>{thread.pinned ? "Unpin" : "Pin"}</button></form>
                <form action={staffThreadAction.bind(null, thread.id, thread.locked ? "unlock" : "lock")}><button>{thread.locked ? "Unlock" : "Lock"}</button></form>
                <form action={staffThreadAction.bind(null, thread.id, thread.hidden ? "unhide" : "hide")}><button>{thread.hidden ? "Unhide" : "Hide"}</button></form>
              </div>
            )}
          </div>

          {posts.map((p) => {
            const pAuthor = p.citizens?.display_handle ?? "citizen";
            const pStaff = p.citizens?.role === "staff";
            if (muted.has(p.author_id)) {
              return (
                <div className="post-card" key={p.id} style={{ opacity: 0.6 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-dim)" }}>
                    Reply from a citizen you&apos;ve muted.
                  </span>
                </div>
              );
            }
            const quoted = p.quoted_post_id ? posts.find((q) => q.id === p.quoted_post_id) : null;
            return (
              <div className={p.hidden ? "post-card hidden-row" : "post-card"} key={p.id}>
                <div className="post-head">
                  <AvatarDisc handle={pAuthor} staff={pStaff} />
                  <b>{pAuthor}</b>
                  {pStaff && <span className="tflag pin">Staff</span>}
                  <span><RelTime iso={p.created_at} /></span>
                  {p.edited_at && <span style={{ fontSize: 11 }}>(edited)</span>}
                  {p.hidden && <span className="tflag lock">Hidden — under review</span>}
                </div>
                {quoted && (
                  <div className="post-quote" style={{ marginTop: 10 }}>
                    <b>{quoted.citizens?.display_handle ?? "citizen"}:</b> {quoted.body.slice(0, 240)}
                    {quoted.body.length > 240 ? "…" : ""}
                  </div>
                )}
                <div className="post-body">{p.body}</div>
                <div className="post-tools">
                  <form action={toggleUpvote.bind(null, "post", p.id, thread.id)}>
                    <button className={myPostVotes.has(p.id) ? "upvote-btn on" : "upvote-btn"} type="submit">
                      ▲ {postVotes[p.id] ?? 0}
                    </button>
                  </form>
                  {citizen && <ReportBox targetType="post" targetId={p.id} />}
                  {citizen && citizen.id !== p.author_id && (
                    <form action={muteUser.bind(null, p.author_id, thread.id)}>
                      <button className="tool-link" type="submit">Mute</button>
                    </form>
                  )}
                  {isStaff && (
                    <form action={staffPostAction.bind(null, p.id, thread.id, p.hidden ? "unhide" : "hide")}>
                      <button className="tool-link" type="submit">{p.hidden ? "Unhide" : "Hide"}</button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}

          {citizen ? (
            thread.locked ? (
              <p style={{ marginTop: 18, fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-dim)" }}>
                This thread is locked — no new replies.
              </p>
            ) : (
              <ReplyForm threadId={thread.id} />
            )
          ) : (
            <div className="composer" style={{ textAlign: "center" }}>
              <p style={{ fontSize: 15 }}>
                <b>Meet me on the Quad.</b> Citizenship is free and it&apos;s the only ticket into the conversation.
              </p>
              <Link className="btn gold" href={`/join?next=/community/thread/${thread.id}`} style={{ marginTop: 10, display: "inline-block" }}>
                Become a Citizen — Free
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="board-foot">
        <Link href={`/community/${thread.board_slug}`}>View All Threads →</Link>
      </div>
    </main>
  );
}
