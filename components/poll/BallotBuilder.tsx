"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { saveBallot, type BallotActionState } from "@/app/poll/actions";
import type { BallotRank } from "@/lib/jp-poll";

// The weekly JP Poll ballot: rank your top 10. Native selects over the full
// FBS directory (a "quick picks" group of the current national top 25 sits
// on top). One team per slot, one slot per team; RLS + the DB lock guard
// make the ballot immutable at Sunday 8 PM ET.

export interface BallotTeamOption {
  slug: string;
  school: string;
  conference: string;
  logo: string;
}

export default function BallotBuilder({
  teams,
  quickPicks,
  initial,
  editable,
  signedIn,
}: {
  teams: BallotTeamOption[];
  /** slugs of the current national top 25, for the shortcut optgroup */
  quickPicks: string[];
  initial: BallotRank[];
  editable: boolean;
  signedIn: boolean;
}) {
  const [ranks, setRanks] = useState<Record<number, string>>(() =>
    Object.fromEntries(initial.map((r) => [r.rank, r.team_slug])),
  );
  const [status, setStatus] = useState<BallotActionState>({});
  const [pending, startTransition] = useTransition();

  const bySlug = useMemo(() => new Map(teams.map((t) => [t.slug, t])), [teams]);
  const quick = useMemo(
    () => quickPicks.map((s) => bySlug.get(s)).filter((t): t is BallotTeamOption => Boolean(t)),
    [quickPicks, bySlug],
  );
  const byConference = useMemo(() => {
    const groups = new Map<string, BallotTeamOption[]>();
    for (const t of teams) {
      const key = t.conference || "Independents";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [teams]);

  const chosen = Object.values(ranks).filter(Boolean);

  const setRank = (rank: number, team: string) =>
    setRanks((prev) => {
      const next = { ...prev };
      for (const [rk, t] of Object.entries(next)) {
        if (Number(rk) !== rank && t === team) delete next[Number(rk)];
      }
      if (team) next[rank] = team;
      else delete next[rank];
      return next;
    });

  const save = () =>
    startTransition(async () => {
      const payload: BallotRank[] = Object.entries(ranks)
        .filter(([, team]) => team)
        .map(([rank, team_slug]) => ({ rank: Number(rank), team_slug }));
      const res = await saveBallot(payload);
      setStatus(res);
    });

  return (
    <div>
      <div className="seed-grid">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((rank) => {
          const team = ranks[rank] ? bySlug.get(ranks[rank]) : null;
          return (
            <div className="seed-row" key={rank}>
              <span className="seed-num">{rank}</span>
              {team ? (
                <Image src={team.logo} alt="" width={24} height={24} style={{ objectFit: "contain" }} />
              ) : (
                <span className="seed-empty" aria-hidden>·</span>
              )}
              <select
                value={ranks[rank] ?? ""}
                disabled={!editable}
                onChange={(e) => setRank(rank, e.target.value)}
                aria-label={`Your number ${rank}`}
              >
                <option value="">— pick a team —</option>
                {quick.length > 0 && (
                  <optgroup label="QUICK PICKS — THE NATIONAL TOP 25">
                    {quick.map((t) => (
                      <option key={`q-${t.slug}`} value={t.slug}>
                        {t.school}
                        {chosen.includes(t.slug) && ranks[rank] !== t.slug ? " ✓" : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
                {byConference.map(([conf, list]) => (
                  <optgroup label={conf} key={conf}>
                    {list.map((t) => (
                      <option key={t.slug} value={t.slug}>
                        {t.school}
                        {chosen.includes(t.slug) && ranks[rank] !== t.slug ? " ✓" : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {editable && (
        <div className="pick-actions">
          <span className="pick-count">{chosen.length}/10 RANKED{chosen.length === 10 ? " · COMPLETE" : ""}</span>
          {signedIn ? (
            <button type="button" className="btn gold" onClick={save} disabled={pending || chosen.length === 0}>
              {pending ? "Saving…" : "Cast My Ballot"}
            </button>
          ) : (
            <a className="btn gold" href="/join?next=/poll">Join Free to Cast Your Ballot</a>
          )}
          {status.saved && <span className="pick-saved">Ballot saved ✓ — edit any time before Sunday 8 PM ET</span>}
          {status.error && <span className="pick-error">{status.error}</span>}
        </div>
      )}
      <p className="terms-line" style={{ marginTop: 12 }}>
        Only complete 10-team ballots count in the tabulation. Ballots lock Sunday 8 PM ET; every ballot
        goes public with the Tuesday board — no anonymous votes, full distribution shown.
      </p>
    </div>
  );
}
