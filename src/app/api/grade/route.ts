import { NextResponse } from "next/server";
import { z } from "zod";

import { getAIProvider } from "@/lib/ai/server";
import { assertApproved, UnapprovedConceptError } from "@/lib/domain/approval";
import { getConcept, getItem } from "@/lib/content/registry";

export const dynamic = "force-dynamic";

/**
 * Grade a free-text answer.
 *
 * Grading is a server route rather than a client function for two reasons:
 * the answer key stays out of the browser bundle, and swapping the deterministic
 * grader for a model is a server-side config change that needs an API key the
 * frontend must never see.
 */

const requestSchema = z.object({
  itemId: z.string().min(1),
  answer: z.string().max(4000),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Expected { itemId: string, answer: string }." },
      { status: 400 },
    );
  }

  const item = getItem(parsed.data.itemId);
  if (!item) {
    return NextResponse.json({ error: "Unknown retrieval item." }, { status: 404 });
  }

  const concept = getConcept(item.conceptId);
  if (!concept) {
    return NextResponse.json({ error: "Unknown concept." }, { status: 404 });
  }

  try {
    // The approval gate applies to grading too: an answer to an unapproved
    // Concept must not produce memory state.
    assertApproved(concept);
  } catch (error) {
    if (error instanceof UnapprovedConceptError) {
      return NextResponse.json(
        { error: "That concept has not been approved for study." },
        { status: 409 },
      );
    }
    throw error;
  }

  const provider = getAIProvider();
  const result = await provider.gradeFreeAnswer({ item, answer: parsed.data.answer });

  // Re-teaching text is generated here so a student who got it wrong sees the
  // explanation in the same round trip.
  const remediation =
    result.nextAction === "reteach"
      ? await provider.generateRemediation({ concept, answer: parsed.data.answer, result })
      : null;

  return NextResponse.json({ result, remediation, provider: provider.name });
}
