// Editorial Engine V3 — feature flags (brief §22 step 2). Everything defaults
// OFF except shadow mode, which defaults ON: a lane must be enabled AND
// shadow explicitly off before V3 output reaches a reader.

const on = (v: string | undefined) => v === "1" || v?.toLowerCase() === "true";

export interface EditorialV3Flags {
  enabled: boolean;
  josh: boolean;
  reported: boolean;
  shadow: boolean;
}

export function editorialV3Flags(env: Record<string, string | undefined> = process.env): EditorialV3Flags {
  const enabled = on(env.EDITORIAL_V3_ENABLED);
  return {
    enabled,
    josh: enabled && on(env.EDITORIAL_V3_JOSH_ENABLED),
    reported: enabled && on(env.EDITORIAL_V3_REPORTED_ENABLED),
    shadow: env.EDITORIAL_V3_SHADOW_MODE === undefined ? true : on(env.EDITORIAL_V3_SHADOW_MODE),
  };
}

/** True only when a lane is on AND shadow is off. */
export function v3MayWrite(lane: "josh" | "reported", env: Record<string, string | undefined> = process.env): boolean {
  const f = editorialV3Flags(env);
  return f[lane] && !f.shadow;
}

/** Josh's Read auto-publish (Isaac, 2026-08-30: "It doesn't make sense to
 * gate on a human, there is no human to check it right now"). Default ON;
 * EDITORIAL_JOSH_AUTOPUBLISH=false restores the Studio approval click. */
export function joshAutoPublish(env: Record<string, string | undefined> = process.env): boolean {
  return env.EDITORIAL_JOSH_AUTOPUBLISH === undefined ? true : on(env.EDITORIAL_JOSH_AUTOPUBLISH);
}
