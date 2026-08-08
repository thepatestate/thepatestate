import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseTimedText, parseSrv3, transcriptToPromptText } from "./transcript";

const xml = readFileSync(new URL("./__fixtures__/timedtext.xml", import.meta.url), "utf8");
const srv3Xml = readFileSync(new URL("./__fixtures__/srv3.xml", import.meta.url), "utf8");

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

describe("parseSrv3", () => {
  it("parses <p t> segments, converting ms to seconds", () => {
    const segs = parseSrv3(srv3Xml);
    expect(segs).toHaveLength(3);
    expect(segs[0].start).toBe(0.32);
  });
  it("strips <s> word-fragment tags and joins their text", () => {
    expect(parseSrv3(srv3Xml)[0].text).toBe("welcome back to the front porch");
  });
  it("decodes double-escaped entities", () => {
    expect(parseSrv3(srv3Xml)[1].text).toBe("let's talk about the top ten & who survives");
  });
  it("collapses internal whitespace runs to a single space", () => {
    expect(parseSrv3(srv3Xml)[2].text).toBe("first up: Georgia");
  });
  it("returns [] for malformed input", () => {
    expect(parseSrv3("")).toEqual([]);
    expect(parseSrv3("<html>nope</html>")).toEqual([]);
  });
  it("skips empty segments", () => {
    const xmlWithEmpty = `<timedtext><body><p t="100"></p><p t="200">hi</p></body></timedtext>`;
    const segs = parseSrv3(xmlWithEmpty);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toEqual({ start: 0.2, text: "hi" });
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
