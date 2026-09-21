import { z } from "zod";

import type { ConceptState, ReviewLogEntry } from "@/lib/domain/types";
import type { SessionProgress } from "@/lib/engine/session";

/**
 * Where a learner's state lives.
 *
 * Milestone 1 keeps it in IndexedDB in the browser. The interface exists so
 * Milestone 2 can put it in Postgres behind the same calls; nothing above this
 * layer knows which it is talking to.
 */

export interface LearnerSnapshot {
  conceptStates: Record<string, ConceptState>;
  sessions: Record<string, SessionProgress>;
  reviewLog: ReviewLogEntry[];
}

export const EMPTY_SNAPSHOT: LearnerSnapshot = {
  conceptStates: {},
  sessions: {},
  reviewLog: [],
};

export interface LearnerRepository {
  load(): Promise<LearnerSnapshot>;
  saveConceptState(state: ConceptState): Promise<void>;
  saveSession(progress: SessionProgress): Promise<void>;
  appendReview(entry: ReviewLogEntry): Promise<void>;
  clear(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const memoryCardSchema = z.object({
  due: z.string(),
  stability: z.number(),
  difficulty: z.number(),
  elapsedDays: z.number(),
  scheduledDays: z.number(),
  learningSteps: z.number(),
  reps: z.number(),
  lapses: z.number(),
  state: z.number(),
  lastReview: z.string().optional(),
});

export const conceptStateSchema = z.object({
  conceptId: z.string(),
  lectureId: z.string(),
  courseId: z.string(),
  mastery: z.enum(["new", "learning", "weak", "stable", "strong"]),
  card: memoryCardSchema,
  attempts: z.number(),
  lapses: z.number(),
  lastQuality: z.enum(["exact", "partial", "incorrect"]).nullable(),
  lastReviewedAt: z.string().nullable(),
  weakSince: z.string().nullable(),
});

const queuedStepSchema = z.union([
  z.object({ kind: z.literal("teach"), chunkIndex: z.number() }),
  z.object({ kind: z.literal("reteach"), conceptId: z.string() }),
  z.object({
    kind: z.literal("retrieve"),
    conceptId: z.string(),
    itemId: z.string(),
    context: z.enum(["checkpoint", "reinforce", "interleaved", "review"]),
  }),
]);

export const sessionProgressSchema = z.object({
  lectureId: z.string(),
  chunksTaught: z.number(),
  queue: z.array(queuedStepSchema),
  retrievalsSinceInterleave: z.number(),
  interleaved: z.array(z.string()),
  answered: z.number(),
  completed: z.boolean(),
});

export const reviewLogEntrySchema = z.object({
  id: z.string(),
  conceptId: z.string(),
  itemId: z.string(),
  context: z.enum(["checkpoint", "reinforce", "interleaved", "review"]),
  quality: z.enum(["exact", "partial", "incorrect"]),
  reviewedAt: z.string(),
});

/**
 * Drop records that no longer parse instead of failing the whole load.
 *
 * A schema change or a half-written record should cost a student one Concept's
 * history, not their entire course progress.
 */
export function parseSnapshot(raw: {
  conceptStates: unknown[];
  sessions: unknown[];
  reviewLog: unknown[];
}): LearnerSnapshot {
  const conceptStates: Record<string, ConceptState> = {};
  for (const candidate of raw.conceptStates) {
    const parsed = conceptStateSchema.safeParse(candidate);
    if (parsed.success) conceptStates[parsed.data.conceptId] = parsed.data;
  }

  const sessions: Record<string, SessionProgress> = {};
  for (const candidate of raw.sessions) {
    const parsed = sessionProgressSchema.safeParse(candidate);
    if (parsed.success) sessions[parsed.data.lectureId] = parsed.data;
  }

  const reviewLog: ReviewLogEntry[] = [];
  for (const candidate of raw.reviewLog) {
    const parsed = reviewLogEntrySchema.safeParse(candidate);
    if (parsed.success) reviewLog.push(parsed.data);
  }

  return { conceptStates, sessions, reviewLog };
}

/** In-memory repository, used by tests and as a fallback when IndexedDB is blocked. */
export class MemoryRepository implements LearnerRepository {
  #snapshot: LearnerSnapshot = { ...EMPTY_SNAPSHOT };

  constructor(initial?: Partial<LearnerSnapshot>) {
    this.#snapshot = {
      conceptStates: { ...(initial?.conceptStates ?? {}) },
      sessions: { ...(initial?.sessions ?? {}) },
      reviewLog: [...(initial?.reviewLog ?? [])],
    };
  }

  async load(): Promise<LearnerSnapshot> {
    return {
      conceptStates: { ...this.#snapshot.conceptStates },
      sessions: { ...this.#snapshot.sessions },
      reviewLog: [...this.#snapshot.reviewLog],
    };
  }

  async saveConceptState(state: ConceptState): Promise<void> {
    this.#snapshot.conceptStates[state.conceptId] = state;
  }

  async saveSession(progress: SessionProgress): Promise<void> {
    this.#snapshot.sessions[progress.lectureId] = progress;
  }

  async appendReview(entry: ReviewLogEntry): Promise<void> {
    this.#snapshot.reviewLog.push(entry);
  }

  async clear(): Promise<void> {
    this.#snapshot = { conceptStates: {}, sessions: {}, reviewLog: [] };
  }
}
