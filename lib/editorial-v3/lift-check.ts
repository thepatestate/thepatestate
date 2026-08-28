// Verbatim-lift check (Isaac, 2026-08-28: "make sure they are not direct
// lifts off their sources"). Counts runs of N+ words a draft shares with
// its sources outside quotation marks. Names and lists are exempt when a run
// is mostly capitalized tokens (a roster list cannot be paraphrased).
const norm = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

export interface LiftReport { words: number; liftedWords: number; pct: number; runs: string[]; quotedRuns: string[] }

export function sharedRuns(text: string, source: string, n = 8): string[] {
  const g = new Set<string>();
  const w = norm(source).split(" ");
  for (let i = 0; i + n <= w.length; i++) g.add(w.slice(i, i + n).join(" "));
  const t = norm(text).split(" ");
  const hits: string[] = [];
  let i = 0;
  while (i + n <= t.length) {
    if (g.has(t.slice(i, i + n).join(" "))) { let j = i + n; while (j < t.length && g.has(t.slice(j - n + 1, j + 1).join(" "))) j++; hits.push(t.slice(i, j).join(" ")); i = j; } else i++;
  }
  return hits;
}

/** Runs that are mostly names (proper-noun lists) are not lifts. */
function mostlyNames(run: string, original: string): boolean {
  const caps = (original.match(/\b[A-Z][a-zA-Z'’.-]+/g) ?? []).length;
  return caps / run.split(" ").length >= 0.5;
}

export function liftReport(body: string, sources: string[], n = 8): LiftReport {
  const source = sources.join("\n");
  const quoted = (body.match(/"[^"]{20,}"|“[^”]{20,}”/g) ?? []).map(norm);
  const all = sharedRuns(body, source, n);
  const quotedRuns = all.filter((r) => quoted.some((q) => q.includes(r)));
  const runs = all.filter((r) => !quotedRuns.includes(r) && !mostlyNames(r, originalSpan(body, r)));
  const words = norm(body).split(" ").length;
  const liftedWords = runs.reduce((a, r) => a + r.split(" ").length, 0);
  return { words, liftedWords, pct: Math.round((liftedWords / Math.max(1, words)) * 1000) / 10, runs, quotedRuns };
}

/** Finds the original-cased span for a normalized run (best effort). */
function originalSpan(body: string, run: string): string {
  const first = run.split(" ").slice(0, 3).join(" ");
  const idx = norm(body).indexOf(first);
  if (idx < 0) return run;
  // map normalized index back approximately by word count
  const before = norm(body).slice(0, idx).split(" ").length - 1;
  return body.split(/\s+/).slice(before, before + run.split(" ").length).join(" ");
}

/** The gate: fail when more than `maxPct` of the words are unquoted runs
 * of `minRun`+ words shared with the sources, or any single unquoted run
 * reaches `maxRun` words. Facts may be shared; sentences may not. */
export function liftVerdict(r: LiftReport, opts: { maxPct?: number; maxRun?: number } = {}): { pass: boolean; reason: string } {
  const maxPct = opts.maxPct ?? 8, maxRun = opts.maxRun ?? 14;
  const longest = r.runs.reduce((a, x) => Math.max(a, x.split(" ").length), 0);
  if (longest >= maxRun) return { pass: false, reason: `a ${longest}-word run is verbatim from a source outside quotation marks: "${r.runs.find((x) => x.split(" ").length === longest)?.slice(0, 120)}"` };
  if (r.pct > maxPct) return { pass: false, reason: `${r.pct}% of the words are verbatim runs from the sources outside quotation marks (limit ${maxPct}%)` };
  return { pass: true, reason: `${r.pct}% shared outside quotation marks; longest run ${longest} words` };
}
