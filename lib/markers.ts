export type MarkerSegment =
  | { type: "text"; markdown: string }
  | { type: "embed"; seconds: number }
  | { type: "pullquote" };

export function tsToSeconds(ts: string): number {
  const parts = ts.split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export function parseMarkers(body: string): MarkerSegment[] {
  const out: MarkerSegment[] = [];
  const re = /\[EMBED:([\d:]+)\]|\[PULLQUOTE\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const before = body.slice(last, m.index).trim();
    if (before) out.push({ type: "text", markdown: before });
    out.push(m[0] === "[PULLQUOTE]" ? { type: "pullquote" } : { type: "embed", seconds: tsToSeconds(m[1]) });
    last = m.index + m[0].length;
  }
  const tail = body.slice(last).trim();
  if (tail) out.push({ type: "text", markdown: tail });
  return out;
}
