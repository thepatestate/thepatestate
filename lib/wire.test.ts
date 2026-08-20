import { describe, it, expect } from "vitest";
import { titleKeywords, keywordOverlap, hasAttributionOpener, cleanHeadline, headlineNamesOutlet } from "./wire";

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
