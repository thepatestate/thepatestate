"use client";
import { useActionState } from "react";
import { createPost, type ActionState } from "@/app/community/actions";

export default function ReplyForm({ threadId }: { threadId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createPost, {});
  return (
    <form action={formAction} className="composer" id="reply">
      <p className="eyebrow" style={{ margin: 0 }}>Join the conversation</p>
      <input type="hidden" name="thread_id" value={threadId} />
      <label htmlFor="rp-body">Reply</label>
      <textarea id="rp-body" name="body" maxLength={10000} required placeholder="Argue in good faith…" />
      {state.error && <p className="note" style={{ marginTop: 10 }}>{state.error}</p>}
      {state.saved && <p className="note" style={{ marginTop: 10 }}>Posted.</p>}
      <button className="btn solid" type="submit" disabled={pending} style={{ marginTop: 12 }}>
        {pending ? "Posting…" : "Post Reply"}
      </button>
    </form>
  );
}
