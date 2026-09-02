import Link from "next/link";
import RelTime from "@/components/RelTime";
import type { ThreadSummary } from "@/lib/community";

// §3.1 thread row: dominant extra-bold title, author row with avatar
// initials, right-aligned engagement counts, hot-thread accent border,
// live relative timestamps.

export function AvatarDisc({ handle, staff }: { handle: string; staff?: boolean }) {
  const initials = handle
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2) || handle.slice(0, 2);
  return <span className={staff ? "pavatar staff" : "pavatar"}>{initials}</span>;
}

export default function ThreadCard({ thread, showBoard }: { thread: ThreadSummary; showBoard?: string }) {
  const author = thread.citizens?.display_handle ?? thread.author_label ?? "The Quad Desk";
  const staff = thread.citizens?.role === "staff" || !thread.citizens;
  const hot = thread.reply_count >= 5 || (thread.last_reply_at !== null && Date.now() - new Date(thread.last_reply_at).getTime() < 3600_000);
  const cls = ["thread-card", hot ? "hot" : "", thread.hidden ? "hidden-row" : ""].filter(Boolean).join(" ");

  return (
    <Link href={`/community/thread/${thread.id}`} className={cls}>
      <AvatarDisc handle={author} staff={staff} />
      <div className="thread-main">
        <span className="thread-title">
          <span className="thread-flags">
            {thread.pinned && <span className="tflag pin">Pinned</span>}
            {thread.locked && <span className="tflag lock">Locked</span>}
            {thread.thread_type === "news" && <span className="tflag news">Breaking News</span>}
            {thread.thread_type === "rumor" && <span className="tflag rumor">Rumor</span>}
            {thread.thread_type === "game" && <span className="tflag news">Game Thread</span>}
            {thread.thread_type === "question" && <span className="tflag">Question</span>}
            {thread.thread_type === "prediction" && <span className="tflag">Prediction</span>}
            {thread.hidden && <span className="tflag lock">Hidden</span>}
          </span>
          {thread.title}
        </span>
        <span className="thread-byline">
          <b>{author}</b>
          <span>started <RelTime iso={thread.created_at} /></span>
          {showBoard && <span>· {showBoard}</span>}
        </span>
        {thread.last_reply_at && (
          <div className="thread-sub">
            Latest reply <RelTime iso={thread.last_reply_at} />
          </div>
        )}
      </div>
      <div className="thread-counts">
        <span className="replies">💬 {thread.reply_count}</span>
        <span className="views">👁 {thread.view_count.toLocaleString("en-US")}</span>
      </div>
    </Link>
  );
}
