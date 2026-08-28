// Roster names for caption repair (the Josh Cut kept spelling Miami's
// quarterback "Darien"/"Menzah"; the fact sheet carries no players). One
// CFBD call per team, cached for the process. Fail-soft: empty string.
import { getTeamDirectory } from "@/lib/cfbd";

const cache = new Map<string, string>();

export async function rosterNames(slugs: string[], year = new Date().getFullYear()): Promise<string> {
  if (!process.env.CFBD_API_KEY || slugs.length === 0) return "";
  const dir = await getTeamDirectory().catch(() => ({}) as Awaited<ReturnType<typeof getTeamDirectory>>);
  const blocks: string[] = [];
  for (const slug of [...new Set(slugs)].slice(0, 8)) {
    const school = dir[slug]?.school;
    if (!school) continue;
    const key = `${school}:${year}`;
    if (!cache.has(key)) {
      try {
        const res = await fetch(`https://api.collegefootballdata.com/roster?team=${encodeURIComponent(school)}&year=${year}`, { headers: { authorization: `Bearer ${process.env.CFBD_API_KEY}` }, signal: AbortSignal.timeout(20_000) });
        const rows = res.ok ? ((await res.json()) as { firstName?: string; lastName?: string; position?: string }[]) : [];
        const names = rows.filter((r) => r.firstName && r.lastName).map((r) => `${r.firstName} ${r.lastName}${r.position ? ` (${r.position})` : ""}`);
        cache.set(key, names.length ? `${school}: ${names.join(", ")}` : "");
      } catch { cache.set(key, ""); }
    }
    if (cache.get(key)) blocks.push(cache.get(key)!);
  }
  return blocks.length ? `ROSTER NAMES (official spellings, for caption repair only; never a fact about who plays):\n${blocks.join("\n")}` : "";
}
