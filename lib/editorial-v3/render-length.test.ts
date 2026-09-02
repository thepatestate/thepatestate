import { describe, it, expect } from "vitest";
import { renderedWords, moduleCoverage, rendersFlat, shortfall, RENDER_FLOOR } from "./render-length";

const lorem = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

describe("rendered length", () => {
  it("counts the flat body when no modules exist, plus add-on sections", () => {
    const s = { bodyMarkdown: lorem(120), watching: [{ title: lorem(5), body: lorem(20) }], questions: [{ question: lorem(8), why: lorem(40) }] };
    expect(rendersFlat(s)).toBe(true);
    expect(renderedWords(s)).toBe(120 + 25 + 48);
  });
  it("counts the modules, not the body, once the page takes the module path", () => {
    const s = { bodyMarkdown: lorem(300), whatHappened: lorem(90), whyBody: lorem(60), missing: lorem(30), watching: [{ title: lorem(4), body: lorem(16) }] };
    expect(rendersFlat(s)).toBe(false);
    expect(renderedWords(s)).toBe(90 + 60 + 30 + 20);
    expect(shortfall(s)).toBe(RENDER_FLOOR - 200);
  });
  it("measures how much of the body the decomposition kept", () => {
    expect(moduleCoverage({ whatHappened: lorem(45), whyBody: lorem(45) }, lorem(100))).toBeCloseTo(0.9);
    expect(moduleCoverage({ whatHappened: lorem(100) }, "")).toBe(1);
  });
  it("ignores empty and null sections", () => {
    expect(renderedWords({ bodyMarkdown: lorem(10), missing: null, watching: null, questions: [{ question: "", why: null }] })).toBe(10);
  });
});
