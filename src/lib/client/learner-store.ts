"use client";

import type { Concept, ConceptState, GradeResult } from "@/lib/domain/types";
import { recordAnswer } from "@/lib/engine/tutor";
import {
  completeRetrieval,
  completeReteaching,
  completeTeaching,
  currentStep,
  startSession,
  type LecturePlan,
  type SessionProgress,
  type SessionStep,
} from "@/lib/engine/session";
import { createRepository } from "@/lib/persistence/indexeddb";
import {
  EMPTY_SNAPSHOT,
  type LearnerRepository,
  type LearnerSnapshot,
} from "@/lib/persistence/repository";

/**
 * The single client-side store for learner state.
 *
 * It owns the read-modify-write cycle for one answer: grade on the server,
 * advance FSRS and mastery, persist, then let the session engine decide what
 * comes next. Components read a snapshot and call actions; none of them touch
 * IndexedDB or the engine directly.
 */

export interface LearnerSnapshotView {
  states: Map<string, ConceptState>;
  sessions: Map<string, SessionProgress>;
  ready: boolean;
  /** False when IndexedDB is unavailable and progress will not survive a reload. */
  persistent: boolean;
}

const INITIAL: LearnerSnapshotView = {
  states: new Map(),
  sessions: new Map(),
  ready: false,
  persistent: true,
};

let snapshot: LearnerSnapshotView = INITIAL;
let repository: LearnerRepository | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: LearnerSnapshotView): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

function toView(raw: LearnerSnapshot, persistent: boolean): LearnerSnapshotView {
  return {
    states: new Map(Object.entries(raw.conceptStates)),
    sessions: new Map(Object.entries(raw.sessions)),
    ready: true,
    persistent,
  };
}

async function hydrate(): Promise<void> {
  const { repository: repo, persistent } = await createRepository();
  repository = repo;

  try {
    publish(toView(await repo.load(), persistent));
  } catch {
    publish(toView(EMPTY_SNAPSHOT, false));
  }
}

export function getSnapshot(): LearnerSnapshotView {
  return snapshot;
}

/** Server and hydration renders agree on an empty, not-ready store. */
export function getServerSnapshot(): LearnerSnapshotView {
  return INITIAL;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  loading ??= hydrate();
  return () => {
    listeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/** Resume the saved session for a lecture, or start a fresh one. */
export function sessionFor(plan: LecturePlan): SessionProgress {
  const existing = snapshot.sessions.get(plan.lectureId);
  if (existing && !existing.completed) return existing;
  if (existing?.completed) return existing;
  return startSession(plan);
}

export function stepFor(plan: LecturePlan): SessionStep {
  return currentStep(sessionFor(plan), plan);
}

async function persistSession(progress: SessionProgress): Promise<void> {
  const sessions = new Map(snapshot.sessions);
  sessions.set(progress.lectureId, progress);
  publish({ ...snapshot, sessions });
  await repository?.saveSession(progress);
}

export async function acknowledgeTeaching(plan: LecturePlan): Promise<void> {
  const progress = completeTeaching(sessionFor(plan), plan, snapshot.states);
  await persistSession(progress);
}

export async function acknowledgeReteaching(plan: LecturePlan): Promise<void> {
  const progress = completeReteaching(sessionFor(plan), plan, snapshot.states);
  await persistSession(progress);
}

/** Begin a lecture again from the top, discarding the saved session. */
export async function restartSession(plan: LecturePlan): Promise<void> {
  await persistSession(startSession(plan));
}

// ---------------------------------------------------------------------------
// Answering
// ---------------------------------------------------------------------------

export interface AnswerOutcome {
  result: GradeResult;
  remediation: string | null;
  state: ConceptState;
}

/**
 * Grade an answer and update the student's memory of that Concept.
 *
 * This deliberately does not move the session on. The student needs to read
 * their feedback before the next step replaces it, so advancing is a separate
 * call made when they choose to continue.
 */
export async function submitAnswer(input: {
  plan: LecturePlan;
  concept: Concept;
  itemId: string;
  answer: string;
  now?: Date;
}): Promise<AnswerOutcome> {
  const { result, remediation } = await gradeOnServer(input.itemId, input.answer);

  const head = sessionFor(input.plan).queue[0];
  const context = head?.kind === "retrieve" ? head.context : "checkpoint";

  const { state, logEntry } = recordAnswer({
    concept: input.concept,
    previous: snapshot.states.get(input.concept.id),
    itemId: input.itemId,
    result,
    context,
    now: input.now,
  });

  const states = new Map(snapshot.states);
  states.set(state.conceptId, state);
  publish({ ...snapshot, states });

  await Promise.all([
    repository?.saveConceptState(state),
    repository?.appendReview(logEntry),
  ]);

  return { result, remediation, state };
}

/**
 * Move past a graded answer.
 *
 * The session advances against the *updated* state map, so the follow-up
 * question and any interleaving decision see the answer that was just given.
 */
export async function advanceAfterAnswer(
  plan: LecturePlan,
  result: GradeResult,
  now?: Date,
): Promise<void> {
  const advanced = completeRetrieval(sessionFor(plan), plan, snapshot.states, result, now);
  await persistSession(advanced);
}

async function gradeOnServer(
  itemId: string,
  answer: string,
): Promise<{ result: GradeResult; remediation: string | null }> {
  const response = await fetch("/api/grade", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ itemId, answer }),
  });

  if (!response.ok) {
    throw new Error(`Grading failed (${response.status}).`);
  }

  return (await response.json()) as {
    result: GradeResult;
    remediation: string | null;
  };
}

/** Test seam: forget everything held in memory. */
export function resetLearnerStore(): void {
  snapshot = INITIAL;
  repository = null;
  loading = null;
  listeners.clear();
}
