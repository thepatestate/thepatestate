// Josh's 2026 preseason playoff bracket, on the record (source of truth:
// docs/content/josh-playoff-bracket-2026.md, published as the Josh-byline
// article `article-josh-bracket-2026`). Used as the site-wide bracket
// presence until the JP board publishes in-season (Josh, 2026-08-19: "at
// least see a bracket somewhere ... in the meantime have what Josh's
// current playoff bracket is"). Update this file only when Josh updates
// the bracket article — the two must never disagree (consistency ledger).
import { buildRounds } from "@/lib/bracket-rounds";

export interface JoshBracketTeam {
  seed: number;
  slug: string;
  name: string;
  note: "bye" | "hosting" | "traveling";
}

export const JOSH_BRACKET_LABEL = "Josh's Preseason Bracket · August 2026";
export const JOSH_BRACKET_ARTICLE = "/notebook/my-2026-playoff-bracket-on-the-record";
export const JOSH_BRACKET_CHAMPION = "georgia";
export const JOSH_BRACKET_FINAL = "Georgia 31, Ohio State 28";

/** Josh's round-by-round picks, straight from the bracket column (matchup
 * key = the two seeds, lower first): Indiana over Texas and then Boise
 * State; LSU over Notre Dame; Penn State over Alabama; Oregon over Miami
 * and then Clemson; Georgia and Ohio State through their halves; Georgia
 * in the final. Nothing here is inferred — every line is in the column. */
export const JOSH_BRACKET_WINNERS: Record<string, string> = {
  "5-12": "indiana",
  "4-12": "indiana",
  "1-12": "georgia",
  "8-9": "lsu",
  "1-8": "georgia",
  "7-10": "penn-state",
  "2-7": "ohio-state",
  "6-11": "oregon",
  "3-6": "oregon",
  "2-6": "ohio-state",
  "1-2": "georgia",
};

export const JOSH_BRACKET_FIELD: JoshBracketTeam[] = [
  { seed: 1, slug: "georgia", name: "Georgia", note: "bye" },
  { seed: 2, slug: "ohio-state", name: "Ohio State", note: "bye" },
  { seed: 3, slug: "clemson", name: "Clemson", note: "bye" },
  { seed: 4, slug: "boise-state", name: "Boise State", note: "bye" },
  { seed: 5, slug: "texas", name: "Texas", note: "hosting" },
  { seed: 6, slug: "oregon", name: "Oregon", note: "hosting" },
  { seed: 7, slug: "penn-state", name: "Penn State", note: "hosting" },
  { seed: 8, slug: "lsu", name: "LSU", note: "hosting" },
  { seed: 9, slug: "notre-dame", name: "Notre Dame", note: "traveling" },
  { seed: 10, slug: "alabama", name: "Alabama", note: "traveling" },
  { seed: 11, slug: "miami", name: "Miami", note: "traveling" },
  { seed: 12, slug: "indiana", name: "Indiana", note: "traveling" },
];

/** Josh's bracket as the site's two-sided bracket rounds. */
export function joshBracketRounds() {
  return buildRounds(JOSH_BRACKET_FIELD, { champion: JOSH_BRACKET_CHAMPION, winners: JOSH_BRACKET_WINNERS });
}
