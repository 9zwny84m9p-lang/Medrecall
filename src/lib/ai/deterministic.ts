import { gradeFreeText } from "@/lib/grading/free-text";
import type { Concept, GradeResult, RetrievalItem } from "@/lib/domain/types";

import {
  ProviderCapabilityError,
  type AIProvider,
  type DraftConcept,
  type ExtractConceptsInput,
  type GradeInput,
  type RemediationInput,
  type RetrievalItemsInput,
  type TeachingInput,
} from "./provider";

/**
 * The provider MedRecall runs on with no credentials configured.
 *
 * It is not a stub: teaching text and retrieval items come from authored course
 * content, and grading is the real lexical grader. That is what makes the
 * learning engine testable independently of model quality — a failing session
 * test means the engine is wrong, not that a prompt drifted.
 */
export class DeterministicProvider implements AIProvider {
  readonly name = "deterministic";

  /**
   * Concept extraction needs a model. Rather than invent Concepts from page
   * text with a heuristic — which would push unreviewed, low-quality proposals
   * into the approval queue and train the user to rubber-stamp them — this
   * fails loudly. The demo course ships with authored Concepts instead.
   */
  async extractConcepts(input: ExtractConceptsInput): Promise<DraftConcept[]> {
    throw new ProviderCapabilityError(
      this.name,
      "extract concepts",
      `no model is configured, and ${input.pages.length} pages of source text cannot be ` +
        "turned into reviewable Concepts by rule. Set AI_PROVIDER=anthropic with a key, " +
        "or work from the authored demo course.",
    );
  }

  async generateTeachingExplanation({ concept }: TeachingInput): Promise<string> {
    return concept.explanation;
  }

  async generateRetrievalItems({ concept }: RetrievalItemsInput): Promise<RetrievalItem[]> {
    throw new ProviderCapabilityError(
      this.name,
      "generate retrieval items",
      `"${concept.title}" has no authored items and no model is configured to write them.`,
    );
  }

  async gradeFreeAnswer({ item, answer }: GradeInput): Promise<GradeResult> {
    return gradeFreeText(item, answer);
  }

  async generateRemediation({ concept, result }: RemediationInput): Promise<string> {
    return buildRemediation(concept, result);
  }
}

/**
 * Re-teaching text for a Concept the student just got wrong.
 *
 * Deliberately not a copy of the original explanation: it leads with what was
 * missed, so a student who has just failed sees the gap rather than the same
 * wall of text.
 */
export function buildRemediation(concept: Concept, result: GradeResult): string {
  const missed = result.missingPoints;

  // Labels are kept as authored; lower-casing them mangles acronyms like ATP.
  const opening =
    missed.length === 0
      ? `Let's go over ${concept.title} once more.`
      : missed.length === 1
        ? `The piece to hold on to here is ${missed[0]}.`
        : `The pieces to hold on to: ${missed.slice(0, -1).join(", ")} and ${missed.at(-1)}.`;

  return `${opening}\n\n${concept.summary}`;
}
