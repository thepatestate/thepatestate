import { describe, it, expect } from "vitest";
import { titleKeywords, keywordOverlap, hasAttribution } from "./wire";

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

describe("§21 attribution enforcement", () => {
  it("passes 'per ESPN' first sentences", () => {
    expect(hasAttribution("Georgia's starting left tackle will miss six weeks, per ESPN's report. More context.", ["ESPN"])).toBe(true);
  });
  it("passes official announcements", () => {
    expect(hasAttribution("Ohio State officially announced a contract extension for its head coach.", ["ESPN"])).toBe(true);
  });
  it("fails unattributed first sentences", () => {
    expect(hasAttribution("Georgia's starting left tackle will miss six weeks. Everyone is sad.", ["ESPN"])).toBe(false);
  });
});
