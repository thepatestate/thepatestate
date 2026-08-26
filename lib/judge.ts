// One structured-output call for the verification side (judges, fact
// checks, classifiers): Anthropic first, OpenAI as the fallback when the
// Anthropic account is out of credits or down (three outages in a week,
// 2026-08-23/26). Every caller keeps its own schema and parsing; this only
// decides who answers. When OpenAI answers, the result carries
// `via: "openai"` so logs can say the judge and the writer shared a vendor.
import Anthropic from "@anthropic-ai/sdk";

export interface JudgeOptions {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  schemaName: string;
  maxTokens: number;
  effort?: "low" | "medium" | "high";
}

export type Via = "anthropic" | "openai";

const OPENAI_JUDGE_MODEL = process.env.OPENAI_JUDGE_MODEL ?? process.env.OPENAI_WRITER_MODEL ?? "gpt-5.6-luna";

function textOf(res: Anthropic.Message): string {
  const block = res.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

async function viaOpenAI(opts: JudgeOptions): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: OPENAI_JUDGE_MODEL,
      max_completion_tokens: opts.maxTokens,
      response_format: { type: "json_schema", json_schema: { name: opts.schemaName, strict: true, schema: opts.schema } },
      messages: [{ role: "system", content: opts.system }, { role: "user", content: opts.user }],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`openai judge ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

/** Returns the raw JSON text and who produced it. Throws only when both
 * vendors fail (or OpenAI isn't configured and Anthropic failed). */
export async function judgeJSON(
  anthropic: Anthropic | null,
  opts: JudgeOptions,
): Promise<{ text: string; via: Via }> {
  if (anthropic && process.env.ANTHROPIC_API_KEY) {
    try {
      const res = await anthropic.messages.create({
        model: "claude-sonnet-5",
        max_tokens: opts.maxTokens,
        output_config: { ...(opts.effort ? { effort: opts.effort } : {}), format: { type: "json_schema", schema: opts.schema } },
        system: opts.system,
        messages: [{ role: "user", content: opts.user }],
      });
      return { text: textOf(res), via: "anthropic" };
    } catch (err) {
      if (!process.env.OPENAI_API_KEY) throw err;
      console.warn(`[judge] anthropic failed (${err instanceof Error ? err.message.slice(0, 80) : err}); falling back to openai`);
    }
  }
  if (!process.env.OPENAI_API_KEY) throw new Error("no judge provider configured");
  return { text: await viaOpenAI(opts), via: "openai" };
}
