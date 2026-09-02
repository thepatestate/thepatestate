// Pate State AI post triage (v2 brief §3.7): every new thread/post gets a
// cheap risk read before it goes live. Tiers: low = allow, medium = allow
// (flagged for the report queue), high = hide + auto-report for human
// review. FAIL-OPEN by design — an API hiccup must never block citizens
// from posting; the report button and staff tools are the backstop.
// Permanent decisions are always human (§3.7).
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5";
const TIMEOUT_MS = 5000;

export type RiskTier = "low" | "medium" | "high";

export interface TriageResult {
  risk: RiskTier;
  reason: string;
}

const SYSTEM = `You triage posts for a college football fan community ("The Quad").
Classify the post's risk tier:

- "high": personal attacks or harassment, threats, slurs, doxxing (posting
  private info), spam or scam links, sexually explicit content, unverified
  claims about a player's health/legal/disciplinary situation presented as
  fact, or impersonation.
- "medium": borderline hostility, unsourced insider claims ("my buddy works
  in the building..."), excessive profanity, or likely-bait content worth a
  human glance.
- "low": everything else — normal sports talk, takes, jokes, criticism of
  coaching/performance (criticism of public figures' work is fine).

Heated sports opinions are NOT high risk. Only real-world harm, targeted
abuse, or fabricated-insider/medical/legal claims justify "high".`;

export async function triagePost(text: string): Promise<TriageResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !text.trim()) return { risk: "low", reason: "" };
  try {
    const client = new Anthropic({ apiKey: key, timeout: TIMEOUT_MS, maxRetries: 0 });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              risk: { type: "string", enum: ["low", "medium", "high"] },
              reason: { type: "string" },
            },
            required: ["risk", "reason"],
            additionalProperties: false,
          },
        },
      },
      system: SYSTEM,
      messages: [{ role: "user", content: text.slice(0, 4000) }],
    });
    const block = res.content.find((b) => b.type === "text");
    const parsed = JSON.parse(block && "text" in block ? block.text : "{}") as Partial<TriageResult>;
    if (parsed.risk === "high" || parsed.risk === "medium" || parsed.risk === "low") {
      return { risk: parsed.risk, reason: (parsed.reason ?? "").slice(0, 300) };
    }
    return { risk: "low", reason: "" };
  } catch (err) {
    console.error("[moderate:triage]", err instanceof Error ? err.message : err);
    return { risk: "low", reason: "triage unavailable (fail-open)" };
  }
}
