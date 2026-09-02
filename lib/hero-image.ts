// Generates a cinematic editorial hero image for a Notebook article via the
// BFL FLUX API. Entirely fail-soft — every exported function here resolves
// (never rejects) and returns null on any failure, including a missing
// BFL_API_KEY, so callers (lib/ingest.ts, scripts/backfill-heroes.mts) can
// treat hero generation as pure best-effort and never let it block or fail
// the article pipeline.

const BFL_CREATE_URL = "https://api.bfl.ai/v1/flux-2-pro";
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 90_000;

// Always appended to every prompt — the non-negotiable visual guardrail from
// the brief. Never varies with the headline/teams.
const GUARDRAIL_SUFFIX =
  "Cinematic editorial photography, deep navy-blue shadows, warm golden-amber highlights, film grain. " +
  "No visible logos, no team emblems, no readable text, no recognizable faces.";

const DEFAULT_SCENE =
  "a college football stadium at dusk, warm stadium lights glowing against a darkening sky, " +
  "atmospheric fog drifting over the field";

// Small keyword -> scene mapping. Order matters: first match wins, so more
// specific themes (weather, playoff stakes) are listed ahead of generic ones.
// Deliberately headline-subject-only — no team or player names ever enter
// the scene text (see the "no team names" rule in the module docstring).
const SCENE_KEYWORDS: { pattern: RegExp; scene: string }[] = [
  {
    pattern: /(playoff|championship|title game|national title|bowl)/i,
    scene:
      "a packed night stadium under blazing lights, confetti-streaked air, championship-stakes electricity in the crowd",
  },
  {
    pattern: /(storm|rain|snow|weather|cold|freeze|blizzard)/i,
    scene:
      "a college football field under a dramatic storm-lit sky, rain-slicked turf, weather-beaten atmosphere",
  },
  {
    pattern: /(tailgate|game ?day|kickoff|crowd|fans?)/i,
    scene:
      "a packed college football stadium at golden hour, sun flaring low over the upper deck, crowd energy rising before kickoff",
  },
  {
    pattern: /(coach|staff|hire|fire|hot seat|contract|buyout)/i,
    scene: "a stadium sideline at dusk, coaching-staff silhouettes against the lights, quiet high-stakes focus",
  },
  {
    pattern: /(recruit|commit|signing|portal|transfer)/i,
    scene: "a sunlit practice field with fresh yard-line chalk, quiet anticipation before the season",
  },
  {
    pattern: /(rank|poll|top ?25|number one|no\.\s?1)/i,
    scene: "a foggy stadium tunnel at dawn, empty seats fading into mist, the hush before a big reveal",
  },
];

/** Pure prompt builder — no network calls, fully unit-testable. Maps
 * headline keywords to an atmospheric scene (defaulting to a generic dusk
 * stadium when nothing matches), optionally nods at rivalry-week energy
 * when multiple teams are involved, and always appends the guardrail
 * suffix verbatim. Team names/people's names are never interpolated into
 * the prompt text. */
export function buildHeroPrompt(headline: string, teams: string[] = []): string {
  const match = SCENE_KEYWORDS.find(({ pattern }) => pattern.test(headline));
  let scene = match ? match.scene : DEFAULT_SCENE;
  if (teams.length >= 2) scene += ", rivalry-week tension in the air";
  return `Cinematic editorial college-football atmosphere: ${scene}. ${GUARDRAIL_SUFFIX}`;
}

// Wire stories (2026-09-02, Isaac: "put an AI image on each article" on the
// Wire). Nearly every Wire story is filed under "general", so the headline's
// own words pick the scene first and the category is the fallback; a hash
// of the headline then picks the light and the camera so a day's file does
// not come out as thirty copies of the same dusk stadium. Same guardrail:
// no logos, no faces, no text, no team identity, no names interpolated.
const WIRE_SCENES: { pattern: RegExp; scene: string }[] = [
  { pattern: /(injur|surgery|out for the season|torn|acl|achilles|concussion|sidelined|questionable|return(s|ed)? to practice)/i, scene: "a lone football helmet resting on an empty sideline bench, athletic tape and a water bottle on the turf, the field dark and quiet beyond" },
  { pattern: /(court|judge|ruling|lawsuit|eligib|ncaa|penalt|suspend|ban\b|boycott|compliance|affidavit|charge|arrest|investigat)/i, scene: "a hushed empty stadium at dawn seen through the tall windows of an administrative building, papers and a closed folder on a long table in the foreground" },
  { pattern: /(coach|hire|fire|contract|buyout|hot seat|athletic director|\bAD\b|interim|tenure|era)/i, scene: "a stadium sideline at dusk, coaching-staff silhouettes and a headset cord against the lights, quiet high-stakes focus" },
  { pattern: /(recruit|commit|five-star|four-star|visit|offer|\bclass\b|prospect|flip)/i, scene: "a high school football field at golden hour, fresh chalk lines, a small wooden grandstand, a long shadow across the fifty" },
  { pattern: /(portal|transfer|leaves|departs|enters)/i, scene: "a stadium tunnel at dawn, one duffel bag at the mouth of the tunnel, bright field light waiting at the far end" },
  { pattern: /(playoff|championship|title|bracket|national)/i, scene: "a packed night stadium under blazing lights, confetti-streaked air, championship-stakes electricity in the crowd" },
  { pattern: /(depth chart|starter|starts\b|starting|names\b|quarterback|\bqb\b|job\b|battle|rotation|lineup)/i, scene: "a quarterback's helmet and a laminated play sheet resting on an empty bench at a practice field, blank magnets on a whiteboard in the background" },
  { pattern: /(practice|camp|scrimmage|shortens|workout|drill)/i, scene: "a sunlit practice field mid-morning, blocking sleds and orange cones on fresh-cut grass, sprinkler mist catching the light" },
  { pattern: /(win|beat|upset|rally|survive|comeback|loss|falls|blow out|rout)/i, scene: "a stadium erupting at night after a late score, crowd arms raised in silhouette, floodlight haze over the end zone" },
  { pattern: /(poll|rank|top 25|no\. ?\d|preseason|ballot|vote)/i, scene: "a foggy stadium tunnel at dawn, empty seats fading into mist, the hush before a big reveal" },
  { pattern: /(open|opener|kickoff|schedule|date|matchup|host|visit|week 1|season)/i, scene: "stadium gates and turnstiles at first light on game day, a single groundskeeper's cart on the concourse, banners without lettering stirring in the wind" },
  { pattern: /(conference|pac-12|big 12|sec\b|acc\b|big ten|realign|expansion|media rights|tv\b|broadcast)/i, scene: "an empty broadcast booth high above a field at night, monitors glowing, the stadium bowl lit below" },
];
const WIRE_LIGHT = ["at dusk, warm golden-amber light breaking through", "at night under stadium lights, rain-slicked surfaces and floodlight haze", "at dawn, cool blue mist and the first amber light on the horizon", "in late-afternoon sun, long shadows and dust in the air"];
const WIRE_CAMERA = ["wide shot from the upper deck", "low angle from turf level", "medium telephoto with shallow depth of field", "high vantage looking down the sideline"];

function hashText(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Pure prompt builder for the Wire: headline scene (category fallback),
 * hashed light and camera, the guardrail suffix. Never interpolates a team
 * or a person's name. */
export function buildWirePrompt(headline: string, category = "general", teams: string[] = []): string {
  const byHeadline = WIRE_SCENES.find(({ pattern }) => pattern.test(headline))?.scene;
  const byCategory: Record<string, string | undefined> = {
    injury: WIRE_SCENES[0].scene, legal: WIRE_SCENES[1].scene, coaching: WIRE_SCENES[2].scene, recruiting: WIRE_SCENES[3].scene,
    transfer: WIRE_SCENES[4].scene, playoff: WIRE_SCENES[5].scene, media: WIRE_SCENES[11].scene,
  };
  const scene = byHeadline ?? byCategory[category] ?? DEFAULT_SCENE;
  const h = hashText(headline);
  const light = WIRE_LIGHT[h % WIRE_LIGHT.length];
  const camera = WIRE_CAMERA[(h >>> 8) % WIRE_CAMERA.length];
  const rivalry = teams.length >= 2 && /(rival|beat|upset|vs\.?|against)/i.test(headline) ? ", rivalry-week tension in the air" : "";
  return `Cinematic editorial college-football atmosphere, ${camera}: ${scene}, ${light}${rivalry}. ${GUARDRAIL_SUFFIX}`;
}

interface BflCreateResponse {
  polling_url?: string;
}

interface BflPollResponse {
  status?: string;
  result?: { sample?: string };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generates a 1152x640 cinematic editorial hero image for an article via
 * BFL FLUX 2 Pro. Returns the downloaded image bytes as a Buffer, or null on
 * ANY failure — missing API key, request error, non-2xx response, timeout,
 * or a terminal non-"Ready" poll status. Never throws.
 */
export async function generateArticleHero(headline: string, teams: string[]): Promise<Buffer | null> {
  return generateHeroFromPrompt(buildHeroPrompt(headline, teams), headline);
}

/** A Wire story's illustration — same engine, category-led scene. */
export async function generateWireHero(headline: string, category = "general", teams: string[] = [], opts: { timeoutMs?: number } = {}): Promise<Buffer | null> {
  return generateHeroFromPrompt(buildWirePrompt(headline, category, teams), headline, opts.timeoutMs);
}

async function generateHeroFromPrompt(prompt: string, headline: string, timeoutMs = POLL_TIMEOUT_MS): Promise<Buffer | null> {
  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey) return null;

  try {
    // BFL limits concurrent tasks per key (429 under a backfill or when the
    // monitor and a script overlap); back off and retry a few times.
    let createRes: Response | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      createRes = await fetch(BFL_CREATE_URL, {
        method: "POST",
        headers: { "x-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, width: 1152, height: 640 }),
      });
      if (createRes.status !== 429) break;
      await sleep(4000 * (attempt + 1));
    }
    if (!createRes || !createRes.ok) {
      console.error("[hero-image] create failed", createRes?.status);
      return null;
    }
    const created = (await createRes.json()) as BflCreateResponse;
    if (!created.polling_url) return null;

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      const pollRes = await fetch(created.polling_url, { headers: { "x-key": apiKey } });
      if (!pollRes.ok) continue; // transient — keep polling until the deadline
      const poll = (await pollRes.json()) as BflPollResponse;
      if (poll.status === "Ready") {
        const sampleUrl = poll.result?.sample;
        if (!sampleUrl) return null;
        const imgRes = await fetch(sampleUrl);
        if (!imgRes.ok) return null;
        const arrayBuffer = await imgRes.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }
      if (poll.status === "Error" || poll.status === "Failed" || poll.status === "Content Moderated") {
        console.error("[hero-image] poll status", poll.status);
        return null;
      }
      // "Pending"/"Processing"/etc — keep polling.
    }
    console.error("[hero-image] timed out waiting for", headline);
    return null;
  } catch (err) {
    console.error("[hero-image]", headline, err);
    return null;
  }
}
