import { describe, expect, it } from "vitest";

import { gradeFreeText, mentions, normalise } from "./free-text";
import type { RetrievalItem } from "@/lib/domain/types";

const ITEM: RetrievalItem = {
  id: "item-1",
  conceptId: "concept-1",
  kind: "mechanism",
  prompt: "Why does the cell swell?",
  expectedPoints: [
    { id: "sodium", label: "sodium accumulating", alternatives: ["sodium", "na+"] },
    { id: "water", label: "water following osmotically", alternatives: ["water", "osmotic"] },
  ],
  modelAnswer: "Sodium accumulates and water follows osmotically.",
};

const SINGLE: RetrievalItem = {
  ...ITEM,
  id: "item-2",
  expectedPoints: [
    {
      id: "pump",
      label: "the Na+/K+ ATPase",
      alternatives: ["na+/k+ atpase", "sodium pump"],
    },
  ],
};

describe("normalise", () => {
  it("strips punctuation and case", () => {
    expect(normalise("Na+/K+ ATPase, failing!")).toBe("na+/k+ atpase failing");
  });

  it("collapses whitespace", () => {
    expect(normalise("  lots   of\n space ")).toBe("lots of space");
  });

  it("normalises curly quotes", () => {
    expect(normalise("it’s")).toBe("it's");
  });
});

describe("mentions", () => {
  it("matches on whole words", () => {
    expect(mentions("ROS are generated", "ros")).toBe(true);
    expect(mentions("spread across the membrane", "ros")).toBe(false);
  });

  it("matches multi-word phrases", () => {
    expect(mentions("the sodium pump fails", "sodium pump")).toBe(true);
  });

  it("keeps chemical notation intact", () => {
    expect(mentions("Na+/K+ ATPase is inhibited", "na+/k+ atpase")).toBe(true);
  });

  it("ignores an empty alternative", () => {
    expect(mentions("anything", "")).toBe(false);
  });
});

describe("gradeFreeText", () => {
  it("marks a full answer exact and continues", () => {
    const result = gradeFreeText(ITEM, "Sodium builds up and water follows osmotically.");
    expect(result).toMatchObject({
      correct: true,
      quality: "exact",
      missingPoints: [],
      nextAction: "continue",
    });
  });

  it("accepts an alternative phrasing of a point", () => {
    const result = gradeFreeText(SINGLE, "The sodium pump stops working.");
    expect(result.quality).toBe("exact");
  });

  it("marks a half answer partial and asks again", () => {
    const result = gradeFreeText(ITEM, "Sodium builds up inside.");
    expect(result).toMatchObject({
      correct: false,
      quality: "partial",
      nextAction: "reinforce",
    });
    expect(result.missingPoints).toEqual(["water following osmotically"]);
  });

  it("marks an irrelevant answer incorrect and re-teaches", () => {
    const result = gradeFreeText(ITEM, "Something about the nucleus.");
    expect(result).toMatchObject({
      correct: false,
      quality: "incorrect",
      nextAction: "reteach",
    });
    expect(result.missingPoints).toHaveLength(2);
  });

  it("treats a blank answer as incorrect rather than exact", () => {
    const result = gradeFreeText(ITEM, "   ");
    expect(result.quality).toBe("incorrect");
    expect(result.feedback).toMatch(/nothing to grade/i);
  });

  it("names what was missed in the feedback", () => {
    const result = gradeFreeText(ITEM, "Sodium builds up inside.");
    expect(result.feedback).toContain("water following osmotically");
  });

  it("keeps acronyms intact in feedback", () => {
    const result = gradeFreeText(SINGLE, "something unrelated");
    expect(result.feedback).toContain("Na+/K+ ATPase");
    expect(result.feedback).not.toContain("atpase");
  });

  it("releases the model answer with the result", () => {
    expect(gradeFreeText(ITEM, "sodium").modelAnswer).toBe(ITEM.modelAnswer);
  });

  it("does not credit a point by substring alone", () => {
    const result = gradeFreeText(SINGLE, "sodiumpumpery");
    expect(result.quality).toBe("incorrect");
  });
});
