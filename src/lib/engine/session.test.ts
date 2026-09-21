import { describe, expect, it } from "vitest";

import {
  buildLecturePlan,
  completeRetrieval,
  completeReteaching,
  completeTeaching,
  currentStep,
  startSession,
  type LecturePlan,
  type SessionProgress,
} from "./session";
import { recordAnswer } from "./tutor";
import { lectureProgress } from "./progress";
import { gradeFreeText } from "@/lib/grading/free-text";
import type { ConceptState, GradeResult } from "@/lib/domain/types";
import { makeConcept, makeItem } from "@/lib/test-support/factories";

const NOW = new Date("2026-09-21T12:00:00.000Z");

const CORRECT: GradeResult = {
  correct: true,
  quality: "exact",
  missingPoints: [],
  feedback: "",
  nextAction: "continue",
};

const WRONG: GradeResult = {
  correct: false,
  quality: "incorrect",
  missingPoints: ["the point"],
  feedback: "",
  nextAction: "reteach",
};

const PARTIAL: GradeResult = {
  correct: false,
  quality: "partial",
  missingPoints: ["the point"],
  feedback: "",
  nextAction: "reinforce",
};

function conceptOnPage(id: string, pageNumber: number, lectureId = "lecture-1") {
  const concept = makeConcept({ id, lectureId, order: pageNumber });
  return { ...concept, source: { ...concept.source, pageNumber, lectureId } };
}

/** Two concepts, one per chunk, so chunk boundaries are easy to reason about. */
function simplePlan(): LecturePlan {
  const concepts = [conceptOnPage("a", 1), conceptOnPage("b", 5)];
  return buildLecturePlan({
    lectureId: "lecture-1",
    lectureConcepts: concepts,
    priorConcepts: [],
    items: [
      makeItem({ id: "a-basic", conceptId: "a", kind: "basic" }),
      makeItem({ id: "a-cloze", conceptId: "a", kind: "cloze" }),
      makeItem({ id: "b-basic", conceptId: "b", kind: "basic" }),
    ],
  });
}

describe("buildLecturePlan", () => {
  it("keeps draft concepts and their items out of the plan", () => {
    const draft = { ...conceptOnPage("draft", 1), status: "draft" as const };
    const plan = buildLecturePlan({
      lectureId: "lecture-1",
      lectureConcepts: [conceptOnPage("a", 1), draft],
      priorConcepts: [],
      items: [
        makeItem({ id: "a-basic", conceptId: "a" }),
        makeItem({ id: "draft-basic", conceptId: "draft" }),
      ],
    });

    expect(plan.concepts.has("draft")).toBe(false);
    expect(plan.items.has("draft")).toBe(false);
    expect(plan.chunks.flatMap((chunk) => chunk.conceptIds)).toEqual(["a"]);
  });

  it("keeps unapproved prior concepts out of the interleaving pool", () => {
    const draftPrior = {
      ...conceptOnPage("prior-draft", 1, "lecture-0"),
      status: "draft" as const,
    };
    const plan = buildLecturePlan({
      lectureId: "lecture-1",
      lectureConcepts: [conceptOnPage("a", 1)],
      priorConcepts: [draftPrior],
      items: [],
    });

    expect(plan.priorConcepts).toHaveLength(0);
  });
});

describe("session flow", () => {
  it("opens on the first teaching chunk", () => {
    const plan = simplePlan();
    const step = currentStep(startSession(plan), plan);

    expect(step.kind).toBe("teach");
    expect(step.kind === "teach" && step.conceptIds).toEqual(["a"]);
  });

  it("asks about what was just taught", () => {
    const plan = simplePlan();
    const after = completeTeaching(startSession(plan), plan, new Map());
    const step = currentStep(after, plan);

    expect(step).toMatchObject({ kind: "retrieve", conceptId: "a", context: "checkpoint" });
  });

  it("moves on after a correct answer", () => {
    const plan = simplePlan();
    let progress = completeTeaching(startSession(plan), plan, new Map());
    progress = completeRetrieval(progress, plan, new Map(), CORRECT, NOW);

    expect(currentStep(progress, plan)).toMatchObject({ kind: "teach" });
  });

  it("re-teaches before re-asking a concept answered incorrectly", () => {
    const plan = simplePlan();
    let progress = completeTeaching(startSession(plan), plan, new Map());
    progress = completeRetrieval(progress, plan, new Map(), WRONG, NOW);

    expect(currentStep(progress, plan)).toMatchObject({ kind: "reteach", conceptId: "a" });

    progress = completeReteaching(progress, plan, new Map());
    expect(currentStep(progress, plan)).toMatchObject({
      kind: "retrieve",
      conceptId: "a",
      context: "reinforce",
    });
  });

  it("re-teaches immediately but defers the retry to the end of the checkpoint", () => {
    // One chunk covering three concepts, so the checkpoint has three questions.
    const concepts = [conceptOnPage("a", 1), conceptOnPage("b", 2), conceptOnPage("c", 3)];
    const plan = buildLecturePlan({
      lectureId: "lecture-1",
      lectureConcepts: concepts,
      priorConcepts: [],
      items: concepts.flatMap((concept) => [
        makeItem({ id: `${concept.id}-basic`, conceptId: concept.id, kind: "basic" }),
        makeItem({ id: `${concept.id}-cloze`, conceptId: concept.id, kind: "cloze" }),
      ]),
    });

    let progress = completeTeaching(startSession(plan), plan, new Map());
    progress = completeRetrieval(progress, plan, new Map(), WRONG, NOW);

    // The explanation comes straight away, while the gap is fresh.
    expect(currentStep(progress, plan)).toMatchObject({ kind: "reteach", conceptId: "a" });

    progress = completeReteaching(progress, plan, new Map());

    // The rest of the checkpoint comes before the retry, so the student has to
    // hold the answer rather than echo it back.
    expect(currentStep(progress, plan)).toMatchObject({ conceptId: "b" });
    progress = completeRetrieval(progress, plan, new Map(), CORRECT, NOW);
    expect(currentStep(progress, plan)).toMatchObject({ conceptId: "c" });
    progress = completeRetrieval(progress, plan, new Map(), CORRECT, NOW);
    expect(currentStep(progress, plan)).toMatchObject({
      kind: "retrieve",
      conceptId: "a",
      context: "reinforce",
    });
  });

  it("re-asks without re-teaching after a partial answer", () => {
    const plan = simplePlan();
    let progress = completeTeaching(startSession(plan), plan, new Map());
    progress = completeRetrieval(progress, plan, new Map(), PARTIAL, NOW);

    expect(currentStep(progress, plan)).toMatchObject({
      kind: "retrieve",
      context: "reinforce",
    });
  });

  it("completes once every chunk is taught and checked", () => {
    const plan = simplePlan();
    let progress = startSession(plan);

    for (let guard = 0; guard < 20; guard += 1) {
      const step = currentStep(progress, plan);
      if (step.kind === "complete") break;
      if (step.kind === "teach") progress = completeTeaching(progress, plan, new Map());
      else if (step.kind === "reteach") progress = completeReteaching(progress, plan, new Map());
      else progress = completeRetrieval(progress, plan, new Map(), CORRECT, NOW);
    }

    expect(currentStep(progress, plan)).toEqual({ kind: "complete" });
    expect(progress.completed).toBe(true);
    expect(progress.answered).toBe(2);
  });

  it("completes immediately for a lecture with no approved concepts", () => {
    const plan = buildLecturePlan({
      lectureId: "lecture-1",
      lectureConcepts: [],
      priorConcepts: [],
      items: [],
    });

    expect(startSession(plan).completed).toBe(true);
    expect(currentStep(startSession(plan), plan)).toEqual({ kind: "complete" });
  });

  it("ignores an acknowledgement that does not match the current step", () => {
    const plan = simplePlan();
    const progress = startSession(plan);

    expect(completeReteaching(progress, plan, new Map())).toBe(progress);
    expect(completeRetrieval(progress, plan, new Map(), CORRECT, NOW)).toBe(progress);
  });
});

/**
 * The milestone workflow, at engine level: learn Lecture 1, get some concepts
 * wrong, move on to Lecture 2, and have a weak Lecture 1 concept come back.
 */
describe("cross-lecture interleaving", () => {
  const lecture1 = [conceptOnPage("l1-a", 1), conceptOnPage("l1-b", 2)];
  const lecture2 = [
    conceptOnPage("l2-a", 1, "lecture-2"),
    conceptOnPage("l2-b", 5, "lecture-2"),
  ];

  const items = [
    makeItem({ id: "l1-a-basic", conceptId: "l1-a", kind: "basic" }),
    makeItem({ id: "l1-a-cloze", conceptId: "l1-a", kind: "cloze" }),
    makeItem({ id: "l1-b-basic", conceptId: "l1-b", kind: "basic" }),
    makeItem({ id: "l2-a-basic", conceptId: "l2-a", kind: "basic" }),
    makeItem({ id: "l2-b-basic", conceptId: "l2-b", kind: "basic" }),
  ];

  /** State in which the student got one Lecture 1 concept wrong. */
  function statesWithWeakL1(): Map<string, ConceptState> {
    const states = new Map<string, ConceptState>();
    const { state } = recordAnswer({
      concept: lecture1[0]!,
      previous: undefined,
      itemId: "l1-a-basic",
      result: WRONG,
      context: "checkpoint",
      now: NOW,
    });
    states.set(state.conceptId, state);
    return states;
  }

  function lectureTwoPlan(): LecturePlan {
    return buildLecturePlan({
      lectureId: "lecture-2",
      lectureConcepts: lecture2,
      priorConcepts: lecture1,
      items,
    });
  }

  it("records the failed lecture 1 concept as weak", () => {
    const states = statesWithWeakL1();
    expect(states.get("l1-a")?.mastery).toBe("weak");
  });

  it("brings that weak concept into lecture 2", () => {
    const plan = lectureTwoPlan();
    const states = statesWithWeakL1();

    let progress = startSession(plan);
    let interleaved: string | null = null;

    for (let guard = 0; guard < 30 && !interleaved; guard += 1) {
      const step = currentStep(progress, plan);
      if (step.kind === "complete") break;

      if (step.kind === "teach") {
        progress = completeTeaching(progress, plan, states, NOW);
      } else if (step.kind === "reteach") {
        progress = completeReteaching(progress, plan, states, NOW);
      } else {
        if (step.context === "interleaved") interleaved = step.conceptId;
        progress = completeRetrieval(progress, plan, states, CORRECT, NOW);
      }
    }

    expect(interleaved).toBe("l1-a");
    expect(progress.interleaved).toContain("l1-a");
  });

  it("does not interleave in the first lecture, where there is nothing prior", () => {
    const plan = buildLecturePlan({
      lectureId: "lecture-1",
      lectureConcepts: lecture1,
      priorConcepts: [],
      items,
    });

    let progress = startSession(plan);
    for (let guard = 0; guard < 30; guard += 1) {
      const step = currentStep(progress, plan);
      if (step.kind === "complete") break;
      if (step.kind === "teach") progress = completeTeaching(progress, plan, new Map(), NOW);
      else if (step.kind === "reteach") progress = completeReteaching(progress, plan, new Map(), NOW);
      else progress = completeRetrieval(progress, plan, new Map(), CORRECT, NOW);
    }

    expect(progress.interleaved).toEqual([]);
  });

  it("answering the interleaved concept correctly clears its weakness", () => {
    const states = statesWithWeakL1();
    const later = new Date(NOW.getTime() + 86_400_000);

    const { state } = recordAnswer({
      concept: lecture1[0]!,
      previous: states.get("l1-a"),
      itemId: "l1-a-cloze",
      result: CORRECT,
      context: "interleaved",
      now: later,
    });

    expect(state.mastery).not.toBe("weak");
    expect(state.weakSince).toBeNull();
    // The lapse stays on record, so the concept keeps its reinforcement priority.
    expect(state.lapses).toBe(1);
  });
});

/** The engine and the real grader, driven end to end over one lecture. */
describe("a full lecture with real grading", () => {
  it("records weakness for wrong answers and still unlocks the next lecture", () => {
    const concepts = [conceptOnPage("a", 1), conceptOnPage("b", 2), conceptOnPage("c", 3)];
    const rawItems = [
      makeItem({ id: "a-1", conceptId: "a", kind: "basic" }),
      makeItem({ id: "a-2", conceptId: "a", kind: "cloze" }),
      makeItem({ id: "b-1", conceptId: "b", kind: "basic" }),
      makeItem({ id: "b-2", conceptId: "b", kind: "cloze" }),
      makeItem({ id: "c-1", conceptId: "c", kind: "basic" }),
    ];

    const plan = buildLecturePlan({
      lectureId: "lecture-1",
      lectureConcepts: concepts,
      priorConcepts: [],
      items: rawItems,
    });

    const byId = new Map(rawItems.map((item) => [item.id, item]));
    const states = new Map<string, ConceptState>();

    // The student answers "b" wrongly the first time and correctly thereafter.
    const answerFor = (conceptId: string, attempt: number) =>
      conceptId === "b" && attempt === 0 ? "no idea" : "answer";

    const attempts = new Map<string, number>();
    let progress: SessionProgress = startSession(plan);

    for (let guard = 0; guard < 40; guard += 1) {
      const step = currentStep(progress, plan);
      if (step.kind === "complete") break;

      if (step.kind === "teach") {
        progress = completeTeaching(progress, plan, states, NOW);
        continue;
      }
      if (step.kind === "reteach") {
        progress = completeReteaching(progress, plan, states, NOW);
        continue;
      }

      const item = byId.get(step.itemId)!;
      const attempt = attempts.get(step.conceptId) ?? 0;
      attempts.set(step.conceptId, attempt + 1);

      const result = gradeFreeText(item, answerFor(step.conceptId, attempt));
      const { state } = recordAnswer({
        concept: plan.concepts.get(step.conceptId)!,
        previous: states.get(step.conceptId),
        itemId: step.itemId,
        result,
        context: step.context,
        now: NOW,
      });
      states.set(state.conceptId, state);

      progress = completeRetrieval(progress, plan, states, result, NOW);
    }

    expect(progress.completed).toBe(true);
    expect(states.get("b")?.mastery).toBe("weak");
    expect(states.get("a")?.mastery).not.toBe("weak");

    const summary = lectureProgress("lecture-1", concepts, states);
    expect(summary).toMatchObject({ total: 3, attempted: 3, weak: 1 });
    // One weak concept out of three is within tolerance, so lecture 2 opens.
    expect(summary.sufficient).toBe(true);
  });
});
