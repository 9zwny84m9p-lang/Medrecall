import { activeConcepts } from "@/lib/domain/approval";
import { isSettled } from "@/lib/domain/mastery";
import type { Concept, ConceptState, Course, Lecture } from "@/lib/domain/types";

/**
 * Lecture progress and the rule that unlocks the next lecture.
 *
 * "Sufficiently learned" is deliberately not "fully mastered". Holding a student
 * at Lecture 1 until every Concept is strong would block the very thing that
 * makes the rest work — meeting those Concepts again, spaced, while learning
 * Lecture 2.
 */

/** Share of a lecture's Concepts that may still be weak and still let it pass. */
export const MAX_WEAK_RATIO = 0.4;

export interface LectureProgress {
  lectureId: string;
  total: number;
  attempted: number;
  weak: number;
  settled: number;
  /** Enough to move on to the next lecture. */
  sufficient: boolean;
}

export function lectureProgress(
  lectureId: string,
  concepts: readonly Concept[],
  states: ReadonlyMap<string, ConceptState>,
): LectureProgress {
  const approved = activeConcepts(concepts).filter(
    (concept) => concept.lectureId === lectureId,
  );

  let attempted = 0;
  let weak = 0;
  let settled = 0;

  for (const concept of approved) {
    const state = states.get(concept.id);
    if (!state || state.attempts === 0) continue;
    attempted += 1;
    if (state.mastery === "weak") weak += 1;
    if (isSettled(state)) settled += 1;
  }

  const total = approved.length;
  const sufficient =
    total > 0 && attempted === total && weak / total <= MAX_WEAK_RATIO;

  return { lectureId, total, attempted, weak, settled, sufficient };
}

/**
 * Whether a lecture is open to the student.
 *
 * The first lecture of a course always is. After that, the previous lecture must
 * be sufficiently learned.
 */
export function isLectureUnlocked(
  lecture: Lecture,
  course: Course,
  concepts: readonly Concept[],
  states: ReadonlyMap<string, ConceptState>,
): boolean {
  const position = course.lectureIds.indexOf(lecture.id);
  if (position <= 0) return true;

  const previousId = course.lectureIds[position - 1];
  if (!previousId) return true;

  return lectureProgress(previousId, concepts, states).sufficient;
}

/** The lecture "Continue learning" should open: the first unlocked, unfinished one. */
export function nextLectureFor(
  course: Course,
  lectures: readonly Lecture[],
  concepts: readonly Concept[],
  states: ReadonlyMap<string, ConceptState>,
): Lecture | null {
  const byId = new Map(lectures.map((lecture) => [lecture.id, lecture]));

  let fallback: Lecture | null = null;

  for (const lectureId of course.lectureIds) {
    const lecture = byId.get(lectureId);
    if (!lecture) continue;
    if (!isLectureUnlocked(lecture, course, concepts, states)) break;

    fallback = lecture;
    if (!lectureProgress(lectureId, concepts, states).sufficient) return lecture;
  }

  return fallback;
}
