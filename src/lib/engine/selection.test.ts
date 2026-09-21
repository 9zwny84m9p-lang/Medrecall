import { describe, expect, it } from "vitest";

import {
  reinforcementCandidates,
  selectInterleavedConcept,
  selectRetrievalItem,
} from "./selection";
import { makeConcept, makeItem, makeState, stateMap } from "@/lib/test-support/factories";
import type { ConceptState } from "@/lib/domain/types";

const NOW = new Date("2026-09-21T12:00:00.000Z");
const DAY_MS = 86_400_000;

function dueAt(state: ConceptState, offsetMs: number): ConceptState {
  return { ...state, card: { ...state.card, due: new Date(NOW.getTime() + offsetMs).toISOString() } };
}

describe("reinforcementCandidates", () => {
  const weak = makeConcept({ id: "weak", lectureId: "lecture-1" });
  const overdue = makeConcept({ id: "overdue", lectureId: "lecture-1" });
  const fresh = makeConcept({ id: "fresh", lectureId: "lecture-1" });
  const untouched = makeConcept({ id: "untouched", lectureId: "lecture-1" });

  const states = stateMap([
    dueAt(makeState(weak, { mastery: "weak" }, NOW), 0),
    dueAt(makeState(overdue, { mastery: "learning" }, NOW), -3 * DAY_MS),
    dueAt(makeState(fresh, { mastery: "learning" }, NOW), 5 * DAY_MS),
    makeState(untouched, { attempts: 0 }, NOW),
  ]);

  it("ranks weakness above overdueness", () => {
    const ranked = reinforcementCandidates([overdue, weak], states, NOW);
    expect(ranked.map((entry) => entry.concept.id)).toEqual(["weak", "overdue"]);
  });

  it("leaves out concepts that are not yet due", () => {
    const ranked = reinforcementCandidates([fresh], states, NOW);
    expect(ranked).toHaveLength(0);
  });

  it("leaves out concepts that have never been attempted", () => {
    const ranked = reinforcementCandidates([untouched], states, NOW);
    expect(ranked).toHaveLength(0);
  });

  it("marks a lapsed due concept above a clean due one", () => {
    const lapsed = makeConcept({ id: "lapsed" });
    const clean = makeConcept({ id: "clean" });
    const map = stateMap([
      dueAt(makeState(lapsed, { mastery: "learning", lapses: 1 }, NOW), -DAY_MS),
      dueAt(makeState(clean, { mastery: "learning" }, NOW), -2 * DAY_MS),
    ]);

    const ranked = reinforcementCandidates([clean, lapsed], map, NOW);
    expect(ranked.map((entry) => entry.priority)).toEqual(["lapsed_due", "due"]);
  });

  it("orders equal priorities by how overdue they are", () => {
    const a = makeConcept({ id: "a" });
    const b = makeConcept({ id: "b" });
    const map = stateMap([
      dueAt(makeState(a, { mastery: "learning" }, NOW), -DAY_MS),
      dueAt(makeState(b, { mastery: "learning" }, NOW), -5 * DAY_MS),
    ]);

    expect(reinforcementCandidates([a, b], map, NOW).map((e) => e.concept.id)).toEqual([
      "b",
      "a",
    ]);
  });

  it("never returns an unapproved concept", () => {
    const draft = { ...makeConcept({ id: "draft" }), status: "draft" as const };
    const map = stateMap([dueAt(makeState(draft, { mastery: "weak" }, NOW), 0)]);

    expect(reinforcementCandidates([draft], map, NOW)).toHaveLength(0);
  });
});

describe("selectInterleavedConcept", () => {
  const prior = makeConcept({ id: "prior-weak", lectureId: "lecture-1" });
  const alsoPrior = makeConcept({ id: "prior-due", lectureId: "lecture-1" });
  const current = makeConcept({ id: "current", lectureId: "lecture-2" });

  const states = stateMap([
    dueAt(makeState(prior, { mastery: "weak" }, NOW), 0),
    dueAt(makeState(alsoPrior, { mastery: "learning" }, NOW), -DAY_MS),
    dueAt(makeState(current, { mastery: "weak" }, NOW), 0),
  ]);

  it("pulls the most urgent concept from an earlier lecture", () => {
    const picked = selectInterleavedConcept([prior, alsoPrior], states, NOW, {
      currentLectureId: "lecture-2",
    });
    expect(picked?.id).toBe("prior-weak");
  });

  it("never pulls from the lecture being studied", () => {
    const picked = selectInterleavedConcept([current], states, NOW, {
      currentLectureId: "lecture-2",
    });
    expect(picked).toBeNull();
  });

  it("does not repeat a concept already pulled in this session", () => {
    const picked = selectInterleavedConcept([prior, alsoPrior], states, NOW, {
      currentLectureId: "lecture-2",
      exclude: ["prior-weak"],
    });
    expect(picked?.id).toBe("prior-due");
  });

  it("returns null when nothing is worth bringing back", () => {
    const untouched = makeConcept({ id: "untouched", lectureId: "lecture-1" });
    const picked = selectInterleavedConcept([untouched], new Map(), NOW, {
      currentLectureId: "lecture-2",
    });
    expect(picked).toBeNull();
  });
});

describe("selectRetrievalItem", () => {
  const concept = makeConcept({ id: "concept-1" });
  const items = [
    makeItem({ id: "i-free", conceptId: "concept-1", kind: "free_recall" }),
    makeItem({ id: "i-basic", conceptId: "concept-1", kind: "basic" }),
    makeItem({ id: "i-cloze", conceptId: "concept-1", kind: "cloze" }),
  ];

  it("prefers cued recall on a first encounter", () => {
    const state = makeState(concept, { attempts: 0 }, NOW);
    expect(selectRetrievalItem(items, state, "checkpoint")?.id).toBe("i-basic");
  });

  it("rotates format as a concept is met again", () => {
    const seen = [0, 1, 2].map(
      (attempts) =>
        selectRetrievalItem(items, makeState(concept, { attempts }, NOW), "checkpoint")?.id,
    );
    expect(new Set(seen).size).toBe(3);
  });

  it("does not re-ask the exact question just failed", () => {
    const state = makeState(concept, { attempts: 1 }, NOW);
    const asked = selectRetrievalItem(items, state, "checkpoint");
    const retry = selectRetrievalItem(items, state, "reinforce");

    expect(retry?.id).not.toBe(asked?.id);
  });

  it("returns null when a concept has no items", () => {
    expect(selectRetrievalItem([], undefined, "checkpoint")).toBeNull();
  });

  it("works for a concept with no state yet", () => {
    expect(selectRetrievalItem(items, undefined, "checkpoint")?.id).toBe("i-basic");
  });
});
