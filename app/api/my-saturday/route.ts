import { NextRequest, NextResponse } from "next/server";
import { getTeamDirectory } from "@/lib/cfbd";
import { getWeekScoreboard } from "@/lib/cfbd";
import { getLatestPublished, getBoardResults } from "@/lib/jp-poll";
import { getWireItems } from "@/lib/sanity";
import { getBoards } from "@/lib/community";

// "Your Saturday" card data: for each followed team slug, the real bits we
// can source right now — next/current game, JP Poll rank, latest wire item,
// and that team's Quad board when one exists. Fields are null when a
// source has nothing (§0.1: never invented), and the card renders only the
// rows it has.

export interface SaturdayTeam {
  slug: string;
  school: string;
  logo: string | null;
  game: { line: string } | null;
  rank: { rank: number; label: string } | null;
  news: { headline: string; href: string; external: boolean } | null;
  board: { slug: string; title: string } | null;
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/^#\d+\s*/, "").replace(/[&']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function GET(req: NextRequest) {
  const teamsParam = req.nextUrl.searchParams.get("teams") ?? "";
  const slugs = teamsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3);
  if (slugs.length === 0) return NextResponse.json({ teams: [] });

  const [dir, board, scoreboard, wire, boards] = await Promise.all([
    getTeamDirectory().catch(() => ({}) as Awaited<ReturnType<typeof getTeamDirectory>>),
    getLatestPublished().catch(() => null),
    getWeekScoreboard(1).catch(() => []),
    getWireItems(30).catch(() => []),
    getBoards().catch(() => []),
  ]);
  const results = board ? await getBoardResults(board.id).catch(() => []) : [];

  const teams: SaturdayTeam[] = slugs.map((slug) => {
    const info = dir[slug];
    const school = info?.school ?? slug.replace(/-/g, " ");

    const game = scoreboard.find((g) => g.teams.some((t) => slugify(t.label) === slug));
    const gameLine = game
      ? (() => {
          const [a, b] = game.teams;
          const matchup = `${a.label} vs ${b.label}`;
          const when = game.live ? game.st : [game.day, game.time ?? game.st, game.net].filter(Boolean).join(" · ");
          return { line: `${matchup} · ${when}` };
        })()
      : null;

    const hit = results.find((r) => r.team_slug === slug);
    const rank = hit && board ? { rank: hit.rank, label: board.label } : null;

    const item = wire.find((w) => w.teams?.includes(slug));
    const news = item
      ? {
          headline: item.headline,
          href: item.storySlug ? `/wire/${item.storySlug}` : (item.sourceUrl ?? "/wire"),
          external: !item.storySlug && Boolean(item.sourceUrl),
        }
      : null;

    const b = boards.find((x) => x.team_slug === slug || x.slug === slug);
    const boardOut = b ? { slug: b.slug, title: b.name } : null;

    return { slug, school, logo: info?.logo ?? null, game: gameLine, rank, news, board: boardOut };
  });

  return NextResponse.json({ teams }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
