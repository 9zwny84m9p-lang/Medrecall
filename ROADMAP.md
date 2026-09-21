# Roadmap

Ordered by what unblocks the most. The adaptive learning engine comes first;
everything else is in service of it.

## Milestone 1 — the learning loop ✅

The core product, end to end, on a deterministic demo course with no AI
credentials required.

- Concept-centred domain model with source grounding
- Approval gate enforced in the domain layer
- FSRS scheduling, mastery states, weakness that only spaced retrieval clears
- Teaching chunks → retrieval checkpoints → re-teach → spaced retry
- Cross-lecture interleaving and lecture gating
- Free-text grading on the server, answer keys never in the browser
- `AIProvider` seam with deterministic and Anthropic implementations
- IndexedDB persistence across reloads
- iPad-first UI, unit tests, end-to-end journey test, CI, Vercel deploy

## Milestone 2 — real material in, real drafts reviewed

Turn MedRecall from "works on the demo course" into "works on your Pathology
PDFs". This is the milestone that makes the approval gate earn its keep.

1. **PDF ingestion.** `pdfjs-dist` → pages with text and page numbers. Source
   references point at real pages, so "View source" works on uploaded material.
2. **Concept extraction.** `AIProvider.extractConcepts` against Anthropic.
   Everything lands as `draft`.
3. **The review queue.** Approve / fix / discard, with the source excerpt beside
   each proposal. The domain gate already exists; this is the UI for it.
4. **Item generation.** `generateRetrievalItems` per approved Concept, reviewable
   the same way.
5. **Prerequisite linking.** Extraction proposes `prerequisiteIds`; the learning
   graph starts to mean something.

**Risk to watch:** extraction quality decides whether review is a quick pass or
a chore. If a human ends up rewriting most proposals, the pipeline is not ready
and shipping it would train the user to rubber-stamp.

## Milestone 3 — the Today queue and semantic grading

1. **Today across courses.** `engine/today.ts` already builds a fair,
   round-robin queue; it needs a screen and a review session that runs Concepts
   outside a lecture.
2. **Semantic grading by default.** The Anthropic grader exists but is not the
   default. Switching it on needs a comparison against the lexical grader on
   real answers — the lexical one is the reference behaviour, and a model that
   is more lenient in the wrong places is worse than no change.
3. **Remediation worth reading.** Model-generated re-teaching that addresses the
   specific gap, rather than restating the Concept summary.
4. **Clinical application items.** A fifth retrieval kind — a vignette that
   makes the student apply the Concept rather than state it.

## Milestone 4 — accounts and sync

1. **Supabase.** A `LearnerRepository` implementation over Postgres. Nothing
   above `persistence/` changes.
2. **Auth**, and courses that belong to a user.
3. **Device sync**, so an iPad session continues on a laptop.
4. **Offline-tolerant grading.** Grading is a server round trip today; a queued
   answer that grades when connectivity returns would keep a session usable on a
   train.

## Later

- Image occlusion and page masking — additive as new `RetrievalKind`s
- FSRS parameter optimisation from a user's own review log
- Shared or importable courses
- A defensible mastery estimate to sit alongside the named states

## Deliberately not being built

Social features, followers, a marketplace, leaderboards, payments, university
administration, a native mobile app, and gamification beyond what the learning
loop itself needs. None of them make the tutor better at teaching, and each one
would compete for the effort that does.
