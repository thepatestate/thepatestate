// Weekly Pick'Em slate selection — pure, unit-tested. Picks the N most
// marquee games of a week: competitive matchups only (both teams power-
// conference, or both nationally ranked), weighted toward ranked-vs-ranked.
// Cupcake buy games never make the sheet — everyone would pick the same
// side and the confidence sheet turns boring.
import type { EspnWeekGame } from "@/lib/espn";
import type { PickemGame } from "@/lib/play";

/** rankBySlug: team slug → national rank (1-25) from the live polls. */
export function selectMarqueeGames(
  games: EspnWeekGame[],
  rankBySlug: Map<string, number>,
  count = 10,
): EspnWeekGame[] {
  const rank = (slug: string) => rankBySlug.get(slug) ?? 99;
  const scored = games
    .filter((g) => {
      const bothPower = g.awayPower && g.homePower;
      const bothRanked = rank(g.awaySlug) <= 25 && rank(g.homeSlug) <= 25;
      return bothPower || bothRanked;
    })
    .map((g) => {
      const bothRanked = rank(g.awaySlug) <= 25 && rank(g.homeSlug) <= 25;
      const score =
        (50 - Math.min(rank(g.awaySlug), 40)) +
        (50 - Math.min(rank(g.homeSlug), 40)) +
        (g.awayPower && g.homePower ? 15 : 0) +
        (bothRanked ? 30 : 0);
      return { g, score };
    })
    .sort((a, b) => b.score - a.score || a.g.kickoff.localeCompare(b.g.kickoff));
  return scored
    .slice(0, count)
    .map((s) => s.g)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

export function toPickemConfig(games: EspnWeekGame[]): PickemGame[] {
  return games.map((g) => ({
    id: g.id,
    away: g.away,
    home: g.home,
    awayAbbrev: g.awayAbbrev,
    homeAbbrev: g.homeAbbrev,
    awayLogo: g.awayLogo,
    homeLogo: g.homeLogo,
    kickoff: g.kickoff,
    net: g.net,
  }));
}

/** Lock 2 minutes before the slate's earliest kickoff (matches Week 1's
 * published "11:58 AM ET" posture). */
export function slateLockIso(games: EspnWeekGame[]): string {
  const first = games.reduce(
    (min, g) => (g.kickoff < min ? g.kickoff : min),
    games[0]?.kickoff ?? "",
  );
  return new Date(new Date(first).getTime() - 2 * 60_000).toISOString();
}
