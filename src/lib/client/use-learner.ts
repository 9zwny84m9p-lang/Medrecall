"use client";

import { useSyncExternalStore } from "react";

import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
  type LearnerSnapshotView,
} from "./learner-store";

/** Subscribe a component to learner state. */
export function useLearner(): LearnerSnapshotView {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
