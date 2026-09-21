# MedRecall

An adaptive medical curriculum tutor. It teaches a course concept by concept,
checks what you have actually understood, and brings back what you are shaky on
while you learn the next lecture.

MedRecall is not a flashcard app. The unit of learning is a **Concept** — one
idea, traceable to the page it came from — and a flashcard is only one of
several ways to test one. See [ARCHITECTURE.md](./ARCHITECTURE.md) for why.

```
Course → Lectures → Pages → Concepts → Teaching → Retrieval → Mastery → Scheduling → Interleaving
```

## What works today

Milestone 1 delivers the core learning loop end to end, on a deterministic demo
course, with no AI credentials required.

- **Teaching in chunks.** Two to three pages of source material at a time, then a
  retrieval checkpoint on what was just taught.
- **Retrieval, not recognition.** Cued recall, cloze, mechanism ("why does this
  happen") and free recall. Multiple choice is deliberately absent.
- **Free-text grading.** Answers are marked against the Concept's expected
  points and come back as `{ correct, quality, missingPoints, feedback,
  nextAction }`. Grading runs on the server, so the answer key is never in the
  browser bundle.
- **Adaptive follow-up.** A wrong answer is re-taught immediately and asked again
  later in the checkpoint. A partial answer is asked again in a different format.
- **Weakness that sticks.** Answering correctly right after being told the answer
  does not clear a weak flag — only a spaced retrieval does.
- **Cross-lecture interleaving.** While learning Lecture 2, MedRecall pulls in a
  weak or due Concept from Lecture 1. Getting it right there is what clears it.
- **Lecture gating.** Lecture 2 unlocks once Lecture 1 is sufficiently learned —
  every Concept met, with no more than 40% still weak.
- **FSRS scheduling.** `ts-fsrs` sets due dates; the tutoring layer decides what
  is worth studying and how to test it.
- **Mastery states.** `new`, `learning`, `weak`, `stable`, `strong` — named
  states, not invented percentages.
- **Source grounding.** Every Concept shows its document, page and verbatim
  excerpt behind "View source".
- **An approval gate.** Unapproved Concepts cannot be taught, retrieved,
  scheduled, interleaved or counted towards mastery. Enforced in the domain
  layer, not the UI.
- **Persistence.** Learner state is held in IndexedDB and survives a reload.
- **iPad first.** Large touch targets, readable teaching text, works on iPad,
  iPhone and desktop.

### Not yet built

PDF upload and AI Concept extraction, the approve/fix/discard review controls, a
cross-course Today screen, and accounts with synced storage. See
[ROADMAP.md](./ROADMAP.md).

## Getting started

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>. The Pathology demo course (Cell Injury,
Inflammation) is there immediately — no upload, no API key.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |

Run `npx playwright install chromium` once before `npm run test:e2e`. In a
sandbox that ships its own Chromium, set `MEDRECALL_CHROMIUM_PATH` to it instead.

## Configuration

Everything works with no configuration. See [.env.example](./.env.example).

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | `deterministic` | `deterministic` or `anthropic` |
| `ANTHROPIC_API_KEY` | — | Required only for `anthropic` |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | Model for the Anthropic provider |

AI credentials are read on the server only. The provider modules are marked
`server-only`, so importing one from a client component is a build error rather
than a leaked key. A missing key falls back to the deterministic provider with a
warning instead of taking a study session down.

## Project layout

```
src/
  app/            Routes, plus /api/grade and /api/health
  components/     UI
  lib/
    domain/       Types, the approval gate, mastery rules — no I/O
    engine/       FSRS wrapper, selection, session machine, progress, Today queue
    grading/      Deterministic free-text grading
    ai/           AIProvider interface and its implementations
    content/      Course catalogue and the Pathology demo course
    persistence/  Repository interface, IndexedDB + in-memory
    client/       The client-side learner store
e2e/              Playwright journey tests
```

## Testing

```bash
npm test          # 149 unit tests — domain and engine, no browser needed
npm run test:e2e  # the full milestone journey in a real browser at iPad size
```

The end-to-end suite walks the journey the product is built around: open
Pathology, learn Cell Injury, get questions wrong, watch weak Concepts be
recorded, finish the lecture, open Inflammation, meet an injected Lecture 1
Concept, answer it, reload, and find everything still there.

## Disclaimer

MedRecall is a study tool. Its content comes from the material you give it —
always check it against your course and a clinician.
