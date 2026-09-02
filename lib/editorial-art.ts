// Central editorial-art library for the 2026 image-first redesign.
//
// Every article-like card/tile across the site (Notebook cards, Wire rail,
// Quad hot rows, team-page article thumbs, etc.) pulls its photo from here
// instead of hardcoding a path — so a category always resolves to a
// visually-fitting image, and every page can guarantee it never shows the
// same photo twice.
//
// Usage: create one picker per page render (`const art = createArtPicker()`)
// and call `art.pick("category", "Alt text override")` once per card, in
// render order. The picker walks each category's ordered candidate list —
// most-fitting image first, then fallbacks — skipping anything already
// handed out on this page, so a category with a taken primary photo quietly
// falls through to its next-best option (and finally the generic pool)
// rather than repeating. Server components create a fresh picker per
// request, so there's no cross-request state to worry about.

export type ArtCategory =
  | "weekend-truths"
  | "poll"
  | "honor-roll"
  | "mailbag"
  | "recruiting"
  | "coaching"
  | "media"
  | "playoffs"
  | "store"
  | "state"
  | "schedule"
  | "rankings-movement"
  | "atmosphere"
  | "season-preview"
  | "weather"
  | "locker-room"
  | "generic";

type Candidate = { src: string; alt: string };

// Default alt text per image — atmospheric/decorative photos, so a plain
// description of the scene is enough; callers can pass a more specific alt
// via pick()'s second argument when the card is about something concrete.
const IMG: Record<string, string> = {
  "/img/icon/8231846.jpg": "The Indiana marching band and flags before the national championship game (Photo: David Buono/Icon Sportswire)",
  "/img/cfb-aerial.jpg": "A stadium lit up at night, seen from above",
  "/img/cfb-tunnel.jpg": "Players in silhouette walking out through the tunnel",
  "/img/cfb-band.jpg": "Brass instruments catching the light under the stadium lights",
  "/img/cfb-rain.jpg": "Rain falling through the glow of the floodlights",
  "/img/cfb-snow.jpg": "Snow dusting the hashmarks of an empty field",
  "/img/cfb-pylon.jpg": "An end zone pylon in macro, turf blurred behind it",
  "/img/cfb-flag.jpg": "A penalty flag lying on the turf",
  "/img/cfb-headset.jpg": "A coach's headset resting on the bench",
  "/img/cfb-locker.jpg": "A row of lockers in a vintage locker room",
  "/img/cfb-pressbox.jpg": "The field at dusk, framed from inside the press box",
  "/img/cfb-trophy.jpg": "A gold trophy catching the light in its case",
  "/img/cfb-typewriter.jpg": "A sportswriter's desk, typewriter mid-page",
  "/img/cfb-mailbag.jpg": "A leather mailbag resting on a porch rocking chair",
  "/img/cfb-grill.jpg": "Smoke rising off a tailgate grill",
  "/img/cfb-fridaylights.jpg": "A high school football field lit up at dusk",
  "/img/cfb-goalline.jpg": "The goal line, in extreme macro",
  "/img/editorial-film.jpg": "A film projector beside a chalkboard of X's-and-O's diagrams",
  "/img/editorial-turf.jpg": "Frosted turf and a yard line at dawn",
  "/img/editorial-goalpost.jpg": "A goalpost silhouetted in fog against the sunrise",
  "/img/matchup-helmets.jpg": "Blank navy and gold helmets facing off before kickoff",
  "/img/train-tee.jpg": "The Creed Tee's vintage train-and-football graphic",
  "/img/product-tee.jpg": "The Creed Tee, folded flat",
  "/img/tailgate-night.jpg": "LSU fans in purple and gold packing Tiger Stadium's night tailgate lot",
  "/img/tailgate-grove.jpg": "Ole Miss fans tailgating under the oaks of The Grove",
  "/img/hero-porch.jpg": "A porch overlooking a stadium at dusk",
};

function c(src: string): Candidate {
  return { src, alt: IMG[src] ?? "" };
}

// Ordered candidate lists — first entry is the best-fit image for the
// category (per the brief's keyword→image map), remaining entries are
// fallbacks a picker reaches for once the primary is already used
// elsewhere on the page.
const ART: Record<ArtCategory, Candidate[]> = {
  "weekend-truths": [c("/img/editorial-film.jpg"), c("/img/cfb-pylon.jpg")],
  poll: [c("/img/cfb-typewriter.jpg"), c("/img/editorial-goalpost.jpg")],
  "honor-roll": [c("/img/cfb-trophy.jpg"), c("/img/editorial-turf.jpg")],
  mailbag: [c("/img/cfb-mailbag.jpg"), c("/img/editorial-film.jpg")],
  recruiting: [c("/img/cfb-fridaylights.jpg"), c("/img/editorial-turf.jpg")],
  coaching: [c("/img/cfb-headset.jpg"), c("/img/cfb-locker.jpg")],
  media: [c("/img/cfb-pressbox.jpg"), c("/img/editorial-film.jpg")],
  playoffs: [c("/img/cfb-tunnel.jpg"), c("/img/matchup-helmets.jpg")],
  store: [c("/img/train-tee.jpg"), c("/img/product-tee.jpg")],
  state: [c("/img/cfb-goalline.jpg"), c("/img/editorial-goalpost.jpg")],
  schedule: [c("/img/cfb-aerial.jpg"), c("/img/editorial-turf.jpg")],
  "rankings-movement": [c("/img/cfb-flag.jpg"), c("/img/editorial-goalpost.jpg")],
  atmosphere: [c("/img/icon/8231846.jpg"), c("/img/cfb-grill.jpg"), c("/img/tailgate-night.jpg")],
  "season-preview": [c("/img/cfb-band.jpg"), c("/img/editorial-turf.jpg")],
  weather: [c("/img/cfb-snow.jpg"), c("/img/cfb-rain.jpg")],
  "locker-room": [c("/img/cfb-locker.jpg"), c("/img/cfb-headset.jpg")],
  generic: [
    c("/img/cfb-pylon.jpg"),
    c("/img/editorial-goalpost.jpg"),
    c("/img/editorial-turf.jpg"),
    c("/img/editorial-film.jpg"),
    c("/img/cfb-rain.jpg"),
    c("/img/cfb-snow.jpg"),
  ],
};

// Every image path across every category, in a stable order, used as the
// last-resort pool once a category's own list is exhausted — this is what
// makes uniqueness-per-page hold even on pages with more cards than any one
// category has candidates for.
const ALL: Candidate[] = Object.values(ART).flat();

export function createArtPicker() {
  const used = new Set<string>();

  function take(candidates: Candidate[]): Candidate | null {
    for (const cand of candidates) {
      if (!used.has(cand.src)) {
        used.add(cand.src);
        return cand;
      }
    }
    return null;
  }

  return {
    /** Pick the next unused image for `category`. Falls through to the
     * category's fallbacks, then the generic pool, then the full library,
     * before finally (only if every image on the site is already used on
     * this one page) repeating the category's primary image. `alt`
     * overrides the default description when the card needs specific
     * copy. */
    pick(category: ArtCategory, alt?: string): Candidate {
      const primary = take(ART[category] ?? ART.generic);
      const fallback = primary ?? take(ART.generic) ?? take(ALL);
      const chosen = fallback ?? ART[category]?.[0] ?? ART.generic[0];
      return alt ? { src: chosen.src, alt } : chosen;
    },
  };
}
