// Editorial Engine V3 in production (Isaac, 2026-08-28: "launch this on the
// site"). Three adapters from the engines to the site's documents:
//   - the Wire: Engine B from the cluster's fetched sources → wireStory fields
//     (a single bodyMarkdown the page renders; the seven modules stay empty)
//   - the daily house reaction: Engine B from the Wire's sources → article
//   - Josh's Read from the show: the additive engine → article, held ai-drafted
// Lane rules (kit v4 Constitution §3) are unchanged: the desk publishes,
// Josh's byline waits for the click.
import { fetchArticleText } from "./source-text";
import { runReportedEngine, type ReportedMaterial } from "./reported-engine";
import { runJoshAdditive } from "./josh-additive";
import { rosterNames } from "./roster";
import { JOSH_BRACKET_FIELD, JOSH_BRACKET_FINAL, JOSH_BRACKET_LABEL } from "@/lib/josh-bracket";
import { modulateStory } from "@/lib/editorial-v3/modulate";
import { teamFactSheet } from "@/lib/fact-sheet";
import { getTeamDirectory } from "@/lib/cfbd";
import { resolveTeamSlug } from "@/lib/wire";
import type { JoshMaterial } from "./josh-engine";
import type { V3Run } from "./v3-types";
import type { Tier } from "./models";

/** The Wire's tier: economy unless EDITORIAL_WIRE_TIER=premium (Isaac, 2026-08-28: "for the basic reporting we need a much cheaper pipeline"). */
export const wireTier = (): Tier => (process.env.EDITORIAL_WIRE_TIER === "premium" ? "premium" : "economy");
/** The desk gate is on unless EDITORIAL_V3_DESK_GATE=false. */
export const deskGateOn = (): boolean => process.env.EDITORIAL_V3_DESK_GATE !== "false";

export interface SourceRef { outlet: string; url: string; feedText?: string; title?: string }

/** Fetch each source with the real extractor; fall back to the feed's own text. */
export async function gatherSources(refs: SourceRef[]): Promise<ReportedMaterial["sources"]> {
  const out: ReportedMaterial["sources"] = [];
  for (const r of refs.slice(0, 4)) {
    let text = await fetchArticleText(r.url).catch(() => "");
    if (text.length < 600 && r.feedText && r.feedText.length > text.length) text = r.feedText;
    if (text.length < 300) continue;
    out.push({ key: r.url, title: r.title ?? r.outlet, outlets: [r.outlet], urls: [r.url], text });
  }
  return out;
}

const paragraphs = (body: string) => body.replace(/\[EMBED:[^\]]*\]\s*|\[PULLQUOTE\]\s*/g, "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

/** The Wire story fields for a cluster, or a skip reason. */
export async function v3WireStory(input: { clusterKey: string; teams: string[]; refs: SourceRef[]; category?: string; mode: V3Run["mode"]; tier?: Tier; gate?: boolean; importance?: number }): Promise<{ ok: true; fields: Record<string, unknown>; run: V3Run } | { ok: false; reason: string; run?: V3Run }> {
  const sources = await gatherSources(input.refs);
  if (sources.length === 0) return { ok: false, reason: `no-source-text:${input.clusterKey}` };
  const factSheet = await teamFactSheet(input.teams.slice(0, 4), { games: 8 }).catch(() => "");
  // The site's positions ride along as a consistency ledger so a story can
  // say where Josh is on record — never as a fact mine (2026-08-31, Isaac:
  // stories must carry why they exist and how Josh feels about the why).
  const onRecord = `SITE POSITIONS ON RECORD (a consistency ledger: cite at most one, only where it bears directly on this news, attributed to Josh Pate or the site's bracket by name; never contradict silently, never pad with it): ${JOSH_BRACKET_LABEL} — field: ${JOSH_BRACKET_FIELD.map((t) => `${t.seed} ${t.name}`).join(", ")}; final on record: ${JOSH_BRACKET_FINAL}.`;
  const run = await runReportedEngine({ sourceId: input.clusterKey, sources, factSheet, onRecord }, { mode: input.mode, tier: input.tier ?? wireTier(), gate: input.gate ?? deskGateOn(), log: (l) => console.log(`[v3:wire:${input.clusterKey}] ${l}`) });
  if (run.status === "no-article") return { ok: false, reason: run.error ?? "desk gate", run };
  if (run.final && (!run.final.headline.trim() || !run.final.bodyMarkdown.trim())) return { ok: false, reason: `empty-${run.final.headline.trim() ? "body" : "headline"}:${input.clusterKey}`, run };
  if (run.status !== "completed" || !run.final) return { ok: false, reason: `v3-${run.status}:${run.error ?? input.clusterKey}`, run };
  if (!run.artifacts.policy?.pass) return { ok: false, reason: `policy:${run.artifacts.policy?.violations[0] ?? "?"}`, run };
  if (run.artifacts.fact?.verdict !== "pass") return { ok: false, reason: `factcheck-${run.artifacts.fact?.verdict}:${input.clusterKey}`, run };
  if (run.artifacts.quit && !run.artifacts.quit.didFinish) return { ok: false, reason: `quit:${run.artifacts.quit.reason}`, run };
  const paras = paragraphs(run.final.bodyMarkdown);
  // Page modules (2026-09-01): the finished story laid out into the wire
  // page's architecture. Fail-soft — a modulate error ships the flat body.
  let mods: Awaited<ReturnType<typeof modulateStory>>["modules"] | null = null;
  try { const m = await modulateStory(run.final, run.artifacts.pack!, run.artifacts.brief!, input.tier ?? wireTier()); mods = m.modules; run.calls.push(m.call); } catch (err) { console.log(`[v3:wire:${input.clusterKey}] modulate failed: ${err instanceof Error ? err.message : err}`); }
  const teamDir = await getTeamDirectory().catch(() => ({}) as Record<string, unknown>);
  const teams = [...new Set([...(run.final.teams ?? []), ...input.teams])].map((t) => resolveTeamSlug(t, teamDir)).filter(Boolean);
  const confirmed = (run.artifacts.pack?.facts ?? []).every((f) => f.status === "confirmed");
  return {
    ok: true, run,
    fields: {
      headline: run.final.headline,
      deck: run.final.dek,
      verification: confirmed ? "confirmed" : "reported",
      category: input.category ?? "general",
      teams,
      whatHappened: mods?.whatHappened ?? paras[0] ?? "",
      bodyMarkdown: run.final.bodyMarkdown,
      ...(mods ? {
        openTitle: mods.openTitle, whyTitle: mods.whyTitle ?? undefined, whyBody: mods.whyBody ?? undefined,
        missing: mods.missing ?? undefined, callout: mods.callout ?? undefined,
        section04Title: mods.section04Title ?? undefined, section04Body: mods.section04Body ?? undefined,
        chessboard: mods.chessboard ?? undefined, readBody: mods.readBody ?? undefined,
        watching: mods.watching, facts: mods.facts,
      } : {}),
      // Impact follows the item's importance (the news), not the depth (the
      // word count): a 120-word item about a court order is not "low".
      impact: input.importance != null ? (input.importance >= 8 ? "significant" : input.importance >= 5 ? "moderate" : "low") : run.artifacts.brief?.depth === "analysis" ? "significant" : run.artifacts.brief?.depth === "story" ? "moderate" : "low",
      impactRationale: run.artifacts.brief?.depthReason ?? "",
      stats: mods?.stats ?? [],
      sources: sources.map((s) => ({ outlet: s.outlets[0], url: s.urls[0] })),
      productionMethod: "v3-desk",
      v3Depth: run.artifacts.brief?.depth ?? "item",
      v3RunId: run.id,
    },
  };
}

/** A staff reaction article from the same sources, for the daily lane. */
export async function v3ReactionArticle(input: { sourceId: string; refs: SourceRef[]; teams: string[]; mode: V3Run["mode"] }): Promise<{ ok: true; fields: Record<string, unknown>; run: V3Run } | { ok: false; reason: string; run?: V3Run }> {
  const sources = await gatherSources(input.refs);
  if (sources.length === 0) return { ok: false, reason: "no-source-text" };
  const factSheet = await teamFactSheet(input.teams.slice(0, 4), { games: 8 }).catch(() => "");
  const run = await runReportedEngine({ sourceId: input.sourceId, sources, factSheet }, { mode: input.mode, log: (l) => console.log(`[v3:reaction:${input.sourceId}] ${l}`) });
  if (run.status !== "completed" || !run.final) return { ok: false, reason: `v3-${run.status}`, run };
  if (!run.artifacts.policy?.pass) return { ok: false, reason: `policy:${run.artifacts.policy?.violations[0]}`, run };
  if (run.artifacts.fact?.verdict !== "pass") return { ok: false, reason: `factcheck-${run.artifacts.fact?.verdict}`, run };
  return { ok: true, run, fields: { headline: run.final.headline, dek: run.final.dek, bodyMarkdown: run.final.bodyMarkdown, pullQuote: "", primaryTeam: run.final.primaryTeam, teams: run.final.teams, tags: [...run.final.tags, "engine:v3", `depth:${run.artifacts.brief?.depth ?? "item"}`], seoTitle: run.final.seo.title, seoDescription: run.final.seo.description, productionMethod: "ai-reviewed" } };
}

/** Josh's Read from an episode: the additive engine. Held for the click by the caller. */
export async function v3JoshColumn(input: { ytId: string; title: string; description: string; publishedAt: string; transcriptText: string; teams: string[]; onRecord: string; mode: V3Run["mode"]; assignment?: string }): Promise<{ ok: true; fields: Record<string, unknown>; run: V3Run; lowConfidence: boolean } | { ok: false; reason: string; run?: V3Run }> {
  const factSheet = await teamFactSheet(input.teams.slice(0, 6), { games: 14 }).catch(() => "");
  const names = await rosterNames(input.teams.slice(0, 6)).catch(() => "");
  const m: JoshMaterial = { ytId: input.ytId, title: input.title, description: input.description, publishedAt: input.publishedAt, transcriptText: input.transcriptText, factSheet, onRecord: input.onRecord, assignment: input.assignment, rosterNames: names };
  const run = await runJoshAdditive(m, { mode: input.mode, log: (l) => console.log(`[v3:josh:${input.ytId}] ${l}`) });
  if (run.status === "no-article") return { ok: false, reason: `no-article:${run.artifacts.segment?.reason?.slice(0, 80) ?? ""}`, run };
  if (run.status !== "completed" || !run.final) return { ok: false, reason: `v3-${run.status}:${run.error ?? ""}`, run };
  const lowConfidence = !run.artifacts.policy?.pass || run.artifacts.fact?.verdict !== "pass" || run.artifacts.additive?.worthItForListener === false;
  return { ok: true, run, lowConfidence, fields: { headline: run.final.headline, dek: run.final.dek, bodyMarkdown: run.final.bodyMarkdown, pullQuote: run.final.pullQuote, primaryTeam: run.final.primaryTeam, teams: run.final.teams, tags: [...run.final.tags, "engine:v3-additive"], seoTitle: run.final.seo.title, seoDescription: run.final.seo.description } };
}
