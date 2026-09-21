import type {
  Concept,
  ConceptState,
  MasteryState,
  RetrievalItem,
} from "@/lib/domain/types";
import { initialConceptState } from "@/lib/engine/scheduler";

/** Fixtures shared across engine tests. */

export function makeConcept(overrides: Partial<Concept> & { id: string }): Concept {
  const lectureId = overrides.lectureId ?? "lecture-1";
  const courseId = overrides.courseId ?? "course-1";

  return {
    courseId,
    lectureId,
    title: `Concept ${overrides.id}`,
    summary: "summary",
    explanation: "explanation",
    status: "approved",
    prerequisiteIds: [],
    order: 1,
    source: {
      courseId,
      lectureId,
      documentId: "doc-1",
      pageNumber: 1,
      excerpt: "excerpt",
    },
    ...overrides,
  };
}

export function makeItem(overrides: Partial<RetrievalItem> & { id: string; conceptId: string }): RetrievalItem {
  return {
    kind: "basic",
    prompt: "prompt",
    expectedPoints: [{ id: "p1", label: "the point", alternatives: ["answer"] }],
    modelAnswer: "answer",
    ...overrides,
  };
}

/** A state with a chosen mastery and due date, for selection and queue tests. */
export function makeState(
  concept: Concept,
  overrides: Partial<ConceptState> & { mastery?: MasteryState } = {},
  now: Date = new Date(),
): ConceptState {
  const base = initialConceptState(concept, now);
  return {
    ...base,
    attempts: 1,
    ...overrides,
    card: { ...base.card, ...overrides.card },
  };
}

export function stateMap(states: ConceptState[]): Map<string, ConceptState> {
  return new Map(states.map((state) => [state.conceptId, state]));
}
