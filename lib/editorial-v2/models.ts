// Editorial Engine V2 — model routing (brief §4). One place decides which
// vendor and model perform each editorial job, with explicit fallbacks so an
// unavailable model degrades a role rather than failing the run. New OpenAI
// calls use the Responses API (structured JSON + reasoning effort); Anthropic
// calls use the same structured-output shape the V1 verifier uses.
//
// Nothing here stores or returns model reasoning: only the JSON answer and
// the usage numbers.
import Anthropic from "@anthropic-ai/sdk";
import type { StageCall } from "./types";

export type Vendor = "openai" | "anthropic";
export type Effort = "low" | "medium" | "high";

export type Role =
  | "dossier" | "storyMiner" | "angleJudgeA" | "angleJudgeB" | "eicAngle"
  | "blueprint" | "blueprintEditor" | "writerA" | "writerB" | "draftEditor"
  | "rewrite" | "audienceEditor" | "factCheck" | "factRepair"
  | "fanJudgeA" | "fanJudgeB" | "humanityJudge" | "finalEic";

export interface ModelChoice { vendor: Vendor; model: string; effort: Effort; fallbacks: { vendor: Vendor; model: string }[] }

const env = (k: string, d: string) => process.env[k] || d;
const OPENAI_STRONG = () => env("EDITORIAL_OPENAI_STRONG_MODEL", "gpt-5.6-terra");
const OPENAI_FAST = () => env("EDITORIAL_OPENAI_FAST_MODEL", "gpt-5.6-luna");
const OPENAI_ALT = () => env("EDITORIAL_OPENAI_ALT_MODEL", "gpt-5.6-sol");
const ANTHROPIC_STRONG = () => env("EDITORIAL_ANTHROPIC_STRONG_MODEL", "claude-opus-5");
const ANTHROPIC_FAST = () => env("EDITORIAL_ANTHROPIC_FAST_MODEL", "claude-sonnet-5");

const oStrong = (effort: Effort): ModelChoice => ({ vendor: "openai", model: OPENAI_STRONG(), effort, fallbacks: [{ vendor: "openai", model: OPENAI_ALT() }, { vendor: "openai", model: OPENAI_FAST() }, { vendor: "anthropic", model: ANTHROPIC_STRONG() }] });
const oFast = (effort: Effort): ModelChoice => ({ vendor: "openai", model: OPENAI_FAST(), effort, fallbacks: [{ vendor: "openai", model: OPENAI_ALT() }, { vendor: "anthropic", model: ANTHROPIC_FAST() }] });
const aStrong = (effort: Effort): ModelChoice => ({ vendor: "anthropic", model: ANTHROPIC_STRONG(), effort, fallbacks: [{ vendor: "anthropic", model: ANTHROPIC_FAST() }, { vendor: "openai", model: OPENAI_STRONG() }] });
const aFast = (effort: Effort): ModelChoice => ({ vendor: "anthropic", model: ANTHROPIC_FAST(), effort, fallbacks: [{ vendor: "anthropic", model: ANTHROPIC_STRONG() }, { vendor: "openai", model: OPENAI_FAST() }] });

/** Brief §4.3, the default allocation. `draftEditor` and `rewrite` are
 * resolved against the selected draft's author at call time (see
 * `oppositeOf`). */
export function modelForRole(role: Role): ModelChoice {
  switch (role) {
    case "dossier": return aFast("medium");
    case "storyMiner": return oStrong("high");
    case "angleJudgeA": return aFast("medium");
    case "angleJudgeB": return oStrong("high");
    case "eicAngle": return aStrong("high");
    case "blueprint": return oStrong("high");
    case "blueprintEditor": return aFast("high");
    case "writerA": return oStrong("medium");
    case "writerB": return aStrong("medium");
    case "draftEditor": return aStrong("high");
    case "rewrite": return oStrong("high");
    case "audienceEditor": return oStrong("medium");
    case "factCheck": return aFast("low");
    case "factRepair": return aFast("low");
    case "fanJudgeA": return aFast("low");
    case "fanJudgeB": return oStrong("low");
    case "humanityJudge": return aStrong("low");
    case "finalEic": return aStrong("high");
  }
}

/** The strongest model in the other vendor family — used so the editor and
 * the rewriter never share a family with the draft they are judging. */
export function oppositeOf(vendor: Vendor, effort: Effort = "high"): ModelChoice {
  return vendor === "openai" ? aStrong(effort) : oStrong(effort);
}

// Estimated list prices per 1M tokens (input, output) for cost logging.
// Adjust via EDITORIAL_PRICE_<MODEL>="in,out" without a deploy. Estimates only.
const PRICES: Record<string, [number, number]> = {
  "gpt-5.6-terra": [10, 40], "gpt-5.6-sol": [5, 20], "gpt-5.6-luna": [2, 8],
  "claude-opus-5": [15, 75], "claude-sonnet-5": [3, 15],
};
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const override = process.env[`EDITORIAL_PRICE_${model.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`];
  const [pin, pout] = override ? (override.split(",").map(Number) as [number, number]) : PRICES[model] ?? [5, 20];
  return Math.round(((inputTokens * pin + outputTokens * pout) / 1_000_000) * 10000) / 10000;
}

export interface CallOptions {
  stage: string;
  role: Role;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  schemaName: string;
  maxTokens: number;
  /** Override the role's default choice (e.g. oppositeOf the author). */
  choice?: ModelChoice;
}

export interface CallResult<T> { data: T; call: StageCall; raw: string }

// ---------------------------------------------------------------- transports
export interface TransportRequest { vendor: Vendor; model: string; effort: Effort; system: string; user: string; schema: Record<string, unknown>; schemaName: string; maxTokens: number }
export interface TransportResponse { text: string; inputTokens: number; outputTokens: number }
export type Transport = (req: TransportRequest) => Promise<TransportResponse>;

let testTransport: Transport | null = null;
/** Tests inject a transport so no stage ever reaches the network. */
export function __setTransportForTests(t: Transport | null) { testTransport = t; }

class ModelUnavailable extends Error { constructor(msg: string) { super(msg); this.name = "ModelUnavailable"; } }

async function viaOpenAI(req: TransportRequest): Promise<TransportResponse> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: req.model,
      reasoning: { effort: req.effort },
      instructions: req.system,
      input: [{ role: "user", content: req.user }],
      max_output_tokens: req.maxTokens,
      text: { format: { type: "json_schema", name: req.schemaName, strict: true, schema: req.schema } },
      store: false,
    }),
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    if (res.status === 404 || /model|not found|does not exist|unsupported/i.test(body)) throw new ModelUnavailable(`openai ${req.model}: ${res.status} ${body}`);
    throw new Error(`openai ${req.model}: ${res.status} ${body}`);
  }
  const data = (await res.json()) as { status?: string; output?: { type: string; content?: { type: string; text?: string }[] }[]; usage?: { input_tokens?: number; output_tokens?: number }; incomplete_details?: { reason?: string } };
  const text = (data.output ?? []).filter((o) => o.type === "message").flatMap((o) => o.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text ?? "").join("");
  if (data.status === "incomplete") throw new Error(`openai ${req.model}: incomplete (${data.incomplete_details?.reason ?? "?"})`);
  return { text, inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 };
}

async function viaAnthropic(req: TransportRequest): Promise<TransportResponse> {
  const anthropic = new Anthropic();
  try {
    const res = await anthropic.messages.create({
      model: req.model,
      max_tokens: req.maxTokens,
      output_config: { effort: req.effort, format: { type: "json_schema", schema: req.schema } },
      system: req.system,
      messages: [{ role: "user", content: req.user }],
    });
    const block = res.content.find((b) => b.type === "text");
    return { text: block && block.type === "text" ? block.text : "", inputTokens: res.usage?.input_tokens ?? 0, outputTokens: res.usage?.output_tokens ?? 0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not_found|model|404/i.test(msg)) throw new ModelUnavailable(`anthropic ${req.model}: ${msg.slice(0, 200)}`);
    throw err;
  }
}

function vendorConfigured(v: Vendor): boolean {
  return v === "openai" ? !!process.env.OPENAI_API_KEY : !!process.env.ANTHROPIC_API_KEY;
}

/** One structured call for one editorial job. Walks the fallback chain on
 * "model unavailable" or vendor failure; throws only when every option
 * fails. Returns the parsed JSON and the usage record for telemetry. */
export async function callJSON<T>(opts: CallOptions): Promise<CallResult<T>> {
  const choice = opts.choice ?? modelForRole(opts.role);
  const chain = [{ vendor: choice.vendor, model: choice.model }, ...choice.fallbacks];
  const errors: string[] = [];
  for (const c of chain) {
    if (!testTransport && !vendorConfigured(c.vendor)) { errors.push(`${c.vendor} not configured`); continue; }
    const started = Date.now();
    try {
      const req: TransportRequest = { vendor: c.vendor, model: c.model, effort: choice.effort, system: opts.system, user: opts.user, schema: opts.schema, schemaName: opts.schemaName, maxTokens: opts.maxTokens };
      const res = await (testTransport ?? (c.vendor === "openai" ? viaOpenAI : viaAnthropic))(req);
      const data = JSON.parse(res.text) as T;
      const call: StageCall = { stage: opts.stage, role: opts.role, vendor: c.vendor, model: c.model, inputTokens: res.inputTokens, outputTokens: res.outputTokens, costUsd: estimateCost(c.model, res.inputTokens, res.outputTokens), ms: Date.now() - started };
      if (c.model !== choice.model) console.warn(`[v2:${opts.stage}] ${choice.model} failed (${errors.join(" | ").slice(0, 200)}); used ${c.vendor}/${c.model}`);
      return { data, call, raw: res.text };
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message.slice(0, 160)}` : String(err);
      errors.push(`${c.vendor}/${c.model} → ${msg}`);
      // A parse failure on a real answer is not a model-availability problem;
      // still fall through so the run degrades instead of dying.
    }
  }
  throw new Error(`[v2:${opts.stage}] every model failed: ${errors.join(" | ")}`);
}
