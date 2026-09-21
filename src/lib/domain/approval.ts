import type { Concept } from "./types";

/**
 * The approval gate.
 *
 * AI-extracted Concepts are proposals, not curriculum. A Concept that a human
 * has not approved must never be taught, retrieved, scheduled, counted towards
 * mastery, interleaved, or placed in the Today queue.
 *
 * This lives in the domain layer on purpose. Enforcing it only in the UI would
 * mean every new surface — a queue builder, a background scheduler, an export —
 * has to remember the rule. Here, the engine physically cannot see a draft:
 * every selection path funnels through `activeConcepts`.
 */

export class UnapprovedConceptError extends Error {
  readonly conceptId: string;

  constructor(concept: Pick<Concept, "id" | "status" | "title">) {
    super(
      `Concept "${concept.title}" (${concept.id}) is ${concept.status}, not approved, ` +
        `and cannot enter teaching, retrieval or scheduling.`,
    );
    this.name = "UnapprovedConceptError";
    this.conceptId = concept.id;
  }
}

export function isApproved(concept: Concept): boolean {
  return concept.status === "approved";
}

/** The only supported way for the engine to obtain Concepts to work with. */
export function activeConcepts(concepts: readonly Concept[]): Concept[] {
  return concepts.filter(isApproved);
}

/** Concepts still waiting on a human decision. */
export function draftConcepts(concepts: readonly Concept[]): Concept[] {
  return concepts.filter((concept) => concept.status === "draft");
}

/**
 * Throw unless the Concept is approved.
 *
 * Used at the points where a single Concept crosses into the engine — grading a
 * specific answer, say — where a filter cannot help.
 */
export function assertApproved(concept: Concept): Concept {
  if (!isApproved(concept)) throw new UnapprovedConceptError(concept);
  return concept;
}

/** Approve a draft, recording the human decision. */
export function approveConcept(concept: Concept): Concept {
  return { ...concept, status: "approved" };
}

/** Reject a draft outright; it stays on record but never becomes curriculum. */
export function discardConcept(concept: Concept): Concept {
  return { ...concept, status: "discarded" };
}
