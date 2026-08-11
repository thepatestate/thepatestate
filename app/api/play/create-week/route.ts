import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getEspnWeekGames, getNationalRankings } from "@/lib/espn";
import { selectMarqueeGames, toPickemConfig, slateLockIso } from "@/lib/play-week";

export const maxDuration = 60;

// Weekly Pick'Em auto-creation: once the current week's Pick'Em locks, the
// next week's competition seeds itself from the live schedule + rankings —
// same marquee-selection rule as the hand-built Week 1 slate. Idempotent
// (skips if next week exists); stops at week 15 or when the feed can't
// supply a competitive slate. Runs daily via pg_cron.

const LAST_WEEK = 15;
const MIN_GAMES = 6;

export async function POST(request: Request) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;
  if (!isAdminConfigured) return NextResponse.json({ error: "no admin client" }, { status: 500 });
  const admin = createAdminClient();

  // Latest pickem week on file.
  const { data: comps } = await admin
    .from("competitions")
    .select("slug, locks_at")
    .eq("type", "pickem")
    .like("slug", "pickem-week-%");
  const rows = (comps as { slug: string; locks_at: string }[] | null) ?? [];
  const weeks = rows
    .map((c) => ({ week: Number(c.slug.replace("pickem-week-", "")), locks_at: c.locks_at }))
    .filter((c) => Number.isFinite(c.week))
    .sort((a, b) => a.week - b.week);
  const latest = weeks[weeks.length - 1];
  if (!latest) return NextResponse.json({ ok: true, skipped: "no pickem competitions exist" });

  const summary: Record<string, unknown> = { latestWeek: latest.week };
  if (new Date(latest.locks_at).getTime() > Date.now()) {
    summary.skipped = "current week not locked yet";
  } else if (latest.week >= LAST_WEEK) {
    summary.skipped = "season complete";
  } else {
    const nextWeek = latest.week + 1;
    const [games, polls] = await Promise.all([getEspnWeekGames(nextWeek), getNationalRankings()]);
    const rankBySlug = new Map<string, number>();
    for (const p of polls) for (const r of p.ranks) {
      const existing = rankBySlug.get(r.slug);
      if (existing == null || r.rank < existing) rankBySlug.set(r.slug, r.rank);
    }
    const slate = selectMarqueeGames(games, rankBySlug, 10);
    if (slate.length < MIN_GAMES) {
      summary.skipped = `only ${slate.length} competitive games for week ${nextWeek}`;
    } else {
      const lastKick = slate.reduce((max, g) => (g.kickoff > max ? g.kickoff : max), slate[0].kickoff);
      const { error } = await admin.from("competitions").insert({
        slug: `pickem-week-${nextWeek}`,
        type: "pickem",
        name: `Week ${nextWeek} Pick'Em`,
        season: 2026,
        locks_at: slateLockIso(slate),
        ends_at: new Date(new Date(lastKick).getTime() + 12 * 3600_000).toISOString(),
        scoring_rule_id: "pickem-confidence-v1",
        terms_version: "2026-08-11",
        config: { games: toPickemConfig(slate) },
      });
      // Unique-slug violation = another run beat us to it; that's fine.
      summary.created = error ? `skipped: ${error.message}` : `pickem-week-${nextWeek} (${slate.length} games)`;
    }
  }
  console.log("[play:create-week]", JSON.stringify(summary));
  return NextResponse.json({ ok: true, summary });
}
