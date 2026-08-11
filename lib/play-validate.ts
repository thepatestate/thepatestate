// Pure entry-validation logic for the competition engine (§5.1) — no I/O,
// unit-tested, shared by the server actions (authoritative) and the entry
// UIs (friendly pre-flight). Every rule here guards data integrity; the
// deterministic scorers in lib/score-play.ts assume validated shapes.
import type { PickemGame } from "@/lib/play";

export interface PickemPickInput {
  gameId: string;
  winner: "away" | "home";
  confidence: number;
}

export interface BracketInput {
  /** seed number (1-12) → team slug */
  seeds: Record<number, string>;
  champion: string | null;
  /** predicted total points in the championship game (tiebreaker) */
  tiebreaker: number | null;
}

/** Validate a (possibly partial) pick'em entry against the competition's
 * game snapshot. Returns error strings; [] = valid. */
export function validatePickem(games: PickemGame[], picks: PickemPickInput[]): string[] {
  const errors: string[] = [];
  const ids = new Set(games.map((g) => g.id));
  const seenGames = new Set<string>();
  const seenConfidence = new Set<number>();
  const max = games.length;
  for (const p of picks) {
    if (!ids.has(p.gameId)) errors.push(`unknown game ${p.gameId}`);
    if (seenGames.has(p.gameId)) errors.push(`duplicate pick for game ${p.gameId}`);
    seenGames.add(p.gameId);
    if (p.winner !== "away" && p.winner !== "home") errors.push(`invalid winner for game ${p.gameId}`);
    if (!Number.isInteger(p.confidence) || p.confidence < 1 || p.confidence > max) {
      errors.push(`confidence must be 1–${max}`);
    } else if (seenConfidence.has(p.confidence)) {
      errors.push(`confidence ${p.confidence} used more than once`);
    }
    seenConfidence.add(p.confidence);
  }
  return errors;
}

/** Validate a (possibly partial) bracket. knownTeams guards against invented
 * programs; fieldSize is the competition's configured field (12). */
export function validateBracket(
  input: BracketInput,
  knownTeams: Set<string>,
  fieldSize = 12,
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const [seedStr, team] of Object.entries(input.seeds)) {
    const seed = Number(seedStr);
    if (!Number.isInteger(seed) || seed < 1 || seed > fieldSize) errors.push(`invalid seed ${seedStr}`);
    if (!knownTeams.has(team)) errors.push(`unknown team ${team}`);
    if (seen.has(team)) errors.push(`${team} appears at more than one seed`);
    seen.add(team);
  }
  if (input.champion) {
    if (!knownTeams.has(input.champion)) errors.push(`unknown champion ${input.champion}`);
    if (!seen.has(input.champion)) errors.push("champion must be one of your 12 field teams");
  }
  if (input.tiebreaker != null) {
    if (!Number.isFinite(input.tiebreaker) || input.tiebreaker < 0 || input.tiebreaker > 200) {
      errors.push("tiebreaker must be a total-points number between 0 and 200");
    }
  }
  return errors;
}

/** A complete, submittable entry (used to badge "entry complete"). */
export function pickemComplete(games: PickemGame[], picks: PickemPickInput[]): boolean {
  return picks.length === games.length && validatePickem(games, picks).length === 0;
}

export function bracketComplete(input: BracketInput, fieldSize = 12): boolean {
  return (
    Object.keys(input.seeds).length === fieldSize &&
    Boolean(input.champion) &&
    input.tiebreaker != null
  );
}
