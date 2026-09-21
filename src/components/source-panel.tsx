"use client";

import type { Concept } from "@/lib/domain/types";

/**
 * "View source" — the traceability guarantee, made visible.
 *
 * Every Concept knows the document, page and excerpt it came from, so a student
 * who doubts a claim can check it against their own lecture rather than taking
 * MedRecall's word for it. A `<details>` element keeps it one tap away without
 * competing with the teaching text.
 */
export function SourcePanel({ concept }: { concept: Concept }) {
  const { source } = concept;

  return (
    <details className="group rounded-xl border border-border bg-surface-muted/60">
      <summary className="flex min-h-touch cursor-pointer list-none items-center gap-2 px-4 text-sm font-medium text-muted transition-colors hover:text-foreground">
        <span aria-hidden className="transition-transform group-open:rotate-90">
          ›
        </span>
        View source · page {source.pageNumber}
      </summary>
      <div className="border-t border-border px-4 py-3">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">
          {source.documentId.replace(/^doc-/, "").replace(/-/g, " ")} · page{" "}
          {source.pageNumber}
        </p>
        <blockquote className="mt-2 border-l-2 border-brand-400 pl-3 text-sm text-pretty">
          {source.excerpt}
        </blockquote>
      </div>
    </details>
  );
}
