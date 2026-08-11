import { describe, expect, it } from "vitest";
import { rankPoints, tabulateBallots, validateBallot, type BallotRank } from "@/lib/jp-poll";

function ballot(...slugs: string[]): BallotRank[] {
  return slugs.map((team_slug, i) => ({ rank: i + 1, team_slug }));
}

describe("rankPoints", () => {
  it("pays 10 down to 1", () => {
    expect(rankPoints(1)).toBe(10);
    expect(rankPoints(10)).toBe(1);
  });
});

describe("tabulateBallots", () => {
  it("sums points and counts first-place votes", () => {
    const tally = tabulateBallots([
      ballot("georgia", "ohio-state", "texas"),
      ballot("ohio-state", "georgia", "texas"),
    ]);
    // georgia 10+9=19, ohio-state 9+10=19, texas 8+8=16
    expect(tally[0].points).toBe(19);
    expect(tally[1].points).toBe(19);
    expect(tally[2]).toMatchObject({ team_slug: "texas", points: 16, first_place: 0 });
    expect(tally[0].first_place).toBe(1);
    expect(tally[1].first_place).toBe(1);
  });
  it("breaks point ties by first-place votes, then alphabetically", () => {
    // georgia and ohio-state tie on points; georgia has 2 first-place votes.
    const tally = tabulateBallots([
      ballot("georgia", "ohio-state"),
      ballot("georgia", "ohio-state"),
      ballot("ohio-state", "georgia"),
      ballot("ohio-state", "georgia"),
      ballot("georgia", "ohio-state"),
      ballot("ohio-state", "georgia"),
    ]);
    expect(tally[0].points).toBe(tally[1].points);
    // 3 first-place each → alphabetical: georgia before ohio-state
    expect(tally[0].first_place).toBe(3);
    expect(tally[0].team_slug).toBe("georgia");
  });
  it("caps output at topN and ignores out-of-range ranks", () => {
    const many = Array.from({ length: 30 }, (_, i) => `team-${String(i).padStart(2, "0")}`);
    const ballots = [many.slice(0, 10), many.slice(10, 20), many.slice(20, 30)].map((s) => ballot(...s));
    expect(tabulateBallots(ballots, 25).length).toBe(25);
    expect(tabulateBallots([[{ rank: 11, team_slug: "x" }]]).length).toBe(0);
  });
  it("is deterministic regardless of ballot order", () => {
    const a = [ballot("georgia", "texas"), ballot("texas", "georgia"), ballot("alabama", "georgia")];
    const b = [a[2], a[0], a[1]];
    expect(tabulateBallots(a)).toEqual(tabulateBallots(b));
  });
});

describe("validateBallot", () => {
  const known = new Set(["georgia", "ohio-state", "texas", "oregon"]);
  it("accepts a valid partial ballot", () => {
    expect(validateBallot(ballot("georgia", "texas"), known)).toEqual([]);
  });
  it("rejects duplicate ranks, duplicate teams, unknown teams, bad ranks", () => {
    expect(
      validateBallot([{ rank: 1, team_slug: "georgia" }, { rank: 1, team_slug: "texas" }], known).join(" "),
    ).toMatch(/rank 1 used more than once/);
    expect(
      validateBallot([{ rank: 1, team_slug: "georgia" }, { rank: 2, team_slug: "georgia" }], known).join(" "),
    ).toMatch(/appears more than once/);
    expect(validateBallot([{ rank: 1, team_slug: "fake" }], known).length).toBe(1);
    expect(validateBallot([{ rank: 11, team_slug: "georgia" }], known).join(" ")).toMatch(/invalid rank/);
  });
});
