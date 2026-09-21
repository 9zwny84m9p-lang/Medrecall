import { describe, expect, it } from "vitest";

import {
  getConcept,
  getItem,
  listAllConcepts,
  listApprovedConcepts,
  listApprovedConceptsForLecture,
  listCourses,
  listDraftConcepts,
  listItemsForConcepts,
  listLectures,
  listPriorApprovedConcepts,
  listPublicItemsForConcepts,
  toPublicItem,
} from "./registry";
import { buildLectureBundle } from "./bundle";
import { gradeFreeText } from "@/lib/grading/free-text";
import {
  CELL_INJURY_LECTURE_ID,
  INFLAMMATION_LECTURE_ID,
  PATHOLOGY_COURSE_ID,
} from "./pathology";

describe("the demo course", () => {
  it("has Pathology with Cell Injury then Inflammation", () => {
    const [course] = listCourses();
    expect(course?.id).toBe(PATHOLOGY_COURSE_ID);
    expect(listLectures(PATHOLOGY_COURSE_ID).map((lecture) => lecture.title)).toEqual([
      "Cell Injury",
      "Inflammation",
    ]);
  });

  it("covers the cell injury concepts the curriculum calls for", () => {
    const titles = listApprovedConceptsForLecture(CELL_INJURY_LECTURE_ID).map(
      (concept) => concept.title,
    );

    expect(titles).toEqual(
      expect.arrayContaining([
        "ATP depletion",
        "Na+/K+ ATPase failure",
        "Cellular swelling",
        "Anaerobic glycolysis",
        "Reactive oxygen species",
        "Mitochondrial injury",
      ]),
    );
  });

  it("gives every approved concept a source excerpt to show", () => {
    for (const concept of listApprovedConcepts()) {
      expect(concept.source.excerpt.length).toBeGreaterThan(40);
      expect(concept.source.pageNumber).toBeGreaterThan(0);
      expect(concept.source.lectureId).toBe(concept.lectureId);
    }
  });

  it("gives every approved concept at least two ways to be tested", () => {
    for (const concept of listApprovedConcepts()) {
      const items = listItemsForConcepts([concept.id]);
      expect(items.length, `items for ${concept.id}`).toBeGreaterThanOrEqual(2);
      expect(new Set(items.map((item) => item.kind)).size).toBeGreaterThan(1);
    }
  });

  /**
   * The marking scheme has to accept the answer the item itself calls correct.
   * When it does not, the expected points are wrong — usually a stem like
   * "marginat" that whole-word matching can never hit — and a student giving a
   * textbook answer would be marked down.
   */
  it("grades every model answer as correct against its own item", () => {
    const failures = listItemsForConcepts(
      listApprovedConcepts().map((concept) => concept.id),
    )
      .map((item) => ({ item, result: gradeFreeText(item, item.modelAnswer) }))
      .filter((entry) => entry.result.quality !== "exact")
      .map((entry) => `${entry.item.id}: missing ${entry.result.missingPoints.join(", ")}`);

    expect(failures).toEqual([]);
  });

  it("never offers multiple choice", () => {
    const kinds = new Set(
      listItemsForConcepts(listApprovedConcepts().map((concept) => concept.id)).map(
        (item) => item.kind,
      ),
    );
    expect(kinds.has("basic")).toBe(true);
    expect([...kinds]).not.toContain("multiple_choice");
  });

  it("gives every item a model answer and at least one expected point", () => {
    for (const item of listItemsForConcepts(
      listApprovedConcepts().map((concept) => concept.id),
    )) {
      expect(item.expectedPoints.length, item.id).toBeGreaterThan(0);
      expect(item.modelAnswer.length, item.id).toBeGreaterThan(0);
    }
  });
});

describe("the approval gate over real content", () => {
  it("keeps drafts on record", () => {
    expect(listDraftConcepts().length).toBeGreaterThan(0);
    expect(listAllConcepts().length).toBeGreaterThan(listApprovedConcepts().length);
  });

  it("never lets a draft into the approved list", () => {
    const approvedIds = new Set(listApprovedConcepts().map((concept) => concept.id));
    for (const draft of listDraftConcepts()) {
      expect(approvedIds.has(draft.id)).toBe(false);
    }
  });

  it("never lets a draft into a lecture bundle", () => {
    for (const lectureId of [CELL_INJURY_LECTURE_ID, INFLAMMATION_LECTURE_ID]) {
      const bundle = buildLectureBundle(lectureId);
      const ids = new Set([
        ...(bundle?.concepts ?? []).map((concept) => concept.id),
        ...(bundle?.priorConcepts ?? []).map((concept) => concept.id),
      ]);

      for (const draft of listDraftConcepts()) {
        expect(ids.has(draft.id), `${draft.id} leaked into ${lectureId}`).toBe(false);
      }
    }
  });
});

describe("prior concepts", () => {
  it("has none before the first lecture", () => {
    expect(listPriorApprovedConcepts(CELL_INJURY_LECTURE_ID)).toEqual([]);
  });

  it("offers the first lecture's concepts while studying the second", () => {
    const prior = listPriorApprovedConcepts(INFLAMMATION_LECTURE_ID);
    expect(prior.length).toBeGreaterThan(0);
    expect(prior.every((concept) => concept.lectureId === CELL_INJURY_LECTURE_ID)).toBe(true);
  });
});

describe("answer keys stay on the server", () => {
  it("strips expected points and the model answer from a public item", () => {
    const item = getItem("item-atp-basic");
    expect(item?.expectedPoints.length).toBeGreaterThan(0);

    const pub = toPublicItem(item!) as Record<string, unknown>;
    expect(pub.expectedPoints).toBeUndefined();
    expect(pub.modelAnswer).toBeUndefined();
    expect(pub.prompt).toBe(item?.prompt);
  });

  it("ships no answer keys in a lecture bundle", () => {
    const bundle = buildLectureBundle(CELL_INJURY_LECTURE_ID);
    const serialised = JSON.stringify(bundle?.items);

    expect(serialised).not.toContain("expectedPoints");
    expect(serialised).not.toContain("modelAnswer");
  });

  it("strips every item, not just the first", () => {
    const ids = listApprovedConcepts().map((concept) => concept.id);
    for (const item of listPublicItemsForConcepts(ids) as Record<string, unknown>[]) {
      expect(item.expectedPoints).toBeUndefined();
      expect(item.modelAnswer).toBeUndefined();
    }
  });
});

describe("lookups", () => {
  it("finds a concept by id", () => {
    expect(getConcept("concept-atp-depletion")?.title).toBe("ATP depletion");
  });

  it("returns null for an unknown id", () => {
    expect(getConcept("nope")).toBeNull();
    expect(getItem("nope")).toBeNull();
    expect(buildLectureBundle("nope")).toBeNull();
  });

  it("only returns items whose concept was asked for", () => {
    const items = listItemsForConcepts(["concept-atp-depletion"]);
    expect(items.every((item) => item.conceptId === "concept-atp-depletion")).toBe(true);
  });
});
