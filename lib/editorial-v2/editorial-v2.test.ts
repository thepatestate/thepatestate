import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { editorialV2Flags, v2MayWrite } from "./flags";
import { callJSON, __setTransportForTests, modelForRole, oppositeOf, type TransportRequest } from "./models";
import { hardPolicyForLane, voiceCardForLane, goldStandardSentinel, judgeReferenceForLane } from "./context-pack";
import { writerContext, ARTICLE_SCHEMA, type ContextPack } from "./writers";
import { hardPolicyGates } from "./policy-gates";
import { styleDiagnostics, lengthNote } from "./diagnostics";
import { hardDecision, enforceBudget, ROUTE_FOR_CLASS, DEFAULT_BUDGET } from "./failure-router";
import { scrub } from "./telemetry";
import { retrieveFragments, loadFragments } from "./voice-retrieval";
import { DOSSIER_SCHEMA } from "./dossier";
import { MINER_SCHEMA } from "./story-miner";
import { BLUEPRINT_SCHEMA, BLUEPRINT_REVIEW_SCHEMA } from "./blueprint";
import { SELECTION_SCHEMA } from "./draft-editor";
import { FAN_SCHEMA, HUMANITY_SCHEMA } from "./final-eval";
import { DECISION_SCHEMA } from "./failure-router";
import type { EditorialDossier, StoryAngle, AngleDecision, StoryBlueprint, ArticleDraft, FactCheckResult } from "./types";

const dossier: EditorialDossier = {
  subject: "Miami as ACC favorite", teams: ["miami", "clemson"], coreDevelopment: "Josh calls Miami the class of the ACC.",
  confirmedFacts: [{ fact: "Miami opens No. 7 in the AP poll", sourceRef: "fact-sheet", confidence: "confirmed" }],
  uncertainOrMissing: [], numbers: [], quotes: [], joshOnRecord: [{ text: "Miami's the best team by far in the ACC", timestamp: "00:02:18", topic: "acc" }],
  footballMechanisms: [], tensions: [], contradictions: [], fanObjections: ["Miami went 6-2 in the league last year"], secondOrderConsequences: [],
  observableTests: [{ date: "2026-10-03", opponent: "Clemson", thingToWatch: "the road result" }], thingsActuallyInteresting: [],
  sourceSufficiency: { score: 8, canSupportBrief: true, canSupportReaction: true, canSupportPremiumColumn: true, reason: "one argument with football behind it" },
};
const angle: StoryAngle = { id: "a1", thesis: "Clemson on October 3 is the only date that owns the ACC argument.", readerPromise: "", whyNow: "", evidenceAvailable: [], missingEvidence: [], fanTension: "", likelyObjection: "", answerToObjection: "", saturdayPayoff: "", novelty: 8, stakes: 8, evidenceStrength: 8, fanArgument: 8, pateRelevance: 8, specificity: 8, curiosity: 8, risk: "" };
const decision: AngleDecision = { decision: "select", selectedAngleId: "a1", finalThesis: angle.thesis, reason: "", requiredEvidence: [], mustAvoid: [] };
const blueprint: StoryBlueprint = { thesis: angle.thesis, targetLength: { minGuidance: 600, ideal: 850, maxGuidance: 1100 }, beats: [
  { id: "b1", job: "hook", point: "x", sourceRefs: [], joshRefs: [], newInformation: "", readerReactionTarget: "argument", mandatory: true },
  { id: "b2", job: "fan-objection", point: "y", sourceRefs: [], joshRefs: [], newInformation: "", readerReactionTarget: "argument", mandatory: true },
  { id: "b3", job: "close", point: "z", sourceRefs: [], joshRefs: [], newInformation: "", readerReactionTarget: "want-to-watch", mandatory: true },
], openingStrategy: "", centralDistinction: "", strongestProof: "", fanObjection: "", honestConcession: "", saturdayTest: "", endingJob: "", cutIfThin: [] };
const draft: ArticleDraft = { headline: "Miami Is the ACC by Itself", dek: "One date decides it.", bodyMarkdown: "I think Miami is the class of the league.\n\n[EMBED:00:02:18]\n\nClemson on October 3 is the only result that reopens it.\n\n— JP", pullQuote: "", primaryTeam: "miami", teams: ["miami"], tags: ["acc"], seo: { title: "", description: "" } };

const requiredKeys = (schema: { required?: string[] }) => schema.required ?? [];

describe("flags", () => {
  it("default off; shadow default on; a lane may write only when on and shadow off", () => {
    expect(editorialV2Flags({}).enabled).toBe(false);
    expect(editorialV2Flags({}).shadow).toBe(true);
    expect(v2MayWrite("show", { EDITORIAL_V2_ENABLED: "true", EDITORIAL_V2_SHOW_ENABLED: "true" })).toBe(false);
    expect(v2MayWrite("show", { EDITORIAL_V2_ENABLED: "true", EDITORIAL_V2_SHOW_ENABLED: "true", EDITORIAL_V2_SHADOW_MODE: "false" })).toBe(true);
    expect(v2MayWrite("show", { EDITORIAL_V2_SHOW_ENABLED: "true", EDITORIAL_V2_SHADOW_MODE: "false" })).toBe(false);
  });
});

describe("model routing", () => {
  const seen: TransportRequest[] = [];
  beforeEach(() => { seen.length = 0; });
  afterEach(() => __setTransportForTests(null));

  it("falls back down the chain when a named model is unavailable", async () => {
    __setTransportForTests(async (req) => {
      seen.push(req);
      if (req.model === "gpt-5.6-terra") { const e = new Error("model not found"); e.name = "ModelUnavailable"; throw e; }
      return { text: JSON.stringify({ ok: true }), inputTokens: 10, outputTokens: 5 };
    });
    const r = await callJSON<{ ok: boolean }>({ stage: "t", role: "storyMiner", system: "s", user: "u", schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false }, schemaName: "t", maxTokens: 100 });
    expect(r.data.ok).toBe(true);
    expect(seen.map((s) => s.model)).toEqual(["gpt-5.6-terra", "gpt-5.6-sol"]);
    expect(r.call.model).toBe("gpt-5.6-sol");
    expect(r.call.costUsd).toBeGreaterThan(0);
  });
  it("throws only when every model fails", async () => {
    __setTransportForTests(async () => { throw new Error("down"); });
    await expect(callJSON({ stage: "t", role: "dossier", system: "s", user: "u", schema: {}, schemaName: "t", maxTokens: 10 })).rejects.toThrow(/every model failed/);
  });
  it("keeps the creative path cross-family", () => {
    expect(modelForRole("writerA").vendor).not.toBe(modelForRole("writerB").vendor);
    expect(modelForRole("angleJudgeA").vendor).not.toBe(modelForRole("angleJudgeB").vendor);
    expect(modelForRole("fanJudgeA").vendor).not.toBe(modelForRole("fanJudgeB").vendor);
    expect(oppositeOf("openai").vendor).toBe("anthropic");
    expect(oppositeOf("anthropic").vendor).toBe("openai");
  });
});

describe("context pack", () => {
  const pack: ContextPack = { lane: "show", product: "josh-column", dossier, angle, decision, blueprint, fragments: retrieveFragments(blueprint, { teams: ["miami"] }) };
  it("the writer never receives the gold standard, the judge does", () => {
    const ctx = writerContext(pack);
    const sentinel = goldStandardSentinel("show");
    expect(sentinel.length).toBeGreaterThan(60);
    expect(ctx).not.toContain(sentinel);
    expect(ctx).not.toContain("I picked three of them");
    expect(judgeReferenceForLane("show")).toContain("I picked three of them");
    expect(ctx.length).toBeLessThan(judgeReferenceForLane("show").length * 3);
  });
  it("carries hard policy, the voice card, the blueprint and the dossier", () => {
    const ctx = writerContext(pack);
    expect(ctx).toContain("HARD POLICY");
    expect(ctx).toContain("VOICE CARD");
    expect(ctx).toContain("APPROVED BLUEPRINT");
    expect(ctx).toContain("REPORTING DOSSIER");
    expect(ctx).toContain("OUTPUT CONTRACT");
    expect(hardPolicyForLane("show")).toMatch(/first person/i);
    expect(voiceCardForLane("show").split(/\s+/).length).toBeLessThan(400);
  });
  it("both writers get identical facts; neither prompt contains a draft", () => {
    const a = writerContext(pack), b = writerContext(pack);
    expect(a).toBe(b);
    expect(a).not.toMatch(/DRAFT [AB]/);
  });
  it("retrieval excludes the hidden benchmark's fragments and covers the beats' jobs", () => {
    const withMiami = retrieveFragments(blueprint, { teams: ["miami"] });
    expect(withMiami.some((f) => f.sourceId === "article-miami-acc-favorite-v2")).toBe(true);
    const without = retrieveFragments(blueprint, { teams: ["miami"], excludeSourceIds: ["article-miami-acc-favorite-v2"] });
    expect(without.every((f) => f.sourceId !== "article-miami-acc-favorite-v2")).toBe(true);
    expect(without.length).toBeGreaterThanOrEqual(3);
    expect(loadFragments().every((f) => f.approved)).toBe(true);
  });
});

describe("hard policy gates", () => {
  it("passes a clean first-person column with one embed", () => {
    expect(hardPolicyGates({ draft, lane: "show", transcriptText: "[02:18] Miami's the best team by far in the ACC" }).pass).toBe(true);
  });
  it("fails the fact/brand rules, not style", () => {
    const bad = { ...draft, bodyMarkdown: "Miami is the class of the league. The machine agrees and this is a lock of the week. I logged this on August 27.\n\n[EMBED:00:02:18]\n\n— JP" };
    const r = hardPolicyGates({ draft: bad, lane: "show", transcriptText: "" });
    expect(r.pass).toBe(false);
    expect(r.violations.join(" ")).toMatch(/AI Predictor/);
    expect(r.violations.join(" ")).toMatch(/tout/);
    expect(r.violations.join(" ")).toMatch(/Ledger/);
    const styleOnly = { ...draft, bodyMarkdown: "I think this. The real question is whether it holds.\n\n[EMBED:00:02:18]\n\nThe margin is the bet.\n\n— JP" };
    expect(hardPolicyGates({ draft: styleOnly, lane: "show", transcriptText: "" }).pass).toBe(true);
  });
  it("quote fidelity is fail-closed", () => {
    const quoted = { ...draft, bodyMarkdown: 'I said "this exact sentence is not on the tape anywhere" on the show.\n\n[EMBED:00:02:18]\n\n— JP' };
    expect(hardPolicyGates({ draft: quoted, lane: "show", transcriptText: "[00:01] something else entirely" }).violations.join(" ")).toMatch(/quote fidelity/);
  });
});

describe("diagnostics are signals", () => {
  it("a 690-word finished column is not a failure", () => {
    expect(lengthNote(690, "josh-column")).toBeNull();
    expect(lengthNote(500, "josh-column")).toMatch(/fine if the argument is finished/);
    const d = styleDiagnostics(draft.bodyMarkdown);
    expect(d.words).toBeGreaterThan(0);
    expect(Array.isArray(d.styleFlags)).toBe(true);
  });
});

describe("failure router", () => {
  const pass: FactCheckResult = { verdict: "pass", claims: [], joshMisattribution: [] };
  const spent = { remine: 0, blueprint: 0, rewrite: 0, factRepair: 0, cycles: 1 };
  it("fact-check failure blocks and routes to fact repair, then holds", () => {
    const bad: FactCheckResult = { verdict: "unsupported", claims: [{ claim: "91 percent returning", status: "unsupported", sourceRefs: [] }], joshMisattribution: [] };
    const d1 = hardDecision(bad, { pass: true, violations: [] }, spent, DEFAULT_BUDGET)!;
    expect(d1.decision).toBe("revise"); expect(d1.routeTo).toBe("fact-repair"); expect(d1.failureClass).toBe("fact");
    const d2 = hardDecision(bad, { pass: true, violations: [] }, { ...spent, factRepair: 1 }, DEFAULT_BUDGET)!;
    expect(d2.decision).toBe("hold"); expect(d2.routeTo).toBe("human");
  });
  it("Josh misattribution is a fact failure", () => {
    const bad: FactCheckResult = { verdict: "pass", claims: [], joshMisattribution: ["Josh said Miami wins it all"] };
    expect(hardDecision({ ...bad, verdict: "contradicted" }, { pass: true, violations: [] }, spent, DEFAULT_BUDGET)!.failureClass).toBe("fact");
  });
  it("every failure class maps to a valid stage and budgets convert revise to hold", () => {
    for (const r of Object.values(ROUTE_FOR_CLASS)) expect(["reporting", "story-miner", "blueprint", "developmental-rewrite", "voice-edit", "fact-repair", "human"]).toContain(r);
    const d = enforceBudget({ decision: "revise", failureClass: "structure", reason: "repeats", routeTo: "blueprint", instructions: [] }, { ...spent, blueprint: 2 }, DEFAULT_BUDGET);
    expect(d.decision).toBe("hold"); expect(d.routeTo).toBe("human");
    const e = enforceBudget({ decision: "revise", failureClass: "prose", reason: "x", routeTo: "developmental-rewrite", instructions: [] }, { ...spent, cycles: 3 }, DEFAULT_BUDGET);
    expect(e.decision).toBe("hold");
    expect(hardDecision(pass, { pass: true, violations: [] }, spent, DEFAULT_BUDGET)).toBeNull();
  });
});

describe("telemetry", () => {
  it("strips anything that looks like model reasoning", () => {
    const s = scrub({ decision: "accept", reasoning: "secret", nested: { thoughts: "x", keep: 1 }, list: [{ chain_of_thought: "y", ok: true }] }) as Record<string, unknown>;
    expect(JSON.stringify(s)).not.toMatch(/secret|thoughts|chain_of_thought/);
    expect((s.nested as { keep: number }).keep).toBe(1);
  });
});

describe("stage schemas are strict", () => {
  it("every schema requires all of its properties and forbids extras", () => {
    for (const s of [DOSSIER_SCHEMA, MINER_SCHEMA, BLUEPRINT_SCHEMA, BLUEPRINT_REVIEW_SCHEMA, SELECTION_SCHEMA, FAN_SCHEMA, HUMANITY_SCHEMA, DECISION_SCHEMA, ARTICLE_SCHEMA] as { properties: Record<string, unknown>; required?: string[]; additionalProperties?: boolean }[]) {
      expect(s.additionalProperties).toBe(false);
      expect(requiredKeys(s).sort()).toEqual(Object.keys(s.properties).sort());
    }
  });
});
