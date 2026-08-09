import { describe, it, expect } from "vitest";
import { buildHeroPrompt } from "./hero-image";

const GUARDRAIL =
  "Cinematic editorial photography, deep navy-blue shadows, warm golden-amber highlights, film grain. " +
  "No visible logos, no team emblems, no readable text, no recognizable faces.";

describe("buildHeroPrompt", () => {
  it("always appends the guardrail suffix verbatim", () => {
    expect(buildHeroPrompt("Any random headline", [])).toContain(GUARDRAIL);
    expect(buildHeroPrompt("Georgia beats Alabama in a classic", ["georgia", "alabama"])).toContain(GUARDRAIL);
  });

  it("falls back to a generic dusk-stadium scene with no keyword match", () => {
    const prompt = buildHeroPrompt("A perfectly bland headline about nothing in particular", []);
    expect(prompt).toContain("dusk");
    expect(prompt).toContain(GUARDRAIL);
  });

  it("maps playoff/championship keywords to a night-stadium scene", () => {
    const prompt = buildHeroPrompt("The Playoff Picture Just Got Clearer", []);
    expect(prompt).toMatch(/night stadium|championship/i);
  });

  it("maps weather keywords to a storm scene", () => {
    const prompt = buildHeroPrompt("Snow Blankets the Field for a Historic Upset", []);
    expect(prompt).toMatch(/storm/i);
  });

  it("maps recruiting/portal keywords to a practice-field scene", () => {
    const prompt = buildHeroPrompt("Five-Star Commit Flips in the Portal Window", []);
    expect(prompt).toMatch(/practice field/i);
  });

  it("maps coaching keywords to a sideline scene", () => {
    const prompt = buildHeroPrompt("Hot Seat Watch: Three Coaches on the Brink", []);
    expect(prompt).toMatch(/sideline/i);
  });

  it("maps ranking/poll keywords to a tunnel scene", () => {
    const prompt = buildHeroPrompt("Why the Poll Still Doesn't Trust No. 1", []);
    expect(prompt).toMatch(/tunnel/i);
  });

  it("never interpolates team names into the prompt", () => {
    const prompt = buildHeroPrompt("Georgia and Alabama Renew the Rivalry", ["georgia", "alabama"]);
    expect(prompt.toLowerCase()).not.toContain("georgia");
    expect(prompt.toLowerCase()).not.toContain("alabama");
  });

  it("adds a rivalry-week nod only when 2+ teams are involved", () => {
    const solo = buildHeroPrompt("A Quiet Bye Week Story", ["georgia"]);
    const rivalry = buildHeroPrompt("A Quiet Bye Week Story", ["georgia", "alabama"]);
    expect(solo).not.toContain("rivalry-week");
    expect(rivalry).toContain("rivalry-week");
  });

  it("defaults the teams argument to an empty array", () => {
    expect(() => buildHeroPrompt("No teams passed at all")).not.toThrow();
  });
});
