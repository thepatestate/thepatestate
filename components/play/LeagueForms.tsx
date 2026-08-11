"use client";

import { useActionState, useState, useTransition } from "react";
import { createLeague, joinLeague, type PlayActionState } from "@/app/play/actions";

// Private-group forms (v2 brief §5.2): create a group for a competition, or
// join one with an invite code. The code is the credential — joining goes
// through a security-definer RPC, never a direct insert.

export function CreateLeagueForm({ competition }: { competition: string }) {
  const [state, action, pending] = useActionState<PlayActionState, FormData>(createLeague, {});
  return (
    <form action={action} className="league-form">
      <input type="hidden" name="competition" value={competition} />
      <label>
        Group name
        <input name="name" type="text" minLength={3} maxLength={60} required placeholder="Smith Family Bracket War" />
      </label>
      <label>
        Description <span className="opt">(optional)</span>
        <input name="description" type="text" maxLength={300} placeholder="Loser hosts the title-game watch party." />
      </label>
      <label>
        Visibility
        <select name="visibility" defaultValue="private">
          <option value="private">Private — invite link only</option>
          <option value="public">Public — anyone can find it</option>
        </select>
      </label>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create Group"}
      </button>
      {state.error && <span className="pick-error">{state.error}</span>}
    </form>
  );
}

export function JoinLeagueForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="league-form row"
      onSubmit={(e) => {
        e.preventDefault();
        if (!code.trim()) return;
        startTransition(async () => {
          const res = await joinLeague(code.trim().toLowerCase());
          if (res?.error) setError(res.error);
        });
      }}
    >
      <label style={{ flex: 1 }}>
        Have an invite code?
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. 4f7a1c9b02de"
          aria-label="Invite code"
        />
      </label>
      <button className="btn" type="submit" disabled={pending || !code.trim()}>
        {pending ? "Joining…" : "Join Group"}
      </button>
      {error && <span className="pick-error">{error}</span>}
    </form>
  );
}

export function CopyInviteLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = `https://thepatestate.com/play/join/${code}`;
  return (
    <button
      type="button"
      className="btn"
      onClick={() => {
        navigator.clipboard?.writeText(link).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? "Copied ✓" : "Copy Invite Link"}
    </button>
  );
}
