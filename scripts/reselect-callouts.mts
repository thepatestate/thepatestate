// Recompute every wire story's callout with the independent scorer
// (lib/wire.ts selectCallout — callout overhaul, 2026-08-20). Replaces the
// old writer-picked "sharpest lines" wholesale: stories where no sentence
// clears the bar get their callout REMOVED (an empty slot beats junk).
// Pure code, no model calls; batched Sanity transactions.
//
// Run:  npx tsx scripts/reselect-callouts.mts [--dry-run]
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function loadDotEnvLocal() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
}
loadDotEnvLocal();

const { writeClient } = await import("../lib/sanity.ts");
const { selectCallout } = await import("../lib/wire.ts");

const DRY_RUN = process.argv.includes("--dry-run");

interface Row { _id: string; headline?: string; category?: string; whatHappened?: string; whyItMatters?: string[]; readBody?: string; callout?: string }
const rows = await writeClient.fetch<Row[]>(
  `*[_type == "wireStory"]{ _id, headline, category, whatHappened, whyItMatters, readBody, callout }`
);

let set = 0, cleared = 0, unchanged = 0;
const changes: { id: string; callout: string | null }[] = [];
for (const r of rows) {
  const next = selectCallout(r);
  const prev = (r.callout ?? "").trim();
  if (next === prev) { unchanged++; continue; }
  changes.push({ id: r._id, callout: next || null });
  if (next) set++; else cleared++;
}
console.log(`${rows.length} stories: ${set} callouts set/replaced, ${cleared} cleared (nothing qualified), ${unchanged} unchanged${DRY_RUN ? " (DRY RUN)" : ""}`);

if (!DRY_RUN) {
  for (let i = 0; i < changes.length; i += 50) {
    let tx = writeClient.transaction();
    for (const c of changes.slice(i, i + 50)) {
      tx = c.callout
        ? tx.patch(c.id, (p) => p.set({ callout: c.callout }))
        : tx.patch(c.id, (p) => p.unset(["callout"]));
    }
    await tx.commit();
    console.log(`committed ${Math.min(i + 50, changes.length)}/${changes.length}`);
  }
}
console.log("RESELECT DONE");
