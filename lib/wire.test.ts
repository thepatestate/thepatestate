import { describe, it, expect } from "vitest";
import { titleKeywords, keywordOverlap, hasAttributionOpener, cleanHeadline, headlineNamesOutlet, splitSentences, scoreCallout, selectCallout, CALLOUT_BANNED } from "./wire";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("wire clustering", () => {
  it("clusters same-story titles across outlets", () => {
    const a = titleKeywords("Georgia starting left tackle out six weeks with foot injury");
    const b = titleKeywords("Report: Georgia LT expected to miss six weeks (foot)");
    expect(keywordOverlap(a, b)).toBeGreaterThanOrEqual(0.6);
  });

  it("keeps unrelated stories apart", () => {
    const a = titleKeywords("Georgia starting left tackle out six weeks with foot injury");
    const b = titleKeywords("Big 12 announces new media rights extension with ESPN and FOX");
    expect(keywordOverlap(a, b)).toBeLessThan(0.6);
  });

  it("strips stopwords and short tokens", () => {
    const kw = titleKeywords("The College Football News Report of the Week");
    expect(kw.has("the")).toBe(false);
    expect(kw.has("college")).toBe(false);
    expect(kw.has("week")).toBe(true);
  });
});

describe("§21 attribution rule (flipped 2026-08-20: no in-prose attribution)", () => {
  it("rejects 'Per X' openers", () => {
    expect(hasAttributionOpener("Per On3's report, Kentucky will open in Week Zero. More context.")).toBe(true);
  });
  it("rejects 'According to X' openers", () => {
    expect(hasAttributionOpener("According to ESPN, Georgia's left tackle will miss six weeks.")).toBe(true);
  });
  it("rejects prose that narrates the report", () => {
    expect(hasAttributionOpener("Kentucky moved its opener. The report notes the change helps travel.")).toBe(true);
  });
  it("passes plain factual openers", () => {
    expect(hasAttributionOpener("Georgia's starting left tackle will miss six weeks. Everyone is sad.")).toBe(false);
  });
  it("passes official-announcement phrasing", () => {
    expect(hasAttributionOpener("Ohio State officially announced a contract extension for its head coach.")).toBe(false);
  });
});

describe("cleanHeadline", () => {
  it("strips markdown bold", () => {
    expect(cleanHeadline("**Akron promotion draws backlash**")).toBe("Akron promotion draws backlash");
  });
  it("strips trailing outlet leans", () => {
    expect(cleanHeadline("Kentucky Pursues Jaxon Kohler and Mark Mitchell, per On3")).toBe("Kentucky Pursues Jaxon Kohler and Mark Mitchell");
    expect(cleanHeadline("Luke Fickell enters Wisconsin season on hot seat, per Yahoo Sports")).toBe("Luke Fickell enters Wisconsin season on hot seat");
  });
  it("leaves clean headlines alone", () => {
    expect(cleanHeadline("Texas A&M to Unveil Statue Honoring R.C. Slocum")).toBe("Texas A&M to Unveil Statue Honoring R.C. Slocum");
  });
});

describe("cleanHeadline leading-outlet strip", () => {
  it("strips outlet-verb openers", () => {
    expect(cleanHeadline("On3 Reports Five Oregon Players Raising Their Stock in Fall Camp")).toBe("Five Oregon Players Raising Their Stock in Fall Camp");
    expect(cleanHeadline("ESPN: Rebuilt Pac-12 Aims to Be 'League of Its Own'")).toBe("Rebuilt Pac-12 Aims to Be 'League of Its Own'");
    expect(cleanHeadline("Yahoo ranks Miami atop 2026 ACC power rankings")).toBe("Miami atop 2026 ACC power rankings");
  });
  it("flags mid-headline outlet mentions for real rewrite", () => {
    expect(headlineNamesOutlet("Miami\u2019s New Quarterback Headlines Yahoo Sports\u2019 ACC Transfer List")).toBe(true);
    expect(headlineNamesOutlet("Texas A&M to Unveil Statue Honoring R.C. Slocum")).toBe(false);
    expect(headlineNamesOutlet("Georgia trails three SEC rivals in NIL spending")).toBe(false);
    expect(headlineNamesOutlet("Four-star WR climbs the Rivals300 after camp season")).toBe(true);
  });
});

describe("splitSentences", () => {
  it("protects abbreviations, ranks, and dates", () => {
    const out = splitSentences("Oklahoma plays Texas on Oct. 10. The Sooners were already No. 10 nationally. St. John's is unrelated.");
    expect(out).toHaveLength(3);
    expect(out[0]).toBe("Oklahoma plays Texas on Oct. 10.");
    expect(out[1]).toBe("The Sooners were already No. 10 nationally.");
  });
});

describe("scoreCallout", () => {
  it("accepts a concrete claim with contrast", () => {
    expect(scoreCallout("Florida State has a place in the group, but the group has eight names.")).toBeGreaterThanOrEqual(4);
  });
  it("vetoes template and process language", () => {
    expect(scoreCallout("This moves Oklahoma's expectations up a spot, not the earth.")).toBe(-Infinity);
    expect(scoreCallout("The task now is decision communication, not another scrimmage.")).toBe(-Infinity);
    expect(scoreCallout("The failure condition is straightforward for the Sooners this season.")).toBe(-Infinity);
  });
  it("vetoes hedge-stacked sentences", () => {
    expect(scoreCallout("Georgia might win the opener and could be favored, whether the line holds or not.")).toBe(-Infinity);
  });
  it("vetoes report/outlet mentions and fragments", () => {
    expect(scoreCallout("The report says Georgia will start the veteran quarterback this weekend.")).toBe(-Infinity);
    expect(scoreCallout("because the roster was bought at championship price this year")).toBe(-Infinity);
  });
});

describe("selectCallout", () => {
  it("prefers a strong read sentence and skips junk", () => {
    const story = {
      whatHappened: "Brent Venables signed a six-year extension with Oklahoma. The contract averages $10.5 million annually.",
      whyItMatters: ["Six ranked opponents sit on the 2026 schedule."],
      readBody: "This moves expectations up a spot, not the earth. If that schedule turns 2026 into another six-win finish, the length of this deal will become the story.",
    };
    const pick = selectCallout(story);
    expect(pick).toContain("six-win finish");
  });
  it("returns empty when nothing clears the bar", () => {
    expect(selectCallout({ whatHappened: "A thing occurred.", whyItMatters: [], readBody: "It is what it is for now." })).toBe("");
  });
});

describe("prompt hygiene (regression guard)", () => {
  it("wire prompts contain no callout-banned phrases", () => {
    for (const name of ["wire-story.md", "wire-item.md", "global-preamble.md"]) {
      const text = readFileSync(join(process.cwd(), "prompts", name), "utf8");
      for (const sentence of text.split(/\n/)) {
        // The ban applies to quotable prose examples; instruction lines that
        // BAN a phrase necessarily mention it, so only flag lines that are
        // not explicit prohibitions.
        if (/never|banned|ban list|do not|don'?t/i.test(sentence)) continue;
        for (const re of CALLOUT_BANNED.slice(0, 5)) {
          expect(sentence).not.toMatch(re);
        }
      }
    }
  });
});
