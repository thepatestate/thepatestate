// Editorial Engine V2 — feature flags (brief §4.2, §25). Everything defaults
// to OFF except shadow mode, which defaults to ON so that turning a lane on
// can never publish by accident: a lane must be enabled AND shadow must be
// explicitly turned off before V2 output reaches a reader.

const on = (v: string | undefined) => v === "1" || v?.toLowerCase() === "true";

export interface EditorialV2Flags {
  enabled: boolean;
  show: boolean;
  standalone: boolean;
  wire: boolean;
  shadow: boolean;
  maxCycles: number;
}

export function editorialV2Flags(env: Record<string, string | undefined> = process.env): EditorialV2Flags {
  const enabled = on(env.EDITORIAL_V2_ENABLED);
  const shadow = env.EDITORIAL_V2_SHADOW_MODE === undefined ? true : on(env.EDITORIAL_V2_SHADOW_MODE);
  const cycles = Number(env.EDITORIAL_V2_MAX_CYCLES ?? 3);
  return {
    enabled,
    show: enabled && on(env.EDITORIAL_V2_SHOW_ENABLED),
    standalone: enabled && on(env.EDITORIAL_V2_STANDALONE_ENABLED),
    wire: enabled && on(env.EDITORIAL_V2_WIRE_ENABLED),
    shadow,
    maxCycles: Number.isFinite(cycles) && cycles > 0 ? Math.min(6, cycles) : 3,
  };
}

/** True only when a lane is on AND shadow is off: the sole condition under
 * which V2 may write a reader-facing document. */
export function v2MayWrite(lane: "show" | "standalone" | "wire", env: Record<string, string | undefined> = process.env): boolean {
  const f = editorialV2Flags(env);
  return f[lane] && !f.shadow;
}
