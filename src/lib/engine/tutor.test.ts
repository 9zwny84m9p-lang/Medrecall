import { describe, expect, it } from "vitest";

import { ensureState, recordAnswer } from "./tutor";
import { UnapprovedConceptError } from "@/lib/domain/approval";
import { makeConcept, stateMap } from "@/lib/test-support/factories";
import type { GradeResult } from "@/lib/domain/types";

const NOW = new Date("2026-09-21T12:00:00.000Z");
const CONCEPT = makeConcept({ id: "concept-1" });

function result(quality: GradeResult["quality"]): GradeResult {
  return {
    correct: quality === "exact",
    quality,
    missingPoints: [],
    feedback: "",
    nextAction: quality === "exact" ? "continue" : "reinforce",
  };
}

describe("recordAnswer", () => {
  it("creates state for a concept seen for the first time", () => {
    const { state } = recordAnswer({
      concept: CONCEPT,
      previous: undefined,
      itemId: "item-1",
      result: result("exact"),
      context: "checkpoint",
      now: NOW,
    });

    expect(state).toMatchObject({ conceptId: "concept-1", attempts: 1, lapses: 0 });
    expect(state.mastery).not.toBe("new");
  });

  it("advances the memory card, pushing the next review out", () => {
    const { state } = recordAnswer({
      concept: CONCEPT,
      previous: undefined,
      itemId: "item-1",
      result: result("exact"),
      context: "checkpoint",
      now: NOW,
    });

    expect(state.card.reps).toBe(1);
    expect(new Date(state.card.due).getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("marks a wrong answer weak", () => {
    const { state } = recordAnswer({
      concept: CONCEPT,
      previous: undefined,
      itemId: "item-1",
      result: result("incorrect"),
      context: "checkpoint",
      now: NOW,
    });

    expect(state.mastery).toBe("weak");
    expect(state.lapses).toBe(1);
  });

  it("writes a review log entry describing the retrieval", () => {
    const { logEntry } = recordAnswer({
      concept: CONCEPT,
      previous: undefined,
      itemId: "item-1",
      result: result("partial"),
      context: "interleaved",
      now: NOW,
    });

    expect(logEntry).toMatchObject({
      conceptId: "concept-1",
      itemId: "item-1",
      context: "interleaved",
      quality: "partial",
      reviewedAt: NOW.toISOString(),
    });
  });

  it("refuses to give an unapproved concept memory state", () => {
    const draft = { ...CONCEPT, status: "draft" as const };

    expect(() =>
      recordAnswer({
        concept: draft,
        previous: undefined,
        itemId: "item-1",
        result: result("exact"),
        context: "checkpoint",
        now: NOW,
      }),
    ).toThrow(UnapprovedConceptError);
  });

  it("accumulates across answers", () => {
    const first = recordAnswer({
      concept: CONCEPT,
      previous: undefined,
      itemId: "item-1",
      result: result("incorrect"),
      context: "checkpoint",
      now: NOW,
    });

    const second = recordAnswer({
      concept: CONCEPT,
      previous: first.state,
      itemId: "item-2",
      result: result("exact"),
      context: "reinforce",
      now: new Date(NOW.getTime() + 60_000),
    });

    expect(second.state.attempts).toBe(2);
    expect(second.state.lapses).toBe(1);
    // Immediate reinforcement does not undo weakness.
    expect(second.state.mastery).toBe("weak");
  });
});

describe("ensureState", () => {
  it("returns existing state when there is some", () => {
    const { state } = recordAnswer({
      concept: CONCEPT,
      previous: undefined,
      itemId: "item-1",
      result: result("exact"),
      context: "checkpoint",
      now: NOW,
    });

    expect(ensureState(CONCEPT, stateMap([state]), NOW)).toBe(state);
  });

  it("fabricates a fresh state when there is none", () => {
    expect(ensureState(CONCEPT, new Map(), NOW)).toMatchObject({
      conceptId: "concept-1",
      attempts: 0,
      mastery: "new",
    });
  });
});
