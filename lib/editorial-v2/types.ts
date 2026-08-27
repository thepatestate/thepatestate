// Editorial Engine V2 — the typed artifacts that pass between stages
// (brief §5–§19). Every stage returns one of these; nothing else crosses a
// stage boundary, and none of them carries model reasoning.

export type Lane = "show" | "standalone" | "wire";
export type Product = "josh-column" | "staff-reaction" | "wire-story";

// ---------------------------------------------------------------- fixtures
export interface KnownOutput {
  label: string;
  system: string; // "v1" | "v1-lab" | "v1-pipeline" | "v2"
  headline: string;
  dek: string;
  bodyMarkdown: string;
  pullQuote: string;
  legacyFan?: { score: number; legibility: number; enjoyment: number; joshVoice: number; notes: string };
  legacyVoice?: { score: number; notes: string };
}

export interface FactTrap {
  kind: "unsupported-stat" | "outdated-date" | "asr-misspelling" | "unstated-josh-inference";
  text: string;
  mustNotAppearAsFact: boolean;
}

export interface ShowFixture {
  id: string;
  lane: "show";
  shape: "argument" | "list";
  note: string;
  frozenAt: string;
  episode: { ytId: string; title: string; description: string; publishedAt: string; series: string };
  transcriptText: string;
  quotes: { quote: string; timestamp: string; topic: string; teams: string[]; heat: number }[];
  teams: string[];
  factSheet: string;
  onRecord: string;
  knownOutputs: KnownOutput[];
  traps: FactTrap[];
}

// ------------------------------------------------------------ stage 1: dossier
export interface EditorialDossier {
  subject: string;
  teams: string[];
  eventDate?: string;
  coreDevelopment: string;
  confirmedFacts: { fact: string; sourceRef: string; confidence: "confirmed" | "reported" }[];
  uncertainOrMissing: { item: string; whyItMatters: string }[];
  numbers: { value: string; meaning: string; sourceRef: string }[];
  quotes: { text: string; speaker: string; timestamp?: string; sourceRef: string; role: "claim" | "evidence" | "tone" | "concession" | "context" }[];
  joshOnRecord: { text: string; date?: string; timestamp?: string; topic: string }[];
  footballMechanisms: { mechanism: string; evidence: string[]; certainty: "fact" | "reasonable-analysis" | "speculative" }[];
  tensions: string[];
  contradictions: string[];
  fanObjections: string[];
  secondOrderConsequences: string[];
  observableTests: { date?: string; opponent?: string; thingToWatch: string }[];
  thingsActuallyInteresting: string[];
  sourceSufficiency: { score: number; canSupportBrief: boolean; canSupportReaction: boolean; canSupportPremiumColumn: boolean; reason: string };
}

// -------------------------------------------------------- stage 2: story miner
export interface StoryAngle {
  id: string;
  thesis: string;
  readerPromise: string;
  whyNow: string;
  evidenceAvailable: string[];
  missingEvidence: string[];
  fanTension: string;
  likelyObjection: string;
  answerToObjection: string;
  saturdayPayoff: string;
  novelty: number;
  stakes: number;
  evidenceStrength: number;
  fanArgument: number;
  pateRelevance: number;
  specificity: number;
  curiosity: number;
  risk: string;
}

export interface StoryMinerResult {
  angles: StoryAngle[];
  sourceShape: "one-argument" | "list" | "weak";
  premiumWarranted: boolean;
  note: string;
}

// ------------------------------------------------------ stages 3–4: tournament
export interface AngleScore {
  angleId: string;
  novelty: number;
  stakes: number;
  evidence: number;
  fanTension: number;
  specificity: number;
  brandFit: number;
  curiosity: number;
  valueAdded: number;
  fatalProblem?: string;
  strongestReasonToRun: string;
  strongestReasonNotToRun: string;
}

export interface AngleJudgement { judge: string; scores: AngleScore[] }

export interface AngleDecision {
  decision: "select" | "remine" | "kill";
  selectedAngleId?: string;
  finalThesis?: string;
  reason: string;
  requiredEvidence: string[];
  mustAvoid: string[];
}

// -------------------------------------------------------- stages 5–6: blueprint
export type BeatJob = "hook" | "claim" | "evidence" | "football" | "fan-objection" | "counter" | "turn" | "consequence" | "watch" | "close";
export type ReaderReaction = "didnt-know" | "hadnt-thought" | "want-to-watch" | "argument" | "emotion" | "none";

export interface StoryBeat {
  id: string;
  job: BeatJob;
  point: string;
  sourceRefs: string[];
  joshRefs: string[];
  newInformation: string;
  readerReactionTarget: ReaderReaction;
  mandatory: boolean;
}

export interface StoryBlueprint {
  thesis: string;
  targetLength: { minGuidance: number; ideal: number; maxGuidance: number };
  beats: StoryBeat[];
  openingStrategy: string;
  centralDistinction: string;
  strongestProof: string;
  fanObjection: string;
  honestConcession: string;
  saturdayTest: string;
  endingJob: string;
  cutIfThin: string[];
}

export type BlueprintVerdict = "pass" | "revise-blueprint" | "return-to-angle" | "return-to-reporting" | "kill";

export interface BlueprintReview {
  verdict: BlueprintVerdict;
  problems: string[];
  cutBeats: string[];
  revisedBlueprint?: StoryBlueprint;
  reason: string;
}

// ------------------------------------------------------- stage 7: voice
export type FragmentFunction = "open" | "claim" | "fan-objection" | "concession" | "football-explanation" | "distinction" | "humor" | "transition" | "flag-plant" | "close";

export interface VoiceFragment {
  id: string;
  sourceType: "josh-edited-article" | "josh-transcript" | "approved-article";
  sourceId: string;
  exactText: string;
  function: FragmentFunction;
  teams: string[];
  topics: string[];
  tone: string[];
  approved: boolean;
}

// ------------------------------------------------------- stage 8: drafts
export interface ArticleDraft {
  headline: string;
  dek: string;
  bodyMarkdown: string;
  pullQuote: string;
  primaryTeam: string;
  teams: string[];
  tags: string[];
  seo: { title: string; description: string };
}

export interface WriterOutput { writer: "A" | "B"; model: string; draft: ArticleDraft }

// ------------------------------------------------------- stage 9: selector
export interface DraftSelection {
  winner: "A" | "B" | "hybrid" | "neither";
  opening: { winner: "A" | "B" | "neither"; reason: string };
  argument: { winner: "A" | "B" | "neither"; reason: string };
  football: { winner: "A" | "B" | "neither"; reason: string };
  audienceConnection: { winner: "A" | "B" | "neither"; reason: string };
  bestParagraphs: { draft: "A" | "B"; paragraphIndex: number; reason: string }[];
  cut: { draft: "A" | "B"; paragraphIndex: number; reason: string }[];
  structuralProblems: string[];
  voiceProblems: string[];
  generatedTells: string[];
  developmentalPlan: string[];
  route: "developmental-rewrite" | "back-to-blueprint" | "back-to-angle";
}

// ------------------------------------------------------ stage 11: audience edit
export interface AudienceEdit {
  verdict: "pass-with-micro-edits" | "revised";
  findings: string[];
  draft: ArticleDraft;
}

// ------------------------------------------------------ stage 12: fact check
export interface FactCheckResult {
  verdict: "pass" | "unsupported" | "contradicted";
  claims: { claim: string; status: "supported" | "unsupported" | "contradicted" | "analysis"; sourceRefs: string[] }[];
  joshMisattribution: string[];
}

// ------------------------------------------------------ stage 13: policy
export interface PolicyResult { pass: boolean; violations: string[] }

// ------------------------------------------------------ diagnostics
export interface StyleDiagnostics {
  words: number;
  restatementPct: number;
  restatements: string[];
  abstractParagraphs: number;
  isolatedOneLiners: number;
  questionMarks: number;
  styleFlags: string[];
  paragraphLengths: number[];
}

// ------------------------------------------------------ stage 14: judges
export interface FanJudgement {
  judge: string;
  interested: string;
  bored: string;
  learned: string;
  arguedWith: string;
  wouldText: string;
  obvious: string;
  machine: string;
  finished: boolean;
  wouldSend: boolean;
  legibility: number;
  enjoyment: number;
  valueAdded: number;
  fanConnection: number;
  sendability: number;
  joshVoice?: number;
  overall: number;
}

export interface HumanityJudgement {
  judge: string;
  humanity: number;
  tells: string[];
  strongestHumanPassage: string;
  notes: string;
}

export interface FinalEvaluation {
  fanA: FanJudgement;
  fanB: FanJudgement;
  humanity: HumanityJudgement;
  voice: { score: number; notes: string; pass: boolean };
  legacyFan?: { score: number; legibility: number; enjoyment: number; joshVoice: number; notes: string };
  /** V1's exemplar-similarity voice judge, kept for continuity only. */
  legacyVoice?: { score: number; notes: string };
  thresholds: { fanMean: number; legibilityMin: number; sendabilityMean: number; voice: number; humanity: number };
  meets: { fanMean: boolean; legibilityMin: boolean; sendabilityMean: boolean; voice: boolean; humanity: boolean; all: boolean };
}

// ------------------------------------------------------ stage 15: router
export type FailureClass = "none" | "evidence" | "angle" | "structure" | "prose" | "voice" | "audience" | "fact" | "policy";
export type RouteTarget = "reporting" | "story-miner" | "blueprint" | "developmental-rewrite" | "voice-edit" | "fact-repair" | "human";

export interface EditorialDecision {
  decision: "accept" | "revise" | "hold" | "kill";
  failureClass: FailureClass;
  reason: string;
  routeTo: RouteTarget;
  instructions: string[];
}

// ------------------------------------------------------ run record
export interface StageCall {
  stage: string;
  role: string;
  vendor: "openai" | "anthropic";
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  ms: number;
}

export interface EditorialRun {
  id: string;
  lane: Lane;
  product: Product;
  sourceId: string;
  fixture?: string;
  mode: "shadow" | "replay" | "live";
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  cycles: number;
  decision?: EditorialDecision;
  finalScore?: number;
  final?: ArticleDraft;
  artifacts: {
    dossier?: EditorialDossier;
    miner?: StoryMinerResult;
    angleJudgements?: AngleJudgement[];
    angleDecision?: AngleDecision;
    blueprint?: StoryBlueprint;
    blueprintReview?: BlueprintReview;
    voiceFragmentIds?: string[];
    writerPrompts?: { A: string; B: string };
    drafts?: WriterOutput[];
    selection?: DraftSelection;
    rewrite?: ArticleDraft;
    audienceEdit?: AudienceEdit;
    factCheck?: FactCheckResult;
    factRepair?: { removed: string[]; draft: ArticleDraft };
    policy?: PolicyResult;
    diagnostics?: StyleDiagnostics;
    evaluation?: FinalEvaluation;
    history?: { cycle: number; decision: EditorialDecision }[];
  };
  calls: StageCall[];
  totalCostUsd: number;
  error?: string;
}

// ------------------------------------------------------ §23 (reserved)
export interface EditorialEdit {
  type: "cut-repetition" | "stronger-thesis" | "specific-proof" | "fan-objection" | "remove-meta" | "remove-performance" | "reorder" | "better-transition" | "human-accountability" | "football-specificity" | "other";
  before: string;
  after: string;
  inferredReason: string;
  reusableLesson: string;
  confidence: number;
}
