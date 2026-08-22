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
  it("flags Article Updates 4.0 corporate noun phrases", () => {
    expect(boilerplateViolations("The move reshapes the roster strategy in Athens.")).toContain("corporate noun phrase");
    expect(boilerplateViolations("Nobody questions the production profile here.")).toContain("corporate noun phrase");
    expect(boilerplateViolations("That raises the value of every internal answer.")).toContain("answer-as-player");
    expect(boilerplateViolations("The room needs a dependable answer behind Fleming.")).toContain("answer-as-player");
  });
  it("flags fake drama and fake profundity", () => {
    expect(boilerplateViolations("The season hinges on the left tackle.")).toContain("fake drama");
    expect(boilerplateViolations("The offense can't cash that check yet.")).toContain("fake drama");
    expect(boilerplateViolations("The season has to prove what the preseason can only assume.")).toContain("fake profundity");
    expect(boilerplateViolations("Continuity only matters until continuity is tested.")).toContain("fake profundity");
  });
  it("flags the-clean-read and story-under-the-story", () => {
    expect(boilerplateViolations("The clean read is that Georgia holds serve.")).toContain("the-clean-read");
    expect(boilerplateViolations("That's the story under the story here.")).toContain("story-under-the-story");
  });
  it("allows one thesis-announcing opener but flags repetition", () => {
    const one = "The question is whether the line holds up in November.";
    expect(boilerplateViolations(one)).not.toContain("repeated thesis-announcing openers");
    const two = one + "\nThe reality is that nobody knows yet.";
    expect(boilerplateViolations(two)).toContain("repeated thesis-announcing openers");
  });
  it("normal football prose survives the answer-as-player rule", () => {
    expect(boilerplateViolations("Stockton had an answer for every blitz Auburn showed him.")).toEqual([]);
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
