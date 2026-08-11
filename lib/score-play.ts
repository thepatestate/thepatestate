// Deterministic scoring for the competition engine (v2 brief §5.1: official
// scoring comes from a deterministic rules engine reading the official
// results database — the LLM never calculates or alters outcomes). Pure
// functions, no I/O, unit-tested; /api/play/score feeds them play_results
// rows and writes the outputs back.

export interface PickemPickValue {
  winner: "away" | "home";
  confidence: number;
}

export interface PickemResultValue {
  winner: "away" | "home";
  awayPts: number;
  homePts: number;
}

/** Confidence pick'em: a correct pick earns its confidence points. */
export function scorePickemPick(pick: PickemPickValue, result: PickemResultValue): number {
  return pick.winner === result.winner ? pick.confidence : 0;
}

/** Score an entry's picks against whatever results exist so far. Games with
 * no result contribute nothing yet (running totals during the week). */
export function scorePickemEntry(
  picks: { slot: string; value: PickemPickValue }[],
  results: Record<string, PickemResultValue>,
): { perPick: Record<string, number>; total: number; scoredGames: number } {
  const perPick: Record<string, number> = {};
  let total = 0;
  let scoredGames = 0;
  for (const p of picks) {
    const result = results[p.slot];
    if (!result) continue;
    const pts = scorePickemPick(p.value, result);
    perPick[p.slot] = pts;
    total += pts;
    scoredGames += 1;
  }
  return { perPick, total, scoredGames };
}

export interface BracketRuleConfig {
  fieldPoints: number; // team made the real field (any seed)
  seedPoints: number; // bonus: exact seed
  champPoints: number; // bonus: champion correct
}

export interface BracketOfficial {
  /** real seed number → team slug */
  field: Record<number, string>;
  champion: string | null;
}

/** Preseason bracket: +fieldPoints per picked team in the real field,
 * +seedPoints bonus when the seed matches exactly, +champPoints bonus for
 * the right champion. Matches the published /playoffs copy (10/25/100). */
export function scoreBracketEntry(
  seeds: Record<number, string>,
  champion: string | null,
  official: BracketOfficial,
  rule: BracketRuleConfig,
): { perSeed: Record<number, number>; championPoints: number; total: number } {
  const realTeams = new Set(Object.values(official.field));
  const perSeed: Record<number, number> = {};
  let total = 0;
  for (const [seedStr, team] of Object.entries(seeds)) {
    const seed = Number(seedStr);
    let pts = 0;
    if (realTeams.has(team)) pts += rule.fieldPoints;
    if (official.field[seed] === team) pts += rule.seedPoints;
    perSeed[seed] = pts;
    total += pts;
  }
  const championPoints = champion && official.champion === champion ? rule.champPoints : 0;
  total += championPoints;
  return { perSeed, championPoints, total };
}

/** Tiebreaker distance: |predicted championship total − actual|; lower wins.
 * Entries with no prediction sort last (Infinity). */
export function tiebreakDistance(predicted: number | null, actual: number): number {
  return predicted == null ? Number.POSITIVE_INFINITY : Math.abs(predicted - actual);
}
