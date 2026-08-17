import Link from "next/link";
import type { ThreadSummary } from "@/lib/community";
import RelTime from "@/components/RelTime";

// v5 "Live on the Porch": real community threads + the join panel. With no
// threads yet, the panel stands alone — no fabricated conversation (§0.1).
const AV_CLASSES = ["a1", "a2", "a3", "a4"] as const;

export default function PorchSection({ threads }: { threads: ThreadSummary[] }) {
  const visible = threads.filter((t) => !t.hidden).slice(0, 4);
  const side = (
    <div className="porch-side">
      <div className="on">The porch is open</div>
      <h3>Team threads. Poll arguments. Gameday chats.</h3>
      <p>Moderated like a front porch, not a mosh pit. Every take signed. Citizens only.</p>
      <Link className="btn" href="/community">Pull Up a Chair →</Link>
      <div className="rules">Free with citizenship · House rules apply</div>
    </div>
  );
  return (
    <section className="porch" id="porch">
      <div className="wrap">
        <div className="sect-head">
          <div>
            <div className="eyebrow">Pull Up a Chair</div>
            <h2>Live on the Porch</h2>
            <div className="sub">The comment section, if the comment section had manners.</div>
          </div>
          <Link className="more" href="/community">All Threads →</Link>
        </div>
        {visible.length === 0 ? (
          side
        ) : (
          <div className="porch-grid">
            <div>
              {visible.map((t, i) => {
                const author = t.author_label ?? t.citizens?.display_handle ?? "a citizen";
                return (
                  <Link className="thread" href={`/community/thread/${t.id}`} key={t.id}>
                    <span className={`av ${AV_CLASSES[i % AV_CLASSES.length]}`}>
                      {author.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <div className="cat">
                        {t.reply_count >= 50 && <span className="hot">🔥 Hot</span>}
                        {t.board_slug.replace(/-/g, " ")}
                      </div>
                      <h4>{t.title}</h4>
                      <div className="meta">
                        Started by {author} · last reply <RelTime iso={t.last_reply_at ?? t.created_at} />
                      </div>
                    </div>
                    <div className="replies"><b>{t.reply_count}</b><span>Replies</span></div>
                  </Link>
                );
              })}
            </div>
            {side}
          </div>
        )}
      </div>
    </section>
  );
}
