import { describe, it, expect } from "vitest";
import { hollowReport } from "./hollow";

describe("hollowReport", () => {
  it("kills an item built from what the details do not identify", () => {
    const body = "West Virginia released its initial depth chart, but the available details leave the lineup unknown.\n\nThe available details do not identify the chart's starters, backups or positions. They also do not identify the quarterback.";
    const v = hollowReport(body, "item");
    expect(v.hollow).toBe(true);
    expect(v.hits).toBeGreaterThanOrEqual(3);
  });
  it("allows a couple of honest unknowns inside real reporting", () => {
    const filler = Array.from({ length: 40 }, (_, i) => `Fact sentence number ${i} about the game and the roster.`).join(" ");
    const two = `Tennessee named Brandon the starter. Tennessee did not say when Brandon was told. ${filler} The report does not identify which schools voted. ${filler}`;
    expect(hollowReport(two, "brief").hollow).toBe(false);
    const three = `${two} The available material does not list the starters.`;
    expect(hollowReport(three, "brief").hollow).toBe(false); // 3 hits over ~500 words is reporting
  });
  it("ignores ordinary prose", () => {
    expect(hollowReport("Georgia beat Clemson 31-28 on a field goal with 13 seconds left. Smart said the defense was not available for comment.", "item").hollow).toBe(false);
  });
});
