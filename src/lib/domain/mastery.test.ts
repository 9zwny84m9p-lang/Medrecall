import { describe, expect, it } from "vitest";

import {
  applyResult,
  clearsWeakness,
  deriveMastery,
  isSettled,
  needsReinforcement,
  STABLE_STABILITY_DAYS,
  STRONG_STABILITY_DAYS,
} from "./mastery";
import type { ConceptState, MemoryCard } from "./types";

const NOW = new Date("2026-09-21T12:00:00.000Z");

function card(overrides: Partial<MemoryCard> = {}): MemoryCard {
  return {
    due: NOW.toISOString(),
    stability: 0,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 0,
    learningSteps: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    ...overrides,
  };
}

function state(overrides: Partial<ConceptState> = {}): ConceptState {
  return {
    conceptId: "concept-1",
    lectureId: "lecture-1",
    courseId: "course-1",
    mastery: "new",
    card: card(),
    attempts: 0,
    lapses: 0,
    lastQuality: null,
    lastReviewedAt: null,
    weakSince: null,
    ...overrides,
  };
}

describe("deriveMastery", () => {
  it("is new before any review", () => {
    expect(deriveMastery(card(), null, null)).toBe("new");
  });

  it("is weak after an incorrect answer", () => {
    expect(deriveMastery(card({ reps: 1 }), "incorrect", null)).toBe("weak");
  });

  it("stays weak while weakness is unresolved, even after a correct answer", () => {
    const stable = card({ reps: 3, stability: STABLE_STABILITY_DAYS + 1 });
    expect(deriveMastery(stable, "exact", NOW.toISOString())).toBe("weak");
  });

  it("is learning early on", () => {
    expect(deriveMastery(card({ reps: 1, stability: 1 }), "exact", null)).toBe("learning");
  });

  it("is stable once stability passes the threshold", () => {
    const stable = card({ reps: 4, stability: STABLE_STABILITY_DAYS });
    expect(deriveMastery(stable, "exact", null)).toBe("stable");
  });

  it("is strong only without a history of lapses", () => {
    const strong = card({ reps: 8, stability: STRONG_STABILITY_DAYS });
    expect(deriveMastery(strong, "exact", null)).toBe("strong");
    expect(deriveMastery({ ...strong, lapses: 1 }, "exact", null)).toBe("stable");
  });
});

describe("clearsWeakness", () => {
  it("only counts spaced retrievals", () => {
    expect(clearsWeakness("interleaved")).toBe(true);
    expect(clearsWeakness("review")).toBe(true);
    expect(clearsWeakness("checkpoint")).toBe(false);
    expect(clearsWeakness("reinforce")).toBe(false);
  });
});

describe("applyResult", () => {
  it("records a failure as weak and counts the lapse", () => {
    const next = applyResult(state(), card({ reps: 1 }), "incorrect", "checkpoint", NOW);
    expect(next).toMatchObject({
      mastery: "weak",
      lapses: 1,
      attempts: 1,
      lastQuality: "incorrect",
    });
    expect(next.weakSince).toBe(NOW.toISOString());
  });

  it("does not clear weakness on an immediate re-ask", () => {
    const weak = state({ mastery: "weak", weakSince: NOW.toISOString(), lapses: 1 });
    const next = applyResult(weak, card({ reps: 2, stability: 3 }), "exact", "reinforce", NOW);

    expect(next.mastery).toBe("weak");
    expect(next.weakSince).toBe(NOW.toISOString());
  });

  it("clears weakness on a spaced success", () => {
    const weak = state({ mastery: "weak", weakSince: NOW.toISOString(), lapses: 1 });
    const later = new Date(NOW.getTime() + 86_400_000);
    const next = applyResult(weak, card({ reps: 3, stability: 2 }), "exact", "interleaved", later);

    expect(next.weakSince).toBeNull();
    expect(next.mastery).toBe("learning");
  });

  it("does not clear weakness on a partial answer", () => {
    const weak = state({ mastery: "weak", weakSince: NOW.toISOString(), lapses: 1 });
    const next = applyResult(weak, card({ reps: 3, stability: 2 }), "partial", "interleaved", NOW);
    expect(next.mastery).toBe("weak");
  });

  it("keeps the original weakSince across repeated failures", () => {
    const first = applyResult(state(), card({ reps: 1 }), "incorrect", "checkpoint", NOW);
    const later = new Date(NOW.getTime() + 60_000);
    const second = applyResult(first, card({ reps: 2 }), "incorrect", "reinforce", later);

    expect(second.weakSince).toBe(NOW.toISOString());
    expect(second.lapses).toBe(2);
  });
});

describe("reinforcement helpers", () => {
  it("flags weak concepts and anything that has ever lapsed", () => {
    expect(needsReinforcement(state({ mastery: "weak" }))).toBe(true);
    expect(needsReinforcement(state({ mastery: "learning", lapses: 1 }))).toBe(true);
    expect(needsReinforcement(state({ mastery: "learning" }))).toBe(false);
  });

  it("counts stable and strong concepts as settled", () => {
    expect(isSettled(state({ mastery: "stable" }))).toBe(true);
    expect(isSettled(state({ mastery: "strong" }))).toBe(true);
    expect(isSettled(state({ mastery: "learning" }))).toBe(false);
  });
});
