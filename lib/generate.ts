import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const BYLINE_JOSH = "Josh Pate";
export const SERIES_VALUES = [
  "weekend-truths", "poll-day", "sit-down", "picks-drop", "espn-friday", "mailbag", "general",
] as const;

const MODEL = "claude-sonnet-5";

function prompt(name: string): string {
  return readFileSync(join(process.cwd(), "prompts", name), "utf8");
}

function client(): Anthropic | null {
  return process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
}

export interface CompanionDraft {
  headline: string;
  dek: string;
  bodyMarkdown: string;
  pullQuote: string;
  primaryTeam: string;
  teams: string[];
  tags: string[];
  seo: { title: string; description: string };
}

export function validateDraft(raw: unknown): CompanionDraft | null {
  if (typeof raw !== "object" || raw === null) return null;
  const d = raw as Record<string, unknown>;
  const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
  const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
  const seo = d.seo as Record<string, unknown> | undefined;
  if (
    !isStr(d.headline) || !isStr(d.dek) || !isStr(d.bodyMarkdown) || !isStr(d.pullQuote) ||
    typeof d.primaryTeam !== "string" || !isStrArr(d.teams) || !isStrArr(d.tags) ||
    !seo || !isStr(seo.title) || !isStr(seo.description)
  ) return null;
  if (!d.bodyMarkdown.includes("[PULLQUOTE]")) return null;
  return {
    headline: d.headline, dek: d.dek, bodyMarkdown: d.bodyMarkdown, pullQuote: d.pullQuote,
    primaryTeam: d.primaryTeam, teams: d.teams, tags: d.tags,
    seo: { title: seo.title, description: seo.description },
  };
}

const DRAFT_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    dek: { type: "string" },
    bodyMarkdown: { type: "string" },
    pullQuote: { type: "string" },
    primaryTeam: { type: "string" },
    teams: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    seo: {
      type: "object",
      properties: { title: { type: "string" }, description: { type: "string" } },
      required: ["title", "description"],
      additionalProperties: false,
    },
  },
  required: ["headline", "dek", "bodyMarkdown", "pullQuote", "primaryTeam", "teams", "tags", "seo"],
  additionalProperties: false,
} as const;

function textOf(res: Anthropic.Message): string {
  const block = res.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

export async function classifySeries(input: {
  title: string; description: string; publishedAt: string;
}): Promise<string> {
  const c = client();
  if (!c) return "general";
  try {
    const weekday = new Date(input.publishedAt).toLocaleDateString("en-US", {
      weekday: "long", timeZone: "America/New_York",
    });
    const res = await c.messages.create({
      model: MODEL,
      max_tokens: 256,
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: { series: { type: "string", enum: [...SERIES_VALUES] } },
            required: ["series"],
            additionalProperties: false,
          },
        },
      },
      system: prompt("series-classifier.md"),
      messages: [{
        role: "user",
        content: `Title: ${input.title}\nWeekday (ET): ${weekday}\nDescription:\n${input.description.slice(0, 1500)}`,
      }],
    });
    const parsed = JSON.parse(textOf(res)) as { series?: string };
    return SERIES_VALUES.includes(parsed.series as never) ? (parsed.series as string) : "general";
  } catch (err) {
    console.error("[generate:classifySeries]", err);
    return "general";
  }
}

export async function draftCompanion(input: {
  title: string; description: string; publishedAt: string; series: string; transcriptText: string | null;
}): Promise<CompanionDraft | null> {
  const c = client();
  if (!c) return null;
  const system = `${prompt("global-preamble.md")}\n\n${prompt("companion-article.md")}`;
  const user = [
    `Episode title: ${input.title}`,
    `Series: ${input.series}`,
    `Published: ${input.publishedAt}`,
    `Description:\n${input.description.slice(0, 3000)}`,
    input.transcriptText
      ? `Transcript (timestamped):\n${input.transcriptText}`
      : `NO TRANSCRIPT AVAILABLE — draft from the title and description only, per your instructions.`,
  ].join("\n\n");

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await c.messages.create({
        model: MODEL,
        max_tokens: 8192,
        output_config: { format: { type: "json_schema", schema: DRAFT_SCHEMA } },
        system,
        messages: [{ role: "user", content: user }],
      });
      const draft = validateDraft(JSON.parse(textOf(res)));
      if (draft) return draft;
    } catch (err) {
      // SDK already retried 429/5xx internally; loop covers schema/parse misses
      console.error("[generate:draftCompanion]", attempt, err);
    }
  }
  return null;
}

export interface PlaybookIntro {
  subject: string;
  intro: string;
}

const PLAYBOOK_FALLBACK: PlaybookIntro = {
  subject: "The Playbook — The Pate State",
  intro: "Here's what's new on the porch.",
};

const PLAYBOOK_SCHEMA = {
  type: "object",
  properties: {
    subject: { type: "string" },
    intro: { type: "string" },
  },
  required: ["subject", "intro"],
  additionalProperties: false,
} as const;

export async function draftPlaybookIntro(input: {
  weekday: string; episodeTitle: string | null; articleHeadlines: string[];
}): Promise<PlaybookIntro> {
  // Everything — including the prompt-file reads — stays inside this try/catch
  // so this function can NEVER throw; any failure falls back to the constants.
  try {
    const c = client();
    if (!c) return PLAYBOOK_FALLBACK;
    const system = `${prompt("global-preamble.md")}\n\n${prompt("playbook.md")}`;
    const user = [
      `Weekday: ${input.weekday}`,
      `Episode title: ${input.episodeTitle ?? "(none today)"}`,
      `Article headlines:\n${input.articleHeadlines.length ? input.articleHeadlines.map((h) => `- ${h}`).join("\n") : "(none today)"}`,
    ].join("\n\n");

    const res = await c.messages.create({
      model: MODEL,
      max_tokens: 256,
      output_config: { effort: "low", format: { type: "json_schema", schema: PLAYBOOK_SCHEMA } },
      system,
      messages: [{ role: "user", content: user }],
    });
    const parsed = JSON.parse(textOf(res)) as { subject?: string; intro?: string };
    const subject = typeof parsed.subject === "string" ? parsed.subject.trim() : "";
    const intro = typeof parsed.intro === "string" ? parsed.intro.trim() : "";
    if (!subject || !intro) return PLAYBOOK_FALLBACK;
    return { subject: subject.length > 45 ? subject.slice(0, 45) : subject, intro };
  } catch (err) {
    console.error("[generate:draftPlaybookIntro]", err);
    return PLAYBOOK_FALLBACK;
  }
}
