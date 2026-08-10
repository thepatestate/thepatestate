import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { getWeekScoreboard, getTeamDirectory } from "@/lib/cfbd";
import { slugifyTeam } from "@/lib/teams-meta";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const maxDuration = 60;

// Auto game threads (v2 §3.2 Game Day): every morning in season, create a
// live thread on the Game Day board for each of today's marquee games
// (both teams power-4, or any game involving a seeded team-porch program).
// Idempotent: one thread per game per day, keyed by title match. No-ops
// outside the season (no games today).

const SEASON_WEEKS = 16;

function todayEt(): string {
  return new Date().toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }).toUpperCase();
}

export async function POST(request: Request) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;
  if (!isAdminConfigured) return NextResponse.json({ error: "no admin client" }, { status: 500 });

  const admin = createAdminClient();
  const { data: teamBoards } = await admin.from("boards").select("slug, team_slug").eq("kind", "team");
  const porchTeams = new Set(((teamBoards as { team_slug: string | null }[] | null) ?? []).map((b) => b.team_slug).filter(Boolean));

  const dir = await getTeamDirectory();
  const power = new Set(["SEC", "Big Ten", "Big 12", "ACC"]);
  const today = todayEt();

  let created = 0;
  let checked = 0;
  for (let week = 1; week <= SEASON_WEEKS; week++) {
    const games = await getWeekScoreboard(week);
    if (games.length === 0) continue;
    const todays = games.filter((g) => g.day === today.toUpperCase());
    checked += todays.length;
    for (const g of todays) {
      const away = g.teams[0].label;
      const home = g.teams[1].label;
      const awaySlug = slugifyTeam(away);
      const homeSlug = slugifyTeam(home);
      const marquee =
        (power.has(dir[awaySlug]?.conference ?? "") && power.has(dir[homeSlug]?.conference ?? "")) ||
        porchTeams.has(awaySlug) ||
        porchTeams.has(homeSlug);
      if (!marquee) continue;

      const title = `GAME THREAD: ${away} at ${home} (${g.time ?? "today"})`.slice(0, 140);
      const { data: existing } = await admin
        .from("threads")
        .select("id")
        .eq("board_slug", "game-day")
        .eq("title", title)
        .maybeSingle();
      if (existing) continue;

      const { error } = await admin.from("threads").insert({
        board_slug: "game-day",
        author_id: null,
        author_label: "The Porch Desk",
        title,
        body: `${away} at ${home} — kickoff ${g.time ?? "today"}${g.net ? ` on ${g.net}` : ""}.\n\nScores, takes, overreactions: this is the room. Keep it in good faith.`,
        thread_type: "game",
      });
      if (!error) created++;
      else console.error("[game-threads]", error.message);
    }
    // Only the week containing today matters; once we found today's games, stop.
    if (todays.length > 0) break;
  }

  return NextResponse.json({ ok: true, checked, created });
}
