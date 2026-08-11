"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { savePickemPicks } from "@/app/play/actions";
import type { PickemGame } from "@/lib/play";
import type { PickemPickInput } from "@/lib/play-validate";

// Week Pick'Em entry sheet (v2 brief §5.2 shared engine). Tap a team to
// pick the winner, weight it 1–N confidence (each number once — N = your
// surest thing). Server actions re-validate; RLS + DB triggers make the
// whole sheet immutable at lock.

function kickoffLabel(iso: string): string {
  const d = new Date(iso);
  const day = d
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" })
    .replace(/,/g, "")
    .toUpperCase();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  return `${day} · ${time} ET`;
}

type Side = "away" | "home";
interface PickState {
  winner?: Side;
  confidence?: number;
}

export default function PickemSlate({
  slug,
  games,
  locked,
  initial,
  consensus,
  signedIn,
}: {
  slug: string;
  games: PickemGame[];
  locked: boolean;
  initial: PickemPickInput[];
  consensus?: Record<string, { away: number; home: number }>;
  signedIn: boolean;
}) {
  const [picks, setPicks] = useState<Record<string, PickState>>(() =>
    Object.fromEntries(initial.map((p) => [p.gameId, { winner: p.winner, confidence: p.confidence }])),
  );
  const [status, setStatus] = useState<{ error?: string; saved?: boolean }>({});
  const [pending, startTransition] = useTransition();

  const max = games.length;
  const usedConfidence = useMemo(() => {
    const used = new Map<number, string>();
    for (const [gid, p] of Object.entries(picks)) if (p.confidence) used.set(p.confidence, gid);
    return used;
  }, [picks]);
  const pickedCount = Object.values(picks).filter((p) => p.winner && p.confidence).length;

  const setWinner = (gameId: string, winner: Side) =>
    setPicks((prev) => ({ ...prev, [gameId]: { ...prev[gameId], winner } }));
  const setConfidence = (gameId: string, confidence: number) =>
    setPicks((prev) => {
      const next = { ...prev };
      // Confidence numbers are exclusive — grab it from the row that had it.
      for (const [gid, p] of Object.entries(next)) {
        if (gid !== gameId && p.confidence === confidence) next[gid] = { ...p, confidence: undefined };
      }
      next[gameId] = { ...next[gameId], confidence: confidence || undefined };
      return next;
    });

  const save = () =>
    startTransition(async () => {
      const payload: PickemPickInput[] = Object.entries(picks)
        .filter(([, p]) => p.winner && p.confidence)
        .map(([gameId, p]) => ({ gameId, winner: p.winner!, confidence: p.confidence! }));
      const res = await savePickemPicks(slug, payload);
      setStatus(res);
    });

  return (
    <div>
      {games.map((g) => {
        const p = picks[g.id] ?? {};
        const cons = consensus?.[g.id];
        const consTotal = cons ? cons.away + cons.home : 0;
        return (
          <div className="pick-game" key={g.id}>
            <div className="pick-meta">
              <span>{kickoffLabel(g.kickoff)}</span>
              <span>{g.net}</span>
            </div>
            <div className="pick-row">
              {(["away", "home"] as const).map((side) => {
                const name = side === "away" ? g.away : g.home;
                const logo = side === "away" ? g.awayLogo : g.homeLogo;
                const chosen = p.winner === side;
                const pct = cons && consTotal > 0 ? Math.round((cons[side] / consTotal) * 100) : null;
                return (
                  <button
                    key={side}
                    type="button"
                    className={chosen ? "pick-team chosen" : "pick-team"}
                    disabled={locked}
                    onClick={() => setWinner(g.id, side)}
                    aria-pressed={chosen}
                  >
                    <Image src={logo} alt="" width={26} height={26} style={{ objectFit: "contain" }} />
                    <b>{name}</b>
                    {side === "away" && <span className="pick-at">at</span>}
                    {pct != null && <span className="pick-pct">{pct}%</span>}
                  </button>
                );
              })}
              <label className="pick-conf">
                <span>CONF</span>
                <select
                  value={p.confidence ?? ""}
                  disabled={locked}
                  onChange={(e) => setConfidence(g.id, Number(e.target.value))}
                  aria-label={`Confidence for ${g.away} at ${g.home}`}
                >
                  <option value="">—</option>
                  {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                      {usedConfidence.has(n) && usedConfidence.get(n) !== g.id ? " ·" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        );
      })}

      {!locked && (
        <div className="pick-actions">
          <span className="pick-count">
            {pickedCount}/{max} PICKED
          </span>
          {signedIn ? (
            <button type="button" className="btn gold" onClick={save} disabled={pending || pickedCount === 0}>
              {pending ? "Saving…" : "Save My Picks"}
            </button>
          ) : (
            <a className="btn gold" href={`/join?next=/play/${slug}`}>
              Join Free to Save Picks
            </a>
          )}
          {status.saved && <span className="pick-saved">Saved ✓</span>}
          {status.error && <span className="pick-error">{status.error}</span>}
        </div>
      )}
    </div>
  );
}
