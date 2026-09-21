import { describe, expect, it } from "vitest";
import { Rating } from "ts-fsrs";

import {
  initialConceptState,
  isDue,
  newMemoryCard,
  overdueBy,
  scheduleNext,
  toRating,
} from "./scheduler";
import { makeConcept } from "@/lib/test-support/factories";

const NOW = new Date("2026-09-21T12:00:00.000Z");
const DAY_MS = 86_400_000;

describe("toRating", () => {
  it("maps answer quality onto FSRS ratings", () => {
    expect(toRating("exact")).toBe(Rating.Good);
    expect(toRating("partial")).toBe(Rating.Hard);
    expect(toRating("incorrect")).toBe(Rating.Again);
  });
});

describe("scheduleNext", () => {
  it("advances the card on a correct answer", () => {
    const next = scheduleNext(newMemoryCard(NOW), "exact", NOW);
    expect(next.reps).toBe(1);
    expect(new Date(next.due).getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("gives a correct answer a later due date than a wrong one", () => {
    const card = newMemoryCard(NOW);
    const good = scheduleNext(card, "exact", NOW);
    const again = scheduleNext(card, "incorrect", NOW);

    expect(new Date(good.due).getTime()).toBeGreaterThan(new Date(again.due).getTime());
  });

  it("records a lapse on a wrong answer to an established card", () => {
    let card = newMemoryCard(NOW);
    for (let day = 0; day < 4; day += 1) {
      card = scheduleNext(card, "exact", new Date(NOW.getTime() + day * DAY_MS));
    }

    const lapsed = scheduleNext(card, "incorrect", new Date(NOW.getTime() + 5 * DAY_MS));
    expect(lapsed.lapses).toBeGreaterThan(card.lapses);
  });

  it("builds stability over repeated successes", () => {
    let card = newMemoryCard(NOW);
    let elapsed = 0;

    for (let review = 0; review < 5; review += 1) {
      card = scheduleNext(card, "exact", new Date(NOW.getTime() + elapsed));
      elapsed = new Date(card.due).getTime() - NOW.getTime();
    }

    expect(card.stability).toBeGreaterThan(1);
    expect(card.reps).toBe(5);
  });

  it("round-trips through the serialisable card shape", () => {
    const next = scheduleNext(newMemoryCard(NOW), "exact", NOW);
    expect(JSON.parse(JSON.stringify(next))).toEqual(next);
    expect(typeof next.due).toBe("string");
  });
});

describe("due dates", () => {
  it("treats the due moment itself as due", () => {
    const card = { ...newMemoryCard(NOW), due: NOW.toISOString() };
    expect(isDue(card, NOW)).toBe(true);
    expect(overdueBy(card, NOW)).toBe(0);
  });

  it("is not due ahead of the due date", () => {
    const card = { ...newMemoryCard(NOW), due: new Date(NOW.getTime() + DAY_MS).toISOString() };
    expect(isDue(card, NOW)).toBe(false);
    expect(overdueBy(card, NOW)).toBeLessThan(0);
  });

  it("measures how overdue a card is", () => {
    const card = { ...newMemoryCard(NOW), due: new Date(NOW.getTime() - 2 * DAY_MS).toISOString() };
    expect(overdueBy(card, NOW)).toBe(2 * DAY_MS);
  });
});

describe("initialConceptState", () => {
  it("starts a concept new and unattempted", () => {
    const concept = makeConcept({ id: "concept-1" });
    const state = initialConceptState(concept, NOW);

    expect(state).toMatchObject({
      conceptId: "concept-1",
      lectureId: concept.lectureId,
      courseId: concept.courseId,
      mastery: "new",
      attempts: 0,
      lapses: 0,
      lastQuality: null,
      weakSince: null,
    });
  });
});
