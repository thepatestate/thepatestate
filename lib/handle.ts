export const RESERVED_HANDLES = [
  "josh", "joshpate", "pate", "patestate", "thepatestate", "admin", "administrator",
  "mod", "moderator", "official", "staff", "support", "wiredesk", "thewire",
  "citizen", "porch", "quad", "mayor", "help", "api", "root", "system",
] as const;

// Conservative, unambiguous list of severe slurs, checked as substrings.
// Kept short and deliberately excludes anything that collides with ordinary
// words (the "Scunthorpe problem") — e.g. no fragments that appear inside
// "grass", "class", "cockpit", etc.
const BLOCKED_SUBSTRINGS = [
  "nigger", "nigga", "chink", "kike", "gook", "faggot", "tranny", "wetback", "dyke",
] as const;

export type HandleResult =
  | { ok: true; handle: string; display: string }
  | { ok: false; error: "length" | "charset" | "underscore" | "reserved" };

export function validateHandle(raw: string): HandleResult {
  const display = raw.trim();
  if (display.length < 3 || display.length > 20) return { ok: false, error: "length" };
  if (!/^[a-zA-Z0-9_]+$/.test(display)) return { ok: false, error: "charset" };
  if (display.startsWith("_") || display.endsWith("_")) return { ok: false, error: "underscore" };
  const handle = display.toLowerCase();
  if ((RESERVED_HANDLES as readonly string[]).includes(handle)) return { ok: false, error: "reserved" };
  if (BLOCKED_SUBSTRINGS.some((bad) => handle.includes(bad))) return { ok: false, error: "reserved" };
  return { ok: true, handle, display };
}
