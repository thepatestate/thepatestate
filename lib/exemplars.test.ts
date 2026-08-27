import { describe, it, expect } from "vitest";
import { exemplarProse, voiceExemplarBlock } from "./exemplars";

describe("voice exemplars (the approved reference builds)", () => {
  it("extracts Josh's Read as first-person prose", () => {
    const p = exemplarProse("feature-three-boards-v3_1");
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

describe("kit v4.2 second approved column", () => {
  it("extracts the Miami column as prose without the chrome, and passes its own laws", () => {
    const p = exemplarProse("article-miami-acc-favorite-v2");
    expect(p).toContain("So name the alternative.");
    expect(p).not.toContain("Photo Slot");
    expect(p).not.toContain("Watch the Companion");
    expect(p).not.toContain("Citizen Pulse");
    expect(p.split(/\s+/).length).toBeGreaterThan(850);
  });
  it("shows the feature lane both approved columns", () => {
    const b = voiceExemplarBlock("feature");
    expect(b).toContain("=== feature-three-boards-v3_1.html ===");
    expect(b).toContain("=== article-miami-acc-favorite-v2.html ===");
    expect(b).not.toContain("deserves one honest footnote");
  });
});
