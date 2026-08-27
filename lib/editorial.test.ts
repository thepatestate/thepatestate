import { describe, it, expect } from "vitest";
import {
  boilerplateViolations, pickArchitecture, ARCHITECTURES, exemplarParroting, editorialSystem,
  HOUSE_NOTES, QUALITY_CATEGORIES, restatements, circles,
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

describe("editorialSystem (the kit's load order: 01 → 02 → spec → 07 → house notes → contract)", () => {
  it("stacks the Constitution, the Voice Bible, the spec, the snapshot, the notes, and the task prompt in order", () => {
    const sys = editorialSystem("wire", "TASK CONTRACT MARKER");
    const con = sys.indexOf("THE PATE STATE CONSTITUTION");
    const bible = sys.indexOf("THE PATE STATE VOICE BIBLE");
    const spec = sys.indexOf("SPEC: THE WIRE");
    const snap = sys.indexOf("CURRENT STATE — THE DATED SNAPSHOT");
    const ex = sys.indexOf("THE GOLD STANDARD —");
    const notes = sys.indexOf("SITE MECHANICS (what the site does for you");
    const task = sys.indexOf("TASK CONTRACT MARKER");
    // Kit v4 load order: 01 → 02 → the one spec → 07 → the gold standard → mechanics → contract.
    expect(con).toBeGreaterThanOrEqual(0);
    expect(bible).toBeGreaterThan(con);
    expect(spec).toBeGreaterThan(bible);
    expect(snap).toBeGreaterThan(spec);
    expect(ex).toBeGreaterThan(snap);
    expect(notes).toBeGreaterThan(ex);
    expect(task).toBeGreaterThan(notes);
  });
  it("routes each lane to its spec and never loads a retired file", () => {
    expect(editorialSystem("news-reaction", "")).toContain("SPEC: THE WIRE");
    expect(editorialSystem("feature", "")).toContain("SPEC: JOSH-VOICE FEATURES");
    expect(editorialSystem("show-adaptation", "")).toContain("SPEC: JOSH-VOICE FEATURES");
    expect(editorialSystem("annual", "")).toContain("SPEC: PRESEASON ANNUALS");
    for (const p of ["wire", "feature", "show-adaptation"] as const) {
      const sys = editorialSystem(p, "");
      expect(sys).not.toContain("EDITORIAL CORE");
      expect(sys).not.toContain("MASTER EDITORIAL + WRITING SYSTEM");
      expect(sys).not.toContain("Article Updates 4.0");
    }
  });
  it("closes every lane with the approved article it must sound like", () => {
    // Kit v4: the approval lane calibrates to the v3 gold standard; the
    // autonomous lane (Wire + house reaction) to the approved Wire build.
    expect(editorialSystem("feature", "")).toContain("=== feature-three-boards-v3_1.html ===");
    expect(editorialSystem("show-adaptation", "")).toContain("I picked three of them");
    expect(editorialSystem("news-reaction", "")).toContain("=== wire-ohio-state-rowe-safety.html ===");
    expect(editorialSystem("wire", "")).toContain("=== wire-ohio-state-rowe-safety.html ===");
  });
  it("house notes keep the site's mechanics out of the prose and the examples out of the stories", () => {
    expect(HOUSE_NOTES).toMatch(/SITE RENDERS THE FURNITURE/);
    expect(HOUSE_NOTES).toMatch(/GOLD STANDARD's facts/);
  });
  it("the judge scores discovery", () => {
    expect(QUALITY_CATEGORIES).toContain("discovery");
  });
});

describe("Voice Bible §6 gates (the kit)", () => {
  it("flags announced candor, 'the machine', internal craft vocabulary, and overrated", () => {
    expect(boilerplateViolations("The honest read is that Texas is fine.")).toContain("announcing candor");
    expect(boilerplateViolations("The machine has Ohio State first.")).toContain("the-machine as the Predictor");
    expect(boilerplateViolations("That left tackle is load-bearing for the season.")).toContain("internal craft vocabulary");
    expect(boilerplateViolations("Alabama is overrated this year.")).toContain("overrated dunk-framing");
    expect(boilerplateViolations("The Wildcats will look to bounce back.")).toContain("generic AI transition (kit)");
  });
  it("passes the Predictor named properly and plain football", () => {
    expect(boilerplateViolations("The AI Predictor has Ohio State 2.1 rating points clear of the field. Georgia is the market's favorite.")).toEqual([]);
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

describe("restatements / circles (the reader's #1 complaint)", () => {
  it("flags sentences that repeat an earlier sentence's content words", () => {
    const text = "Frazier is the closer because receiver asks less of a freshman than running back does. Walton has more to prove in protection before the staff trusts him. The staff can trust Frazier sooner because receiver asks less of a freshman than running back. Protection is where Walton still has the most to prove before the staff trusts him.";
    const hits = restatements(text);
    expect(hits.length).toBe(2);
  });
  it("does not flag a piece that keeps adding new information", () => {
    const text = "Rowe will miss four to six weeks with a high ankle sprain. He made the coverage checks on a defense that allowed 9.3 points per game. The four projected starters around him have no starts in this scheme. Texas arrives in Columbus in 17 days. Bowling Green will not stress a coverage check. Watch which safety wears the green dot against Texas. Day has not named the replacement. The transfer from Tulane played 40 snaps at nickel last season.";
    expect(restatements(text)).toEqual([]);
    expect(circles(text)).toBe(false);
  });
});

describe("abstractParagraphs", () => {
  it("flags a long paragraph with no name, number, play, or date", async () => {
    const { abstractParagraphs } = await import("./editorial");
    const abstract = "The popular read on this season is treating last year's results as permanent evidence about what these programs are, and that is where I think the conversation goes wrong, because a result is a snapshot of one afternoon and not a verdict on a program, and the difference between those two things is the whole argument here.";
    const concrete = "Ohio State returns three starters from a defense that allowed 9.3 points per game, and Rowe was the only one of them behind the front, which is why the Texas game on September 12 is the first real look at the four new starters around him and the one I have circled.";
    expect(abstractParagraphs(`${abstract}\n\n${concrete}`)).toHaveLength(1);
  });
});

describe("Voice Bible §13 as code (kit v4)", () => {
  it("kickerBudget allows one isolated kicker per 400 words in the body, excluding open and close", async () => {
    const { kickerBudget } = await import("./editorial");
    const para = "Georgia returns 117 combined career starts on the offensive line, which is the most of any team in the country and the reason the hard parts of football look routine in Athens. ".repeat(3);
    const ok = [para, para, "That decision has to work.", para, para, para, "— JP"].join("\n\n");
    expect(kickerBudget(ok).ok).toBe(true);
    const over = [para, "Short one.", para, "Another short one.", "A third.", para, "— JP"].join("\n\n");
    expect(kickerBudget(over).ok).toBe(false);
  });
  it("attributedInSentenceOne wants the source in sentence one", async () => {
    const { attributedInSentenceOne } = await import("./editorial");
    expect(attributedInSentenceOne("Ohio State safety Jalen Rowe will miss four to six weeks, head coach Ryan Day confirmed after practice. He has 26 starts.")).toBe(true);
    expect(attributedInSentenceOne("Pete Thamel reported the timeline Wednesday afternoon.")).toBe(true);
    expect(attributedInSentenceOne("Jalen Rowe is out four to six weeks. Ryan Day confirmed it later.")).toBe(false);
  });
  it("ensureSignOff appends — JP once", async () => {
    const { ensureSignOff } = await import("./editorial");
    expect(ensureSignOff("Body.")).toBe("Body.\n\n— JP");
    expect(ensureSignOff("Body.\n\n— JP")).toBe("Body.\n\n— JP");
  });
});

describe("kit v4.2 laws (Josh's Aug 27 corrections)", () => {
  it("bans the banal contingency, meta-analytical framing, the narrated Ledger line, and card-for-schedule", () => {
    expect(boilerplateViolations("Miami is the favorite as long as Mensah is upright.")).toContain("banal contingency (v4.2)");
    expect(boilerplateViolations("If the quarterback goes down they will not be as good.")).toContain("banal contingency (v4.2)");
    expect(boilerplateViolations("That last number deserves one honest footnote.")).toContain("meta-analytical framing (v4.2)");
    expect(boilerplateViolations("Here is the part I think gets missed.")).toContain("meta-analytical framing (v4.2)");
    expect(boilerplateViolations("The calendar is doing more work here than the roster gap is.")).toContain("meta-analytical framing (v4.2)");
    expect(boilerplateViolations("I logged this on August 27, 2026, and it will be graded when the ACC title is decided.")).toContain("Ledger narrated in prose (v4.2)");
    expect(boilerplateViolations("The toughest game on the whole card is at Notre Dame.")).toContain("card for a schedule (v4.2)");
  });
  it("lets the house versions through", () => {
    expect(boilerplateViolations("This one gets graded the night the ACC championship is decided.")).toEqual([]);
    expect(boilerplateViolations("The Cardinals host SMU on September 19. Louisville is a wild card in this race.")).toEqual([]);
    expect(boilerplateViolations("A 9.4 average is partly Carr's arm and partly a run game so dangerous that defenses spent the year conceding space.")).toEqual([]);
  });
});
