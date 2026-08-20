import { describe, it, expect } from "vitest";
import { titleKeywords, keywordOverlap, hasAttributionOpener } from "./wire";

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
