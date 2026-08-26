"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { saveBracket } from "@/app/play/actions";
import type { BracketInput } from "@/lib/play-validate";
import TourneyBracket from "@/components/TourneyBracket";
import { buildRounds, championOf } from "@/lib/bracket-rounds";

// Preseason Playoff Challenge entry (v2 brief §5.2 Window 1): seed the
// 12-team field, crown a champion, call the championship total (tiebreak).
// Seeds 1–4 carry first-round byes. Native selects over the full FBS
// directory (grouped by conference) — reliable on every device; a fancier
// picker can come later without touching the engine.

export interface BracketTeamOption {
  slug: string;
  school: string;
  conference: string;
  logo: string;
}

export default function BracketBuilder({
  slug,
  teams,
  fieldSize,
  locked,
  initial,
  signedIn,
}: {
  slug: string;
  teams: BracketTeamOption[];
  fieldSize: number;
  locked: boolean;
  initial: BracketInput;
  signedIn: boolean;
}) {
  const [seeds, setSeeds] = useState<Record<number, string>>(initial.seeds);
  const [champion, setChampion] = useState<string | null>(initial.champion);
  const [tiebreaker, setTiebreaker] = useState<string>(
    initial.tiebreaker != null ? String(initial.tiebreaker) : "",
  );
  const [status, setStatus] = useState<{ error?: string; saved?: boolean }>({});
  const [pending, startTransition] = useTransition();

  const bySlug = useMemo(() => new Map(teams.map((t) => [t.slug, t])), [teams]);
  const byConference = useMemo(() => {
    const groups = new Map<string, BracketTeamOption[]>();
    for (const t of teams) {
      const key = t.conference || "Independents";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [teams]);

  const chosen = Object.values(seeds).filter(Boolean);
  const complete = chosen.length === fieldSize && champion && tiebreaker !== "";

  // The citizen's picks drawn as the same two-sided bracket the rest of the
  // site uses (Josh, 2026-08-26). Chalk fills the games the entry doesn't
  // decide; the chosen champion wins every game on its path.
  const previewRounds = useMemo(
    () =>
      buildRounds(
        Object.entries(seeds)
          .filter(([, slug]) => Boolean(slug))
          .map(([seed, slug]) => ({ seed: Number(seed), slug, name: bySlug.get(slug)?.school ?? slug })),
        { champion },
      ),
    [seeds, champion, bySlug],
  );

  const setSeed = (seed: number, team: string) =>
    setSeeds((prev) => {
      const next = { ...prev };
      // A team holds one seed at a time — reassigning moves it.
      for (const [s, t] of Object.entries(next)) {
        if (Number(s) !== seed && t === team) delete next[Number(s)];
      }
      if (team) next[seed] = team;
      else delete next[seed];
      if (champion && !Object.values(next).includes(champion)) setChampion(null);
      return next;
    });

  const save = () =>
    startTransition(async () => {
      const res = await saveBracket(slug, {
        seeds,
        champion,
        tiebreaker: tiebreaker === "" ? null : Number(tiebreaker),
      });
      setStatus(res);
    });

  return (
    <div>
      <TourneyBracket rounds={previewRounds} champTitle="YOUR CHAMPION" champName={championOf(previewRounds)} />
      <div className="seed-grid">
        {Array.from({ length: fieldSize }, (_, i) => i + 1).map((seed) => {
          const team = seeds[seed] ? bySlug.get(seeds[seed]) : null;
          return (
            <div className="seed-row" key={seed}>
              <span className="seed-num">
                {seed}
                {seed <= 4 && <em title="First-round bye">BYE</em>}
              </span>
              {team ? (
                <Image src={team.logo} alt="" width={24} height={24} style={{ objectFit: "contain" }} />
              ) : (
                <span className="seed-empty" aria-hidden>
                  ·
                </span>
              )}
              <select
                value={seeds[seed] ?? ""}
                disabled={locked}
                onChange={(e) => setSeed(seed, e.target.value)}
                aria-label={`Seed ${seed}`}
              >
                <option value="">— pick a team —</option>
                {byConference.map(([conf, list]) => (
                  <optgroup label={conf} key={conf}>
                    {list.map((t) => (
                      <option key={t.slug} value={t.slug}>
                        {t.school}
                        {chosen.includes(t.slug) && seeds[seed] !== t.slug ? " ✓" : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <div className="champ-row">
        <label>
          <span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>
            Your National Champion
          </span>
          <select
            value={champion ?? ""}
            disabled={locked || chosen.length === 0}
            onChange={(e) => setChampion(e.target.value || null)}
          >
            <option value="">— from your 12 —</option>
            {chosen.map((s) => (
              <option key={s} value={s}>
                {bySlug.get(s)?.school ?? s}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>
            Tiebreaker — Title-Game Total Points
          </span>
          <input
            type="number"
            min={0}
            max={200}
            inputMode="numeric"
            placeholder="e.g. 52"
            value={tiebreaker}
            disabled={locked}
            onChange={(e) => setTiebreaker(e.target.value)}
          />
        </label>
      </div>

      {!locked && (
        <div className="pick-actions">
          <span className="pick-count">
            {chosen.length}/{fieldSize} SEEDED{complete ? " · COMPLETE" : ""}
          </span>
          {signedIn ? (
            <button type="button" className="btn gold" onClick={save} disabled={pending || chosen.length === 0}>
              {pending ? "Saving…" : "Save My Bracket"}
            </button>
          ) : (
            <a className="btn gold" href={`/join?next=/play/${slug}`}>
              Join Free to Save Your Bracket
            </a>
          )}
          {status.saved && <span className="pick-saved">Saved ✓</span>}
          {status.error && <span className="pick-error">{status.error}</span>}
        </div>
      )}
    </div>
  );
}
