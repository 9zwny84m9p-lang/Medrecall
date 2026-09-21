import { activeConcepts } from "@/lib/domain/approval";
import type {
  Concept,
  GradeResult,
  PublicRetrievalItem,
  RetrievalContext,
} from "@/lib/domain/types";
import type { ConceptState } from "@/lib/domain/types";

import { buildTeachingChunks, type TeachingChunk } from "./chunks";
import {
  INTERLEAVE_AFTER_RETRIEVALS,
  selectInterleavedConcept,
  selectRetrievalItem,
} from "./selection";

/**
 * The teaching loop, as a pure state machine.
 *
 * teach a chunk → check retrieval on what was just taught → grade → update state
 * → reinforce or re-teach what was missed → occasionally pull a weak Concept
 * from an earlier lecture → next chunk.
 *
 * Nothing here touches storage, React or the network, which is what makes the
 * whole adaptive behaviour testable without a browser.
 */

export type SessionStep =
  | { kind: "teach"; chunk: TeachingChunk; conceptIds: string[] }
  | { kind: "reteach"; conceptId: string }
  | {
      kind: "retrieve";
      conceptId: string;
      itemId: string;
      context: RetrievalContext;
    }
  | { kind: "complete" };

type QueuedStep =
  | { kind: "teach"; chunkIndex: number }
  | { kind: "reteach"; conceptId: string }
  | { kind: "retrieve"; conceptId: string; itemId: string; context: RetrievalContext };

export interface SessionProgress {
  lectureId: string;
  /** Chunks already taught. */
  chunksTaught: number;
  queue: QueuedStep[];
  retrievalsSinceInterleave: number;
  /** Concepts pulled in from earlier lectures during this session. */
  interleaved: string[];
  /** Retrievals answered in this session, for the session summary. */
  answered: number;
  completed: boolean;
}

/** Everything the engine needs to run a lecture, assembled once per session. */
export interface LecturePlan {
  lectureId: string;
  chunks: TeachingChunk[];
  /** Approved Concepts of this lecture, by id. */
  concepts: Map<string, Concept>;
  /**
   * Retrieval items by concept id, in their answer-key-free form. The engine
   * only ever needs an item's id and kind, so the client can run the same
   * engine on the same data the server does.
   */
  items: Map<string, PublicRetrievalItem[]>;
  /** Approved Concepts from earlier lectures, available for interleaving. */
  priorConcepts: Concept[];
}

export function buildLecturePlan(input: {
  lectureId: string;
  lectureConcepts: readonly Concept[];
  priorConcepts: readonly Concept[];
  items: readonly PublicRetrievalItem[];
}): LecturePlan {
  const approved = activeConcepts(input.lectureConcepts).filter(
    (concept) => concept.lectureId === input.lectureId,
  );
  const approvedIds = new Set(approved.map((concept) => concept.id));
  const prior = activeConcepts(input.priorConcepts);
  const priorIds = new Set(prior.map((concept) => concept.id));

  const items = new Map<string, PublicRetrievalItem[]>();
  for (const item of input.items) {
    // Items belonging to unapproved Concepts are dropped with them.
    if (!approvedIds.has(item.conceptId) && !priorIds.has(item.conceptId)) continue;
    const bucket = items.get(item.conceptId) ?? [];
    bucket.push(item);
    items.set(item.conceptId, bucket);
  }

  return {
    lectureId: input.lectureId,
    chunks: buildTeachingChunks(input.lectureId, approved),
    concepts: new Map([...approved, ...prior].map((concept) => [concept.id, concept])),
    items,
    priorConcepts: prior,
  };
}

export function startSession(plan: LecturePlan): SessionProgress {
  const progress: SessionProgress = {
    lectureId: plan.lectureId,
    chunksTaught: 0,
    queue: [],
    retrievalsSinceInterleave: 0,
    interleaved: [],
    answered: 0,
    completed: false,
  };

  return refill(progress, plan, new Map(), new Date());
}

/** The step the student is currently on. Pure read — safe to call on any render. */
export function currentStep(progress: SessionProgress, plan: LecturePlan): SessionStep {
  const head = progress.queue[0];
  if (!head) return { kind: "complete" };

  if (head.kind === "teach") {
    const chunk = plan.chunks[head.chunkIndex];
    if (!chunk) return { kind: "complete" };
    return { kind: "teach", chunk, conceptIds: chunk.conceptIds };
  }

  return head;
}

/**
 * Queue what follows a graded answer.
 *
 * `continue` moves on. Otherwise the Concept is asked again, in a different
 * format — but not straight away: the retry goes to the back of the current
 * checkpoint, so the student has to hold the answer for a few questions instead
 * of echoing it back.
 *
 * Re-teaching is the opposite. An explanation lands while the gap is still
 * fresh, so `reteach` goes to the front and is shown immediately.
 */
function followUp(
  conceptId: string,
  result: GradeResult,
  plan: LecturePlan,
  states: ReadonlyMap<string, ConceptState>,
): { immediate: QueuedStep[]; deferred: QueuedStep[] } {
  const nothing = { immediate: [], deferred: [] };
  if (result.nextAction === "continue") return nothing;

  const immediate: QueuedStep[] =
    result.nextAction === "reteach" ? [{ kind: "reteach", conceptId }] : [];

  const item = selectRetrievalItem(
    plan.items.get(conceptId) ?? [],
    states.get(conceptId),
    "reinforce",
  );
  if (!item) return { immediate, deferred: [] };

  return {
    immediate,
    deferred: [{ kind: "retrieve", conceptId, itemId: item.id, context: "reinforce" }],
  };
}

/**
 * Keep the queue non-empty.
 *
 * When a checkpoint drains, the engine decides between pulling an earlier
 * Concept in and moving on to the next chunk, and marks the session complete
 * when neither is available.
 */
function refill(
  progress: SessionProgress,
  plan: LecturePlan,
  states: ReadonlyMap<string, ConceptState>,
  now: Date,
): SessionProgress {
  if (progress.queue.length > 0) return progress;

  if (progress.retrievalsSinceInterleave >= INTERLEAVE_AFTER_RETRIEVALS) {
    const concept = selectInterleavedConcept(plan.priorConcepts, states, now, {
      currentLectureId: plan.lectureId,
      exclude: progress.interleaved,
    });

    if (concept) {
      const item = selectRetrievalItem(
        plan.items.get(concept.id) ?? [],
        states.get(concept.id),
        "interleaved",
      );

      if (item) {
        return {
          ...progress,
          queue: [
            { kind: "retrieve", conceptId: concept.id, itemId: item.id, context: "interleaved" },
          ],
          retrievalsSinceInterleave: 0,
          interleaved: [...progress.interleaved, concept.id],
        };
      }
    }
  }

  if (progress.chunksTaught < plan.chunks.length) {
    return { ...progress, queue: [{ kind: "teach", chunkIndex: progress.chunksTaught }] };
  }

  return { ...progress, completed: true };
}

/** Move past a teaching step, queueing the checkpoint for what was just taught. */
export function completeTeaching(
  progress: SessionProgress,
  plan: LecturePlan,
  states: ReadonlyMap<string, ConceptState>,
  now: Date = new Date(),
): SessionProgress {
  const head = progress.queue[0];
  if (head?.kind !== "teach") return progress;

  const chunk = plan.chunks[head.chunkIndex];
  const checkpoint: QueuedStep[] = [];

  for (const conceptId of chunk?.conceptIds ?? []) {
    const item = selectRetrievalItem(
      plan.items.get(conceptId) ?? [],
      states.get(conceptId),
      "checkpoint",
    );
    if (item) {
      checkpoint.push({ kind: "retrieve", conceptId, itemId: item.id, context: "checkpoint" });
    }
  }

  const next: SessionProgress = {
    ...progress,
    chunksTaught: progress.chunksTaught + 1,
    queue: [...progress.queue.slice(1), ...checkpoint],
  };

  return refill(next, plan, states, now);
}

/** Move past a re-teaching step; the retry behind it is already queued. */
export function completeReteaching(
  progress: SessionProgress,
  plan: LecturePlan,
  states: ReadonlyMap<string, ConceptState>,
  now: Date = new Date(),
): SessionProgress {
  const head = progress.queue[0];
  if (head?.kind !== "reteach") return progress;

  return refill({ ...progress, queue: progress.queue.slice(1) }, plan, states, now);
}

/**
 * Record a graded answer and move the session on.
 *
 * `states` must already reflect this answer, so the follow-up question and any
 * interleaving decision are made against the student's updated memory.
 */
export function completeRetrieval(
  progress: SessionProgress,
  plan: LecturePlan,
  states: ReadonlyMap<string, ConceptState>,
  result: GradeResult,
  now: Date = new Date(),
): SessionProgress {
  const head = progress.queue[0];
  if (head?.kind !== "retrieve") return progress;

  const { immediate, deferred } = followUp(head.conceptId, result, plan, states);

  const next: SessionProgress = {
    ...progress,
    answered: progress.answered + 1,
    retrievalsSinceInterleave: progress.retrievalsSinceInterleave + 1,
    queue: [...immediate, ...progress.queue.slice(1), ...deferred],
  };

  return refill(next, plan, states, now);
}
