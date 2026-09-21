# AI handoff

Current state of MedRecall, written so another engineering agent can pick it up
without re-deriving anything. Read [ARCHITECTURE.md](./ARCHITECTURE.md) for the
reasoning behind the decisions listed here.

**Last updated:** end of Milestone 1.

## Where things stand

Milestone 1 is complete: the full learning loop runs end to end on a
deterministic demo course, with no AI credentials. Milestone 2 (PDF ingestion
and Concept review) has not been started.

| | |
| --- | --- |
| Repository | `9zwny84m9p-lang/Medrecall` |
| Stack | Next.js 16 (App Router), React 19, TypeScript 5.9, Tailwind 4, Zod 4, ts-fsrs 5, idb 8 |
| Tests | 149 unit (Vitest) + 5 end-to-end (Playwright) |
| Persistence | IndexedDB, browser-local |
| AI | `DeterministicProvider` by default; `AnthropicProvider` wired but not on |

## Run it

```bash
npm ci
npm run dev                 # http://localhost:3000
npm test                    # unit
npm run typecheck && npm run lint
npx playwright install chromium && npm run test:e2e
```

In a sandbox with its own Chromium, set `MEDRECALL_CHROMIUM_PATH` to that binary
instead of running `playwright install`.

## The five invariants

Break any of these and the product is wrong, not merely buggy. Each is covered
by a test that will fail.

1. **No unapproved Concept enters anything.** Not teaching, retrieval,
   scheduling, mastery, interleaving or the Today queue. Every selection path
   goes through `activeConcepts()` in `lib/domain/approval.ts`; single-Concept
   paths use `assertApproved()`, which throws.
   → `domain/approval.test.ts`, `content/registry.test.ts`
2. **Answer keys never reach the browser.** `expectedPoints` and `modelAnswer`
   stay server-side. `toPublicItem` in `content/registry.ts` builds the public
   shape field by field, so a new field on `RetrievalItem` is server-side by
   default.
   → `content/registry.test.ts`, and an e2e test that greps the rendered page
3. **FSRS decides only *when*.** What to study and how to test it lives in
   `engine/selection.ts`. Do not push curriculum logic into the scheduler.
4. **Immediate reinforcement never clears weakness.** Only `interleaved` or
   `review` context can — `clearsWeakness()` in `domain/mastery.ts`. This is
   what makes cross-lecture interleaving work at all.
   → `domain/mastery.test.ts`
5. **A model answer must grade as correct against its own item.** Content
   invariant; it has already caught two real bugs.
   → `content/registry.test.ts`

## Map of the code

| Path | What lives there |
| --- | --- |
| `lib/domain/types.ts` | Every domain type. Start here. |
| `lib/domain/approval.ts` | The approval gate. |
| `lib/domain/mastery.ts` | Mastery states and transitions. |
| `lib/engine/scheduler.ts` | The only file that touches `ts-fsrs`. |
| `lib/engine/selection.ts` | What to bring back, and in what format. |
| `lib/engine/session.ts` | The teaching loop, as a pure reducer. |
| `lib/engine/chunks.ts` | Grouping Concepts into teaching chunks by page. |
| `lib/engine/progress.ts` | Lecture progress and the unlock rule. |
| `lib/engine/today.ts` | Cross-course queue with round-robin fairness. |
| `lib/engine/tutor.ts` | Where a graded answer becomes learner state. |
| `lib/grading/free-text.ts` | The deterministic grader. |
| `lib/ai/provider.ts` | The `AIProvider` interface. |
| `lib/content/registry.ts` | The only door onto curriculum content. |
| `lib/persistence/repository.ts` | Storage interface + in-memory implementation. |
| `lib/client/learner-store.ts` | The single client-side store. |
| `app/api/grade/route.ts` | Grading endpoint. |

## Tuning constants

All named and exported, so a change is greppable:

| Constant | Value | Where |
| --- | --- | --- |
| `MAX_PAGES_PER_CHUNK` | 3 | `engine/chunks.ts` |
| `MAX_CONCEPTS_PER_CHUNK` | 3 | `engine/chunks.ts` |
| `INTERLEAVE_AFTER_RETRIEVALS` | 2 | `engine/selection.ts` |
| `MAX_WEAK_RATIO` | 0.4 | `engine/progress.ts` |
| `STABLE_STABILITY_DAYS` | 7 | `domain/mastery.ts` |
| `STRONG_STABILITY_DAYS` | 21 | `domain/mastery.ts` |
| `DEFAULT_TODAY_LIMIT` | 20 | `engine/today.ts` |

These are judgement calls, not measured values. Changing them is fine; changing
them silently is not — several tests assert behaviour that depends on them.

## How to add things

**A new retrieval format.** Add to `RETRIEVAL_KINDS` in `domain/types.ts`, place
it in `KIND_PREFERENCE` in `engine/selection.ts`, add a label in
`components/learn-session.tsx`, and author items. If it is not free text, it
needs its own grading path — `grading/free-text.ts` assumes prose.

**A storage backend.** Implement `LearnerRepository` and return it from
`createRepository()`. Nothing above `persistence/` changes. `MemoryRepository`
is the reference implementation and the one tests use.

**A model provider.** Implement `AIProvider`, add a branch in
`lib/ai/server.ts`. Keep the module `server-only`. Follow
`AnthropicProvider.gradeFreeAnswer`: run the lexical grader first and fall back
to it when the response is unusable, so a bad response never costs a student
their answer.

**Course content.** `content/pathology.ts` and `content/pathology-items.ts` are
the shape to copy. Register in `content/registry.ts`. Every Concept needs a real
`SourceRef` and at least two items of different kinds — `registry.test.ts`
enforces both.

## Traps

- **Expected-point alternatives must be whole words.** `mentions()` matches on
  word boundaries with `-s`/`-es` tolerance and nothing more. A stem like
  `marginat` matches nothing. The model-answer test catches this.
- **Do not advance the session inside `submitAnswer`.** Grading and advancing
  are separate on purpose; merging them hides the student's feedback behind the
  next step. `advanceAfterAnswer` is called when they click Continue.
- **`selectRetrievalItem` takes `PublicRetrievalItem`.** The engine only needs
  an item's id and kind, which is what lets the client run the same engine as
  the server without the answer key.
- **Server and hydration renders must agree.** `getServerSnapshot` returns an
  empty, not-ready store; real data arrives after mount. Reading IndexedDB
  during render will produce a hydration mismatch.
- **Do not `setState` synchronously in an effect.** The React Compiler lint rule
  is on and will fail the build. External state goes through
  `useSyncExternalStore`.
- **Vitest config is `.mts`.** A `.ts` config is loaded as CommonJS and warns.

## First things to do next

1. PDF ingestion with `pdfjs-dist`, producing `SourcePage[]` with real page
   numbers (Milestone 2, step 1).
2. `AnthropicProvider.extractConcepts` — currently throws
   `ProviderCapabilityError` by design.
3. The approve/fix/discard UI on `/review`. The page lists drafts today and says
   so; the domain functions (`approveConcept`, `discardConcept`) already exist
   and are tested.

Before any of that, run `npm test && npm run typecheck && npm run lint &&
npm run build`. All four are green at handoff; if one is not, that is a
regression, not an inherited problem.
