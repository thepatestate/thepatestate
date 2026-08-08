"use client";
import { useActionState } from "react";
import { createCitizen, type WelcomeState } from "@/app/welcome/actions";
import { TEAMS_TOP25, TEAMS_ALL } from "@/lib/teams";

export default function WelcomeForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<WelcomeState, FormData>(
    createCitizen,
    {}
  );
  return (
    <form action={formAction} className="panel">
      <input type="hidden" name="next" value={next} />
      <label className="eyebrow" htmlFor="handle">Handle</label>
      <input
        id="handle" name="handle" required minLength={3} maxLength={20}
        placeholder="PorchSwingProphet"
        style={{ display: "block", width: "100%", padding: "12px 14px", margin: "8px 0 14px", fontFamily: "var(--mono)", fontSize: 14, border: "1.5px solid var(--line-l)", borderRadius: 2, background: "#fff", color: "var(--ink)" }}
      />
      <label className="eyebrow" htmlFor="favorite_team">Favorite team (optional)</label>
      <select
        id="favorite_team" name="favorite_team" defaultValue=""
        style={{ display: "block", width: "100%", padding: "12px 14px", margin: "8px 0 18px", fontFamily: "var(--mono)", fontSize: 14, border: "1.5px solid var(--line-l)", borderRadius: 2, background: "#fff", color: "var(--ink)" }}
      >
        <option value="">No flag on my porch</option>
        <optgroup label="The JP Top 25">
          {TEAMS_TOP25.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </optgroup>
        <optgroup label="All Teams A–Z">
          {TEAMS_ALL.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </optgroup>
      </select>
      {state.error && <p className="note" style={{ marginBottom: 12 }}>{state.error}</p>}
      <button className="btn solid" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Take My Seat"}
      </button>
    </form>
  );
}
