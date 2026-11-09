// @phli/ai-orchestrator — Legal AI orchestration domain types
// Responsibility: see docs/architecture/AI_RESEARCH_SPECIFICATION.md
//
// These interfaces describe the model-gateway contract and the structured
// research answer produced after retrieval, citation validation and temporal
// reasoning. Nothing here is bound to a provider; concrete providers implement
// `ModelProvider` behind a provider-neutral gateway.

/**
 * The kind of research the user is asking about. Drives retrieval breadth,
 * citation validation depth and the answer schema selected.
 */
export type ResearchIntent =
  | 'case_lookup'
  | 'statute_lookup'
  | 'doctrine'
  | 'procedure'
  | 'definition'
  | 'comparison'
  | 'drafting'
  | 'education'
  | 'general';

/** Confidence expressed by the orchestrator about a grounded answer. */
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'insufficient';

/** Which structured answer schema is being produced. */
export type AnswerFormat = 'legal_research' | 'educational' | 'professional';

/** A machine-verifiable citation backing a claim in the answer. */
export interface AnswerCitation {
  /** Canonical document the citation resolves to. */
  documentId: string;
  /** Canonical citation text, e.g. `G.R. No. 123456`. */
  citationText: string;
  /** Passage the citation supports. */
  passage?: string;
  /** Whether the citation survived citation validation. */
  verified: boolean;
  /** Validation layer results: identity, location, support, temporal. */
  validationLayers?: string[];
}

/**
 * A request routed through the model gateway. The orchestrator supplies
 * grounded context and an intent; the provider returns the generated answer.
 */
export interface GenerationRequest {
  /** User-facing prompt after retrieval-context injection. */
  prompt: string;
  /** Optional system instruction. */
  systemPrompt?: string;
  /** Intent the model should optimise for. */
  intent: ResearchIntent;
  /** Answer schema to target. */
  format: AnswerFormat;
  /** Grounded retrieved passages the model may cite. */
  context?: GenerationContextItem[];
  /** Override model sampling. */
  temperature?: number;
  /** Override token ceiling. */
  maxTokens?: number;
  /** `text` (default) or `json` to force structured output. */
  responseFormat?: 'text' | 'json';
  /** Correlation id shared with retrieval traces. */
  traceId?: string;
}

/** One grounded context item injected into a generation request. */
export interface GenerationContextItem {
  documentId: string;
  citationText?: string;
  passage: string;
  score?: number;
  verified?: boolean;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/** The result returned by a provider. */
export interface GenerationResult {
  /** The generated answer text. */
  text: string;
  /** Provider-qualified model identifier. */
  model: string;
  /** Provider name used for routing and cost accounting. */
  provider: string;
  /** Token accounting for the call. */
  usage: TokenUsage;
  /** Why generation stopped. */
  finishReason: 'stop' | 'length' | 'content_filter' | 'error';
  /** Generation latency in milliseconds. */
  latencyMs: number;
  /** Whether the model abstained from answering. */
  abstained?: boolean;
  /** Raw structured output when responseFormat is `json`. */
  structured?: Record<string, unknown>;
}

/** A streaming generation chunk emitted by a provider that supports it. */
export interface GenerationChunk {
  delta: string;
  finishReason?: 'stop' | 'length' | 'content_filter' | 'error';
}

/** Provider capabilities advertised by the gateway. */
export type ModelCapability =
  | 'chat'
  | 'completion'
  | 'streaming'
  | 'json_mode'
  | 'system_prompt'
  | 'function_calling'
  | 'embedding';

/** Result of a provider health probe. */
export interface ModelProviderHealth {
  available: boolean;
  latencyMs?: number;
  error?: string;
}

/**
 * Provider-neutral model gateway interface (dossier Rule 2). Concrete providers
 * register under their provider id and are routed by intent/capability, not by
 * provider-specific contract.
 */
export interface ModelProvider {
  id: string;
  displayName: string;
  /** Capabilities the provider advertises. */
  supports: ModelCapability[];
  /** Generate a single answer for a grounded request. */
  generate(request: GenerationRequest): Promise<GenerationResult>;
  /** Optional streaming generation. */
  generateStream?(
    request: GenerationRequest,
  ): AsyncIterable<GenerationChunk>;
  /** Optional provider health probe. */
  healthCheck?(): Promise<ModelProviderHealth>;
}

/**
 * Legal research structured answer. Grounded, cited and temporally anchored.
 */
export interface LegalResearchAnswer {
  /** Restated research question, disambiguated after classification. */
  question: string;
  /** Short direct answer, front-loaded. */
  shortAnswer: string;
  /** Governing holding or rule statement, where one exists. */
  holding?: string;
  /** Legal doctrines and principles invoked. */
  doctrine?: string[];
  /** Authorities applied, in citation order. */
  applicableLaw: LegalAuthorityRef[];
  /** Discussion linking facts to authorities. */
  discussion: string;
  /** Conclusion. */
  conclusion: string;
}

/** One legal authority used in an answer. */
export interface LegalAuthorityRef {
  documentId: string;
  citationText: string;
  title?: string;
  documentType?: string;
  issuingBody?: string;
  date?: string;
  verificationStatus?: string;
  relevance?: string;
}

/**
 * Educational structured answer (ALAC / IRAC).
 *
 * IRAC = Issue · Rule · Application · Conclusion.
 * ALAC = Answer · Law · Application · Conclusion.
 */
export type LegalFramework = 'IRAC' | 'ALAC';

export interface IracAnswer {
  issue: string;
  rule: string;
  application: string;
  conclusion: string;
}

export interface AlacAnswer {
  answer: string;
  law: string;
  application: string;
  conclusion: string;
}

export interface EducationalAnswer {
  framework: LegalFramework;
  /** IRAC payload when framework is `IRAC`. */
  irac?: IracAnswer;
  /** ALAC payload when framework is `ALAC`. */
  alac?: AlacAnswer;
  /** Teaching note explaining why this answer is one-sided or contested. */
  teachingNote?: string;
  /** Follow-up questions to deepen understanding. */
  followUpQuestions?: string[];
}

/**
 * Professional structured answer (formal legal memorandum style).
 */
export interface ProfessionalAnswer {
  /** Intended addressee, when known. */
  addressee?: string;
  subject: string;
  issueStatement: string;
  briefAnswer: string;
  factsAssumptions: string;
  analysis: string;
  recommendations: string[];
  riskFlags?: string[];
}

/**
 * Structured research answer returned by the orchestrator. Exactly one of the
 * format-specific payloads is populated, matching `format`.
 */
export interface ResearchAnswer {
  /** The query that produced this answer. */
  query: string;
  /** Detected intent. */
  intent: ResearchIntent;
  /** Answer schema in force. */
  format: AnswerFormat;
  /** Human-readable answer text. */
  answer: string;
  /** Citations backing the answer. */
  citations: AnswerCitation[];
  /** Orchestrator confidence, considering retrieval depth and citation verification. */
  confidence: ConfidenceLevel;
  /** True when the orchestrator abstained because evidence is insufficient. */
  abstained: boolean;
  /** Reasons the confidence is not high, e.g. conflicting authorities. */
  uncertaintyNotes?: string[];
  /** Point-in-time the answer is stated as of. */
  asOfDate?: string;
  /** Short chain-of-thought summary, not exposed to end users in production. */
  reasoning?: string;
  legalResearch?: LegalResearchAnswer;
  educational?: EducationalAnswer;
  professional?: ProfessionalAnswer;
}
