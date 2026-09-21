import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  type Card,
  type Grade,
} from "ts-fsrs";

import type { AnswerQuality, ConceptState, MemoryCard } from "@/lib/domain/types";
import { deriveMastery } from "@/lib/domain/mastery";

/**
 * FSRS answers exactly one question for MedRecall: **when** should this Concept
 * be seen again?
 *
 * It does not choose what to study or how to test it — that is the tutoring
 * layer in `selection.ts` and `session.ts`. Keeping the split sharp is what lets
 * the scheduler be swapped or retuned without touching the curriculum logic.
 */

const parameters = generatorParameters({ enable_fuzz: false });
const scheduler = fsrs(parameters);

/** Map a graded answer onto an FSRS rating. */
export function toRating(quality: AnswerQuality): Grade {
  switch (quality) {
    case "exact":
      return Rating.Good;
    case "partial":
      return Rating.Hard;
    case "incorrect":
      return Rating.Again;
  }
}

function toMemoryCard(card: Card): MemoryCard {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review?.toISOString(),
  };
}

function toFsrsCard(card: MemoryCard): Card {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    learning_steps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.lastReview ? new Date(card.lastReview) : undefined,
  };
}

export function newMemoryCard(now: Date): MemoryCard {
  return toMemoryCard(createEmptyCard(now));
}

/** Advance a Concept's memory state by one graded review. */
export function scheduleNext(
  card: MemoryCard,
  quality: AnswerQuality,
  now: Date,
): MemoryCard {
  const { card: next } = scheduler.next(toFsrsCard(card), now, toRating(quality));
  return toMemoryCard(next);
}

export function isDue(card: MemoryCard, now: Date): boolean {
  return new Date(card.due).getTime() <= now.getTime();
}

/** How overdue a Concept is, in milliseconds. Negative means not yet due. */
export function overdueBy(card: MemoryCard, now: Date): number {
  return now.getTime() - new Date(card.due).getTime();
}

/** A fresh, never-studied state for a Concept. */
export function initialConceptState(
  concept: { id: string; lectureId: string; courseId: string },
  now: Date,
): ConceptState {
  const card = newMemoryCard(now);
  return {
    conceptId: concept.id,
    lectureId: concept.lectureId,
    courseId: concept.courseId,
    mastery: deriveMastery(card, null, null),
    card,
    attempts: 0,
    lapses: 0,
    lastQuality: null,
    lastReviewedAt: null,
    weakSince: null,
  };
}
