// A verified team fact sheet for the writer's source pack (voice loop round
// 8, 2026-08-26): the reader's judge kept asking for the games, records and
// dates the episode or the wire story didn't carry, and the writer rightly
// won't invent them. Everything here comes from the live data feed the site
// already renders on team pages. Fail-soft: a missing feed just leaves a
// team out.
import { getTeamDirectory } from "@/lib/cfbd";
import { getRecords, getTeamSchedule } from "@/lib/team-data";
import { getTeamPollRanks } from "@/lib/espn";

export async function teamFactSheet(slugs: string[], opts: { games?: number } = {}): Promise<string> {
  const want = [...new Set(slugs.filter(Boolean))].slice(0, 4);
  if (want.length === 0) return "";
  const dir = await getTeamDirectory().catch(() => ({}) as Awaited<ReturnType<typeof getTeamDirectory>>);
  const sheets = await Promise.all(
    want.map(async (slug) => {
      const info = dir[slug];
      if (!info) return "";
      const [records, schedule, polls] = await Promise.all([
        getRecords(info.school).catch(() => ({ current: null, last: null })),
        getTeamSchedule(info.school).catch(() => []),
        getTeamPollRanks(slug).catch(() => null),
      ]);
      const lines: string[] = [`${info.school} (${info.conference || "Independent"})`];
      if (records.last) lines.push(`  2025 record: ${records.last.wins}-${records.last.losses} (${records.last.confWins}-${records.last.confLosses} conference)`);
      if (records.current && (records.current.wins || records.current.losses)) lines.push(`  2026 record so far: ${records.current.wins}-${records.current.losses}`);
      if (polls && polls.length) lines.push(`  Preseason polls: ${polls.map((p) => `${p.poll.replace(/\s*Poll$/i, "")} No. ${p.rank}`).join(", ")}`);
      const games = schedule.slice(0, opts.games ?? 13);
      if (games.length) {
        lines.push(`  2026 schedule:`);
        for (const g of games) lines.push(`    ${g.dateLabel} ${g.home ? "vs" : "at"} ${g.opponent}${g.timeLabel && g.timeLabel !== "TBD" ? ` · ${g.timeLabel}` : ""}${g.tv ? ` · ${g.tv}` : ""}${g.result ? ` · ${g.result}` : ""}`);
      }
      return lines.join("\n");
    }),
  );
  const body = sheets.filter(Boolean).join("\n\n");
  return body
    ? `TEAM FACTS (verified from the live data feed as of ${new Date().toISOString().slice(0, 10)}; use them to cash claims out with real games, dates and records; never contradict them, never go beyond them):\n${body}`
    : "";
}
