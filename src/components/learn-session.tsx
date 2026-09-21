"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { SourcePanel } from "@/components/source-panel";
import {
  Badge,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  CARD,
  FIELD,
  MASTERY_STYLE,
  cn,
} from "@/components/ui";
import {
  acknowledgeReteaching,
  acknowledgeTeaching,
  advanceAfterAnswer,
  restartSession,
  sessionFor,
  stepFor,
  submitAnswer,
  type AnswerOutcome,
} from "@/lib/client/learner-store";
import { useLearner } from "@/lib/client/use-learner";
import type { LectureBundle } from "@/lib/content/bundle";
import { MASTERY_LABELS } from "@/lib/domain/mastery";
import type { GradeResult, RetrievalKind } from "@/lib/domain/types";
import { buildLecturePlan } from "@/lib/engine/session";
import { lectureProgress } from "@/lib/engine/progress";

const KIND_LABEL: Record<RetrievalKind, string> = {
  basic: "Recall",
  cloze: "Fill the gap",
  mechanism: "Mechanism",
  free_recall: "Free recall",
};

const QUALITY_STYLE: Record<GradeResult["quality"], string> = {
  exact: "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/60",
  partial: "border-amber-400 bg-amber-50 dark:bg-amber-950/60",
  incorrect: "border-red-400 bg-red-50 dark:bg-red-950/60",
};

const QUALITY_LABEL: Record<GradeResult["quality"], string> = {
  exact: "Correct",
  partial: "Partly there",
  incorrect: "Not yet",
};

export function LearnSession({ bundle }: { bundle: LectureBundle }) {
  const learner = useLearner();

  const plan = useMemo(
    () =>
      buildLecturePlan({
        lectureId: bundle.lecture.id,
        lectureConcepts: bundle.concepts,
        priorConcepts: bundle.priorConcepts,
        items: bundle.items,
      }),
    [bundle],
  );

  const [outcome, setOutcome] = useState<AnswerOutcome | null>(null);
  // Held separately from `outcome`: the re-teaching text has to survive past the
  // feedback panel into the re-teaching step that follows it.
  const [remediation, setRemediation] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!learner.ready) {
    return <p className="text-muted">Loading your progress…</p>;
  }

  const session = sessionFor(plan);
  const step = stepFor(plan);
  const progress = lectureProgress(bundle.lecture.id, bundle.concepts, learner.states);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleContinueTeaching() {
    await run(() => acknowledgeTeaching(plan));
  }

  async function handleContinueReteaching() {
    await run(() => acknowledgeReteaching(plan));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step.kind !== "retrieve" || outcome) return;

    const concept = plan.concepts.get(step.conceptId);
    if (!concept) return;

    setBusy(true);
    setError(null);
    try {
      const result = await submitAnswer({
        plan,
        concept,
        itemId: step.itemId,
        answer,
      });
      setOutcome(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Grading failed.");
    } finally {
      setBusy(false);
    }
  }

  /** Read the feedback, then move on — this is where the session advances. */
  async function handleNext() {
    if (!outcome) return;

    setRemediation(outcome.remediation);
    await run(() => advanceAfterAnswer(plan, outcome.result));
    setOutcome(null);
    setAnswer("");
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link href={`/courses/${bundle.course.id}`} className="text-sm text-muted hover:underline">
          ← {bundle.course.title}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{bundle.lecture.title}</h1>
          <Badge className="bg-surface-muted text-muted">
            {progress.attempted}/{progress.total} concepts met
          </Badge>
        </div>
      </header>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/60 dark:text-red-100">
          {error}
        </p>
      ) : null}

      {!learner.persistent ? (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100">
          This browser is blocking local storage, so this session will not survive a reload.
        </p>
      ) : null}

      {step.kind === "teach" ? (
        <TeachingStep
          conceptIds={step.conceptIds}
          plan={plan}
          pageStart={step.chunk.pageStart}
          pageEnd={step.chunk.pageEnd}
          busy={busy}
          onContinue={handleContinueTeaching}
        />
      ) : null}

      {step.kind === "reteach" ? (
        <ReteachingStep
          title={plan.concepts.get(step.conceptId)?.title ?? "That concept"}
          text={remediation ?? plan.concepts.get(step.conceptId)?.explanation ?? ""}
          busy={busy}
          onContinue={async () => {
            setRemediation(null);
            await handleContinueReteaching();
          }}
        />
      ) : null}

      {step.kind === "retrieve" ? (
        <RetrievalStep
          key={`${step.itemId}:${session.answered}`}
          prompt={bundle.items.find((item) => item.id === step.itemId)?.prompt ?? ""}
          kind={bundle.items.find((item) => item.id === step.itemId)?.kind ?? "basic"}
          conceptTitle={plan.concepts.get(step.conceptId)?.title ?? ""}
          interleaved={step.context === "interleaved"}
          reinforcing={step.context === "reinforce"}
          answer={answer}
          onAnswerChange={setAnswer}
          onSubmit={handleSubmit}
          outcome={outcome}
          busy={busy}
          onNext={handleNext}
          mastery={
            outcome ? MASTERY_LABELS[outcome.state.mastery] : null
          }
          masteryClass={outcome ? MASTERY_STYLE[outcome.state.mastery] : ""}
        />
      ) : null}

      {step.kind === "complete" ? (
        <CompleteStep
          bundle={bundle}
          answered={session.answered}
          sufficient={progress.sufficient}
          weak={progress.weak}
          onRestart={() => run(() => restartSession(plan))}
          busy={busy}
        />
      ) : null}
    </div>
  );
}

function TeachingStep({
  conceptIds,
  plan,
  pageStart,
  pageEnd,
  busy,
  onContinue,
}: {
  conceptIds: string[];
  plan: ReturnType<typeof buildLecturePlan>;
  pageStart: number;
  pageEnd: number;
  busy: boolean;
  onContinue: () => void;
}) {
  return (
    <section className="flex flex-col gap-5" aria-label="Teaching">
      <p className="text-sm font-medium tracking-wide text-muted uppercase">
        Teaching · pages {pageStart}
        {pageEnd !== pageStart ? `–${pageEnd}` : ""}
      </p>

      {conceptIds.map((conceptId) => {
        const concept = plan.concepts.get(conceptId);
        if (!concept) return null;

        return (
          <article key={conceptId} className={cn(CARD, "flex flex-col gap-4")}>
            <h2 className="text-xl font-semibold">{concept.title}</h2>
            <p className="teaching-prose text-pretty">{concept.explanation}</p>
            <SourcePanel concept={concept} />
          </article>
        );
      })}

      <button type="button" className={BUTTON_PRIMARY} onClick={onContinue} disabled={busy}>
        I&rsquo;ve read this — check my understanding
      </button>
    </section>
  );
}

function ReteachingStep({
  title,
  text,
  busy,
  onContinue,
}: {
  title: string;
  text: string;
  busy: boolean;
  onContinue: () => void;
}) {
  return (
    <section className="flex flex-col gap-5" aria-label="Re-teaching">
      <p className="text-sm font-medium tracking-wide text-muted uppercase">
        Let&rsquo;s go back over this
      </p>
      <article className={cn(CARD, "flex flex-col gap-4 border-brand-200")}>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="teaching-prose whitespace-pre-line text-pretty">{text}</p>
      </article>
      <button type="button" className={BUTTON_PRIMARY} onClick={onContinue} disabled={busy}>
        Try that one again
      </button>
    </section>
  );
}

function RetrievalStep({
  prompt,
  kind,
  conceptTitle,
  interleaved,
  reinforcing,
  answer,
  onAnswerChange,
  onSubmit,
  outcome,
  busy,
  onNext,
  mastery,
  masteryClass,
}: {
  prompt: string;
  kind: RetrievalKind;
  conceptTitle: string;
  interleaved: boolean;
  reinforcing: boolean;
  answer: string;
  onAnswerChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  outcome: AnswerOutcome | null;
  busy: boolean;
  onNext: () => void;
  mastery: string | null;
  masteryClass: string;
}) {
  return (
    <section className="flex flex-col gap-4" aria-label="Retrieval">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-100">
          {KIND_LABEL[kind]}
        </Badge>
        {interleaved ? (
          <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            From an earlier lecture
          </Badge>
        ) : null}
        {reinforcing ? (
          <Badge className="bg-surface-muted text-muted">Once more</Badge>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className={cn(CARD, "flex flex-col gap-4")}>
        <h2 className="text-xl font-semibold text-pretty">{prompt}</h2>

        <label htmlFor="answer" className="sr-only">
          Your answer
        </label>
        <textarea
          id="answer"
          name="answer"
          rows={4}
          className={FIELD}
          value={answer}
          onChange={(event) => onAnswerChange(event.target.value)}
          placeholder="Answer in your own words…"
          readOnly={Boolean(outcome)}
          autoFocus
        />

        {!outcome ? (
          <button type="submit" className={BUTTON_PRIMARY} disabled={busy}>
            {busy ? "Checking…" : "Check my answer"}
          </button>
        ) : null}
      </form>

      {outcome ? (
        <div
          role="status"
          className={cn(
            "flex flex-col gap-3 rounded-2xl border-2 p-5",
            QUALITY_STYLE[outcome.result.quality],
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold">
              {QUALITY_LABEL[outcome.result.quality]}
            </span>
            <Badge className="bg-white/70 text-foreground dark:bg-black/30">
              {conceptTitle}
            </Badge>
            {mastery ? <Badge className={masteryClass}>{mastery}</Badge> : null}
          </div>

          <p className="text-pretty">{outcome.result.feedback}</p>

          {outcome.result.modelAnswer ? (
            <p className="text-sm text-pretty">
              <span className="font-semibold">Model answer: </span>
              {outcome.result.modelAnswer}
            </p>
          ) : null}

          <button type="button" className={BUTTON_SECONDARY} onClick={onNext} disabled={busy}>
            Continue
          </button>
        </div>
      ) : null}
    </section>
  );
}

function CompleteStep({
  bundle,
  answered,
  sufficient,
  weak,
  onRestart,
  busy,
}: {
  bundle: LectureBundle;
  answered: number;
  sufficient: boolean;
  weak: number;
  onRestart: () => void;
  busy: boolean;
}) {
  return (
    <section className={cn(CARD, "flex flex-col gap-4")} aria-label="Lecture complete">
      <h2 className="text-2xl font-semibold">{bundle.lecture.title} complete</h2>
      <p className="text-muted text-pretty">
        {answered} retrieval {answered === 1 ? "question" : "questions"} answered.
        {weak > 0
          ? ` ${weak} concept${weak === 1 ? "" : "s"} still need work — MedRecall will bring ${
              weak === 1 ? "it" : "them"
            } back while you learn the next lecture.`
          : " Nothing is flagged as weak."}
      </p>
      <p className="text-sm text-muted">
        {sufficient
          ? "The next lecture is unlocked."
          : "Work through the remaining concepts to unlock the next lecture."}
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href={`/courses/${bundle.course.id}`} className={BUTTON_PRIMARY}>
          Back to {bundle.course.title}
        </Link>
        <button type="button" className={BUTTON_SECONDARY} onClick={onRestart} disabled={busy}>
          Run this lecture again
        </button>
      </div>
    </section>
  );
}
