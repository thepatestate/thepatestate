// Re-freeze one show fixture's fact sheet for the teams its assignment is
// about (teamFactSheet caps at four teams per call; batch and concatenate).
//   npx tsx scripts/editorial-refreeze-factsheet.mts miami-acc miami,clemson,smu,louisville,notre-dame,stanford,wake-forest
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
for (const l of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim(); }
const { teamFactSheet } = await import("../lib/fact-sheet.ts");
const [id, teamList] = process.argv.slice(2);
const slugs = teamList.split(",");
const parts: string[] = [];
for (let i = 0; i < slugs.length; i += 4) parts.push(await teamFactSheet(slugs.slice(i, i + 4), { games: 14 }));
const sheet = parts.filter(Boolean).join("\n\n");
for (const f of [`fixtures/editorial-replay/show-${id}.json`, `fixtures/editorial-replay/show-${id}-traps.json`]) {
  if (!existsSync(f)) continue;
  const fx = JSON.parse(readFileSync(f, "utf8"));
  const traps = f.endsWith("-traps.json") ? "\n\nSEEDED TRAP (unsupported stat): Miami returned 91 percent of its offensive production from 2025.\nSEEDED TRAP (outdated date): Miami at Clemson is on November 14." : "";
  fx.factSheet = sheet + traps; fx.teams = [...new Set([...fx.teams, ...slugs])];
  writeFileSync(f, JSON.stringify(fx, null, 2));
  console.log(`${f}: fact sheet ${fx.factSheet.length} chars for ${slugs.join(", ")}`);
}
