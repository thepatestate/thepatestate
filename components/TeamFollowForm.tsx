"use client";
import { useActionState } from "react";
import { updateTeamFollows, type ProfileState } from "@/app/me/actions";

// Followed-teams picker (v2 brief §6): up to 5 teams beyond the primary
// flag. Options are the full FBS directory, resolved server-side.
export default function TeamFollowForm({
  teams,
  current,
}: {
  teams: { value: string; label: string }[];
  current: string[];
}) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(updateTeamFollows, {});
  const selectStyle = {
    display: "block",
    width: "100%",
    padding: "10px 12px",
    margin: "6px 0 10px",
    fontFamily: "var(--mono)",
    fontSize: 13,
    border: "1.5px solid var(--line-l)",
    borderRadius: 2,
    background: "#fff",
    color: "var(--ink)",
  } as const;

  return (
    <form action={formAction}>
      <p className="eyebrow">Followed teams — up to 5</p>
      <p style={{ fontSize: 13.5, color: "var(--ink-dim)", margin: "4px 0 10px" }}>
        Beyond your flag: the programs whose news, games, and threads you want surfaced first.
      </p>
      {[0, 1, 2, 3, 4].map((i) => (
        <select key={i} name="follow" defaultValue={current[i] ?? ""} style={selectStyle} aria-label={`Followed team ${i + 1}`}>
          <option value="">—</option>
          {teams.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      ))}
      {state.error && <p className="note" style={{ marginBottom: 12 }}>{state.error}</p>}
      {state.saved && <p className="note" style={{ marginBottom: 12 }}>Saved.</p>}
      <button className="btn solid" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save My Teams"}
      </button>
    </form>
  );
}
