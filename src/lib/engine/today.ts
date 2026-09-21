import type { Concept, ConceptState } from "@/lib/domain/types";

import { reinforcementCandidates, type Candidate } from "./selection";

/**
 * The Today queue: what to review across every course.
 *
 * The one rule that matters here is fairness. Ranking everything by urgency in a
 * single list lets a 400-Concept Pathology course fill the entire queue and bury
 * a 20-Concept course the student is also taking. Instead each course is ranked
 * on its own and the queue is filled round-robin, so every course gets a turn
 * before any course gets a second one.
 */

export interface TodayEntry {
  concept: Concept;
  state: ConceptState;
  priority: Candidate["priority"];
  courseId: string;
}

export const DEFAULT_TODAY_LIMIT = 20;

export function buildTodayQueue(
  concepts: readonly Concept[],
  states: ReadonlyMap<string, ConceptState>,
  now: Date,
  limit: number = DEFAULT_TODAY_LIMIT,
): TodayEntry[] {
  if (limit <= 0) return [];

  const byCourse = new Map<string, Concept[]>();
  for (const concept of concepts) {
    const bucket = byCourse.get(concept.courseId) ?? [];
    bucket.push(concept);
    byCourse.set(concept.courseId, bucket);
  }

  // Ranked per course, so urgency is compared within a course, never across.
  const queues = [...byCourse.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([courseId, courseConcepts]) => ({
      courseId,
      candidates: reinforcementCandidates(courseConcepts, states, now),
    }))
    .filter((queue) => queue.candidates.length > 0);

  const queue: TodayEntry[] = [];
  let round = 0;

  while (queue.length < limit) {
    let tookAny = false;

    for (const { courseId, candidates } of queues) {
      const candidate = candidates[round];
      if (!candidate) continue;

      queue.push({
        concept: candidate.concept,
        state: candidate.state,
        priority: candidate.priority,
        courseId,
      });
      tookAny = true;

      if (queue.length >= limit) break;
    }

    if (!tookAny) break;
    round += 1;
  }

  return queue;
}
