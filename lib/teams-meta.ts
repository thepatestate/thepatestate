// Real team logos, served from ESPN's public CDN. Every id below was
// verified with `curl -s -o /dev/null -w "%{http_code}"` against the URL
// pattern in teamLogoUrl() and confirmed to return 200 before being added
// here (see the batch-2 client-edits report for the verification run).
//
// Keys are slugs: lowercase, ampersands/apostrophes stripped, everything
// else collapsed to hyphens — see slugifyTeam(). Team display names in the
// page-level DEMO_* data (e.g. "Ohio State", "Notre Dame") should be run
// through slugifyTeam() before looking them up here.
export const TEAM_LOGOS: Record<string, number> = {
  georgia: 61,
  "ohio-state": 194,
  texas: 251,
  oregon: 2483,
  "penn-state": 213,
  lsu: 99,
  clemson: 228,
  "notre-dame": 87,
  alabama: 333,
  miami: 2390,
  indiana: 84,
  michigan: 130,
  "texas-am": 245,
  nebraska: 158,
  "ole-miss": 145,
  wisconsin: 275,
  usc: 30,
  oklahoma: 201,
  tennessee: 2633,
  florida: 57,
  missouri: 142,
  iowa: 2294,
  washington: 264,
  utah: 254,
  colorado: 38,
  byu: 252,
  "florida-state": 52,
  "georgia-tech": 59,
  smu: 2567,
  "boise-state": 68,
  army: 349,
  tulane: 2655,
  "arizona-state": 9,
  "kansas-state": 2306,
  // Added to cover teams referenced in the site's demo data beyond the
  // client's original id list; verified 200 the same way as the rest.
  "texas-tech": 2641,
  "oklahoma-state": 197,
  unlv: 2439,
  "iowa-state": 66,
  vanderbilt: 238,
};

/** Lowercase, hyphenated slug for a team display name (e.g. "Ohio State" -> "ohio-state"). */
export function slugifyTeam(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[&']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** ESPN CDN logo URL for a team slug, or null if the team isn't mapped yet. */
export function teamLogoUrl(slug: string): string | null {
  const id = TEAM_LOGOS[slug];
  return id ? `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png` : null;
}

// The 39 team slugs with generated blank-helmet studio photography in
// public/img/helmets/ (source: josh-assets/generated/helmets/). Every
// helmet faces LEFT in identical framing against a dark charcoal-navy
// background. Built explicitly from the directory listing at
// implementation time — update this set if more helmets are generated.
const HELMET_SLUGS = new Set<string>([
  "alabama",
  "arizona-state",
  "army",
  "boise-state",
  "byu",
  "clemson",
  "colorado",
  "florida",
  "florida-state",
  "georgia",
  "georgia-tech",
  "indiana",
  "iowa",
  "iowa-state",
  "kansas-state",
  "lsu",
  "miami",
  "michigan",
  "missouri",
  "nebraska",
  "notre-dame",
  "ohio-state",
  "oklahoma",
  "oklahoma-state",
  "ole-miss",
  "oregon",
  "penn-state",
  "smu",
  "tennessee",
  "texas",
  "texas-am",
  "texas-tech",
  "tulane",
  "unlv",
  "usc",
  "utah",
  "vanderbilt",
  "washington",
  "wisconsin",
]);

/** Blank-helmet studio photo URL for a team slug, or null if not generated yet. */
export function helmetUrl(slug: string): string | null {
  return HELMET_SLUGS.has(slug) ? `/img/helmets/${slug}.jpg` : null;
}

// Light-background companion set (public/img/helmets-light/, same 39 slugs)
// for use on light/cream sections — cream background instead of dark
// charcoal-navy, so the helmet reads clearly without a dark chip behind it.
// Every helmet in this set faces RIGHT (mirror of the dark set); mirror
// with CSS transform:scaleX(-1) wherever a helmet needs to face left (e.g.
// the away side of a matchup).
export function helmetLightUrl(slug: string): string | null {
  return HELMET_SLUGS.has(slug) ? `/img/helmets-light/${slug}.jpg` : null;
}
