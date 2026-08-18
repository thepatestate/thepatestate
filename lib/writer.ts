// The prose writer — which model actually writes the articles.
// Client preference (Isaac, 2026-08-17): article prose from OpenAI. The
// switch is env-driven so the writer can change without a deploy diff:
//   WRITER_PROVIDER=openai  + OPENAI_API_KEY  → OpenAI writes
//   anything else                              → Anthropic writes (default)
//   OPENAI_WRITER_MODEL overrides the OpenAI model name.
// Deliberately NOT switched: the fact-check gate, quote extraction, and
// series classification stay on Anthropic — verification is stronger when
// the checker isn't the writer grading its own homework.
import Anthropic from "@anthropic-ai/sdk";

export const WRITER_PROVIDER: "openai" | "anthropic" =
  process.env.WRITER_PROVIDER === "openai" && process.env.OPENAI_API_KEY ? "openai" : "anthropic";

const OPENAI_MODEL = process.env.OPENAI_WRITER_MODEL ?? "gpt-5.2";
const ANTHROPIC_MODEL = "claude-sonnet-5";

/** One structured-output writing call, provider-routed. Returns the raw JSON
 * string (callers keep their own JSON.parse + validation + retry loops). */
export async function writeJSON(opts: {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  schemaName: string;
  maxTokens: number;
}): Promise<string> {
  if (WRITER_PROVIDER === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_completion_tokens: opts.maxTokens,
        response_format: {
          type: "json_schema",
          json_schema: { name: opts.schemaName, strict: true, schema: opts.schema },
        },
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) {
      throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  }

  const anthropic = new Anthropic();
  const res = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: opts.maxTokens,
    output_config: { format: { type: "json_schema", schema: opts.schema } },
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  const block = res.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}
