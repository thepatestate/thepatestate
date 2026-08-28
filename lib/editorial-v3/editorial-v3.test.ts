import { describe, it, expect, afterEach } from "vitest";
import { editorialV3Flags, v3MayWrite } from "./flags";
import { callJSON, __setTransportForTests, modelForRole, oppositeOf, type TransportRequest } from "./models";
import { hardPolicyGates } from "./policy-gates";
import { segmentText, cutOnlyArticle, cutAsProse, tsToSec } from "./josh-engine";
import { quitVerdict } from "./judges";
import { DEPTH_WORDS } from "./v3-types";
import { v3Prompt, words, ARTICLE_SCHEMA } from "./v3-context";
import { judgeReferenceForLane } from "./context-pack";
import { scrub } from "./telemetry";
import type { JoshCut, QuitReading } from "./v3-types";

const cut: JoshCut = {
  segmentStart: "02:12", segmentEnd: "03:40", centralThought: "Miami is the best team in the ACC by far.",
  blocks: [
    { text: "Miami is the best team by far in the ACC and everybody else is playing for second.", sourceStart: "02:12", sourceEnd: "02:20" },
    { text: "If not them, then who? Name the alternative. SMU, Louisville, Clemson.", sourceStart: "02:40", sourceEnd: "03:04" },
  ],
  removedBecauseRepetitive: ["by far, by far"], removedBecauseOffTopic: [],
};

describe("V3 flags", () => {
  it("default off, shadow default on, may write only when a lane is on and shadow off", () => {
    expect(editorialV3Flags({}).enabled).toBe(false);
    expect(editorialV3Flags({}).shadow).toBe(true);
    expect(v3MayWrite("josh", { EDITORIAL_V3_ENABLED: "true", EDITORIAL_V3_JOSH_ENABLED: "true" })).toBe(false);
    expect(v3MayWrite("josh", { EDITORIAL_V3_ENABLED: "true", EDITORIAL_V3_JOSH_ENABLED: "true", EDITORIAL_V3_SHADOW_MODE: "false" })).toBe(true);
    expect(v3MayWrite("reported", { EDITORIAL_V3_REPORTED_ENABLED: "true", EDITORIAL_V3_SHADOW_MODE: "false" })).toBe(false);
  });
});

describe("model routing", () => {
  afterEach(() => __setTransportForTests(null));
  it("falls back when a named model is unavailable and throws only when all fail", async () => {
    const seen: TransportRequest[] = [];
    __setTransportForTests(async (req) => { seen.push(req); if (req.model === "gpt-5.6-terra") { const e = new Error("model not found"); e.name = "ModelUnavailable"; throw e; } return { text: JSON.stringify({ ok: true }), inputTokens: 5, outputTokens: 2 }; });
    const r = await callJSON<{ ok: boolean }>({ stage: "t", role: "fanBrief", system: "s", user: "u", schema: {}, schemaName: "t", maxTokens: 10 });
    expect(r.data.ok).toBe(true);
    expect(seen.map((s) => s.model)).toEqual(["gpt-5.6-terra", "gpt-5.6-sol"]);
    __setTransportForTests(async () => { throw new Error("down"); });
    await expect(callJSON({ stage: "t", role: "joshCut", system: "s", user: "u", schema: {}, schemaName: "t", maxTokens: 10 })).rejects.toThrow(/every model failed/);
  });
  it("V3 uses a few calls, not a committee: the quit judge is the opposite family of the writer", () => {
    expect(modelForRole("reportedWriter").vendor).not.toBe(modelForRole("subtractionEditor").vendor);
    expect(oppositeOf(modelForRole("joshProseEdit").vendor).vendor).not.toBe(modelForRole("joshProseEdit").vendor);
  });
});

describe("Josh engine", () => {
  it("segmentText keeps only the lines inside the segment (with a small margin)", () => {
    const t = "[01:00] before\n[02:12] Miami is the best\n[02:50] then who\n[03:40] end of thought\n[05:00] later";
    const s = segmentText(t, "02:12", "03:40");
    expect(s).toContain("Miami is the best");
    expect(s).toContain("end of thought");
    expect(s).not.toContain("later");
    expect(s).not.toContain("before");
  });
  it("the cut-only article is Josh's words in his order, signed, with nothing added", () => {
    const a = cutOnlyArticle(cut);
    expect(a.bodyMarkdown).toMatch(/^Miami is the best team by far/);
    expect(a.bodyMarkdown).toMatch(/— JP$/);
    expect(a.bodyMarkdown).not.toMatch(/objection|concession|test/i);
    expect(cutAsProse(cut, [{ fact: "Miami opens No. 7 in the AP poll", sourceRef: "fact-sheet", insertAfterBlock: 0, whyUseful: "" }])).toContain("[VERIFIED FACT");
  });
  it("the prose-edit prompt forbids invention and never carries the gold standard", () => {
    const p = v3Prompt("josh-prose-edit");
    expect(p).toMatch(/editing Josh Pate, not writing as Josh Pate/);
    expect(p).toMatch(/may NOT invent/);
    expect(p).not.toContain("I picked three of them");
    expect(judgeReferenceForLane("show")).toContain("I picked three of them");
  });
});

describe("reported engine", () => {
  it("depth ranges are the brief's, and the writer prompt refuses padding and Josh catchphrases", () => {
    expect(DEPTH_WORDS.item).toEqual({ min: 75, max: 200 });
    expect(DEPTH_WORDS.story.max).toBeLessThan(DEPTH_WORDS.analysis.max);
    const p = v3Prompt("reported-writer");
    expect(p).toMatch(/stop at 280 words/);
    expect(p).toMatch(/catchphrases/);
    expect(v3Prompt("desk-voice")).toMatch(/DO NOT EXPLAIN A NORMAL FOOTBALL THING/);
    expect(v3Prompt("subtraction-editor")).toMatch(/first job is subtraction/);
  });
});

describe("reader tests", () => {
  it("didFinish=false fails the article; a never-quit read passes", () => {
    const base: QuitReading = { neverWantedToQuit: true, reason: "none", didFinish: true, soundsLikeFootballPerson: true, worthTheTime: true, wouldClickAnother: true, wouldSend: true, note: "" };
    expect(quitVerdict(base)).toBe("pass");
    expect(quitVerdict({ ...base, neverWantedToQuit: false, didFinish: false, quitParagraphIndex: 3, reason: "repetitive" })).toBe("fail");
  });
});

describe("hard gates stay hard; style is not a gate", () => {
  it("fails tout language, model nicknames and narrated Ledger; passes plain style", () => {
    const draft = { headline: "Miami is the ACC's best", dek: "", bodyMarkdown: "I think Miami is the class of the league. The machine agrees. Lock of the week.\n\n[EMBED:00:02:12]\n\n— JP", pullQuote: "", primaryTeam: "", teams: [], tags: [], seo: { title: "", description: "" } };
    const r = hardPolicyGates({ draft, lane: "show", transcriptText: "" });
    expect(r.pass).toBe(false);
    expect(r.violations.join(" ")).toMatch(/AI Predictor|tout/);
    const plain = { ...draft, bodyMarkdown: "I think Miami is the class of the league. The real question is whether anybody else is close.\n\n[EMBED:00:02:12]\n\n— JP" };
    expect(hardPolicyGates({ draft: plain, lane: "show", transcriptText: "" }).pass).toBe(true);
    expect(hardPolicyGates({ draft: { ...plain, bodyMarkdown: "Alabama named its starter. It is not a surprise." }, lane: "standalone" }).pass).toBe(true);
  });
  it("quoted spans must be verbatim in the transcript", () => {
    const draft = { headline: "h", dek: "", bodyMarkdown: 'I said "this sentence is not on the tape at all" last week.\n\n[EMBED:00:02:12]\n\n— JP', pullQuote: "", primaryTeam: "", teams: [], tags: [], seo: { title: "", description: "" } };
    expect(hardPolicyGates({ draft, lane: "show", transcriptText: "[00:01] something else" }).violations.join(" ")).toMatch(/quote fidelity/);
  });
});

describe("telemetry and schemas", () => {
  it("strips reasoning fields; the article schema is strict", () => {
    expect(JSON.stringify(scrub({ a: 1, reasoning: "x", nested: { thoughts: "y", keep: 2 } }))).not.toMatch(/reasoning|thoughts/);
    expect(ARTICLE_SCHEMA.additionalProperties).toBe(false);
    expect(words("one two three [EMBED:00:00:01] four\n\n— JP")).toBe(4);
  });
});

describe("timestamps", () => {
  it("parses bracketed and bare timestamps, so a bracketed segment never empties the cut", () => {
    expect(tsToSec("[02:06]")).toBe(126);
    expect(tsToSec("02:06")).toBe(126);
    expect(tsToSec("00:02:06")).toBe(126);
    expect(segmentText("[02:06] a\n[03:00] b\n[09:00] c", "[02:06]", "[03:52]")).toContain("b");
    expect(segmentText("[02:06] a\n[03:00] b\n[09:00] c", "[02:06]", "[03:52]")).not.toContain("c");
  });
});
