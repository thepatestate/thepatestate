// The desk gate (Isaac, 2026-08-28: "we need to be sure we have a better gate
// to keep non-college football articles out"). One cheap Luna call on the
// feed headline and text BEFORE a headline becomes a Wire item, so junk never
// costs a story and never leaves a dead click. The keyword filter in
// lib/wire.ts runs first (free); this catches what keywords cannot (NAIA
// previews, reader polls, odds listings, high-school highlights).
import { callJSON, choiceFor } from "./models";
import { v3Prompt, S, obj } from "./v3-context";
import type { StageCall } from "./v3-types";

export interface DeskGateResult { collegeFootball: boolean; level: "FBS" | "FCS" | "other"; nationalDeskWouldRun: boolean; reason: string }
const GATE_SCHEMA = obj({ collegeFootball: { type: "boolean" }, level: { type: "string", enum: ["FBS", "FCS", "other"] }, nationalDeskWouldRun: { type: "boolean" }, reason: S });

export async function deskGate(input: { headline: string; text: string }): Promise<{ result: DeskGateResult; pass: boolean; call: StageCall }> {
  const { data, call } = await callJSON<DeskGateResult>({ stage: "desk-gate", role: "deskGate", choice: choiceFor("deskGate", "economy"), maxTokens: 400, schemaName: "desk_gate", schema: GATE_SCHEMA as unknown as Record<string, unknown>, system: v3Prompt("desk-gate"), user: `HEADLINE: ${input.headline}\n\nTEXT:\n${input.text.slice(0, 4000)}` });
  return { result: data, pass: data.collegeFootball && data.nationalDeskWouldRun, call };
}
