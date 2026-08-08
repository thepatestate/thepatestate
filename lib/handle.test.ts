import { describe, it, expect } from "vitest";
import { validateHandle, RESERVED_HANDLES } from "./handle";

describe("validateHandle", () => {
  it("accepts valid handles and normalizes case", () => {
    const r = validateHandle("SicEmSaturdays");
    expect(r).toEqual({ ok: true, handle: "sicemsaturdays", display: "SicEmSaturdays" });
  });
  it("accepts underscores mid-handle and digits", () => {
    expect(validateHandle("porch_prophet_88").ok).toBe(true);
  });
  it("rejects too short and too long", () => {
    expect(validateHandle("ab")).toEqual({ ok: false, error: "length" });
    expect(validateHandle("a".repeat(21))).toEqual({ ok: false, error: "length" });
    expect(validateHandle("abc").ok).toBe(true);
    expect(validateHandle("a".repeat(20)).ok).toBe(true);
  });
  it("rejects bad charset", () => {
    for (const bad of ["hey there", "porch-swing", "josé", "state!"]) {
      expect(validateHandle(bad)).toEqual({ ok: false, error: "charset" });
    }
  });
  it("rejects leading/trailing underscore", () => {
    expect(validateHandle("_porch")).toEqual({ ok: false, error: "underscore" });
    expect(validateHandle("porch_")).toEqual({ ok: false, error: "underscore" });
  });
  it("rejects reserved names case-insensitively", () => {
    for (const r of ["josh", "JoshPate", "ADMIN", "thepatestate", "WireDesk"]) {
      expect(validateHandle(r)).toEqual({ ok: false, error: "reserved" });
    }
  });
  it("every reserved entry is itself lowercase", () => {
    for (const r of RESERVED_HANDLES) expect(r).toBe(r.toLowerCase());
  });
  it("rejects handles containing blocked slurs, anywhere in the string", () => {
    expect(validateHandle("chink")).toEqual({ ok: false, error: "reserved" });
    expect(validateHandle("BigTranny99")).toEqual({ ok: false, error: "reserved" });
    expect(validateHandle("xx_faggot_xx")).toEqual({ ok: false, error: "reserved" });
  });
  it("does not false-positive on ordinary words (Scunthorpe guard)", () => {
    expect(validateHandle("grass").ok).toBe(true);
    expect(validateHandle("firstclass").ok).toBe(true);
  });
});
