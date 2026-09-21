import type {
  Concept,
  Course,
  Lecture,
  PublicRetrievalItem,
} from "@/lib/domain/types";

import {
  getCourse,
  getLecture,
  listApprovedConcepts,
  listApprovedConceptsForLecture,
  listCourses,
  listLectures,
  listPriorApprovedConcepts,
  listPublicItemsForConcepts,
} from "./registry";

/**
 * Serialisable bundles handed from server components to client components.
 *
 * Everything crossing this boundary is answer-key-free and approved-only, so the
 * two invariants that matter — no leaked answers, no unapproved Concepts — are
 * upheld at the one place data leaves the server.
 */

export interface CourseBundle {
  course: Course;
  lectures: Lecture[];
  /** Approved Concepts across the whole course. */
  concepts: Concept[];
}

export interface LectureBundle {
  course: Course;
  lecture: Lecture;
  /** Approved Concepts in this lecture. */
  concepts: Concept[];
  /** Approved Concepts from earlier lectures, eligible for interleaving. */
  priorConcepts: Concept[];
  /** Items for this lecture and for every interleavable prior Concept. */
  items: PublicRetrievalItem[];
}

export function buildCourseBundle(courseId: string): CourseBundle | null {
  const course = getCourse(courseId);
  if (!course) return null;

  return {
    course,
    lectures: listLectures(courseId),
    concepts: listApprovedConcepts().filter((concept) => concept.courseId === courseId),
  };
}

export function buildCourseBundles(): CourseBundle[] {
  return listCourses()
    .map((course) => buildCourseBundle(course.id))
    .filter((bundle): bundle is CourseBundle => bundle !== null);
}

export function buildLectureBundle(lectureId: string): LectureBundle | null {
  const lecture = getLecture(lectureId);
  if (!lecture) return null;

  const course = getCourse(lecture.courseId);
  if (!course) return null;

  const concepts = listApprovedConceptsForLecture(lectureId);
  const priorConcepts = listPriorApprovedConcepts(lectureId);

  const items = listPublicItemsForConcepts([
    ...concepts.map((concept) => concept.id),
    ...priorConcepts.map((concept) => concept.id),
  ]);

  return { course, lecture, concepts, priorConcepts, items };
}
