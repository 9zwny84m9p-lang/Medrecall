import { activeConcepts } from "@/lib/domain/approval";
import type { Concept } from "@/lib/domain/types";

/**
 * Teaching chunks: a few pages of source material taught together before the
 * first retrieval checkpoint.
 *
 * Chunking is by source page rather than by concept count so that what is taught
 * together is what appeared together in the lecture — the student's mental model
 * of "that bit about ATP" survives the transfer into MedRecall.
 */

export interface TeachingChunk {
  id: string;
  lectureId: string;
  /** 0-based position within the lecture. */
  index: number;
  pageStart: number;
  pageEnd: number;
  conceptIds: string[];
}

/** Roughly the 2–5 page span a chunk should cover. */
export const MAX_PAGES_PER_CHUNK = 3;
/**
 * Upper bound on Concepts in one checkpoint. A chunk that taught eight ideas
 * before asking anything would be a lecture, not a chunk.
 */
export const MAX_CONCEPTS_PER_CHUNK = 3;

function byPageThenOrder(a: Concept, b: Concept): number {
  if (a.source.pageNumber !== b.source.pageNumber) {
    return a.source.pageNumber - b.source.pageNumber;
  }
  return a.order - b.order;
}

/**
 * Group a lecture's approved Concepts into teaching chunks.
 *
 * Draft Concepts are filtered out here as well as at every other entry point —
 * chunking is one of the places unapproved material would otherwise leak into
 * teaching.
 */
export function buildTeachingChunks(
  lectureId: string,
  concepts: readonly Concept[],
  options: { maxPages?: number; maxConcepts?: number } = {},
): TeachingChunk[] {
  const maxPages = options.maxPages ?? MAX_PAGES_PER_CHUNK;
  const maxConcepts = options.maxConcepts ?? MAX_CONCEPTS_PER_CHUNK;

  const ordered = activeConcepts(concepts)
    .filter((concept) => concept.lectureId === lectureId)
    .sort(byPageThenOrder);

  const chunks: TeachingChunk[] = [];
  let current: Concept[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const pages = current.map((concept) => concept.source.pageNumber);
    chunks.push({
      id: `${lectureId}:chunk-${chunks.length}`,
      lectureId,
      index: chunks.length,
      pageStart: Math.min(...pages),
      pageEnd: Math.max(...pages),
      conceptIds: current.map((concept) => concept.id),
    });
    current = [];
  };

  for (const concept of ordered) {
    const first = current[0];
    const wouldSpan = first
      ? concept.source.pageNumber - first.source.pageNumber + 1
      : 1;

    if (current.length >= maxConcepts || wouldSpan > maxPages) flush();
    current.push(concept);
  }
  flush();

  return chunks;
}
