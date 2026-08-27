import { describe, it, expect } from "vitest";
import { exemplarProse, voiceExemplarBlock } from "./exemplars";

describe("voice exemplars (the approved reference builds)", () => {
  it("extracts Josh's Read as first-person prose", () => {
    const p = exemplarProse("feature-three-boards-v3");
    expect(p).toContain("I picked three of them");
    expect(p).not.toMatch(/<[a-z]+/);
    expect(p.split(/\s+/).length).toBeGreaterThan(1200);
  });
  it("extracts the Wire build as desk prose with no first person", () => {
    const p = exemplarProse("wire-ohio-state-rowe-safety");
    expect(p).toContain("Jalen Rowe");
    expect(p).not.toMatch(/\bI\b/);
  });
  it("wraps the exemplar with the match-the-voice, never-the-content rail", () => {
    const b = voiceExemplarBlock("feature");
    expect(b).toMatch(/THE GOLD STANDARD —/);
    expect(b).toMatch(/never reuse its claims/i);
    expect(b).toContain("=== end of exemplar ===");
  });
});
