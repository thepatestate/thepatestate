import { describe, expect, it } from "vitest";
import { validatePickem, validateBracket, pickemComplete, bracketComplete } from "@/lib/play-validate";
import {
  scorePickemPick,
  scorePickemEntry,
  scoreBracketEntry,
  tiebreakDistance,
} from "@/lib/score-play";
import type { PickemGame } from "@/lib/play";

const GAMES: PickemGame[] = Array.from({ length: 10 }, (_, i) => ({
  id: `g${i + 1}`,
  away: `Away ${i + 1}`,
  home: `Home ${i + 1}`,
  awayAbbrev: `A${i + 1}`,
  homeAbbrev: `H${i + 1}`,
  awayLogo: "",
  homeLogo: "",
  kickoff: "2026-08-29T16:00Z",
  net: "ESPN",
}));

describe("validatePickem", () => {
  it("accepts a full valid sheet", () => {
    const picks = GAMES.map((g, i) => ({ gameId: g.id, winner: "home" as const, confidence: i + 1 }));
    expect(validatePickem(GAMES, picks)).toEqual([]);
    expect(pickemComplete(GAMES, picks)).toBe(true);
  });
  it("accepts a partial sheet", () => {
    expect(validatePickem(GAMES, [{ gameId: "g1", winner: "away", confidence: 10 }])).toEqual([]);
    expect(pickemComplete(GAMES, [{ gameId: "g1", winner: "away", confidence: 10 }])).toBe(false);
  });
  it("rejects duplicate confidence", () => {
    const picks = [
      { gameId: "g1", winner: "away" as const, confidence: 5 },
      { gameId: "g2", winner: "home" as const, confidence: 5 },
    ];
    expect(validatePickem(GAMES, picks).join(" ")).toMatch(/confidence 5 used more than once/);
  });
  it("rejects out-of-range confidence, unknown games, duplicate games", () => {
    expect(validatePickem(GAMES, [{ gameId: "g1", winner: "home", confidence: 11 }]).length).toBe(1);
    expect(validatePickem(GAMES, [{ gameId: "nope", winner: "home", confidence: 1 }]).length).toBe(1);
    const dupes = [
      { gameId: "g1", winner: "home" as const, confidence: 1 },
      { gameId: "g1", winner: "away" as const, confidence: 2 },
    ];
    expect(validatePickem(GAMES, dupes).join(" ")).toMatch(/duplicate pick/);
  });
});

describe("validateBracket", () => {
  const known = new Set(["georgia", "ohio-state", "texas", "oregon", "alabama", "miami"]);
  it("accepts valid partial seeds and champion from field", () => {
    const errs = validateBracket(
      { seeds: { 1: "georgia", 2: "ohio-state" }, champion: "georgia", tiebreaker: 52 },
      known,
    );
    expect(errs).toEqual([]);
  });
  it("rejects a champion outside the field", () => {
    const errs = validateBracket({ seeds: { 1: "georgia" }, champion: "texas", tiebreaker: null }, known);
    expect(errs.join(" ")).toMatch(/champion must be one of your 12/);
  });
  it("rejects duplicate teams, unknown teams, bad seeds, bad tiebreaker", () => {
    expect(
      validateBracket({ seeds: { 1: "georgia", 2: "georgia" }, champion: null, tiebreaker: null }, known).join(" "),
    ).toMatch(/more than one seed/);
    expect(
      validateBracket({ seeds: { 1: "fake-team" }, champion: null, tiebreaker: null }, known).length,
    ).toBe(1);
    expect(validateBracket({ seeds: { 13: "georgia" }, champion: null, tiebreaker: null }, known).join(" ")).toMatch(
      /invalid seed/,
    );
    expect(validateBracket({ seeds: {}, champion: null, tiebreaker: 999 }, known).join(" ")).toMatch(/tiebreaker/);
  });
  it("flags completeness only at 12 seeds + champion + tiebreaker", () => {
    const seeds = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, `t${i}`]));
    expect(bracketComplete({ seeds, champion: "t0", tiebreaker: 45 })).toBe(true);
    expect(bracketComplete({ seeds, champion: null, tiebreaker: 45 })).toBe(false);
  });
});

describe("scorePickem", () => {
  it("awards confidence on correct picks only", () => {
    expect(scorePickemPick({ winner: "home", confidence: 7 }, { winner: "home", awayPts: 10, homePts: 24 })).toBe(7);
    expect(scorePickemPick({ winner: "away", confidence: 7 }, { winner: "home", awayPts: 10, homePts: 24 })).toBe(0);
  });
  it("totals only games with results (running totals mid-week)", () => {
    const picks = [
      { slot: "g1", value: { winner: "home" as const, confidence: 10 } },
      { slot: "g2", value: { winner: "away" as const, confidence: 3 } },
      { slot: "g3", value: { winner: "home" as const, confidence: 5 } },
    ];
    const results = {
      g1: { winner: "home" as const, awayPts: 13, homePts: 20 },
      g2: { winner: "home" as const, awayPts: 21, homePts: 28 },
    };
    const scored = scorePickemEntry(picks, results);
    expect(scored.total).toBe(10);
    expect(scored.scoredGames).toBe(2);
    expect(scored.perPick).toEqual({ g1: 10, g2: 0 });
  });
});

describe("scoreBracketEntry", () => {
  const rule = { fieldPoints: 10, seedPoints: 25, champPoints: 100 };
  const official = {
    field: { 1: "georgia", 2: "ohio-state", 3: "texas", 4: "oregon" },
    champion: "georgia",
  };
  it("pays field + exact-seed + champion per the published 10/25/100 copy", () => {
    // Right team right seed (10+25), right team wrong seed (10), miss (0),
    // champion correct (+100).
    const scored = scoreBracketEntry(
      { 1: "georgia", 2: "texas", 3: "alabama" },
      "georgia",
      official,
      rule,
    );
    expect(scored.perSeed[1]).toBe(35);
    expect(scored.perSeed[2]).toBe(10);
    expect(scored.perSeed[3]).toBe(0);
    expect(scored.championPoints).toBe(100);
    expect(scored.total).toBe(145);
  });
  it("pays no champion bonus for a wrong champ, even if in field", () => {
    const scored = scoreBracketEntry({ 1: "georgia" }, "ohio-state", official, rule);
    expect(scored.championPoints).toBe(0);
    expect(scored.total).toBe(35);
  });
});

describe("tiebreakDistance", () => {
  it("sorts closest-first, missing predictions last", () => {
    expect(tiebreakDistance(52, 45)).toBe(7);
    expect(tiebreakDistance(40, 45)).toBe(5);
    expect(tiebreakDistance(null, 45)).toBe(Number.POSITIVE_INFINITY);
  });
});
