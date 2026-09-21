"use client";

import Link from "next/link";

import { Badge, BUTTON_PRIMARY, CARD, MASTERY_STYLE, cn } from "@/components/ui";
import { useLearner } from "@/lib/client/use-learner";
import type { CourseBundle } from "@/lib/content/bundle";
import { MASTERY_LABELS } from "@/lib/domain/mastery";
import { isLectureUnlocked, lectureProgress } from "@/lib/engine/progress";

/**
 * A course's lectures, with the unlock rule made visible.
 *
 * A locked lecture says what would unlock it rather than just refusing — the
 * gate is a teaching decision, so the student should be able to see the reason.
 */
export function LectureList({ bundle }: { bundle: CourseBundle }) {
  const learner = useLearner();

  if (!learner.ready) {
    return <p className="text-muted">Loading your progress…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-muted hover:underline">
          ← All courses
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{bundle.course.title}</h1>
        <p className="text-muted">{bundle.course.subject}</p>
      </header>

      <ol className="flex flex-col gap-4">
        {bundle.lectures.map((lecture) => {
          const unlocked = isLectureUnlocked(
            lecture,
            bundle.course,
            bundle.concepts,
            learner.states,
          );
          const progress = lectureProgress(lecture.id, bundle.concepts, learner.states);
          const concepts = bundle.concepts.filter(
            (concept) => concept.lectureId === lecture.id,
          );

          return (
            <li key={lecture.id}>
              <article className={cn(CARD, "flex flex-col gap-4", !unlocked && "opacity-70")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {lecture.order}. {lecture.title}
                    </h2>
                    <p className="text-sm text-muted">
                      {progress.attempted}/{progress.total} concepts met
                      {progress.weak > 0 ? ` · ${progress.weak} weak` : ""}
                    </p>
                  </div>
                  {progress.sufficient ? (
                    <Badge className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                      Learned
                    </Badge>
                  ) : unlocked ? (
                    <Badge className="bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-100">
                      Available
                    </Badge>
                  ) : (
                    <Badge>Locked</Badge>
                  )}
                </div>

                <ul className="flex flex-wrap gap-2">
                  {concepts.map((concept) => {
                    const mastery = learner.states.get(concept.id)?.mastery ?? "new";
                    return (
                      <li key={concept.id}>
                        <Badge className={MASTERY_STYLE[mastery]}>
                          {concept.title} · {MASTERY_LABELS[mastery]}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>

                {unlocked ? (
                  <Link href={`/learn/${lecture.id}`} className={BUTTON_PRIMARY}>
                    {progress.attempted === 0 ? "Start" : "Continue"} {lecture.title}
                  </Link>
                ) : (
                  <p className="text-sm text-muted text-pretty">
                    Unlocks once the previous lecture is sufficiently learned — every
                    concept met, with no more than 40% still weak.
                  </p>
                )}
              </article>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
