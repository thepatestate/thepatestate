// Observability (brief §24). Every V2 run is stored as structured artifacts
// and decisions: Supabase `editorial_runs` when configured, plus a local JSON
// file so replays are inspectable offline. Model reasoning is never stored;
// `scrub` strips any field that looks like it.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import type { EditorialRun } from "./types";

const REASONING_KEYS = /^(reasoning|reasoning_content|thoughts?|chain_of_thought|scratchpad|thinking)$/i;

export function scrub<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => scrub(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) if (!REASONING_KEYS.test(k)) out[k] = scrub(v);
    return out as T;
  }
  return value;
}

export function newRunId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function localRunDir(): string {
  return process.env.EDITORIAL_V2_RUN_DIR ?? join(process.cwd(), ".superpowers", "editorial-runs");
}

/** Writes the run locally and upserts it to Supabase. Fail-soft. */
export async function recordRun(run: EditorialRun): Promise<void> {
  const clean = scrub(run);
  try {
    mkdirSync(localRunDir(), { recursive: true });
    writeFileSync(join(localRunDir(), `${run.id}.json`), JSON.stringify(clean, null, 2));
  } catch (err) { console.warn("[v2:telemetry] local write failed", err instanceof Error ? err.message : err); }
  if (!isAdminConfigured || process.env.VITEST) return;
  try {
    const { error } = await createAdminClient().from("editorial_runs").upsert({
      id: run.id, lane: run.lane, product: run.product, source_id: run.sourceId, fixture: run.fixture ?? null, mode: run.mode,
      status: run.status, started_at: run.startedAt, completed_at: run.completedAt ?? null, cycles: run.cycles,
      decision: run.decision?.decision ?? null, failure_class: run.decision?.failureClass ?? null,
      final_score: run.finalScore ?? null, published_content_id: null,
      total_cost_usd: run.totalCostUsd, total_calls: run.calls.length, artifacts: clean, error: run.error ?? null,
    }, { onConflict: "id" });
    if (error) console.warn("[v2:telemetry] upsert failed", error.message);
  } catch (err) { console.warn("[v2:telemetry] upsert threw", err instanceof Error ? err.message : err); }
}
