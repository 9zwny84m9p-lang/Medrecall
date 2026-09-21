import type {
  Concept,
  GradeResult,
  RetrievalItem,
  SourcePage,
  SourceRef,
} from "@/lib/domain/types";

/**
 * The seam between MedRecall's domain and whichever model is behind it.
 *
 * Nothing in `domain/` or `engine/` imports a vendor SDK. Providers are resolved
 * on the server only (`server.ts`), so API keys never reach frontend code.
 */

export interface ExtractConceptsInput {
  courseId: string;
  lectureId: string;
  documentId: string;
  pages: SourcePage[];
}

/**
 * A Concept proposal.
 *
 * It has no id and no status because it is not curriculum yet — it becomes a
 * `draft` Concept, and only a human decision makes it `approved`.
 */
export interface DraftConcept {
  title: string;
  summary: string;
  explanation: string;
  source: SourceRef;
  prerequisiteTitles: string[];
}

export interface TeachingInput {
  concept: Concept;
  /** Concepts already covered, so an explanation can build on them. */
  priorConceptTitles: string[];
}

export interface RetrievalItemsInput {
  concept: Concept;
  kinds: RetrievalItem["kind"][];
}

export interface GradeInput {
  item: RetrievalItem;
  answer: string;
}

export interface RemediationInput {
  concept: Concept;
  answer: string;
  result: GradeResult;
}

export interface AIProvider {
  readonly name: string;
  /** PDF pages in, Concept proposals out. Always lands as drafts. */
  extractConcepts(input: ExtractConceptsInput): Promise<DraftConcept[]>;
  generateTeachingExplanation(input: TeachingInput): Promise<string>;
  generateRetrievalItems(input: RetrievalItemsInput): Promise<RetrievalItem[]>;
  gradeFreeAnswer(input: GradeInput): Promise<GradeResult>;
  /** A second, different explanation for a Concept the student got wrong. */
  generateRemediation(input: RemediationInput): Promise<string>;
}

/**
 * Raised by a provider for capabilities that are wired but not yet implemented,
 * so a caller gets a clear message instead of a silent empty result.
 */
export class ProviderCapabilityError extends Error {
  constructor(provider: string, capability: string, detail: string) {
    super(`${provider} cannot ${capability} yet: ${detail}`);
    this.name = "ProviderCapabilityError";
  }
}
