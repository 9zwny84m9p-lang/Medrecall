import "server-only";

import { z } from "zod";

import { gradeFreeText } from "@/lib/grading/free-text";
import type { GradeResult } from "@/lib/domain/types";

import {
  ProviderCapabilityError,
  type AIProvider,
  type DraftConcept,
  type GradeInput,
  type RemediationInput,
  type TeachingInput,
} from "./provider";

/**
 * Anthropic-backed provider.
 *
 * `server-only` at the top of this file is load-bearing: importing it from a
 * client component is a build error, so the API key cannot be pulled into a
 * browser bundle by accident.
 *
 * Only the capabilities Milestone 1 actually routes through — grading and
 * re-teaching — are implemented. Concept extraction and item generation belong
 * with the PDF pipeline and are left throwing a clear error rather than shipping
 * untested prompts behind a working-looking method.
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5";

const gradeResponseSchema = z.object({
  correct: z.boolean(),
  quality: z.enum(["exact", "partial", "incorrect"]),
  missingPoints: z.array(z.string()),
  feedback: z.string(),
  nextAction: z.enum(["continue", "reinforce", "reteach"]),
});

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";

  readonly #apiKey: string;
  readonly #model: string;

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    if (!apiKey) {
      throw new Error("AnthropicProvider needs ANTHROPIC_API_KEY to be set.");
    }
    this.#apiKey = apiKey;
    this.#model = model;
  }

  async #complete(system: string, user: string, maxTokens = 1024): Promise<string> {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.#apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.#model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Anthropic request failed: ${response.status} ${response.statusText}`,
      );
    }

    const payload: unknown = await response.json();
    const parsed = z
      .object({ content: z.array(z.object({ type: z.string(), text: z.string().optional() })) })
      .safeParse(payload);

    if (!parsed.success) throw new Error("Anthropic returned an unexpected payload.");

    return parsed.data.content
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("")
      .trim();
  }

  async extractConcepts(): Promise<DraftConcept[]> {
    throw new ProviderCapabilityError(
      this.name,
      "extract concepts",
      "the PDF ingestion pipeline lands in Milestone 2; see ROADMAP.md.",
    );
  }

  async generateRetrievalItems(): Promise<never> {
    throw new ProviderCapabilityError(
      this.name,
      "generate retrieval items",
      "item generation lands with the ingestion pipeline in Milestone 2; see ROADMAP.md.",
    );
  }

  async generateTeachingExplanation({
    concept,
    priorConceptTitles,
  }: TeachingInput): Promise<string> {
    const covered = priorConceptTitles.length
      ? `The student has already covered: ${priorConceptTitles.join(", ")}.`
      : "This is the first concept in the lecture.";

    return this.#complete(
      "You are a medical tutor. Explain one concept clearly in 3-5 sentences, " +
        "grounded strictly in the source excerpt given. Do not introduce facts " +
        "that are not supported by it.",
      `Concept: ${concept.title}\nSummary: ${concept.summary}\n` +
        `Source excerpt: ${concept.source.excerpt}\n${covered}`,
    );
  }

  /**
   * Semantic grading.
   *
   * The lexical grader runs first and its verdict is sent along as a prior: the
   * model is there to catch a correct answer phrased in unanticipated words, not
   * to re-derive the marking scheme. If the response is unusable, the lexical
   * result stands rather than the student losing their answer.
   */
  async gradeFreeAnswer({ item, answer }: GradeInput): Promise<GradeResult> {
    const lexical = gradeFreeText(item, answer);

    const expected = item.expectedPoints
      .map((point) => `- ${point.label} (e.g. ${point.alternatives.join(", ")})`)
      .join("\n");

    let raw: string;
    try {
      raw = await this.#complete(
        "You grade a medical student's free-text recall. Reply with JSON only, " +
          'matching {"correct":boolean,"quality":"exact"|"partial"|"incorrect",' +
          '"missingPoints":string[],"feedback":string,' +
          '"nextAction":"continue"|"reinforce"|"reteach"}. ' +
          "Credit correct meaning regardless of wording. Keep feedback to one or two sentences.",
        `Question: ${item.prompt}\nExpected points:\n${expected}\n` +
          `Model answer: ${item.modelAnswer}\nStudent answer: ${answer}\n` +
          `A lexical matcher scored this "${lexical.quality}".`,
        512,
      );
    } catch {
      return lexical;
    }

    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return lexical;
    }

    const result = gradeResponseSchema.safeParse(parsed);
    if (!result.success) return lexical;

    return { ...result.data, modelAnswer: item.modelAnswer };
  }

  async generateRemediation({ concept, answer, result }: RemediationInput): Promise<string> {
    return this.#complete(
      "You are a medical tutor re-teaching a concept a student just got wrong. " +
        "Lead with the piece they missed. 3-4 sentences. Stay within the source excerpt.",
      `Concept: ${concept.title}\nSource excerpt: ${concept.source.excerpt}\n` +
        `Student answer: ${answer}\nMissed: ${result.missingPoints.join(", ") || "none"}`,
    );
  }
}
