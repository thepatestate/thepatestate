import { describe, it, expect } from "vitest";
import { buildWirePrompt } from "./hero-image";

describe("buildWirePrompt", () => {
  it("picks the scene from the headline before the category, and never names the team", () => {
    const p = buildWirePrompt("Georgia quarterback out for the season with torn ACL", "general", ["georgia"]);
    expect(p).toMatch(/lone football helmet/);
    expect(p).not.toMatch(/georgia/i);
    expect(p).toMatch(/No visible logos/);
  });
  it("falls back to the category, then the default scene", () => {
    expect(buildWirePrompt("Board meets on Tuesday", "recruiting")).toMatch(/high school football field/);
    expect(buildWirePrompt("Board meets on Tuesday", "general")).toMatch(/stadium at dusk/);
  });
  it("varies light and camera by headline so a day's file is not one image", () => {
    const a = buildWirePrompt("Ohio State opens 2026 season against Ball State");
    const b = buildWirePrompt("Oklahoma opens 2026 against UTEP ahead of Michigan trip");
    const c = buildWirePrompt("Cincinnati opens against Boston College with streak at stake");
    expect(new Set([a, b, c]).size).toBeGreaterThan(1);
    expect(buildWirePrompt("same headline")).toBe(buildWirePrompt("same headline"));
  });
});
