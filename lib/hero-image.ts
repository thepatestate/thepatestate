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
  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey) return null;

  try {
    const prompt = buildHeroPrompt(headline, teams);
    const createRes = await fetch(BFL_CREATE_URL, {
      method: "POST",
      headers: { "x-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, width: 1152, height: 640 }),
    });
    if (!createRes.ok) {
      console.error("[hero-image] create failed", createRes.status);
      return null;
    }
    const created = (await createRes.json()) as BflCreateResponse;
    if (!created.polling_url) return null;

    const deadline = Date.now() + POLL_TIMEOUT_MS;
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
