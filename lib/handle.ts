export const RESERVED_HANDLES = [
  "josh", "joshpate", "pate", "patestate", "thepatestate", "admin", "administrator",
  "mod", "moderator", "official", "staff", "support", "wiredesk", "thewire",
  "citizen", "porch", "mayor", "help", "api", "root", "system",
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
  return { ok: true, handle, display };
}
