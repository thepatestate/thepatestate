import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseTimedText, transcriptToPromptText } from "./transcript";

const xml = readFileSync(new URL("./__fixtures__/timedtext.xml", import.meta.url), "utf8");

describe("parseTimedText", () => {
  it("parses segments with numeric starts", () => {
    const segs = parseTimedText(xml);
    expect(segs).toHaveLength(3);
    expect(segs[0]).toEqual({ start: 0.32, text: "welcome back to the front porch" });
  });
  it("decodes double-escaped entities", () => {
    expect(parseTimedText(xml)[1].text).toBe("let's talk about the top ten & who survives");
  });
  it("returns [] for malformed input", () => {
    expect(parseTimedText("")).toEqual([]);
    expect(parseTimedText("<html>nope</html>")).toEqual([]);
  });
});

describe("transcriptToPromptText", () => {
  it("formats [MM:SS] lines", () => {
    const out = transcriptToPromptText([{ start: 65.5, text: "hello porch" }]);
    expect(out).toBe("[01:05] hello porch");
  });
  it("caps total length at 60000 chars", () => {
    const segs = Array.from({ length: 5000 }, (_, i) => ({ start: i, text: "x".repeat(20) }));
    expect(transcriptToPromptText(segs).length).toBeLessThanOrEqual(60000);
  });
});
