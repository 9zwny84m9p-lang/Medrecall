import { describe, expect, it } from "vitest";

import { isLectureUnlocked, lectureProgress, nextLectureFor } from "./progress";
import { makeConcept, makeState, stateMap } from "@/lib/test-support/factories";
import type { Course, Lecture } from "@/lib/domain/types";

const NOW = new Date("2026-09-21T12:00:00.000Z");

const COURSE: Course = {
  id: "course-1",
  title: "Pathology",
  subject: "General Pathology",
  lectureIds: ["lecture-1", "lecture-2", "lecture-3"],
};

const LECTURES: Lecture[] = [
  { id: "lecture-1", courseId: "course-1", title: "One", order: 1, documentId: "doc-1" },
  { id: "lecture-2", courseId: "course-1", title: "Two", order: 2, documentId: "doc-2" },
  { id: "lecture-3", courseId: "course-1", title: "Three", order: 3, documentId: "doc-3" },
];

const L1 = ["a", "b", "c", "d", "e"].map((id) =>
  makeConcept({ id: `l1-${id}`, lectureId: "lecture-1" }),
);
const L2 = ["a", "b"].map((id) => makeConcept({ id: `l2-${id}`, lectureId: "lecture-2" }));
const ALL = [...L1, ...L2];

/** Every lecture-1 concept attempted, with `weakCount` of them still weak. */
function progressed(weakCount: number) {
  return stateMap(
    L1.map((concept, index) =>
      makeState(concept, { mastery: index < weakCount ? "weak" : "learning" }, NOW),
    ),
  );
}

describe("lectureProgress", () => {
  it("counts only concepts that have been attempted", () => {
    const states = stateMap([makeState(L1[0]!, {}, NOW)]);
    expect(lectureProgress("lecture-1", ALL, states)).toMatchObject({
      total: 5,
      attempted: 1,
    });
  });

  it("does not count a state that exists but has no attempts", () => {
    const states = stateMap([makeState(L1[0]!, { attempts: 0 }, NOW)]);
    expect(lectureProgress("lecture-1", ALL, states).attempted).toBe(0);
  });

  it("counts weak and settled concepts separately", () => {
    const states = stateMap([
      makeState(L1[0]!, { mastery: "weak" }, NOW),
      makeState(L1[1]!, { mastery: "stable" }, NOW),
      makeState(L1[2]!, { mastery: "strong" }, NOW),
    ]);
    expect(lectureProgress("lecture-1", ALL, states)).toMatchObject({ weak: 1, settled: 2 });
  });

  it("ignores concepts from other lectures", () => {
    expect(lectureProgress("lecture-2", ALL, new Map()).total).toBe(2);
  });

  it("leaves draft concepts out of the denominator", () => {
    const draft = { ...makeConcept({ id: "draft", lectureId: "lecture-1" }), status: "draft" as const };
    expect(lectureProgress("lecture-1", [...ALL, draft], new Map()).total).toBe(5);
  });

  it("is not sufficient until every concept has been met", () => {
    const states = stateMap(L1.slice(0, 4).map((concept) => makeState(concept, {}, NOW)));
    expect(lectureProgress("lecture-1", ALL, states).sufficient).toBe(false);
  });

  it("is sufficient with a minority still weak", () => {
    expect(lectureProgress("lecture-1", ALL, progressed(2)).sufficient).toBe(true);
  });

  it("is not sufficient when too many are still weak", () => {
    expect(lectureProgress("lecture-1", ALL, progressed(3)).sufficient).toBe(false);
  });

  it("is not sufficient for an empty lecture", () => {
    expect(lectureProgress("lecture-empty", ALL, new Map()).sufficient).toBe(false);
  });
});

describe("isLectureUnlocked", () => {
  it("always opens the first lecture", () => {
    expect(isLectureUnlocked(LECTURES[0]!, COURSE, ALL, new Map())).toBe(true);
  });

  it("keeps later lectures shut until the previous one is learned", () => {
    expect(isLectureUnlocked(LECTURES[1]!, COURSE, ALL, new Map())).toBe(false);
  });

  it("opens the next lecture once the previous one is sufficient", () => {
    expect(isLectureUnlocked(LECTURES[1]!, COURSE, ALL, progressed(1))).toBe(true);
  });

  it("does not open a lecture two ahead", () => {
    expect(isLectureUnlocked(LECTURES[2]!, COURSE, ALL, progressed(1))).toBe(false);
  });
});

describe("nextLectureFor", () => {
  it("starts at the first lecture for a new student", () => {
    expect(nextLectureFor(COURSE, LECTURES, ALL, new Map())?.id).toBe("lecture-1");
  });

  it("advances once a lecture is learned", () => {
    expect(nextLectureFor(COURSE, LECTURES, ALL, progressed(1))?.id).toBe("lecture-2");
  });

  it("stops at the last finished lecture when the course is complete", () => {
    const states = stateMap([
      ...L1.map((concept) => makeState(concept, { mastery: "stable" }, NOW)),
      ...L2.map((concept) => makeState(concept, { mastery: "stable" }, NOW)),
    ]);
    // Lecture 3 has no concepts, so it can never be "sufficient"; it is still
    // the right place to send the student next.
    expect(nextLectureFor(COURSE, LECTURES, ALL, states)?.id).toBe("lecture-3");
  });
});
