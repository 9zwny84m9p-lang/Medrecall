import { describe, expect, it } from "vitest";

import { MemoryRepository, parseSnapshot } from "./repository";
import { initialConceptState } from "@/lib/engine/scheduler";
import { makeConcept } from "@/lib/test-support/factories";
import type { SessionProgress } from "@/lib/engine/session";

const NOW = new Date("2026-09-21T12:00:00.000Z");
const CONCEPT = makeConcept({ id: "concept-1" });
const STATE = initialConceptState(CONCEPT, NOW);

const SESSION: SessionProgress = {
  lectureId: "lecture-1",
  chunksTaught: 1,
  queue: [{ kind: "retrieve", conceptId: "concept-1", itemId: "item-1", context: "checkpoint" }],
  retrievalsSinceInterleave: 1,
  interleaved: [],
  answered: 2,
  completed: false,
};

describe("parseSnapshot", () => {
  it("round-trips valid records", () => {
    const snapshot = parseSnapshot({
      conceptStates: [STATE],
      sessions: [SESSION],
      reviewLog: [
        {
          id: "log-1",
          conceptId: "concept-1",
          itemId: "item-1",
          context: "checkpoint",
          quality: "exact",
          reviewedAt: NOW.toISOString(),
        },
      ],
    });

    expect(snapshot.conceptStates["concept-1"]).toEqual(STATE);
    expect(snapshot.sessions["lecture-1"]).toEqual(SESSION);
    expect(snapshot.reviewLog).toHaveLength(1);
  });

  it("drops a corrupt record without losing the rest", () => {
    const snapshot = parseSnapshot({
      conceptStates: [STATE, { conceptId: "broken" }, null],
      sessions: [SESSION, { lectureId: 42 }],
      reviewLog: [{ nope: true }],
    });

    expect(Object.keys(snapshot.conceptStates)).toEqual(["concept-1"]);
    expect(Object.keys(snapshot.sessions)).toEqual(["lecture-1"]);
    expect(snapshot.reviewLog).toEqual([]);
  });

  it("rejects a state with a mastery value it does not recognise", () => {
    const snapshot = parseSnapshot({
      conceptStates: [{ ...STATE, mastery: "mastered" }],
      sessions: [],
      reviewLog: [],
    });

    expect(snapshot.conceptStates).toEqual({});
  });

  it("rejects a session queue step it does not recognise", () => {
    const snapshot = parseSnapshot({
      conceptStates: [],
      sessions: [{ ...SESSION, queue: [{ kind: "dance" }] }],
      reviewLog: [],
    });

    expect(snapshot.sessions).toEqual({});
  });

  it("returns an empty snapshot for empty storage", () => {
    expect(parseSnapshot({ conceptStates: [], sessions: [], reviewLog: [] })).toEqual({
      conceptStates: {},
      sessions: {},
      reviewLog: [],
    });
  });
});

describe("MemoryRepository", () => {
  it("stores and returns concept state", async () => {
    const repository = new MemoryRepository();
    await repository.saveConceptState(STATE);

    expect((await repository.load()).conceptStates["concept-1"]).toEqual(STATE);
  });

  it("overwrites state for the same concept rather than duplicating it", async () => {
    const repository = new MemoryRepository();
    await repository.saveConceptState(STATE);
    await repository.saveConceptState({ ...STATE, attempts: 3 });

    const loaded = await repository.load();
    expect(Object.keys(loaded.conceptStates)).toHaveLength(1);
    expect(loaded.conceptStates["concept-1"]?.attempts).toBe(3);
  });

  it("keeps one session per lecture", async () => {
    const repository = new MemoryRepository();
    await repository.saveSession(SESSION);
    await repository.saveSession({ ...SESSION, answered: 9 });

    const loaded = await repository.load();
    expect(loaded.sessions["lecture-1"]?.answered).toBe(9);
  });

  it("appends to the review log", async () => {
    const repository = new MemoryRepository();
    const entry = {
      id: "log-1",
      conceptId: "concept-1",
      itemId: "item-1",
      context: "checkpoint" as const,
      quality: "exact" as const,
      reviewedAt: NOW.toISOString(),
    };

    await repository.appendReview(entry);
    await repository.appendReview({ ...entry, id: "log-2" });

    expect((await repository.load()).reviewLog).toHaveLength(2);
  });

  it("hands back a copy, so callers cannot mutate stored state", async () => {
    const repository = new MemoryRepository();
    await repository.saveConceptState(STATE);

    const loaded = await repository.load();
    delete loaded.conceptStates["concept-1"];

    expect((await repository.load()).conceptStates["concept-1"]).toEqual(STATE);
  });

  it("clears everything", async () => {
    const repository = new MemoryRepository();
    await repository.saveConceptState(STATE);
    await repository.saveSession(SESSION);
    await repository.clear();

    expect(await repository.load()).toEqual({
      conceptStates: {},
      sessions: {},
      reviewLog: [],
    });
  });
});
