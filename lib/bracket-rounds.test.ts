import { describe, it, expect } from "vitest";
import { buildRounds, championOf, seedFromRanked } from "./bracket-rounds";

const FIELD = ["Georgia", "Ohio State", "Clemson", "Boise State", "Texas", "Oregon", "Penn State", "LSU", "Notre Dame", "Alabama", "Miami", "Indiana"]
  .map((name, i) => ({ seed: i + 1, name, slug: name.toLowerCase().replace(/\s+/g, "-") }));

describe("buildRounds (two-sided 12-team bracket)", () => {
  it("lays out seven columns funneling to the championship", () => {
    const rounds = buildRounds(FIELD);
    expect(rounds.map((r) => r.title)).toEqual([
      "First Round", "Quarterfinals", "Semifinal", "National Championship", "Semifinal", "Quarterfinals", "First Round",
    ]);
    expect(rounds[3].center).toBe(true);
    expect(rounds[0].games[0]).toMatchObject({ seedA: 9, seedB: 8, tag: "AT LSU" });
    expect(rounds[6].games[1]).toMatchObject({ seedA: 11, seedB: 6, tag: "AT OREGON" });
  });
  it("plays chalk by default: the 1 seed wins it all", () => {
    expect(championOf(buildRounds(FIELD))).toBe("Georgia");
    const qf = buildRounds(FIELD)[1].games[0];
    expect(qf).toMatchObject({ seedA: 1, teamA: "Georgia", winA: true, seedB: 8, teamB: "LSU" });
  });
  it("routes the named champion through every game it plays, chalk elsewhere", () => {
    const rounds = buildRounds(FIELD, { champion: "indiana" });
    expect(championOf(rounds)).toBe("Indiana");
    expect(rounds[0].games[1]).toMatchObject({ seedA: 12, winA: true, seedB: 5, winB: false });
    // The other half is still chalk: Ohio State reaches the final.
    expect(rounds[3].games[0].teamB).toBe("Ohio State");
  });
  it("honors explicit winners by matchup key", () => {
    const rounds = buildRounds(FIELD, { winners: { "8-9": "notre-dame" } });
    expect(rounds[0].games[0]).toMatchObject({ teamA: "Notre Dame", winA: true, winB: false });
    expect(rounds[1].games[0].teamB).toBe("Notre Dame");
  });
  it("renders TBD for missing seeds and no champion until the field is complete", () => {
    const rounds = buildRounds(FIELD.slice(0, 4));
    expect(rounds[0].games[0].teamA).toBe("TBD");
    expect(championOf(rounds)).toBe("Georgia");
    expect(championOf(buildRounds([]))).toBe("");
  });
  it("seeds a ranked list into a 12-team field", () => {
    const seeded = seedFromRanked(FIELD.map((t) => ({ name: t.name, slug: t.slug })).concat([{ name: "Utah", slug: "utah" }]));
    expect(seeded).toHaveLength(12);
    expect(seeded[11]).toMatchObject({ seed: 12, name: "Indiana" });
  });
});

describe("Josh's bracket from the column", () => {
  it("reproduces his on-record path: Indiana to the semifinal, Georgia over Ohio State", async () => {
    const { joshBracketRounds } = await import("./josh-bracket");
    const rounds = joshBracketRounds();
    expect(championOf(rounds)).toBe("Georgia");
    expect(rounds[0].games[1]).toMatchObject({ teamA: "Indiana", winA: true, teamB: "Texas" });
    expect(rounds[1].games[1]).toMatchObject({ teamA: "Boise State", winA: false, teamB: "Indiana", winB: true });
    expect(rounds[2].games[0]).toMatchObject({ teamA: "Georgia", winA: true, teamB: "Indiana" });
    expect(rounds[5].games[1]).toMatchObject({ teamA: "Clemson", winA: false, teamB: "Oregon", winB: true });
    expect(rounds[3].games[0]).toMatchObject({ teamA: "Georgia", winA: true, teamB: "Ohio State" });
  });
});
