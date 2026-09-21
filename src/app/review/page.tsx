import type { Metadata } from "next";

import { Badge, CARD, cn } from "@/components/ui";
import { listApprovedConcepts, listDraftConcepts } from "@/lib/content/registry";

export const metadata: Metadata = {
  title: "Concept review",
  description: "Approve, fix or discard extracted concepts before they enter the curriculum.",
};

/**
 * The approval queue.
 *
 * Read-only in Milestone 1: the demo course ships with authored Concepts, so
 * there is nothing yet for a human to approve. What this page does show — and
 * what the tests assert — is that the draft Concepts on record are visible here
 * and nowhere else in the product. Approve/fix/discard controls land with the
 * PDF ingestion pipeline in Milestone 2, when there will be drafts worth acting
 * on; see ROADMAP.md.
 */
export default function ReviewPage() {
  const drafts = listDraftConcepts();
  const approved = listApprovedConcepts();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Concept review</h1>
        <p className="max-w-2xl text-muted text-pretty">
          Concepts extracted from source material are proposals, not curriculum. Until
          one is approved it cannot be taught, retrieved, scheduled, interleaved or
          counted towards mastery — a rule enforced in the domain layer, not just here.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold">Awaiting review</h2>
          <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            {drafts.length} draft{drafts.length === 1 ? "" : "s"}
          </Badge>
        </div>

        {drafts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
            Nothing is waiting on you.
          </p>
        ) : (
          drafts.map((concept) => (
            <article key={concept.id} className={cn(CARD, "flex flex-col gap-3")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-lg font-semibold">{concept.title}</h3>
                <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                  Draft — not in use
                </Badge>
              </div>
              <p className="text-sm text-muted text-pretty">{concept.summary}</p>
              <p className="text-xs text-muted">
                Source: page {concept.source.pageNumber} of{" "}
                {concept.source.documentId.replace(/^doc-/, "").replace(/-/g, " ")}
              </p>
            </article>
          ))
        )}

        <p className="text-sm text-muted text-pretty">
          Approve, fix and discard controls arrive with the PDF ingestion pipeline in
          Milestone 2, when there are extracted drafts to act on.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">In the curriculum</h2>
        <p className="text-sm text-muted">
          {approved.length} approved concept{approved.length === 1 ? "" : "s"} across your
          courses.
        </p>
      </section>
    </div>
  );
}
