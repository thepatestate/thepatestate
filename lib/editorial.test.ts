import { describe, it, expect } from "vitest";
import {
  boilerplateViolations, pickArchitecture, ARCHITECTURES, exemplarParroting, editorialSystem,
  HOUSE_OVERRIDES, VOICE_V4_PROMPT, QUALITY_CATEGORIES,
} from "./editorial";

describe("Editorial Core gates (Josh's MD files, 2026-08-23)", () => {
  it("flags consulting language (Core §13)", () => {
    expect(boilerplateViolations("The move has strategic implications for the developmental infrastructure.")).toContain("consulting language");
    expect(boilerplateViolations("He offers a pathway to production and a meaningful contribution.")).toContain("consulting language");
    expect(boilerplateViolations("This is a talent acquisition with a strong impact profile.")).toContain("consulting language");
  });
  it("flags generic AI transitions (Core §14)", () => {
    expect(boilerplateViolations("This development comes as Georgia prepares for Tennessee.")).toContain("generic AI transition");
    expect(boilerplateViolations("Moving forward, the staff has options. That being said, nobody knows.")).toContain("generic AI transition");
    expect(boilerplateViolations("Fans will certainly be watching the left tackle.")).toContain("generic AI transition");
  });
  it("flags analytical scaffolding labels (Core §17, Notebook §18)", () => {
    expect(boilerplateViolations("The mechanism is simple: slide the protection.")).toContain("scaffolding label");
    expect(boilerplateViolations("The best-case scenario is a ten-win season.")).toContain("scaffolding label");
    expect(boilerplateViolations("The cleanest read is that Oregon holds serve.")).toContain("scaffolding label");
  });
  it("flags coaching clichés and 'first real test' (Game Week §63–64)", () => {
    expect(boilerplateViolations("This one will be won in the trenches.")).toContain("coaching cliché");
    expect(boilerplateViolations("Tennessee is Georgia's first real test.")).toContain("coaching cliché");
    expect(boilerplateViolations("It's a statement game for Michigan.")).toContain("coaching cliché");
  });
  it("flags recruiting hype (Recruiting §73, §85)", () => {
    expect(boilerplateViolations("A massive get for Georgia as the rich get richer.")).toContain("recruiting hype");
    expect(boilerplateViolations("Ohio State's recruiting heater continues with a loaded class.")).toContain("recruiting hype");
  });
  it("rations podcast-transcript devices: one is fine, two flag (Core §15)", () => {
    const one = "Here's the thing. Georgia has nine returning starters on defense.";
    expect(boilerplateViolations(one)).not.toContain("podcast-transcript devices");
    const two = `${one} If you're Tennessee, that's the deal you signed up for.`;
    expect(boilerplateViolations(two)).toContain("podcast-transcript devices");
  });
  it("flags a pile-up of rhetorical questions (Notebook §38)", () => {
    const five = "Can he start? Will he stay? Does it matter? Who replaces him? When do we know?";
    expect(boilerplateViolations(five)).toContain("rhetorical question pile-up");
    expect(boilerplateViolations("Who replaces him? Nobody has said. The opener is in 13 days.")).not.toContain("rhetorical question pile-up");
  });
  it("passes ordinary reported football prose", () => {
    expect(boilerplateViolations(
      "Kansas State announced Thursday that left tackle John Pastore will miss the season. He was the only returning starter on a line replacing four. Collin Klein said the staff will look at two transfers first, and the opener against Iowa State is in 16 days.",
    ).filter((v) => v !== "exemplar parroting")).toEqual([]);
  });
});

describe("exemplarParroting (the documents' examples are not templates)", () => {
  it("catches the documents' signature lines", () => {
    expect(exemplarParroting("Fleming caught 40 passes. Every other Maryland tight end combined caught nine.")).not.toEqual([]);
    expect(exemplarParroting("A court ruling can restore eligibility. It cannot restore May.")).not.toEqual([]);
    expect(exemplarParroting("Texas has its No. 1 receiver. Now it needs a No. 2.")).not.toEqual([]);
    expect(exemplarParroting("Depth always looks better on an August roster than it does in November.")).not.toEqual([]);
    expect(exemplarParroting("Georgia doesn't have a talent problem. It has a January problem.")).not.toEqual([]);
  });
  it("catches exemplar people appearing in a story about another team", () => {
    expect(exemplarParroting("Oregon needs someone like Fleming to emerge at tight end.")).toContain("exemplar name out of context");
  });
  it("allows the exemplar people in a story actually about their team", () => {
    expect(exemplarParroting("Maryland tight end Dorian Fleming is back for another season in College Park.")).toEqual([]);
  });
  it("is surfaced through boilerplateViolations", () => {
    expect(boilerplateViolations("Kansas State lost the one lineman it thought it didn't have to replace.")).toContain("exemplar parroting");
  });
});

describe("editorialSystem (Core → product MD → house overrides → task contract)", () => {
  it("stacks the Editorial Core, the product document, the overrides, and the task prompt in order", () => {
    const sys = editorialSystem("wire", "TASK CONTRACT MARKER");
    const core = sys.indexOf("THE PATE STATE EDITORIAL CORE");
    const wire = sys.indexOf("MASTER EDITORIAL + WRITING SYSTEM");
    const over = sys.indexOf("HOUSE OVERRIDES (current site policy");
    const task = sys.indexOf("TASK CONTRACT MARKER");
    expect(core).toBeGreaterThan(0);
    expect(wire).toBeGreaterThan(core);
    expect(over).toBeGreaterThan(wire);
    expect(task).toBeGreaterThan(over);
  });
  it("routes each product to its own document", () => {
    expect(editorialSystem("notebook", "")).toContain("THE PATE STATE NOTEBOOK");
    expect(editorialSystem("recruiting", "")).toContain("RECRUITING INTELLIGENCE");
    expect(editorialSystem("game-week", "")).toContain("GAME WEEK");
    const show = editorialSystem("show-adaptation", "");
    expect(show).toContain("THE PATE STATE EDITORIAL CORE");
    expect(show).not.toContain("MASTER EDITORIAL + WRITING SYSTEM");
  });
  it("overrides keep attribution in the footer and ration spoken devices", () => {
    expect(HOUSE_OVERRIDES).toMatch(/ATTRIBUTION LIVES IN THE FOOTER/);
    expect(HOUSE_OVERRIDES).toMatch(/EXAMPLES ARE NOT TEMPLATES/);
  });
  it("the distilled voice layer no longer hands the writer stock spoken transitions", () => {
    expect(VOICE_V4_PROMPT).not.toMatch(/That's the bet\./);
    expect(VOICE_V4_PROMPT).not.toMatch(/where this gets interesting/);
  });
  it("the judge scores discovery", () => {
    expect(QUALITY_CATEGORIES).toContain("discovery");
  });
});

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
