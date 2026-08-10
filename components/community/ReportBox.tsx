"use client";
import { useActionState } from "react";
import { reportContent, type ActionState } from "@/app/community/actions";

// Collapsible report control (§3.3): three-word minimum, goes straight to
// the staff queue. Available on every thread and reply.
export default function ReportBox({ targetType, targetId }: { targetType: "thread" | "post"; targetId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(reportContent, {});
  if (state.saved) {
    return <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--field, #1E3B2E)" }}>Reported — a human will review it.</span>;
  }
  return (
    <details className="report-box">
      <summary>Report</summary>
      <form action={formAction} style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
        <input type="hidden" name="target_type" value={targetType} />
        <input type="hidden" name="target_id" value={targetId} />
        <input
          type="text"
          name="reason"
          required
          maxLength={500}
          placeholder="What's wrong with it?"
          style={{ flex: 1, minWidth: 200, padding: "8px 10px", fontSize: 13, border: "1.5px solid var(--line-l)", borderRadius: 4 }}
        />
        <button className="btn" type="submit" disabled={pending} style={{ padding: "8px 14px" }}>
          {pending ? "…" : "Send"}
        </button>
      </form>
      {state.error && <p className="note" style={{ marginTop: 6 }}>{state.error}</p>}
    </details>
  );
}
