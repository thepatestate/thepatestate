// The 12-team playoff as a two-sided bracket: seven columns funneling to the
// championship in the middle (first round → quarterfinals → semifinal →
// title → semifinal → quarterfinals → first round). Pure data builder shared
// by the rankings page, the playoffs page, and the Play bracket builder.
//
// Winners are never invented: the named champion wins every game on its
// path and every other game goes to the better seed (chalk). Callers that
// hold real round-by-round picks pass them through `winners`.

export type BGame = {
  seedA: number; teamA: string; winA: boolean;
  seedB: number; teamB: string; winB: boolean;
  tag: string;
};
export type BRound = { title: string; center?: boolean; games: BGame[] };

export interface SeededTeam {
  seed: number;
  name: string;
  slug?: string;
}

export interface BuildRoundsOptions {
  /** Team name or slug that wins the whole thing; wins every game it plays. */
  champion?: string | null;
  /** Explicit winners by matchup key "A-B" (seeds, lower first), name or slug. */
  winners?: Record<string, string>;
}

const TBD = (seed: number): SeededTeam => ({ seed, name: "TBD", slug: `tbd-${seed}` });

/** Builds the seven-column bracket from a seeded field (seeds 1–12; missing
 * seeds render as TBD). Layout follows the CFP: 8/9 → 1, 5/12 → 4 on the
 * left; 7/10 → 2, 6/11 → 3 on the right; first-round games at the higher
 * seed's campus. */
export function buildRounds(field: SeededTeam[], opts: BuildRoundsOptions = {}): BRound[] {
  const by = new Map(field.map((t) => [t.seed, t]));
  const t = (s: number) => by.get(s) ?? TBD(s);
  const matches = (x: SeededTeam, who: string | null | undefined) =>
    Boolean(who) && (x.name === who || x.slug === who);
  const pick = (a: SeededTeam, b: SeededTeam): SeededTeam => {
    const key = `${Math.min(a.seed, b.seed)}-${Math.max(a.seed, b.seed)}`;
    const forced = opts.winners?.[key];
    if (forced) return matches(a, forced) ? a : matches(b, forced) ? b : a.seed < b.seed ? a : b;
    if (matches(a, opts.champion)) return a;
    if (matches(b, opts.champion)) return b;
    return a.seed < b.seed ? a : b;
  };
  const play = (a: SeededTeam, b: SeededTeam, tag: string): { game: BGame; winner: SeededTeam } => {
    const winner = pick(a, b);
    return {
      game: { seedA: a.seed, teamA: a.name, winA: winner === a, seedB: b.seed, teamB: b.name, winB: winner === b, tag },
      winner,
    };
  };
  const at = (home: SeededTeam) => (home.name === "TBD" ? "FIRST ROUND" : `AT ${home.name.toUpperCase()}`);

  const r1L1 = play(t(9), t(8), at(t(8)));
  const r1L2 = play(t(12), t(5), at(t(5)));
  const r1R1 = play(t(10), t(7), at(t(7)));
  const r1R2 = play(t(11), t(6), at(t(6)));
  const qfL1 = play(t(1), r1L1.winner, "QUARTERFINAL");
  const qfL2 = play(t(4), r1L2.winner, "QUARTERFINAL");
  const qfR1 = play(t(2), r1R1.winner, "QUARTERFINAL");
  const qfR2 = play(t(3), r1R2.winner, "QUARTERFINAL");
  const sfL = play(qfL1.winner, qfL2.winner, "SEMIFINAL");
  const sfR = play(qfR1.winner, qfR2.winner, "SEMIFINAL");
  const fin = play(sfL.winner, sfR.winner, "NATIONAL CHAMPIONSHIP");

  return [
    { title: "First Round", games: [r1L1.game, r1L2.game] },
    { title: "Quarterfinals", games: [qfL1.game, qfL2.game] },
    { title: "Semifinal", games: [sfL.game] },
    { title: "National Championship", center: true, games: [fin.game] },
    { title: "Semifinal", games: [sfR.game] },
    { title: "Quarterfinals", games: [qfR1.game, qfR2.game] },
    { title: "First Round", games: [r1R1.game, r1R2.game] },
  ];
}

/** The champion the bracket funnels to ("" for an incomplete bracket). */
export function championOf(rounds: BRound[]): string {
  const final = rounds.find((r) => r.center)?.games[0];
  if (!final) return "";
  const name = final.winA ? final.teamA : final.winB ? final.teamB : "";
  return name === "TBD" ? "" : name;
}

/** Seeds a 12-team field from a ranked list (a poll's top 12, a consensus
 * order, a citizen's picks). */
export function seedFromRanked(ranked: { name: string; slug?: string }[]): SeededTeam[] {
  return ranked.slice(0, 12).map((r, i) => ({ seed: i + 1, name: r.name, slug: r.slug }));
}
