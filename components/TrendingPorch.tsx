import Link from "next/link";
import { getTrendingThreads, getBoards } from "@/lib/community";
import ThreadCard from "@/components/community/ThreadCard";

// "Trending on The Porch" homepage module (v2 §1.3, §3.8). Real data only
// (§0.1): renders nothing until the porch has genuine activity — no fake
// thread lists, ever. Uses the cached public client so the homepage stays
// statically rendered.
export default async function TrendingPorch() {
  const [threads, boards] = await Promise.all([getTrendingThreads(4), getBoards()]);
  if (threads.length === 0) return null;
  const boardName = (slug: string) => boards.find((b) => b.slug === slug)?.name ?? slug;

  return (
    <section className="tight" style={{ background: "#EFEDE8" }}>
      <div className="wrap">
        <div className="sec-head">
          <div>
            <p className="eyebrow">Where the Porch Is Loudest</p>
            <h2 className="display" style={{ fontSize: 34 }}>Trending on The Porch</h2>
          </div>
          <Link className="view-all" href="/community">All Boards →</Link>
        </div>
        <div className="thread-list">
          {threads.map((t) => (
            <ThreadCard thread={t} key={t.id} showBoard={boardName(t.board_slug)} />
          ))}
        </div>
      </div>
    </section>
  );
}
