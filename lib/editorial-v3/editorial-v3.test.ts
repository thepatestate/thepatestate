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
  it("V3 uses a few calls, not a committee: the desk editor is a different model from the reporter", () => {
    expect(modelForRole("reportedWriter").model).not.toBe(modelForRole("deskEditor").model);
    expect(oppositeOf(modelForRole("joshProseEdit").vendor).vendor).not.toBe(modelForRole("joshProseEdit").vendor);
  });
  it("2026-08-30: no Anthropic model writes or rewrites prose in any lane", () => {
    for (const role of ["reportedWriter", "joshColumnWriter", "deskEditor", "joshProseEdit", "joshSubtraction", "factRepair", "subtractionEditor"] as const) expect(modelForRole(role).vendor).toBe("openai");
  });
  it("2026-08-28: every first draft is ChatGPT Sol, with OpenAI-only fallbacks; Opus and Sonnet only edit", () => {
    for (const role of ["reportedWriter", "joshColumnWriter"] as const) {
      const c = modelForRole(role);
      expect(c.vendor).toBe("openai"); expect(c.model).toBe("gpt-5.6-sol");
      expect(c.fallbacks.every((f) => f.vendor === "openai")).toBe(true);
    }
    for (const role of ["deskEditor", "joshProseEdit", "joshSubtraction"] as const) expect(modelForRole(role).model).toBe("gpt-5.6-terra");
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
    expect(DEPTH_WORDS.item).toEqual({ min: 110, max: 300 });
    expect(DEPTH_WORDS.story.max).toBeLessThan(DEPTH_WORDS.analysis.max);
    const p = v3Prompt("reported-writer");
    expect(p).toMatch(/ends at 140 words/);
    expect(p).toMatch(/Never end on the schedule/);
    expect(p).toMatch(/the reporting does not establish/);
    expect(p).toMatch(/as Josh Pate/);
    expect(v3Prompt("desk-voice")).toMatch(/DO NOT EXPLAIN A NORMAL FOOTBALL THING/);
    expect(v3Prompt("desk-editor")).toMatch(/THE LEAD/);
    expect(v3Prompt("desk-editor")).toMatch(/may not add a fact/);
    expect(v3Prompt("fan-brief")).toMatch(/WOULD A NATIONAL COLLEGE FOOTBALL DESK RUN THIS/);
    expect(v3Prompt("craft-review")).toMatch(/20 subject no national desk would run/);
  });
});

describe("tiers, gate and cap (2026-08-28)", () => {
  it("economy tier: Sol writes, Luna edits, no Anthropic in the writing path; premium unchanged", async () => {
    const { choiceFor } = await import("./models");
    expect(choiceFor("reportedWriter", "economy").model).toBe("gpt-5.6-sol");
    expect(choiceFor("deskEditor", "economy").model).toBe("gpt-5.6-luna");
    expect(choiceFor("factRepair", "economy").vendor).toBe("openai");
    // nothing Anthropic writes in the economy Wire path
    for (const role of ["reportedWriter", "deskEditor", "factRepair", "packExtract", "fanBrief"] as const) expect(choiceFor(role, "economy").vendor).toBe("openai");
    expect(choiceFor("quitJudge", "economy").model).toBe("gpt-5.6-luna");
    expect(choiceFor("reportedWriter", "premium").model).toBe("gpt-5.6-sol");
    expect(choiceFor("deskEditor").model).toBe("gpt-5.6-terra");
    expect(choiceFor("joshColumnWriter", "economy").model).toBe("gpt-5.6-sol"); // Josh's Read has no economy mode
  });
  it("the desk gate prompt names what a national desk does not run", () => {
    const p = v3Prompt("desk-gate");
    for (const k of ["NAIA", "reader poll", "betting-odds", "high-school", "NFL"]) expect(p).toContain(k);
  });
  it("the keyword filter catches NAIA, reader polls and odds listings; FBS news passes", async () => {
    const { isOffTopic } = await import("@/lib/wire");
    expect(isOffTopic("DWU football gameday: Tigers travel to rival Trojans", "NAIA opener")).toBe(true);
    expect(isOffTopic("Hammer and Rails readers react: predicting Purdue's Big Ten wins")).toBe(true);
    expect(isOffTopic("The odds to win 2026 SEC championship and where Kentucky stands")).toBe(true);
    expect(isOffTopic("Kansas vs. LIU prediction: the Jayhawks need this tune-up")).toBe(true);
    expect(isOffTopic("Tennessee names Faizon Brandon starting QB")).toBe(false);
    expect(isOffTopic("Big Ten, SEC ban NFL players from returning to play")).toBe(false); // college signal beats the NFL word; the desk gate decides
    expect(isOffTopic("Browns cut former Ohio State receiver on final roster day")).toBe(true);
    expect(isOffTopic("Kentucky basketball: Wildcats open at Rupp Arena")).toBe(true);
    // description-only hits do not sink a football story
    expect(isOffTopic("Nebraska's Running Back Race Opens With Jamal Rule in the Mix", "The junior led the Huskers in 2025 before an NFL Draft decision by the starter.")).toBe(false);
    expect(isOffTopic("Kentucky's 2026 roster churn puts 38 former Wildcats across FBS", "Several are NFL hopefuls; two joined the basketball staff.")).toBe(false);
    expect(isOffTopic("2022 Athletes Could Gain a Fifth Season Under Class-Wide NCAA Injunction", "Football and basketball players in the 2022 class would benefit.")).toBe(false);
    expect(isOffTopic("Kentucky adds Jemma Amoore for 2026-27 backcourt depth", "The guard transfers from Ohio.")).toBe(true);
    expect(isOffTopic("Rams bring back Tutu Atwell to reinforce receiver depth", "The former Louisville wide receiver returns.")).toBe(true);
  });
  it("the daily cap counts from midnight Eastern", async () => {
    const { easternMidnightIso } = await import("@/lib/wire");
    const iso = easternMidnightIso(new Date("2026-08-29T03:30:00Z")); // 11:30pm ET Aug 28
    expect(iso).toBe("2026-08-28T04:00:00.000Z");
    expect(easternMidnightIso(new Date("2026-08-29T05:10:00Z"))).toBe("2026-08-29T04:00:00.000Z"); // 1:10am ET Aug 29
  });
});

describe("first-person gate", () => {
  it("roman numerals are not first person; real first person still is", async () => {
    const { hasFirstPersonProse } = await import("@/lib/wire");
    expect(hasFirstPersonProse("The dispute traces to a June vote by the NCAA's Division I board.")).toBe(false);
    expect(hasFirstPersonProse("It was a Title I school in an I-AA league.")).toBe(false);
    expect(hasFirstPersonProse("I think the board got this wrong, and I'm not alone.")).toBe(true);
  });
});

describe("lift gate", () => {
  it("a quote split by an attribution is still a quote, not a lift", async () => {
    const { liftReport } = await import("./lift-check");
    const src = "Kiffin said the program would keep a relentless pursuit of excellence. \"That's how I live. It's how I run the team, and we're always going to look for every edge we can get,\" he said.";
    const body = "Kiffin framed the decision as principle. \"That's how I live,\" he said. \"It's how I run the team, and we're always going to look for every edge we can get.\"";
    const r = liftReport(body, [src]);
    expect(r.runs).toEqual([]);
  });
  it("a stat line shared with the source is a fact, not a lift", async () => {
    const { liftReport, mostlyNumbers } = await import("./lift-check");
    const src = "He finished last season completing 58.3% of his passes for 2,760 yards, 15 touchdowns and nine interceptions, he said.";
    expect(mostlyNumbers("last season completing 58 3 of his passes for 2 760 yards 15 touchdowns and nine interceptions")).toBe(true);
    expect(liftReport("Castellanos spent last season completing 58.3% of his passes for 2,760 yards, 15 touchdowns and nine interceptions before he left.", [src]).runs).toEqual([]);
    expect(liftReport("The rule bans coaches from half of the games and carries a financial penalty on the school equal to a fifth of its budget in every case.", ["The rule bans coaches from half of the games and carries a financial penalty on the school equal to a fifth of its budget in every case."]).runs.length).toBe(1);
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
