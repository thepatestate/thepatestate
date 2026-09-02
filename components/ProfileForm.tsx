"use client";
import { useActionState } from "react";
import { updateFavoriteTeam, type ProfileState } from "@/app/me/actions";
import { TEAMS_TOP25, TEAMS_ALL } from "@/lib/teams";

export default function ProfileForm({ favoriteTeam }: { favoriteTeam: string | null }) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(
    updateFavoriteTeam,
    {}
  );
  return (
    <form action={formAction}>
      <label className="eyebrow" htmlFor="favorite_team">Favorite team</label>
      <select
        id="favorite_team" name="favorite_team" defaultValue={favoriteTeam ?? ""}
        style={{ display: "block", width: "100%", padding: "12px 14px", margin: "8px 0 14px", fontFamily: "var(--mono)", fontSize: 14, border: "1.5px solid var(--line-l)", borderRadius: 2, background: "#fff", color: "var(--ink)" }}
      >
        <option value="">No flag on my Quad</option>
        <optgroup label="The JP Top 25">
          {TEAMS_TOP25.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </optgroup>
        <optgroup label="All Teams A–Z">
          {TEAMS_ALL.filter((t) => !TEAMS_TOP25.some((x) => x.value === t.value)).map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </optgroup>
      </select>
      {state.error && <p className="note" style={{ marginBottom: 12 }}>{state.error}</p>}
      {state.saved && <p className="note" style={{ marginBottom: 12 }}>Saved.</p>}
      <button className="btn solid" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Update My Flag"}
      </button>
    </form>
  );
}
