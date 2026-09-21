# Architecture

How MedRecall is put together, and why. Decisions are recorded with what they
cost, because the reason a thing was chosen is the part that gets lost.

## Why Concept is the central entity

A flashcard app's central entity is a Card. MedRecall's is a **Concept**: one
idea a student must understand, traceable back to the page it came from.

This is the decision everything else follows from, so it is worth being explicit
about what it buys:

- **A Concept can be tested many ways.** Basic recall, cloze, "why does this
  happen", free recall, and later clinical application or image occlusion, are
  all `RetrievalItem`s belonging to one Concept. If the Card were central, "the
  same idea asked four ways" would be four unrelated entities, and a student who
  knows the idea cold would still be drilled on all four.
- **Memory state belongs to the idea, not the question.** When a student is
  shaky on the sodium pump, they are shaky on the sodium pump — not on one
  particular phrasing. One `ConceptState` per Concept means the scheduler and
  the tutor reason about understanding rather than about question exposure.
- **Teaching has something to attach to.** A Card has a front and a back; there
  is nowhere to put an explanation. A Concept carries its own `explanation`, so
  teaching and retrieval are two views of one entity.
- **Prerequisites are expressible.** `prerequisiteIds` between Concepts is a
  learning graph. Between Cards it would be noise.

**Decision:** Concept is the central domain entity; `RetrievalItem` is a way to
test one.
**Reason:** understanding is the thing being modelled, and it is what teaching,
scheduling and mastery all need to hang off.
**Tradeoff:** more moving parts than a card list, and content authoring is
heavier — every Concept needs an explanation, a source reference and several
items, where a card needs a front and a back.
**Future implication:** new retrieval formats are additive. Adding image
occlusion means a new `RetrievalKind` and a renderer; no migration, no change to
scheduling or mastery.

## Layers

```
src/
  app/                    Routes. Server components fetch content; client components own interaction.
    api/grade/            Grading endpoint — see "Why grading is a server route"
    api/health/           Liveness probe and deploy smoke test
  components/             UI. Knows about steps and state; knows nothing about storage.
  lib/
    domain/               Types, the approval gate, mastery rules. No I/O, no React, no vendor SDK.
    engine/               Scheduling, selection, the session state machine, lecture progress, Today.
    grading/              Deterministic free-text grading.
    ai/                   AIProvider interface, the deterministic provider, the Anthropic provider.
    content/              The course catalogue and the demo course.
    persistence/          Repository interface, IndexedDB and in-memory implementations.
    client/               The one client-side store binding engine to persistence.
```

The dependency rule is one-directional: `domain` depends on nothing,
`engine` depends on `domain`, everything else depends on those. Nothing in
`domain` or `engine` imports React, a storage API or a vendor SDK, which is why
the entire adaptive behaviour is testable without a browser.

## The approval gate

**Decision:** unapproved Concepts are filtered out in the domain layer
(`domain/approval.ts`), not in the UI.
**Reason:** an AI-extracted Concept is a proposal, not curriculum. The rule that
matters — a draft never enters teaching, retrieval, scheduling, mastery,
interleaving or the Today queue — has to hold for every current and future
caller, including a background scheduler and an export with no UI at all.
**Tradeoff:** every selection path has to funnel through `activeConcepts`, which
is a discipline the type system does not enforce.
**Future implication:** the PDF pipeline can write drafts straight into the
store without any risk of them being taught before review.

`assertApproved` throws rather than skipping, for the one-Concept paths where a
filter cannot help (grading a specific answer). Silently skipping an unapproved
Concept would hide the bug; throwing surfaces it.

## FSRS decides *when*; MedRecall decides *what* and *how*

**Decision:** FSRS (via `ts-fsrs`) owns due dates only. Which Concept is worth
retrieving, and in what format, lives in `engine/selection.ts`.
**Reason:** FSRS is a memory model, not a curriculum. It has no notion of a
lecture, a prerequisite, or a Concept the student visibly struggled with two
minutes ago.
**Tradeoff:** two systems have to agree. A Concept can be "not due" by FSRS and
still be pulled in by the tutor for being weak.
**Future implication:** the scheduler can be retuned or replaced without
touching the tutoring logic, and vice versa.

Priority order when choosing what to bring back:

1. `weak` — the student actually got it wrong. A known gap.
2. `lapsed_due` — due, and has been wrong before.
3. `due` — due, clean history. A suspected gap.

## Mastery states, not percentages

**Decision:** five named states — `new`, `learning`, `weak`, `stable`, `strong`
— derived from FSRS stability plus the most recent result.
**Reason:** MedRecall has no defensible model for "73% mastered". A made-up
number invites a student to trust it and to plan around it.
**Tradeoff:** coarser. A student cannot see fine-grained movement within
`learning`.
**Future implication:** when there is a defensible model — calibrated against
real recall data — a number can be added *alongside* these states rather than
replacing them.

### Weakness is sticky on purpose

**Decision:** answering correctly immediately after being told the answer does
not clear `weak`. Only a spaced retrieval — interleaved from an earlier lecture,
or a scheduled review — does.
**Reason:** re-answering seconds after seeing the answer demonstrates nothing
about memory. If it cleared weakness, every wrong answer would be erased by the
reinforcement that follows it, and nothing would ever be interleaved.
**Tradeoff:** a student can feel they have "fixed" a Concept and still see it
marked weak.
**Future implication:** this is what makes the cross-lecture story work — the
weak Concept survives to be pulled into the next lecture, where getting it right
means something.

## The session state machine

`engine/session.ts` is a pure reducer over a queue of steps:

```
teach a chunk → checkpoint on what was just taught → grade → update state
  → wrong?  re-teach now, re-ask later
  → every few retrievals, pull in a weak Concept from an earlier lecture
  → next chunk → … → complete
```

**Decision:** re-teaching goes to the *front* of the queue; the retry goes to
the *back* of the current checkpoint.
**Reason:** an explanation lands while the gap is fresh, but being asked the same
question ten seconds after being told the answer tests short-term echo, not
recall. Splitting them gets both.
**Tradeoff:** a student may have forgotten the re-teaching by the time the retry
arrives — which is, in fact, the point.
**Future implication:** the gap is currently "the rest of this checkpoint". It
could become a tuned interval without changing the queue's shape.

**Decision:** grading and advancing are two separate calls
(`submitAnswer`, then `advanceAfterAnswer`).
**Reason:** they were one call, and the session moved on the instant an answer
was graded, so the feedback panel was replaced before the student could read it.
**Tradeoff:** the UI has to hold the graded result between the two calls.

## Why grading is a server route

**Decision:** `/api/grade` grades answers; `expectedPoints` and `modelAnswer`
never reach the browser. `content/registry.ts` builds public items field by
field, so a new field on `RetrievalItem` stays server-side unless someone names
it.
**Reason:** two things at once. The answer key cannot be read out of the
JavaScript bundle by a student who opens devtools, and swapping the deterministic
grader for a model is a server-side config change needing an API key the frontend
must never see.
**Tradeoff:** answering requires a round trip, so the app is not offline-capable
for grading.
**Future implication:** the same route serves whichever provider is configured;
nothing in the client changes when AI grading is switched on.

## The AI seam

`AIProvider` (`lib/ai/provider.ts`) is the only place the domain meets a model.

- `DeterministicProvider` is the default and is **not** a stub: teaching text
  comes from authored content and grading is the real lexical grader. That is
  what lets the learning engine be tested independently of model quality — a
  failing session test means the engine is wrong, not that a prompt drifted.
- `AnthropicProvider` implements what Milestone 1 routes through (grading and
  re-teaching) against the Messages API, with the lexical result as a fallback
  when a response is unusable. Concept extraction and item generation throw a
  clear error rather than shipping untested prompts behind a working-looking
  method; they arrive with the PDF pipeline.
- Both provider modules and the resolver are `server-only`, so importing them
  from a client component is a build error rather than a leaked key.

**Decision:** the deterministic provider refuses to extract Concepts rather than
inventing them heuristically.
**Reason:** rule-based "extraction" would fill the review queue with low-quality
proposals and train the user to rubber-stamp them, which defeats the approval
gate.
**Tradeoff:** no PDF ingestion at all without credentials.

## Persistence

**Decision:** IndexedDB behind a `LearnerRepository` interface, with an
in-memory implementation used by tests and as a fallback.
**Reason:** a review log grows without bound, and `localStorage` is a
synchronous ~5MB bucket that blocks the main thread — the wrong shape for
something written after every answer. The interface exists so Milestone 2 can
put the same calls in front of Postgres.
**Tradeoff:** async everywhere, and an extra abstraction with one real
implementation today.
**Future implication:** Supabase-ready. Nothing above `persistence/` knows where
state lives.

Records are validated on read (`parseSnapshot`) and a record that no longer
parses is dropped rather than failing the load: a schema change should cost a
student one Concept's history, not their whole course.

## State shape

- **Curriculum** (courses, lectures, Concepts, items) lives on the server and is
  read-only to the client.
- **Learner state** (`ConceptState`, `SessionProgress`, review log) lives in the
  browser and is written after every answer.
- The client store (`lib/client/learner-store.ts`) is exposed through
  `useSyncExternalStore`, which keeps server and hydration renders consistent —
  both see an empty, not-ready store, and real data arrives after mount.

## iPad first

The primary user studies on an iPad, so the UI is built for touch first: a
`--spacing-touch` token every control clears, 16px-minimum inputs (below that,
iOS zooms the viewport on focus), `viewportFit: cover`, and a `.teaching-prose`
class that sets teaching text larger and looser than the rest of the interface.
The e2e suite runs at iPad dimensions with touch enabled.

## Testing

- **Unit (Vitest)** — the domain and engine, with no browser. The approval gate,
  mastery transitions, FSRS wrapping, chunking, selection, the session machine,
  lecture gating, Today-queue fairness, grading, and the demo content's own
  invariants.
- **End-to-end (Playwright)** — the milestone journey in a real browser at iPad
  size, covering grading over HTTP and IndexedDB persistence across a reload.
  Nothing reaches into internals: it clicks what a student clicks.

One content test earns its place: every item's model answer must grade as
correct against its own expected points. It has already caught two real bugs —
expected answers written as stems (`marginat`) that whole-word matching can
never hit, and `simultaneous` failing to match `simultaneously`. Both would have
marked a textbook answer wrong.
