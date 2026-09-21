"use client";

import Link from "next/link";

import { Badge, BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, cn } from "@/components/ui";
import { useLearner } from "@/lib/client/use-learner";
import type { CourseBundle } from "@/lib/content/bundle";
import { buildTodayQueue } from "@/lib/engine/today";
import { lectureProgress, nextLectureFor } from "@/lib/engine/progress";

/**
 * The home screen.
 *
 * "Continue learning" is the only decision a student should have to make: it
 * resolves to the first unlocked, unfinished lecture, so the product decides
 * what comes next rather than asking.
 */
export function CourseList({ bundles }: { bundles: CourseBundle[] }) {
  const learner = useLearner();

  const allConcepts = bundles.flatMap((bundle) => bundle.concepts);
  const due = learner.ready
    ? buildTodayQueue(allConcepts, learner.states, new Date())
    : [];

  const primary = bundles[0];
  const nextLecture =
    learner.ready && primary
      ? nextLectureFor(primary.course, primary.lectures, primary.concepts, learner.states)
      : null;

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-5">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Learn the lecture. Keep the lecture.
        </h1>
        <p className="max-w-2xl text-lg text-muted text-pretty">
          MedRecall teaches a course concept by concept, checks what you have actually
          understood, and brings back what you are shaky on while you learn the next
          lecture.
        </p>

        <div className="flex flex-wrap gap-3">
          {nextLecture ? (
            <Link href={`/learn/${nextLecture.id}`} className={BUTTON_PRIMARY}>
              Continue learning · {nextLecture.title}
            </Link>
          ) : (
            <span className={cn(BUTTON_PRIMARY, "pointer-events-none opacity-60")}>
              Loading your progress…
            </span>
          )}
          <Link href="/review" className={BUTTON_SECONDARY}>
            Review extracted concepts
          </Link>
        </div>

        {learner.ready ? (
          <p className="text-sm text-muted">
            {due.length === 0
              ? "Nothing is due for review yet — it appears here once you have answered some questions."
              : `${due.length} concept${due.length === 1 ? "" : "s"} due or flagged weak across your courses.`}
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Your courses</h2>

        {bundles.map((bundle) => (
          <article key={bundle.course.id} className={cn(CARD, "flex flex-col gap-4")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{bundle.course.title}</h3>
                <p className="text-sm text-muted">{bundle.course.subject}</p>
              </div>
              <Badge>
                {bundle.lectures.length} lecture{bundle.lectures.length === 1 ? "" : "s"}
              </Badge>
            </div>

            <ul className="flex flex-col gap-1.5 text-sm text-muted">
              {bundle.lectures.map((lecture) => {
                const progress = learner.ready
                  ? lectureProgress(lecture.id, bundle.concepts, learner.states)
                  : null;

                return (
                  <li key={lecture.id} className="flex items-center justify-between gap-3">
                    <span>{lecture.title}</span>
                    <span>
                      {progress ? `${progress.attempted}/${progress.total}` : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>

            <Link href={`/courses/${bundle.course.id}`} className={BUTTON_SECONDARY}>
              Open {bundle.course.title}
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}
