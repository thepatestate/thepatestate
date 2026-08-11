import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getEspnScoreboard } from "@/lib/espn";
import {
  scorePickemEntry,
  scoreBracketEntry,
  type PickemPickValue,
  type PickemResultValue,
  type BracketOfficial,
  type BracketRuleConfig,
} from "@/lib/score-play";
import type { Competition, PickemGame } from "@/lib/play";

export const maxDuration = 60;

// Scoring cron (v2 brief §5.1): reads official finals from the live feed
// into play_results, then runs the deterministic scorers over every locked
// entry. Runs hourly via pg_cron; every write happens with the service
// role, so RLS immutability for citizens is never loosened. LLMs are
// nowhere in this path.

interface PickRow {
  id: string;
  entry_id: string;
  slot: string;
  value: Record<string, unknown>;
  points: number | null;
}

async function scorePickemCompetition(
  admin: ReturnType<typeof createAdminClient>,
  comp: Competition,
): Promise<{ resulted: number; entriesScored: number; complete: boolean }> {
  const games: PickemGame[] = comp.config.games ?? [];
  const gameIds = new Set(games.map((g) => g.id));

  // 1. Pull existing results, then record finals from the feed.
  const { data: existing } = await admin
    .from("play_results")
    .select("slot, value")
    .eq("competition_slug", comp.slug);
  const results: Record<string, PickemResultValue> = {};
  for (const r of (existing as { slot: string; value: PickemResultValue }[] | null) ?? []) {
    results[r.slot] = r.value;
  }

  let resulted = 0;
  if (Object.keys(results).length < games.length) {
    // All snapshot games live in week 1 of the feed.
    const board = await getEspnScoreboard(1);
    for (const card of board) {
      if (!gameIds.has(card.id) || results[card.id]) continue;
      if (card.st !== "FINAL") continue;
      const [away, home] = card.teams;
      const awayPts = Number(away.pts);
      const homePts = Number(home.pts);
      if (!Number.isFinite(awayPts) || !Number.isFinite(homePts) || awayPts === homePts) continue;
      const value: PickemResultValue = {
        winner: awayPts > homePts ? "away" : "home",
        awayPts,
        homePts,
      };
      const { error } = await admin.from("play_results").insert({
        competition_slug: comp.slug,
        slot: card.id,
        value,
        source: "espn",
      });
      if (!error) {
        results[card.id] = value;
        resulted += 1;
      }
    }
  }

  // 2. Score every entry against available results.
  let entriesScored = 0;
  if (Object.keys(results).length > 0) {
    const { data: entries } = await admin
      .from("play_entries")
      .select("id, points")
      .eq("competition_slug", comp.slug);
    for (const entry of (entries as { id: string; points: number | null }[] | null) ?? []) {
      const { data: picks } = await admin.from("play_picks").select("*").eq("entry_id", entry.id);
      const pickRows = ((picks as PickRow[] | null) ?? []).filter((p) => gameIds.has(p.slot));
      const scored = scorePickemEntry(
        pickRows.map((p) => ({ slot: p.slot, value: p.value as unknown as PickemPickValue })),
        results,
      );
      for (const p of pickRows) {
        const pts = scored.perPick[p.slot];
        if (pts !== undefined && pts !== p.points) {
          await admin.from("play_picks").update({ points: pts }).eq("id", p.id);
        }
      }
      if (entry.points !== scored.total) {
        await admin.from("play_entries").update({ points: scored.total }).eq("id", entry.id);
        entriesScored += 1;
      }
    }
  }

  const complete = Object.keys(results).length >= games.length;
  if (complete && comp.status === "open") {
    await admin.from("competitions").update({ status: "scored" }).eq("slug", comp.slug);
  }
  return { resulted, entriesScored, complete };
}

async function scoreBracketCompetition(
  admin: ReturnType<typeof createAdminClient>,
  comp: Competition,
): Promise<{ entriesScored: number; complete: boolean }> {
  // Official bracket results are recorded by staff when the committee's
  // field is announced (slots seed-1..seed-N + champion). Nothing to do
  // until then.
  const { data: resultRows } = await admin
    .from("play_results")
    .select("slot, value")
    .eq("competition_slug", comp.slug);
  const rows = (resultRows as { slot: string; value: { team?: string } }[] | null) ?? [];
  if (rows.length === 0) return { entriesScored: 0, complete: false };

  const official: BracketOfficial = { field: {}, champion: null };
  for (const r of rows) {
    if (r.slot.startsWith("seed-") && r.value.team) official.field[Number(r.slot.slice(5))] = r.value.team;
    if (r.slot === "champion") official.champion = r.value.team ?? null;
  }
  const fieldSize = comp.config.fieldSize ?? 12;
  const fieldComplete = Object.keys(official.field).length >= fieldSize;
  if (!fieldComplete) return { entriesScored: 0, complete: false };

  const { data: ruleRow } = await admin
    .from("scoring_rules")
    .select("config")
    .eq("id", comp.scoring_rule_id)
    .single();
  const rule = (ruleRow as { config: BracketRuleConfig } | null)?.config;
  if (!rule) return { entriesScored: 0, complete: false };

  let entriesScored = 0;
  const { data: entries } = await admin
    .from("play_entries")
    .select("id, points")
    .eq("competition_slug", comp.slug);
  for (const entry of (entries as { id: string; points: number | null }[] | null) ?? []) {
    const { data: picks } = await admin.from("play_picks").select("*").eq("entry_id", entry.id);
    const seeds: Record<number, string> = {};
    let champion: string | null = null;
    for (const p of ((picks as PickRow[] | null) ?? [])) {
      const team = (p.value as { team?: string }).team;
      if (!team) continue;
      if (p.slot.startsWith("seed-")) seeds[Number(p.slot.slice(5))] = team;
      if (p.slot === "champion") champion = team;
    }
    const scored = scoreBracketEntry(seeds, champion, official, rule);
    if (entry.points !== scored.total) {
      await admin.from("play_entries").update({ points: scored.total }).eq("id", entry.id);
      entriesScored += 1;
    }
  }
  const complete = Boolean(official.champion);
  if (complete && comp.status === "open") {
    await admin.from("competitions").update({ status: "scored" }).eq("slug", comp.slug);
  }
  return { entriesScored, complete };
}

export async function POST(request: Request) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;
  if (!isAdminConfigured) return NextResponse.json({ error: "no admin client" }, { status: 500 });
  const admin = createAdminClient();

  // Only locked, unfinished competitions can score.
  const { data: comps } = await admin
    .from("competitions")
    .select("*")
    .in("status", ["open"])
    .lte("locks_at", new Date().toISOString());

  const summary: Record<string, unknown> = {};
  for (const comp of ((comps as Competition[] | null) ?? [])) {
    try {
      summary[comp.slug] =
        comp.type === "pickem"
          ? await scorePickemCompetition(admin, comp)
          : await scoreBracketCompetition(admin, comp);
    } catch (err) {
      summary[comp.slug] = { error: String(err) };
    }
  }
  console.log("[play:score]", JSON.stringify(summary));
  return NextResponse.json({ ok: true, summary });
}
