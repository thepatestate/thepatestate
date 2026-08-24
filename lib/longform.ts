// The daily long-form pipeline (Josh via Isaac, 2026-08-21): 1–2 standalone
// articles a day on the most interesting topics, in the house voice, that
// stand on their own — distinct from show companions (capped at 3–5/week in
// lib/ingest.ts) and from the Wire (unchanged).
//
// Flow: topic selection (Sonnet — the verification side picks, the writer
// writes) over recent Wire coverage + the Playbook's type menu → source
// pack assembly (wire story text, archived verbatim Josh quotes, standing
// on-record positions) → Luna draft under prompts/standalone-article.md →
// gates (source-narration, fact-check vs the pack, pull-quote verbatim
// check) → published staff-byline article with a generated hero.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { writeClient, isSanityWriteConfigured } from "@/lib/sanity";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { writeJSON } from "@/lib/writer";
import { narratesSourcing, scrubDashes } from "@/lib/wire";
import { generateArticleHero } from "@/lib/hero-image";
import { uploadHeroImage, setArticleHeroImage } from "@/lib/sanity";
import { slugify } from "@/lib/slug";
import { BYLINE_STAFF } from "@/lib/generate";
import { JOSH_BRACKET_FIELD, JOSH_BRACKET_FINAL, JOSH_BRACKET_LABEL } from "@/lib/josh-bracket";
import { pickArchitecture, boilerplateViolations, BOILERPLATE_PROMPT, VOICE_V4_PROMPT, scoreDraft, editorialSystem, type EditorialProduct } from "@/lib/editorial";
import { hasFirstPersonProse } from "@/lib/wire";

const MODEL = "claude-sonnet-5";

function prompt(name: string): string {
  return readFileSync(join(process.cwd(), "prompts", name), "utf8");
}

function textOf(res: Anthropic.Message): string {
  const block = res.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

// Compact menu of playbook types feasible without a game slate to react to.
// The selector is told to pick what a serious fan would most want TODAY.
const TYPE_MENU = `
NR-01 What It Means — flagship reaction to consequential recent news (pick the biggest wire story of the last 48h)
NR-03 Five Consequences — second-order implications of a major event
RK-10 Market-gap — "the market is too high/low on <team>" (mechanism-mandatory, never "overrated")
PS-04 Ceiling/Floor/Most-likely — three scenarios for one prominent team, each with its mechanism
PS-05 Biggest Questions — 5–7 falsifiable questions for one team, each with a named answer date
PE-01 Breakout list — breakout players with the mechanism (role, matchup, leverage)
PE-03 Pressure index — coaching-seat analysis, trajectory + structure, never glee
PO-02 Paths & scenarios — a contender's playoff path in plain English
TI-05 Injury impact — roster mechanics of a significant recent injury (replacement file + calendar)
FA-02 Scheme explainer — one concept, cashed out in consequence at every step
CC-06 History rhymes — "the last time this happened," event-triggered context
RI-01 Prospect fit (Recruiting Intelligence) — why a recent commitment or transfer makes football sense for THIS roster: the room, the timeline, who he affects
RI-02 Class construction (Recruiting Intelligence) — what a program's class is actually built around, the position worth circling, what's still missing
RI-03 Portal audit (Recruiting Intelligence) — did the program solve the problems it entered the portal with (proven snaps lost vs. added)`;

/** Which of Josh's product documents governs a selected type: RI-* types
 * are Recruiting Intelligence; everything else on the menu is Notebook. */
export function productForType(typeId: string): EditorialProduct {
  return /^RI-/i.test(typeId) ? "recruiting" : "notebook";
}

const SELECT_SCHEMA = {
  type: "object",
  properties: {
    typeId: { type: "string" },
    topic: { type: "string" },
    angle: { type: "string" },
    teams: { type: "array", items: { type: "string" } },
    wireStoryIds: { type: "array", items: { type: "string" } },
  },
  required: ["typeId", "topic", "angle", "teams", "wireStoryIds"],
  additionalProperties: false,
} as const;

const LONGFORM_SCHEMA = {
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

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

/** Generates and publishes one standalone long-form article. Returns a
 * result label for the route/cron log. Never throws. */
export async function generateLongformArticle(): Promise<string> {
  if (!isSanityWriteConfigured || !process.env.ANTHROPIC_API_KEY) return "not-configured";
  try {
    const anthropic = new Anthropic();

    // --- Context for selection -----------------------------------------
    const [recentStories, recentArticles] = await Promise.all([
      writeClient.fetch<{ _id: string; headline: string; whatHappened?: string; category?: string; teams?: string[] }[]>(
        `*[_type == "wireStory" && publishedAt > $since] | order(publishedAt desc) [0...14]{ _id, headline, whatHappened, category, teams }`,
        { since: new Date(Date.now() - 72 * 3600_000).toISOString() },
      ),
      writeClient.fetch<{ headline: string; tags?: string[] }[]>(
        `*[_type == "article"] | order(coalesce(publishedAt, _createdAt) desc) [0...20]{ headline, tags }`,
      ),
    ]);
    const recentArch = recentArticles
      .flatMap((a) => a.tags ?? [])
      .filter((t) => t.startsWith("arch:"))
      .map((t) => t.replace(/^arch:/, ""));
    const arch = pickArchitecture(recentArch, recentArticles.length);

    const selRes = await anthropic.messages.create({
      model: MODEL,
      // Reasoning shares this budget with the JSON answer — 1024 truncated.
      max_tokens: 4096,
      output_config: { effort: "low", format: { type: "json_schema", schema: SELECT_SCHEMA } },
      system: `You are the article selection engine for The Pate State (Article Playbook v3.0 + Josh's Notebook and Recruiting Intelligence documents). Pick the ONE standalone long-form article a serious college football fan would most want to read today. Choose a type from the menu, a specific topic, and a sharp angle. Rules: never duplicate or closely overlap a recent article headline; prefer a big recent wire story angle (NR-01/NR-03/TI-05) when one is genuinely consequential, else an evergreen type on a prominent team or national question; RI-* types only when the wire coverage supports roster-level recruiting analysis (a commitment, flip, or portal move with real roster context), never for a bare commitment brief; the angle must be arguable from the wire coverage provided plus general mechanism reasoning (no facts the pack won't contain); teams are lowercase-hyphenated slugs. wireStoryIds: the _ids of the 1-4 provided stories most relevant to the topic (empty for pure evergreen). Output JSON only.`,
      messages: [{
        role: "user",
        content: `TYPE MENU:\n${TYPE_MENU}\n\nRECENT WIRE COVERAGE (72h):\n${recentStories
          .map((s) => `[${s._id}] (${s.category}) ${s.headline} — ${(s.whatHappened ?? "").slice(0, 180)}`)
          .join("\n")}\n\nRECENT ARTICLE HEADLINES (do not duplicate):\n${recentArticles.map((a) => `- ${a.headline}`).join("\n")}`,
      }],
    });
    const sel = JSON.parse(textOf(selRes)) as {
      typeId: string; topic: string; angle: string; teams: string[]; wireStoryIds: string[];
    };

    // --- Source pack ----------------------------------------------------
    const packStories = recentStories.filter((s) => sel.wireStoryIds.includes(s._id));
    const fullStories = packStories.length
      ? await writeClient.fetch<{ headline: string; whatHappened?: string; whyBody?: string; missing?: string; section04Body?: string; readBody?: string }[]>(
          `*[_id in $ids]{ headline, whatHappened, whyBody, missing, section04Body, readBody }`,
          { ids: sel.wireStoryIds },
        )
      : [];
    let quotes: { quote: string; topic: string; yt_id: string; ts_seconds: number }[] = [];
    if (isAdminConfigured && sel.teams.length > 0) {
      const { data } = await createAdminClient()
        .from("josh_quotes")
        .select("quote, topic, yt_id, ts_seconds")
        .overlaps("teams", sel.teams)
        .order("heat", { ascending: false })
        .limit(6);
      quotes = data ?? [];
    }
    const standing = `ON-RECORD SITE POSITIONS (never contradict silently): ${JOSH_BRACKET_LABEL} — field: ${JOSH_BRACKET_FIELD.map((t) => `${t.seed} ${t.name}`).join(", ")}; final on record: ${JOSH_BRACKET_FINAL}. The JP Poll shown on the show is the MODEL's power ratings (Ohio State No. 1 preseason), not a ranking.`;
    const sourcePack = [
      `ASSIGNMENT: type ${sel.typeId} — ${sel.topic}\nANGLE: ${sel.angle}\nARCHITECTURE FOR THIS PIECE (Brief v2 Rule 2 — commit to it fully): ${arch.name} — ${arch.brief}`,
      VOICE_V4_PROMPT,
      BOILERPLATE_PROMPT,
      fullStories.length
        ? `WIRE COVERAGE (verified facts — the fact base):\n${fullStories
            .map((s) => `• ${s.headline}\n${[s.whatHappened, s.whyBody, s.missing, s.section04Body, s.readBody].filter(Boolean).join("\n")}`)
            .join("\n\n")}`
        : "WIRE COVERAGE: none supplied — argue mechanism and stakes only; state no specific facts, stats, or dates.",
      quotes.length
        ? `ARCHIVED VERBATIM JOSH QUOTES (the only permissible Josh voice; use at most one, unaltered):\n${quotes
            .map((q, i) => `${i + 1}. "${q.quote}" (${q.topic})`)
            .join("\n")}`
        : "ARCHIVED JOSH QUOTES: none — pullQuote must be \"\".",
      standing,
    ].join("\n\n");

    // --- Draft (one corrective retry on boilerplate/voice violations) ----
    // System prompt = preamble → 00 Editorial Core → the product document
    // (Notebook, or Recruiting Intelligence for RI-* types) → house
    // overrides → the JSON contract in standalone-article.md.
    const product = productForType(sel.typeId);
    const system = editorialSystem(product, prompt("standalone-article.md"));
    let raw = "";
    let user = sourcePack;
    let draft!: {
      headline: string; dek: string; bodyMarkdown: string; pullQuote: string;
      primaryTeam: string; teams: string[]; tags: string[]; seo: { title: string; description: string };
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      raw = await writeJSON({
        system,
        user,
        schema: LONGFORM_SCHEMA,
        schemaName: "longform_article",
        maxTokens: 8192,
      });
      draft = JSON.parse(raw) as typeof draft;
      const boiler = boilerplateViolations(draft.bodyMarkdown);
      const firstPerson = hasFirstPersonProse(draft.bodyMarkdown);
      if (boiler.length === 0 && !firstPerson) break;
      user = `${sourcePack}\n\nYOUR PREVIOUS DRAFT VIOLATED house style${firstPerson ? " — it used first person under a Staff byline (Josh's positions are third person: \"Pate expects…\")" : ""}${boiler.length ? ` — banned boilerplate: ${boiler.join("; ")}` : ""}. Keep the analysis; rewrite the offending passages in fresh concrete prose.`;
    }
    draft.bodyMarkdown = scrubDashes(draft.bodyMarkdown).replace(/\[EMBED:[^\]]*\]\s*/g, "").replace(/\[\/PULLQUOTE\]/g, "");
    draft.dek = scrubDashes(draft.dek);

    // --- Gates ----------------------------------------------------------
    if (narratesSourcing(draft.bodyMarkdown)) return "gate-sourcenarration";
    if (/!\s|\bguaranteed\b/i.test(draft.bodyMarkdown)) return "gate-banned";
    // Pull quote must be verbatim from a SUPPLIED archived quote (or empty),
    // and must not ALSO be written into the body — writers sometimes quote
    // inline and drop the marker mid-sentence, rendering the quote twice
    // (caught live 2026-08-21). Inline quoting wins; the marker goes.
    if (draft.pullQuote.trim()) {
      const verbatim = quotes.some((q) => normalize(q.quote).includes(normalize(draft.pullQuote)));
      const duplicatedInline = normalize(draft.bodyMarkdown).includes(normalize(draft.pullQuote));
      if (!verbatim || duplicatedInline) {
        draft.pullQuote = "";
        draft.bodyMarkdown = draft.bodyMarkdown.replace(/\s*\[PULLQUOTE\]\s*/g, " ").replace(/ {2,}/g, " ");
      } else {
        // Marker renders as its own block — it always sits on its own line.
        draft.bodyMarkdown = draft.bodyMarkdown.replace(/\s*\[PULLQUOTE\]\s*/g, "\n\n[PULLQUOTE]\n\n");
      }
    } else {
      draft.bodyMarkdown = draft.bodyMarkdown.replace(/\s*\[PULLQUOTE\]\s*/g, " ").replace(/ {2,}/g, " ");
    }
    const checkRes = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: { verdict: { type: "string", enum: ["pass", "unsupported", "contradicted"] } },
            required: ["verdict"],
            additionalProperties: false,
          },
        },
      },
      system:
        "Fact-check gate for a house-analysis article. SOURCES are the only permissible fact base; house ARGUMENT (mechanism, stakes, projections labeled as the house's case) is allowed freely. Verdict 'contradicted' if any stated FACT (a record, stat, date, result, injury, quote, ranking) conflicts with the sources or the on-record positions; 'unsupported' if a material stated fact appears in neither; else 'pass'. Output JSON only.",
      messages: [{ role: "user", content: `SOURCES:\n${sourcePack}\n\nDRAFT:\n${draft.bodyMarkdown}` }],
    });
    const check = JSON.parse(textOf(checkRes)) as { verdict: string };
    if (check.verdict !== "pass") return `factcheck-${check.verdict}`;

    // Brief v2 Part 8: scored quality gate — one rewrite with the judge's
    // notes when the draft scores below 8 in two or more categories.
    const verdict = await scoreDraft(anthropic, { headline: draft.headline, dek: draft.dek, body: draft.bodyMarkdown, sources: sourcePack });
    if (!verdict.pass) {
      const raw2 = await writeJSON({
        system,
        user: `${user}\n\nEDITOR'S REWRITE NOTES (your previous draft failed the quality gate — fix these precisely, keep what works): ${verdict.notes}\n\nIf the notes ask for detail the source pack does not contain, do NOT invent it: cut instead. Delete paragraphs that restate, and let the piece be shorter.`,
        schema: LONGFORM_SCHEMA,
        schemaName: "longform_article",
        maxTokens: 8192,
      });
      const draft2 = JSON.parse(raw2) as typeof draft;
      draft2.bodyMarkdown = scrubDashes(draft2.bodyMarkdown).replace(/\[EMBED:[^\]]*\]\s*/g, "").replace(/\[\/PULLQUOTE\]/g, "");
      if (boilerplateViolations(draft2.bodyMarkdown).length === 0 && !hasFirstPersonProse(draft2.bodyMarkdown)) {
        Object.assign(draft, draft2);
      }
    }

    // --- Publish --------------------------------------------------------
    const slug = slugify(draft.headline);
    const articleId = `article-lf-${slug.slice(0, 60)}`;
    await writeClient.createIfNotExists({
      _id: articleId,
      _type: "article",
      headline: draft.headline,
      slug: { _type: "slug", current: slug },
      dek: draft.dek,
      bodyMarkdown: draft.bodyMarkdown,
      ...(draft.pullQuote ? { pullQuote: draft.pullQuote } : {}),
      byline: BYLINE_STAFF,
      workflowState: "published",
      publishedAt: new Date().toISOString(),
      lowConfidence: false,
      primaryTeam: draft.primaryTeam,
      teams: draft.teams,
      tags: [...draft.tags, sel.typeId, `arch:${arch.key}`, `product:${product}`],
      contentType: "Analysis",
      productionMethod: "ai-reviewed",
      seoTitle: draft.seo.title,
      seoDescription: draft.seo.description,
    });

    try {
      const hero = await generateArticleHero(draft.headline, draft.teams);
      if (hero) {
        const assetId = await uploadHeroImage(hero);
        if (assetId) await setArticleHeroImage(articleId, assetId);
      }
    } catch (err) {
      console.error("[longform:hero]", err);
    }
    return `ok:${articleId}`;
  } catch (err) {
    console.error("[longform]", err);
    return "error";
  }
}
