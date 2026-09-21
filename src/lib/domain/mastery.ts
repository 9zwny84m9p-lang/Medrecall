import type {
  AnswerQuality,
  ConceptState,
  MasteryState,
  MemoryCard,
  RetrievalContext,
} from "./types";

/**
 * Mastery states and the rules that move a Concept between them.
 *
 * FSRS answers *when* a Concept should next be seen. It does not answer *how
 * well the student knows it* in words a student can act on, which is what these
 * states are for.
 */

/** Days of FSRS stability at which a Concept counts as stable. */
export const STABLE_STABILITY_DAYS = 7;
/** Days of FSRS stability at which a Concept counts as strong. */
export const STRONG_STABILITY_DAYS = 21;

export const MASTERY_LABELS: Record<MasteryState, string> = {
  new: "New",
  learning: "Learning",
  weak: "Weak",
  stable: "Stable",
  strong: "Strong",
};

/**
 * Whether a result should be allowed to clear a `weak` flag.
 *
 * Re-answering correctly seconds after being told the answer demonstrates
 * nothing about memory, so immediate reinforcement never promotes a Concept out
 * of `weak`. Only a spaced retrieval — interleaved from an earlier lecture, or a
 * scheduled review — can.
 */
export function clearsWeakness(context: RetrievalContext): boolean {
  return context === "interleaved" || context === "review";
}

/** Where a Concept sits given its memory state and most recent result. */
export function deriveMastery(
  card: MemoryCard,
  lastQuality: AnswerQuality | null,
  weakSince: string | null,
): MasteryState {
  if (lastQuality === null && card.reps === 0) return "new";
  if (lastQuality === "incorrect" || weakSince !== null) return "weak";
  if (card.stability >= STRONG_STABILITY_DAYS && card.lapses === 0) return "strong";
  if (card.stability >= STABLE_STABILITY_DAYS) return "stable";
  return "learning";
}

/**
 * Apply a graded answer to a Concept's state.
 *
 * `card` is the memory state FSRS has already advanced; this function owns
 * everything else — attempt counts, lapses, and whether weakness sticks.
 */
export function applyResult(
  state: ConceptState,
  card: MemoryCard,
  quality: AnswerQuality,
  context: RetrievalContext,
  reviewedAt: Date,
): ConceptState {
  const timestamp = reviewedAt.toISOString();
  const failed = quality === "incorrect";

  let weakSince = state.weakSince;
  if (failed) {
    weakSince = state.weakSince ?? timestamp;
  } else if (quality === "exact" && clearsWeakness(context)) {
    weakSince = null;
  }

  const next: ConceptState = {
    ...state,
    card,
    attempts: state.attempts + 1,
    lapses: state.lapses + (failed ? 1 : 0),
    lastQuality: quality,
    lastReviewedAt: timestamp,
    weakSince,
  };

  return { ...next, mastery: deriveMastery(card, quality, weakSince) };
}

/** A Concept the engine should make a point of bringing back. */
export function needsReinforcement(state: ConceptState): boolean {
  return state.mastery === "weak" || state.lapses > 0;
}

/** Concepts counted as understood well enough to move on from. */
export function isSettled(state: ConceptState): boolean {
  return state.mastery === "stable" || state.mastery === "strong";
}
