import { describe, it, expect } from "vitest";
import { parseMarkers, tsToSeconds } from "./markers";

describe("tsToSeconds", () => {
  it("parses HH:MM:SS", () => expect(tsToSeconds("01:02:03")).toBe(3723));
  it("parses MM:SS", () => expect(tsToSeconds("14:22")).toBe(862));
  it("returns 0 for junk", () => expect(tsToSeconds("nope")).toBe(0));
});

describe("parseMarkers", () => {
  it("splits text, embeds, and pullquote in order", () => {
    const segs = parseMarkers("Intro. [EMBED:00:14:22] Middle. [PULLQUOTE] End.");
    expect(segs).toEqual([
      { type: "text", markdown: "Intro." },
      { type: "embed", seconds: 862 },
      { type: "text", markdown: "Middle." },
      { type: "pullquote" },
      { type: "text", markdown: "End." },
    ]);
  });
  it("handles a body with no markers", () => {
    expect(parseMarkers("Just words.")).toEqual([{ type: "text", markdown: "Just words." }]);
  });
});
