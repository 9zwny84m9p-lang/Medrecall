"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { ConceptState, ReviewLogEntry } from "@/lib/domain/types";
import type { SessionProgress } from "@/lib/engine/session";

import {
  EMPTY_SNAPSHOT,
  MemoryRepository,
  parseSnapshot,
  type LearnerRepository,
  type LearnerSnapshot,
} from "./repository";

/**
 * IndexedDB-backed learner state.
 *
 * IndexedDB rather than localStorage because a review log grows without bound
 * and localStorage is a synchronous ~5MB bucket that blocks the main thread —
 * the wrong shape for something written after every single answer.
 */

const DB_NAME = "medrecall";
const DB_VERSION = 1;

interface MedRecallDB extends DBSchema {
  conceptStates: { key: string; value: ConceptState };
  sessions: { key: string; value: SessionProgress };
  reviewLog: { key: string; value: ReviewLogEntry };
}

async function open(): Promise<IDBPDatabase<MedRecallDB>> {
  return openDB<MedRecallDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("conceptStates")) {
        db.createObjectStore("conceptStates", { keyPath: "conceptId" });
      }
      if (!db.objectStoreNames.contains("sessions")) {
        db.createObjectStore("sessions", { keyPath: "lectureId" });
      }
      if (!db.objectStoreNames.contains("reviewLog")) {
        db.createObjectStore("reviewLog", { keyPath: "id" });
      }
    },
  });
}

export class IndexedDbRepository implements LearnerRepository {
  #db: Promise<IDBPDatabase<MedRecallDB>> | null = null;

  #connection(): Promise<IDBPDatabase<MedRecallDB>> {
    this.#db ??= open();
    return this.#db;
  }

  async load(): Promise<LearnerSnapshot> {
    const db = await this.#connection();
    const [conceptStates, sessions, reviewLog] = await Promise.all([
      db.getAll("conceptStates"),
      db.getAll("sessions"),
      db.getAll("reviewLog"),
    ]);

    return parseSnapshot({ conceptStates, sessions, reviewLog });
  }

  async saveConceptState(state: ConceptState): Promise<void> {
    (await this.#connection()).put("conceptStates", state);
  }

  async saveSession(progress: SessionProgress): Promise<void> {
    (await this.#connection()).put("sessions", progress);
  }

  async appendReview(entry: ReviewLogEntry): Promise<void> {
    (await this.#connection()).put("reviewLog", entry);
  }

  async clear(): Promise<void> {
    const db = await this.#connection();
    await Promise.all([
      db.clear("conceptStates"),
      db.clear("sessions"),
      db.clear("reviewLog"),
    ]);
  }
}

/**
 * A repository that works wherever it finds itself.
 *
 * Private browsing and locked-down enterprise profiles can refuse IndexedDB
 * outright. Falling back to memory keeps the session usable for as long as the
 * tab is open, which beats an error page, and `persistent` lets the UI tell the
 * student their progress will not survive a reload.
 */
export async function createRepository(): Promise<{
  repository: LearnerRepository;
  persistent: boolean;
}> {
  if (typeof indexedDB === "undefined") {
    return { repository: new MemoryRepository(), persistent: false };
  }

  const repository = new IndexedDbRepository();
  try {
    await repository.load();
    return { repository, persistent: true };
  } catch {
    return { repository: new MemoryRepository(EMPTY_SNAPSHOT), persistent: false };
  }
}
