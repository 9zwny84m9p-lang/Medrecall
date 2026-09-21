import { describe, expect, it } from "vitest";

import { buildTodayQueue } from "./today";
import { makeConcept, makeState, stateMap } from "@/lib/test-support/factories";
import type { Concept, ConceptState } from "@/lib/domain/types";

const NOW = new Date("2026-09-21T12:00:00.000Z");
const DAY_MS = 86_400_000;

function courseConcepts(courseId: string, count: number): Concept[] {
  return Array.from({ length: count }, (_, index) =>
    makeConcept({ id: `${courseId}-c${index}`, courseId, lectureId: `${courseId}-l1` }),
  );
}

function dueStates(concepts: Concept[], overdueDays = 1): ConceptState[] {
  return concepts.map((concept) =>
    makeState(
      concept,
      {
        mastery: "learning",
        card: {
          ...makeState(concept, {}, NOW).card,
          due: new Date(NOW.getTime() - overdueDays * DAY_MS).toISOString(),
        },
      },
      NOW,
    ),
  );
}

describe("buildTodayQueue", () => {
  it("returns due concepts", () => {
    const concepts = courseConcepts("course-a", 3);
    const queue = buildTodayQueue(concepts, stateMap(dueStates(concepts)), NOW);

    expect(queue).toHaveLength(3);
    expect(queue.every((entry) => entry.courseId === "course-a")).toBe(true);
  });

  it("leaves out concepts that are not due and not weak", () => {
    const concepts = courseConcepts("course-a", 2);
    const states = stateMap(dueStates(concepts, -5));
    expect(buildTodayQueue(concepts, states, NOW)).toHaveLength(0);
  });

  it("stops one large course monopolising the queue", () => {
    const big = courseConcepts("course-big", 40);
    const small = courseConcepts("course-small", 4);
    const states = stateMap([...dueStates(big), ...dueStates(small)]);

    const queue = buildTodayQueue([...big, ...small], states, NOW, 10);

    expect(queue).toHaveLength(10);
    const fromSmall = queue.filter((entry) => entry.courseId === "course-small");
    expect(fromSmall).toHaveLength(4);
  });

  it("gives every course a turn before any course gets a second", () => {
    const a = courseConcepts("course-a", 5);
    const b = courseConcepts("course-b", 5);
    const states = stateMap([...dueStates(a), ...dueStates(b)]);

    const queue = buildTodayQueue([...a, ...b], states, NOW, 4);
    expect(queue.map((entry) => entry.courseId)).toEqual([
      "course-a",
      "course-b",
      "course-a",
      "course-b",
    ]);
  });

  it("keeps filling from the courses that still have work left", () => {
    const a = courseConcepts("course-a", 1);
    const b = courseConcepts("course-b", 5);
    const states = stateMap([...dueStates(a), ...dueStates(b)]);

    const queue = buildTodayQueue([...a, ...b], states, NOW, 5);
    expect(queue).toHaveLength(5);
    expect(queue.filter((entry) => entry.courseId === "course-b")).toHaveLength(4);
  });

  it("respects the limit", () => {
    const concepts = courseConcepts("course-a", 30);
    const queue = buildTodayQueue(concepts, stateMap(dueStates(concepts)), NOW, 7);
    expect(queue).toHaveLength(7);
  });

  it("returns nothing for a non-positive limit", () => {
    const concepts = courseConcepts("course-a", 5);
    expect(buildTodayQueue(concepts, stateMap(dueStates(concepts)), NOW, 0)).toEqual([]);
  });

  it("puts weak concepts ahead of merely due ones within a course", () => {
    const concepts = courseConcepts("course-a", 2);
    const [first, second] = concepts as [Concept, Concept];
    const states = stateMap([
      ...dueStates([first]),
      makeState(second, { mastery: "weak" }, NOW),
    ]);

    const queue = buildTodayQueue(concepts, states, NOW);
    expect(queue[0]?.concept.id).toBe(second.id);
    expect(queue[0]?.priority).toBe("weak");
  });

  it("never queues an unapproved concept", () => {
    const concepts = courseConcepts("course-a", 2);
    const drafts = concepts.map((concept) => ({ ...concept, status: "draft" as const }));
    const states = stateMap(dueStates(concepts));

    expect(buildTodayQueue(drafts, states, NOW)).toHaveLength(0);
  });
});
