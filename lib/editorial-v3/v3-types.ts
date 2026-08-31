// Editorial Engine V3 — artifacts (brief §4–§16). Small on purpose.
import type { ArticleDraft, FactCheckResult, PolicyResult, StageCall } from "./types";
export type { ArticleDraft, FactCheckResult, PolicyResult, StageCall };

// ---------------------------------------------------------------- Engine A
export interface SegmentDecision {
  decision: "segment" | "no-article";
  segmentStart?: string;
  segmentEnd?: string;
  centralThought?: string;
  reason: string;
}

export interface JoshCut {
  segmentStart: string;
  segmentEnd: string;
  centralThought: string;
  blocks: { text: string; sourceStart: string; sourceEnd: string }[];
  removedBecauseRepetitive: string[];
  removedBecauseOffTopic: string[];
}

export interface SupportFact {
  fact: string;
  sourceRef: string;
  insertAfterBlock?: number;
  whyUseful: string;
}

// ---------------------------------------------------------------- Engine B
export interface ReportingPack {
  development: string;
  facts: { fact: string; sourceRef: string; status: "confirmed" | "reported" }[];
  quotes: { speaker: string; text: string; sourceRef: string }[];
  numbers: { value: string; meaning: string; sourceRef: string }[];
  unknowns: string[];
  relevantTeamContext: string[];
}

export type Depth = "item" | "brief" | "story" | "analysis";

export interface FanBrief {
  theNews: string;
  whyAFanCares: string;
  /** One plain sentence a fan could repeat: what this changes, threatens or
   * sets up (Isaac, 2026-08-31: "articles need to state WHY they exist"). */
  stakes: string;
  /** One sentence only when the site's on-record positions bear on the news
   * (Josh's bracket, poll or picks, from the supplied ledger); else absent. */
  joshAngle?: string;
  interestingDetail?: string;
  footballAngle?: string;
  importantUnknown?: string;
  depth: Depth;
  depthReason: string;
  /** Would a national college-football desk run this at all? (2026-08-28;
   * enforced only with EDITORIAL_V3_DESK_GATE=true, otherwise logged.) */
  nationalDeskWouldRun?: boolean;
  deskReason?: string;
}

export const DEPTH_WORDS: Record<Depth, { min: number; max: number }> = {
  // Ranges raised ~50% on 2026-08-31 (Isaac: "without fluff can you beef it
  // up by another 50%") — the writer's anti-padding rules are unchanged, so
  // the added words must come from the pack: comparisons, memory, context.
  item: { min: 110, max: 300 },
  brief: { min: 300, max: 650 },
  story: { min: 600, max: 1100 },
  analysis: { min: 900, max: 1800 },
};

// ---------------------------------------------------------------- Judges
export type QuitReason = "repetitive" | "obvious" | "overexplained" | "generic" | "AI-sounding" | "abstract" | "irrelevant" | "too slow" | "confusing" | "no new information" | "none";

export interface QuitReading {
  neverWantedToQuit: boolean;
  quitParagraphIndex?: number;
  quitText?: string;
  reason: QuitReason;
  didFinish: boolean;
  soundsLikeFootballPerson: boolean;
  worthTheTime: boolean;
  wouldClickAnother: boolean;
  wouldSend: boolean;
  note: string;
}

export interface AiSmell {
  pass: boolean;
  sentences: string[];
  structural: boolean;
  note: string;
}

// ---------------------------------------------------------------- Run
export interface V3Run {
  id: string;
  engine: "josh" | "reported";
  sourceId: string;
  fixture?: string;
  mode: "shadow" | "replay" | "live";
  status: "completed" | "failed" | "no-article";
  startedAt: string;
  completedAt?: string;
  artifacts: {
    segment?: SegmentDecision;
    cut?: JoshCut;
    support?: SupportFact[];
    pack?: ReportingPack;
    brief?: FanBrief;
    draft?: ArticleDraft;
    tightened?: ArticleDraft;
    subtracted?: ArticleDraft;
    quit?: QuitReading;
    quitAfterRepair?: QuitReading;
    smell?: AiSmell;
    fact?: FactCheckResult;
    policy?: PolicyResult;
    repairs?: string[];
    /** Additive Josh's Read (2026-08-28). */
    additions?: { addition: string; kind: string; sourceRef: string; changesWhat: string; newVsShow: boolean }[];
    additive?: { additions: string[]; worthItForListener: boolean; replayPassage: string; note: string; overlapPct: number };
    lift?: { pct: number; longestRun: number; pass: boolean; reason: string };
  };
  final?: ArticleDraft;
  words?: number;
  calls: StageCall[];
  totalCostUsd: number;
  error?: string;
}
