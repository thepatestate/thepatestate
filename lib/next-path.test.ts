import { describe, it, expect } from "vitest";
import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("passes through a plain path", () => {
    expect(safeNextPath("/porch")).toBe("/porch");
  });
  it("defaults empty and null to /", () => {
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
  });
  it("rejects protocol-relative URLs", () => {
    expect(safeNextPath("//evil.com")).toBe("/");
  });
  it("rejects backslash-prefixed URLs", () => {
    expect(safeNextPath("/\\evil.com")).toBe("/");
  });
  it("rejects off-site absolute URLs", () => {
    expect(safeNextPath("https://evil.com/x")).toBe("/");
  });
  it("reduces same-origin absolute URLs to a path", () => {
    expect(safeNextPath("https://thepatestate.com/porch?a=1")).toBe("/porch?a=1");
  });
  it("unwraps a nested next= on the auth callback", () => {
    expect(safeNextPath("https://thepatestate.com/auth/callback?next=%2Fporch")).toBe("/porch");
  });
  it("rejects a nested attack via the auth callback", () => {
    expect(safeNextPath("https://thepatestate.com/auth/callback?next=//evil.com")).toBe("/");
  });
});
