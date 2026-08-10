"use client";
import { useActionState, useState } from "react";
import { createThread, type ActionState } from "@/app/community/actions";

// New-thread composer (§3.3, §3.5). Citizens choose citizen thread types;
// staff additionally get Breaking News / Staff Announcement. News requires
// a source link — the field appears for news/rumor types.
export default function NewThreadForm({ board, isStaff }: { board: string; isStaff: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createThread, {});
  const [type, setType] = useState("discussion");
  const types = [
    ["discussion", "Discussion"],
    ["question", "Question"],
    ["prediction", "Prediction"],
    ["rumor", "Rumor"],
    ...(isStaff ? ([["news", "Breaking News (staff)"], ["staff", "Staff Announcement"]] as const) : []),
  ] as const;

  return (
    <form action={formAction} className="composer">
      <p className="eyebrow" style={{ margin: 0 }}>Start a thread</p>
      <input type="hidden" name="board" value={board} />
      <label htmlFor="nt-title">Title</label>
      <input id="nt-title" type="text" name="title" maxLength={140} required placeholder="Say it like you'd say it on the porch" />
      <label htmlFor="nt-type">Type</label>
      <select id="nt-type" name="thread_type" value={type} onChange={(e) => setType(e.target.value)}>
        {types.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {(type === "news" || type === "rumor") && (
        <>
          <label htmlFor="nt-src">{type === "news" ? "Source link (required)" : "Source link (if you have one)"}</label>
          <input id="nt-src" type="url" name="source_url" placeholder="https://…" required={type === "news"} />
          {type === "rumor" && (
            <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)", marginTop: 4 }}>
              Rumors stay labeled rumors — they never get marked confirmed.
            </p>
          )}
        </>
      )}
      <label htmlFor="nt-body">Post</label>
      <textarea id="nt-body" name="body" maxLength={10000} placeholder="Make the case…" />
      {state.error && <p className="note" style={{ marginTop: 10 }}>{state.error}</p>}
      <button className="btn solid" type="submit" disabled={pending} style={{ marginTop: 12 }}>
        {pending ? "Posting…" : "Post Thread"}
      </button>
    </form>
  );
}
