import { activeConcepts } from "@/lib/domain/approval";
import { needsReinforcement } from "@/lib/domain/mastery";
import type {
  Concept,
  ConceptState,
  PublicRetrievalItem,
  RetrievalContext,
  RetrievalKind,
} from "@/lib/domain/types";

import { isDue, overdueBy } from "./scheduler";

/**
 * The tutoring layer: *what* to bring back, and *how* to test it.
 *
 * FSRS supplies due dates. Everything here is the decision FSRS does not make —
 * which of the due-or-weak Concepts is worth a student's attention right now,
 * and which retrieval format to use.
 */

/** Retrievals within a lecture before a Concept from an earlier lecture is pulled in. */
export const INTERLEAVE_AFTER_RETRIEVALS = 2;

/**
 * Why a Concept is worth retrieving, most urgent first.
 *
 * Weakness outranks overdueness: a Concept the student has actually got wrong is
 * a known gap, while a merely-overdue Concept is only a suspected one.
 */
export const REINFORCEMENT_PRIORITIES = ["weak", "lapsed_due", "due"] as const;
export type ReinforcementPriority = (typeof REINFORCEMENT_PRIORITIES)[number];

export interface Candidate {
  concept: Concept;
  state: ConceptState;
  priority: ReinforcementPriority;
  overdueMs: number;
}

function classify(
  state: ConceptState,
  now: Date,
): ReinforcementPriority | null {
  if (state.mastery === "weak") return "weak";
  const due = isDue(state.card, now);
  if (!due) return null;
  return needsReinforcement(state) ? "lapsed_due" : "due";
}

function rank(a: Candidate, b: Candidate): number {
  const byPriority =
    REINFORCEMENT_PRIORITIES.indexOf(a.priority) -
    REINFORCEMENT_PRIORITIES.indexOf(b.priority);
  if (byPriority !== 0) return byPriority;

  // Most overdue first, then by id so the order never depends on input order.
  if (a.overdueMs !== b.overdueMs) return b.overdueMs - a.overdueMs;
  return a.concept.id.localeCompare(b.concept.id);
}

/** Every Concept worth bringing back, ranked. Drafts can never appear. */
export function reinforcementCandidates(
  concepts: readonly Concept[],
  states: ReadonlyMap<string, ConceptState>,
  now: Date,
): Candidate[] {
  const candidates: Candidate[] = [];

  for (const concept of activeConcepts(concepts)) {
    const state = states.get(concept.id);
    if (!state || state.attempts === 0) continue;

    const priority = classify(state, now);
    if (!priority) continue;

    candidates.push({
      concept,
      state,
      priority,
      overdueMs: overdueBy(state.card, now),
    });
  }

  return candidates.sort(rank);
}

/**
 * Pick a Concept from an earlier lecture to interleave into the current one.
 *
 * Excludes Concepts from the lecture being studied — retrieving what was taught
 * two minutes ago is the checkpoint's job, not interleaving's — and Concepts
 * already pulled in during this session.
 */
export function selectInterleavedConcept(
  priorConcepts: readonly Concept[],
  states: ReadonlyMap<string, ConceptState>,
  now: Date,
  options: { currentLectureId: string; exclude?: readonly string[] } = {
    currentLectureId: "",
  },
): Concept | null {
  const excluded = new Set(options.exclude ?? []);

  const eligible = priorConcepts.filter(
    (concept) =>
      concept.lectureId !== options.currentLectureId && !excluded.has(concept.id),
  );

  return reinforcementCandidates(eligible, states, now)[0]?.concept ?? null;
}

/**
 * Preference order for retrieval formats.
 *
 * Recall before recognition, and cheap before expensive: a short cued recall
 * first, then cloze, then mechanism, then open free recall. Multiple choice is
 * absent by design.
 */
export const KIND_PREFERENCE: RetrievalKind[] = [
  "basic",
  "cloze",
  "mechanism",
  "free_recall",
];

function byPreferredKind(a: PublicRetrievalItem, b: PublicRetrievalItem): number {
  const byKind = KIND_PREFERENCE.indexOf(a.kind) - KIND_PREFERENCE.indexOf(b.kind);
  return byKind !== 0 ? byKind : a.id.localeCompare(b.id);
}

/**
 * Choose how to test a Concept this time.
 *
 * Rotating on attempt count means a Concept seen repeatedly is asked a different
 * way each time, so the student is recalling the idea rather than a sentence.
 * On a reinforcement the rotation is advanced once more, so the immediate re-ask
 * is never the exact question just failed.
 */
export function selectRetrievalItem<TItem extends PublicRetrievalItem>(
  items: readonly TItem[],
  state: ConceptState | undefined,
  context: RetrievalContext,
): TItem | null {
  if (items.length === 0) return null;

  const ordered = [...items].sort(byPreferredKind);
  const attempts = state?.attempts ?? 0;
  const offset = context === "reinforce" ? 1 : 0;

  return ordered[(attempts + offset) % ordered.length] ?? null;
}
