import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getCitizen } from "@/lib/supabase/server";
import { resolveReport } from "@/app/community/actions";
import RelTime from "@/components/RelTime";

export const metadata: Metadata = {
  title: "Moderation — The Quad",
  robots: { index: false },
};

interface ReportRow {
  id: string;
  target_type: "thread" | "post";
  target_id: string;
  reason: string;
  status: string;
  created_at: string;
  citizens: { display_handle: string } | null;
}

interface LogRow {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  note: string | null;
  created_at: string;
  citizens: { display_handle: string } | null;
}

// Staff report queue + append-only moderation log (§3.4, §3.7). RLS already
// restricts both tables to staff; the redirect is just navigation.
export default async function ModPage() {
  const citizen = await getCitizen();
  if (!citizen || citizen.role !== "staff") redirect("/community");

  const db = await createClient();
  const [{ data: open }, { data: log }, threadLinks] = await Promise.all([
    db.from("reports")
      .select("id, target_type, target_id, reason, status, created_at, citizens(display_handle)")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50),
    db.from("moderation_log")
      .select("id, action, target_type, target_id, note, created_at, citizens(display_handle)")
      .order("created_at", { ascending: false })
      .limit(30),
    Promise.resolve(null),
  ]);
  void threadLinks;

  const reports = (open as unknown as ReportRow[] | null) ?? [];
  // Resolve post targets to their thread so "view" links land somewhere useful.
  const postIds = reports.filter((r) => r.target_type === "post").map((r) => r.target_id);
  const postThreads: Record<string, string> = {};
  if (postIds.length > 0) {
    const { data } = await db.from("posts").select("id, thread_id").in("id", postIds);
    for (const row of (data as { id: string; thread_id: string }[] | null) ?? []) {
      postThreads[row.id] = row.thread_id;
    }
  }

  return (
    <main className="v5-lite">
      <div className="board-bar">
        <div className="wrap">
          <p className="kicker">Staff Only · The Quad</p>
          <h1>The Mod Desk</h1>
          <p className="sub">Open reports first, the permanent log below. Permanent decisions are human-only.</p>
        </div>
      </div>
      <div className="quad-page">
        <div className="wrap" style={{ maxWidth: 880 }}>
          <p className="eyebrow" style={{ marginTop: 24 }}>Open Reports ({reports.length})</p>
          {reports.length === 0 && (
            <p style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink-dim)", marginTop: 10 }}>
              Queue&apos;s clear. The Quad is behaving.
            </p>
          )}
          {reports.map((r) => {
            const href = r.target_type === "thread"
              ? `/community/thread/${r.target_id}`
              : postThreads[r.target_id]
                ? `/community/thread/${postThreads[r.target_id]}`
                : null;
            return (
              <div className="post-card" key={r.id}>
                <div className="post-head">
                  <b>{r.target_type.toUpperCase()}</b>
                  <span>reported by {r.citizens?.display_handle ?? "Pate State AI"}</span>
                  <span><RelTime iso={r.created_at} /></span>
                </div>
                <div className="post-body" style={{ fontSize: 14 }}>{r.reason}</div>
                <div className="post-tools">
                  {href && (
                    <Link href={href} className="tool-link" style={{ textDecoration: "none" }}>
                      View in context →
                    </Link>
                  )}
                  <form action={resolveReport.bind(null, r.id, "resolved")}>
                    <button className="upvote-btn" type="submit">✓ Resolved</button>
                  </form>
                  <form action={resolveReport.bind(null, r.id, "dismissed")}>
                    <button className="upvote-btn" type="submit">✕ Dismiss</button>
                  </form>
                </div>
              </div>
            );
          })}

          <p className="eyebrow" style={{ marginTop: 30 }}>Moderation Log (append-only)</p>
          {(((log as unknown as LogRow[] | null) ?? [])).map((l) => (
            <div key={l.id} style={{ padding: "9px 0", borderBottom: "1px solid #DDD9CF", fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-dim)" }}>
              <b style={{ color: "var(--ink)" }}>{l.citizens?.display_handle ?? "system"}</b> · {l.action}
              {l.note ? ` · ${l.note}` : ""} · <RelTime iso={l.created_at} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
