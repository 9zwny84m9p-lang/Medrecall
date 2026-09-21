import { describe, expect, it } from "vitest";

import {
  activeConcepts,
  approveConcept,
  assertApproved,
  discardConcept,
  draftConcepts,
  isApproved,
  UnapprovedConceptError,
} from "./approval";
import type { Concept } from "./types";

function concept(id: string, status: Concept["status"]): Concept {
  return {
    id,
    courseId: "course-1",
    lectureId: "lecture-1",
    title: `Concept ${id}`,
    summary: "",
    explanation: "",
    status,
    source: {
      courseId: "course-1",
      lectureId: "lecture-1",
      documentId: "doc-1",
      pageNumber: 1,
      excerpt: "",
    },
    prerequisiteIds: [],
    order: 1,
  };
}

const CONCEPTS = [
  concept("approved-1", "approved"),
  concept("draft-1", "draft"),
  concept("discarded-1", "discarded"),
  concept("approved-2", "approved"),
];

describe("the approval gate", () => {
  it("passes only approved concepts through", () => {
    expect(activeConcepts(CONCEPTS).map((entry) => entry.id)).toEqual([
      "approved-1",
      "approved-2",
    ]);
  });

  it("keeps discarded concepts out of the review queue", () => {
    expect(draftConcepts(CONCEPTS).map((entry) => entry.id)).toEqual(["draft-1"]);
  });

  it("recognises approval", () => {
    expect(isApproved(concept("a", "approved"))).toBe(true);
    expect(isApproved(concept("a", "draft"))).toBe(false);
    expect(isApproved(concept("a", "discarded"))).toBe(false);
  });

  it("throws rather than silently skipping an unapproved concept", () => {
    expect(() => assertApproved(concept("draft-1", "draft"))).toThrow(
      UnapprovedConceptError,
    );
    expect(() => assertApproved(concept("gone", "discarded"))).toThrow(
      UnapprovedConceptError,
    );
  });

  it("names the concept in the error, so the failure is actionable", () => {
    try {
      assertApproved(concept("draft-1", "draft"));
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(UnapprovedConceptError);
      expect((error as UnapprovedConceptError).conceptId).toBe("draft-1");
      expect((error as Error).message).toContain("draft");
    }
  });

  it("returns the concept unchanged when it is approved", () => {
    const approved = concept("ok", "approved");
    expect(assertApproved(approved)).toBe(approved);
  });

  it("approving a draft admits it to the curriculum", () => {
    const promoted = approveConcept(concept("draft-1", "draft"));
    expect(promoted.status).toBe("approved");
    expect(activeConcepts([promoted])).toHaveLength(1);
  });

  it("discarding keeps it on record but out of everything", () => {
    const dropped = discardConcept(concept("draft-1", "draft"));
    expect(dropped.status).toBe("discarded");
    expect(activeConcepts([dropped])).toHaveLength(0);
    expect(draftConcepts([dropped])).toHaveLength(0);
  });
});
