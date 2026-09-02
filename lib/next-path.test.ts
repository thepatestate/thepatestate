import { describe, it, expect } from "vitest";
import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("passes through a plain path", () => {
    expect(safeNextPath("/quad")).toBe("/quad");
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
    expect(safeNextPath("https://thepatestate.com/quad?a=1")).toBe("/quad?a=1");
  });
  it("unwraps a nested next= on the auth callback", () => {
    expect(safeNextPath("https://thepatestate.com/auth/callback?next=%2Fquad")).toBe("/quad");
  });
  it("rejects a nested attack via the auth callback", () => {
    expect(safeNextPath("https://thepatestate.com/auth/callback?next=//evil.com")).toBe("/");
  });
  it("rejects a tab-injected protocol-relative URL", () => {
    expect(safeNextPath("/\t/evil.com")).toBe("/");
  });
  it("rejects a percent-encoded tab that decodes to a protocol-relative URL", () => {
    expect(safeNextPath(decodeURIComponent("/%09/evil.com"))).toBe("/");
  });
  it("rejects a newline-injected protocol-relative URL", () => {
    expect(safeNextPath("/\n/evil.com")).toBe("/");
  });
  it("leaves a normal path with no control characters unaffected", () => {
    expect(safeNextPath("/quad/thread-12")).toBe("/quad/thread-12");
  });
});
