import { expect, test, type Page } from "@playwright/test";

/**
 * The Milestone 1 journey, end to end in a real browser:
 *
 *   open MedRecall → Pathology → Lecture 1 → learn concepts → answer retrieval
 *   questions → answer some incorrectly → weak concepts recorded → finish
 *   Lecture 1 → open Lecture 2 → a weak Lecture 1 concept is injected → answer
 *   it → learner state updates → reload → everything remains
 *
 * Nothing here reaches into application internals: it clicks what a student
 * clicks and reads what a student reads.
 */

/** A deliberately wrong answer — it matches no expected point of any item. */
const WRONG = "I am not sure about this one at all";
/** A wide answer covering the demo course's expected points across concepts. */
const BROAD_ANSWER = [
  "ATP adenosine triphosphate falls below 5 to 10 percent and many processes fail together",
  "the Na+/K+ ATPase sodium pump fails so sodium accumulates and potassium leaks out",
  "water follows osmotically causing swelling, pallor and vacuolation, and it is reversible",
  "anaerobic glycolysis makes lactic acid so pH falls",
  "superoxide, hydrogen peroxide and the hydroxyl radical cause lipid peroxidation,",
  "protein oxidation and DNA damage, opposed by superoxide dismutase, catalase and",
  "glutathione peroxidase",
  "mitochondrial injury and the permeability transition pore mean the membrane potential",
  "is lost so ATP cannot be regenerated, and cytochrome c triggers apoptosis",
  "leukocytes and plasma proteins arrive with redness rubor, heat calor, swelling tumor and pain dolor",
  "histamine and nitric oxide dilate arterioles increasing blood flow",
  "endothelial cell contraction in post-capillary venules lets protein out",
  "osmotic pressure drives fluid out, blood concentrates, flow slows and cells marginate",
  "margination, rolling on selectins, adhesion via integrins, transmigration and chemotaxis",
  "NADPH oxidase makes superoxide, then hydrogen peroxide, then myeloperoxidase makes hypochlorite",
].join(" ");

/** Advance one step, whatever kind of step it happens to be. */
async function step(page: Page, answer: string): Promise<string> {
  const teach = page.getByRole("button", { name: /check my understanding/i });
  if (await teach.isVisible().catch(() => false)) {
    await teach.click();
    return "teach";
  }

  const reteach = page.getByRole("button", { name: /try that one again/i });
  if (await reteach.isVisible().catch(() => false)) {
    await reteach.click();
    return "reteach";
  }

  const check = page.getByRole("button", { name: /check my answer/i });
  if (await check.isVisible().catch(() => false)) {
    await page.getByLabel("Your answer").fill(answer);
    await check.click();
    await page.getByRole("status").waitFor();
    await page.getByRole("button", { name: "Continue" }).click();
    return "retrieve";
  }

  return "done";
}

/** Work through a lecture until it completes, answering as instructed. */
async function runLecture(
  page: Page,
  answerFor: (retrievalIndex: number) => string,
  options: { maxSteps?: number } = {},
): Promise<{ retrievals: number; interleaved: string[] }> {
  const maxSteps = options.maxSteps ?? 60;
  let retrievals = 0;
  const interleaved: string[] = [];

  for (let taken = 0; taken < maxSteps; taken += 1) {
    if (await page.getByRole("region", { name: "Lecture complete" }).isVisible().catch(() => false)) {
      break;
    }

    const badge = page.getByText("From an earlier lecture");
    if (await badge.isVisible().catch(() => false)) {
      interleaved.push(await page.getByRole("heading", { level: 2 }).first().innerText());
    }

    const kind = await step(page, answerFor(retrievals));
    if (kind === "retrieve") retrievals += 1;
    if (kind === "done") break;
  }

  return { retrievals, interleaved };
}

test.describe("MedRecall learning journey", () => {
  test("teaches, tests, records weakness, interleaves and persists", async ({ page }) => {
    // --- Open MedRecall --------------------------------------------------
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /learn the lecture/i })).toBeVisible();

    // --- Open Pathology → Lecture 1 --------------------------------------
    await page.getByRole("link", { name: /open pathology/i }).click();
    await expect(page.getByRole("heading", { name: "Pathology", level: 1 })).toBeVisible();

    // Lecture 2 is gated until Lecture 1 is learned.
    await expect(page.getByText("Locked")).toBeVisible();

    await page.getByRole("link", { name: /start cell injury/i }).click();
    await expect(page.getByRole("heading", { name: "Cell Injury", level: 1 })).toBeVisible();

    // Teaching leads, and every concept shows where it came from.
    await expect(page.getByText("Teaching · pages 1")).toBeVisible();
    await expect(page.getByText(/view source · page \d/i).first()).toBeVisible();

    // --- Learn Lecture 1, getting the first two questions wrong -----------
    const lectureOne = await runLecture(page, (index) => (index < 2 ? WRONG : BROAD_ANSWER));
    expect(lectureOne.retrievals).toBeGreaterThan(5);

    // Interleaving does not happen in the first lecture — there is nothing prior.
    expect(lectureOne.interleaved).toHaveLength(0);

    // --- Finish Lecture 1 -------------------------------------------------
    await expect(page.getByRole("heading", { name: /cell injury complete/i })).toBeVisible();
    await expect(page.getByText(/next lecture is unlocked/i)).toBeVisible();

    // --- Weak concepts were recorded --------------------------------------
    await page.getByRole("link", { name: /back to pathology/i }).click();
    await expect(page.getByText(/\d+ weak/)).toBeVisible();
    await expect(page.getByText("Locked")).toHaveCount(0);

    // --- Open Lecture 2 ---------------------------------------------------
    await page.getByRole("link", { name: /start inflammation/i }).click();
    await expect(page.getByRole("heading", { name: "Inflammation", level: 1 })).toBeVisible();

    // --- A weak Lecture 1 concept is injected, and answering it updates state
    const lectureTwo = await runLecture(page, () => BROAD_ANSWER);
    expect(lectureTwo.interleaved.length).toBeGreaterThan(0);

    await page.goto("/courses/course-pathology");
    const cellInjuryCard = page
      .getByRole("listitem")
      .filter({ hasText: "Cell Injury" });
    await expect(cellInjuryCard.getByText(/Learned|Available/)).toBeVisible();

    // --- Reload: everything remains ---------------------------------------
    const beforeReload = await cellInjuryCard.innerText();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Pathology", level: 1 })).toBeVisible();

    const afterReload = await page
      .getByRole("listitem")
      .filter({ hasText: "Cell Injury" })
      .innerText();
    expect(afterReload).toBe(beforeReload);
    expect(afterReload).toMatch(/[1-9]\d*\/\d+ concepts met/);

    // The home screen picks up where the student left off.
    await page.goto("/");
    await expect(page.getByRole("link", { name: /continue learning/i })).toBeVisible();
  });

  test("re-teaches a wrong answer at once and asks it again later", async ({ page }) => {
    await page.goto("/learn/lecture-cell-injury");

    await page.getByRole("button", { name: /check my understanding/i }).click();
    const firstQuestion = await page.getByRole("heading", { level: 2 }).first().innerText();

    await page.getByLabel("Your answer").fill(WRONG);
    await page.getByRole("button", { name: /check my answer/i }).click();

    // The student sees their feedback before anything moves on.
    await expect(page.getByRole("status")).toContainText("Not yet");
    await page.getByRole("button", { name: "Continue" }).click();

    // The explanation comes straight away, while the gap is fresh.
    await expect(page.getByText(/let.s go back over this/i)).toBeVisible();
    await page.getByRole("button", { name: /try that one again/i }).click();

    // The retry is spaced: the rest of the checkpoint comes first.
    await expect(page.getByRole("heading", { level: 2 }).first()).not.toHaveText(firstQuestion);
    await expect(page.getByText("Once more")).toHaveCount(0);

    // Answering the rest of the checkpoint brings the failed concept back.
    let sawRetry = false;
    for (let taken = 0; taken < 12 && !sawRetry; taken += 1) {
      await step(page, BROAD_ANSWER);
      sawRetry = await page
        .getByText("Once more")
        .isVisible()
        .catch(() => false);
    }

    expect(sawRetry).toBe(true);
  });

  test("never shows the answer before the student has answered", async ({ page }) => {
    await page.goto("/learn/lecture-cell-injury");
    await page.getByRole("button", { name: /check my understanding/i }).click();

    // The answer key is not in the page, nor in any script the page loaded.
    const html = await page.content();
    expect(html).not.toContain("expectedPoints");
    expect(html).not.toContain("modelAnswer");
    expect(page.getByText(/model answer/i)).toHaveCount(0);
  });

  test("keeps unapproved concepts out of the curriculum", async ({ page }) => {
    await page.goto("/review");

    // Drafts are visible here…
    await expect(page.getByRole("heading", { name: /apoptosis versus necrosis/i })).toBeVisible();
    await expect(page.getByText("Draft — not in use").first()).toBeVisible();

    // …and nowhere in the lecture that "contains" them.
    await page.goto("/learn/lecture-cell-injury");
    const html = await page.content();
    expect(html).not.toContain("concept-draft-apoptosis");
    expect(html).not.toContain("Apoptosis versus necrosis");
  });

  test("health endpoint reports ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    expect(await response.json()).toMatchObject({ status: "ok", service: "medrecall" });
  });
});
