import { activeConcepts, draftConcepts } from "@/lib/domain/approval";
import type {
  Concept,
  Course,
  Lecture,
  PublicRetrievalItem,
  RetrievalItem,
  SourceDocument,
} from "@/lib/domain/types";

import {
  pathologyConcepts,
  pathologyCourse,
  pathologyDocuments,
  pathologyLectures,
} from "./pathology";
import { pathologyItems } from "./pathology-items";

/**
 * The course catalogue.
 *
 * Curriculum content is read here and nowhere else, which is what lets answer
 * keys stay on the server: `toPublicItem` strips `expectedPoints` and
 * `modelAnswer` before anything reaches a client component. A student cannot
 * read the answers out of the JavaScript bundle because they were never in it.
 *
 * In Milestone 2 this is backed by uploaded documents in a database. Callers
 * see the same shapes.
 */

const courses: Course[] = [pathologyCourse];
const lectures: Lecture[] = [...pathologyLectures];
const documents: SourceDocument[] = [...pathologyDocuments];
const concepts: Concept[] = [...pathologyConcepts];
const items: RetrievalItem[] = [...pathologyItems];

export function listCourses(): Course[] {
  return courses;
}

export function getCourse(courseId: string): Course | null {
  return courses.find((course) => course.id === courseId) ?? null;
}

export function listLectures(courseId: string): Lecture[] {
  return lectures
    .filter((lecture) => lecture.courseId === courseId)
    .sort((a, b) => a.order - b.order);
}

export function getLecture(lectureId: string): Lecture | null {
  return lectures.find((lecture) => lecture.id === lectureId) ?? null;
}

export function getDocument(documentId: string): SourceDocument | null {
  return documents.find((document) => document.id === documentId) ?? null;
}

/** Every Concept on record, drafts included. Only the review queue wants this. */
export function listAllConcepts(): Concept[] {
  return concepts;
}

/** Approved Concepts only — what the engine is allowed to see. */
export function listApprovedConcepts(): Concept[] {
  return activeConcepts(concepts);
}

export function listApprovedConceptsForLecture(lectureId: string): Concept[] {
  return activeConcepts(concepts).filter((concept) => concept.lectureId === lectureId);
}

/** Approved Concepts from every lecture before the given one, in course order. */
export function listPriorApprovedConcepts(lectureId: string): Concept[] {
  const lecture = getLecture(lectureId);
  if (!lecture) return [];

  const course = getCourse(lecture.courseId);
  if (!course) return [];

  const position = course.lectureIds.indexOf(lectureId);
  if (position <= 0) return [];

  const earlier = new Set(course.lectureIds.slice(0, position));
  return activeConcepts(concepts).filter((concept) => earlier.has(concept.lectureId));
}

export function listDraftConcepts(): Concept[] {
  return draftConcepts(concepts);
}

export function getConcept(conceptId: string): Concept | null {
  return concepts.find((concept) => concept.id === conceptId) ?? null;
}

/** Full items, answer keys included. Server-side callers only. */
export function listItemsForConcepts(conceptIds: readonly string[]): RetrievalItem[] {
  const wanted = new Set(conceptIds);
  return items.filter((item) => wanted.has(item.conceptId));
}

export function getItem(itemId: string): RetrievalItem | null {
  return items.find((item) => item.id === itemId) ?? null;
}

/**
 * Strip the answer key so an item can be sent to the browser.
 *
 * Built field by field rather than by omitting keys: a new field added to
 * `RetrievalItem` then has to be named here before it can reach a client, so the
 * default for anything new is "stays on the server".
 */
export function toPublicItem(item: RetrievalItem): PublicRetrievalItem {
  return {
    id: item.id,
    conceptId: item.conceptId,
    kind: item.kind,
    prompt: item.prompt,
  };
}

export function listPublicItemsForConcepts(
  conceptIds: readonly string[],
): PublicRetrievalItem[] {
  return listItemsForConcepts(conceptIds).map(toPublicItem);
}
