// The Phase 3 launch fanbases (v2 §4.6 step 2) — plain data, importable
// from client and server alike. Add slugs here as new hubs ship.
export const LAUNCH_TEAMS: readonly string[] = [
  "georgia", "alabama", "ohio-state", "texas", "michigan", "lsu",
  "tennessee", "oregon", "notre-dame", "clemson", "penn-state", "oklahoma",
  "texas-am", "florida", "auburn", "nebraska", "usc", "florida-state",
  "miami", "wisconsin", "washington", "ole-miss", "arkansas", "south-carolina",
];

export function teamHubHref(slug: string | null | undefined): string {
  return slug && LAUNCH_TEAMS.includes(slug) ? `/teams/${slug}` : "/teams";
}
