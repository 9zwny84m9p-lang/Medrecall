import { describe, expect, it } from "vitest";

import { buildTeachingChunks, MAX_CONCEPTS_PER_CHUNK } from "./chunks";
import { makeConcept } from "@/lib/test-support/factories";

function onPage(id: string, pageNumber: number, order = pageNumber) {
  const concept = makeConcept({ id, order });
  return { ...concept, source: { ...concept.source, pageNumber } };
}

describe("buildTeachingChunks", () => {
  it("groups consecutive pages into a chunk", () => {
    const chunks = buildTeachingChunks("lecture-1", [
      onPage("a", 1),
      onPage("b", 2),
      onPage("c", 3),
    ]);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ pageStart: 1, pageEnd: 3 });
    expect(chunks[0]?.conceptIds).toEqual(["a", "b", "c"]);
  });

  it("starts a new chunk once the page span is exceeded", () => {
    const chunks = buildTeachingChunks("lecture-1", [
      onPage("a", 1),
      onPage("b", 2),
      onPage("c", 5),
    ]);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.conceptIds).toEqual(["a", "b"]);
    expect(chunks[1]?.conceptIds).toEqual(["c"]);
  });

  it("caps how many concepts one checkpoint covers", () => {
    const concepts = Array.from({ length: 7 }, (_, index) => onPage(`c${index}`, 1, index));
    const chunks = buildTeachingChunks("lecture-1", concepts);

    for (const chunk of chunks) {
      expect(chunk.conceptIds.length).toBeLessThanOrEqual(MAX_CONCEPTS_PER_CHUNK);
    }
    expect(chunks.flatMap((chunk) => chunk.conceptIds)).toHaveLength(7);
  });

  it("orders by page, then by position on the page", () => {
    const chunks = buildTeachingChunks("lecture-1", [
      onPage("second", 1, 2),
      onPage("first", 1, 1),
    ]);

    expect(chunks[0]?.conceptIds).toEqual(["first", "second"]);
  });

  it("leaves draft concepts out of teaching entirely", () => {
    const draft = { ...onPage("draft", 1), status: "draft" as const };
    const chunks = buildTeachingChunks("lecture-1", [onPage("approved", 1), draft]);

    expect(chunks.flatMap((chunk) => chunk.conceptIds)).toEqual(["approved"]);
  });

  it("ignores concepts from other lectures", () => {
    const other = { ...onPage("other", 1), lectureId: "lecture-2" };
    const chunks = buildTeachingChunks("lecture-1", [onPage("mine", 1), other]);

    expect(chunks.flatMap((chunk) => chunk.conceptIds)).toEqual(["mine"]);
  });

  it("produces nothing for an empty lecture", () => {
    expect(buildTeachingChunks("lecture-1", [])).toEqual([]);
  });

  it("numbers chunks in order", () => {
    const concepts = Array.from({ length: 6 }, (_, index) => onPage(`c${index}`, index + 1, index));
    const chunks = buildTeachingChunks("lecture-1", concepts);

    expect(chunks.map((chunk) => chunk.index)).toEqual([...chunks.keys()]);
  });
});
