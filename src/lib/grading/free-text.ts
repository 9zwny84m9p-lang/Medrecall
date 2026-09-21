import type {
  ExpectedPoint,
  GradeResult,
  RetrievalItem,
} from "@/lib/domain/types";

/**
 * Deterministic free-text grading.
 *
 * This is the fallback the whole product runs on before AI credentials exist,
 * and the reference behaviour an AI grader must match in shape. It matches an
 * answer against the expected points of an item, each of which carries a set of
 * accepted phrasings, so "sodium pump fails" scores the same as "Na+/K+ ATPase
 * inhibition".
 *
 * It is a lexical matcher, not a semantic one: it will miss a correct answer
 * phrased in words nobody anticipated. That tradeoff is deliberate for
 * Milestone 1 — an offline, testable, explainable grader beats an unavailable
 * one — and `AIProvider.gradeFreeAnswer` is the seam where a semantic grader
 * takes over.
 */

/** Everything that separates "atp" from "ATP," for matching purposes. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9+/'\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Whether an alternative appears in the answer.
 *
 * Matching is on whole words so "ros" does not match "across", but a
 * multi-word alternative matches as a phrase. A regular plural counts as the
 * same word — a student who writes "selectins" has said "selectin" — which is
 * the single most common way an otherwise correct answer used to be marked
 * wrong. Nothing beyond `-s`/`-es` is tolerated: stemming further starts
 * matching words the author did not mean.
 */
export function mentions(answer: string, alternative: string): boolean {
  const haystack = normalise(answer);
  const needle = normalise(alternative);
  if (!needle) return false;

  const boundary = "(^|[^a-z0-9+/-])";
  const trailing = "($|[^a-z0-9+/-])";
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return new RegExp(`${boundary}${escaped}(s|es)?${trailing}`).test(haystack);
}

export function pointIsCovered(answer: string, point: ExpectedPoint): boolean {
  return point.alternatives.some((alternative) => mentions(answer, alternative));
}

function buildFeedback(
  matched: ExpectedPoint[],
  missing: ExpectedPoint[],
  blank: boolean,
): string {
  if (blank) return "Nothing to grade yet — have a go at it in your own words.";
  if (missing.length === 0) return "That covers it.";
  if (matched.length === 0) {
    return `Not quite. The answer needed to get at ${listPoints(missing)}.`;
  }
  return `Part of it. You had ${listPoints(matched)}, but missed ${listPoints(missing)}.`;
}

/**
 * Join point labels into a sentence fragment.
 *
 * Labels are written to read mid-sentence already, and are left exactly as
 * authored — lower-casing them turns "ATP" into "atp" and "Na+/K+ ATPase" into
 * nonsense, in the one message a struggling student actually reads.
 */
function listPoints(points: ExpectedPoint[]): string {
  const labels = points.map((point) => point.label);
  if (labels.length === 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

/**
 * Grade an answer against an item.
 *
 * `exact` means every expected point was covered, `partial` means some were, and
 * `incorrect` means none were. The action follows from that: carry on, ask again
 * shortly, or teach it again before asking.
 */
export function gradeFreeText(item: RetrievalItem, answer: string): GradeResult {
  const blank = normalise(answer).length === 0;
  const points = item.expectedPoints;

  const matched = blank ? [] : points.filter((point) => pointIsCovered(answer, point));
  const missing = points.filter((point) => !matched.includes(point));

  let quality: GradeResult["quality"];
  if (blank || matched.length === 0) {
    quality = "incorrect";
  } else if (missing.length === 0) {
    quality = "exact";
  } else {
    quality = "partial";
  }

  const nextAction: GradeResult["nextAction"] =
    quality === "exact" ? "continue" : quality === "partial" ? "reinforce" : "reteach";

  return {
    correct: quality === "exact",
    quality,
    missingPoints: missing.map((point) => point.label),
    feedback: buildFeedback(matched, missing, blank),
    nextAction,
    modelAnswer: item.modelAnswer,
  };
}
