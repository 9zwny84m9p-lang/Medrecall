import { applyResult } from "@/lib/domain/mastery";
import type {
  Concept,
  ConceptState,
  GradeResult,
  RetrievalContext,
  ReviewLogEntry,
} from "@/lib/domain/types";
import { assertApproved } from "@/lib/domain/approval";

import { initialConceptState, scheduleNext } from "./scheduler";

/**
 * Where a graded answer becomes learner state.
 *
 * The order matters: FSRS advances the memory card, then the mastery rules read
 * that card together with the retrieval context to decide what the student is
 * told. Scheduling and mastery stay separate — see ARCHITECTURE.md.
 */

export interface RecordedAnswer {
  state: ConceptState;
  logEntry: ReviewLogEntry;
}

export function recordAnswer(input: {
  concept: Concept;
  previous: ConceptState | undefined;
  itemId: string;
  result: GradeResult;
  context: RetrievalContext;
  now?: Date;
}): RecordedAnswer {
  // An unapproved Concept must never acquire memory state.
  const concept = assertApproved(input.concept);
  const now = input.now ?? new Date();

  const previous = input.previous ?? initialConceptState(concept, now);
  const card = scheduleNext(previous.card, input.result.quality, now);
  const state = applyResult(previous, card, input.result.quality, input.context, now);

  return {
    state,
    logEntry: {
      id: `${concept.id}:${now.toISOString()}:${previous.attempts}`,
      conceptId: concept.id,
      itemId: input.itemId,
      context: input.context,
      quality: input.result.quality,
      reviewedAt: now.toISOString(),
    },
  };
}

/** Ensure a Concept has state, so a never-seen Concept can still be scheduled. */
export function ensureState(
  concept: Concept,
  states: ReadonlyMap<string, ConceptState>,
  now: Date = new Date(),
): ConceptState {
  return states.get(concept.id) ?? initialConceptState(concept, now);
}
