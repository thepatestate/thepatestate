import { describe, it, expect } from "vitest";
import { boilerplateViolations, pickArchitecture, ARCHITECTURES } from "./editorial";

describe("boilerplateViolations", () => {
  it("flags banned labels", () => {
    expect(boilerplateViolations("The failure condition is simple.")).toContain("failure-condition label");
    expect(boilerplateViolations("The real question is whether the line holds.")).toContain("the-real-question");
    expect(boilerplateViolations("Watch the box count for the answer.")).toContain("watch-for-the-answer");
    expect(boilerplateViolations("Credit belongs to the staff.")).toContain("credit-belongs");
  });
  it("allows one counterpoint framing but flags two", () => {
    const one = "The honest counterpoint is the schedule.";
    expect(boilerplateViolations(one)).not.toContain("multiple counterpoint framings");
    const two = one + " Later, the honest complication is the quarterback room.";
    expect(boilerplateViolations(two)).toContain("multiple counterpoint framings");
  });
  it("passes fresh concrete prose", () => {
    expect(
      boilerplateViolations(
        "Oklahoma did just win ten games, and that's not nothing. The rushing average tells you which part of those wins is least likely to repeat.",
      ),
    ).toEqual([]);
  });
});

describe("pickArchitecture", () => {
  it("never repeats the most recent architectures", () => {
    const recent = ["number-first", "scene-first", "debate", "receipt"];
    for (let seed = 0; seed < 20; seed++) {
      expect(recent).not.toContain(pickArchitecture(recent, seed).key);
    }
  });
  it("caps the condition ladder at one in five", () => {
    const recent = ["condition-ladder", "number-first", "scene-first", "debate"];
    for (let seed = 0; seed < 20; seed++) {
      expect(pickArchitecture(recent, seed).key).not.toBe("condition-ladder");
    }
  });
  it("covers multiple architectures across seeds", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 12; seed++) seen.add(pickArchitecture([], seed).key);
    expect(seen.size).toBeGreaterThan(4);
    expect(ARCHITECTURES.length).toBe(12);
  });
});
