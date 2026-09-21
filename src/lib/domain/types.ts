/**
 * MedRecall's domain model.
 *
 * The central entity is the **Concept** — a single idea a student must
 * understand, traceable back to the page it came from. A Concept is taught, then
 * retrieved in one of several formats, and carries its own memory state.
 *
 * A flashcard is not a domain entity here. `RetrievalItem` is one *way to test*
 * a Concept, and a Concept owns several of them. See ARCHITECTURE.md.
 */

// ---------------------------------------------------------------------------
// Curriculum structure
// ---------------------------------------------------------------------------

export interface Course {
  id: string;
  title: string;
  subject: string;
  /** Lecture ids in the order they are meant to be worked through. */
  lectureIds: string[];
}

export interface Lecture {
  id: string;
  courseId: string;
  title: string;
  /** 1-based position within the course; drives unlock order. */
  order: number;
  documentId: string;
}

/** An uploaded (or, for the demo course, synthesised) source document. */
export interface SourceDocument {
  id: string;
  lectureId: string;
  title: string;
  kind: "pdf" | "slides" | "notes";
  pages: SourcePage[];
}

export interface SourcePage {
  /** 1-based page number as it appears in the document. */
  pageNumber: number;
  text: string;
}

/** Where a Concept came from — every Concept must be able to answer this. */
export interface SourceRef {
  courseId: string;
  lectureId: string;
  documentId: string;
  pageNumber: number;
  /** Verbatim excerpt from that page, shown behind "View source". */
  excerpt: string;
}

// ---------------------------------------------------------------------------
// Concepts
// ---------------------------------------------------------------------------

/**
 * Review status of a Concept.
 *
 * AI-extracted Concepts arrive as `draft` and stay inert until a human approves
 * them. Only `approved` Concepts may be taught, retrieved, scheduled or counted
 * towards mastery — enforced in `approval.ts`, not in the UI.
 */
export const CONCEPT_STATUSES = ["draft", "approved", "discarded"] as const;
export type ConceptStatus = (typeof CONCEPT_STATUSES)[number];

export interface Concept {
  id: string;
  courseId: string;
  lectureId: string;
  /** Short name, e.g. "Na+/K+ ATPase failure". */
  title: string;
  /** One or two sentences: the idea itself, used when teaching. */
  summary: string;
  /** The fuller teaching explanation shown in teaching mode. */
  explanation: string;
  status: ConceptStatus;
  source: SourceRef;
  /** Concepts that should ideally be understood first. */
  prerequisiteIds: string[];
  /** Position within the lecture, used to order teaching. */
  order: number;
}

// ---------------------------------------------------------------------------
// Retrieval
// ---------------------------------------------------------------------------

/**
 * How a Concept is being tested.
 *
 * Multiple choice is deliberately absent: MedRecall prioritises active recall,
 * and recognising an answer is not recalling it. If it is added later it should
 * be a fallback, never the default.
 */
export const RETRIEVAL_KINDS = ["basic", "cloze", "mechanism", "free_recall"] as const;
export type RetrievalKind = (typeof RETRIEVAL_KINDS)[number];

/** A key point an answer is expected to contain. */
export interface ExpectedPoint {
  id: string;
  /** Human-readable description, surfaced as a missing point in feedback. */
  label: string;
  /**
   * Synonym groups. A point matches when any one of these alternatives appears
   * in the answer, so "sodium pump" and "Na+/K+ ATPase" both count.
   */
  alternatives: string[];
}

export interface RetrievalItem {
  id: string;
  conceptId: string;
  kind: RetrievalKind;
  /** The question put to the student. */
  prompt: string;
  /** Points a full answer must cover. Never sent to the browser. */
  expectedPoints: ExpectedPoint[];
  /** A model answer, shown after grading. Never sent to the browser. */
  modelAnswer: string;
}

/**
 * A retrieval item as the browser sees it: the question without the answer key.
 *
 * Grading happens on the server precisely so `expectedPoints` and `modelAnswer`
 * never ship to the client, where a student could read them out of the bundle.
 */
export type PublicRetrievalItem = Omit<RetrievalItem, "expectedPoints" | "modelAnswer">;

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

export const ANSWER_QUALITIES = ["exact", "partial", "incorrect"] as const;
export type AnswerQuality = (typeof ANSWER_QUALITIES)[number];

export const NEXT_ACTIONS = ["continue", "reinforce", "reteach"] as const;
export type NextAction = (typeof NEXT_ACTIONS)[number];

export interface GradeResult {
  correct: boolean;
  quality: AnswerQuality;
  /** Labels of expected points the answer missed. */
  missingPoints: string[];
  feedback: string;
  nextAction: NextAction;
  /** The model answer, released only once the student has answered. */
  modelAnswer?: string;
}

// ---------------------------------------------------------------------------
// Learner state
// ---------------------------------------------------------------------------

/**
 * How well a Concept is known.
 *
 * Deliberately five named states rather than a percentage: MedRecall has no
 * defensible model for "73% mastered", and a made-up number invites a student to
 * trust it. See ARCHITECTURE.md.
 */
export const MASTERY_STATES = ["new", "learning", "weak", "stable", "strong"] as const;
export type MasteryState = (typeof MASTERY_STATES)[number];

/** Why a Concept is being retrieved right now — this changes how a result counts. */
export const RETRIEVAL_CONTEXTS = [
  /** First test after being taught, in the same session. */
  "checkpoint",
  /** Immediate re-ask after a wrong answer, still in the same session. */
  "reinforce",
  /** Pulled in from an earlier lecture while learning a later one. */
  "interleaved",
  /** A scheduled review from the Today queue. */
  "review",
] as const;
export type RetrievalContext = (typeof RETRIEVAL_CONTEXTS)[number];

/** FSRS memory state, stored in a plain serialisable shape. */
export interface MemoryCard {
  due: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview?: string;
}

/** Everything MedRecall knows about one student and one Concept. */
export interface ConceptState {
  conceptId: string;
  lectureId: string;
  courseId: string;
  mastery: MasteryState;
  card: MemoryCard;
  /** Total retrievals attempted, including in-session reinforcement. */
  attempts: number;
  /** Times the Concept has been answered incorrectly. */
  lapses: number;
  lastQuality: AnswerQuality | null;
  lastReviewedAt: string | null;
  /** When the Concept most recently became weak; cleared on a spaced success. */
  weakSince: string | null;
}

export interface ReviewLogEntry {
  id: string;
  conceptId: string;
  itemId: string;
  context: RetrievalContext;
  quality: AnswerQuality;
  reviewedAt: string;
}
