import type { Concept, Course, Lecture, SourceDocument } from "@/lib/domain/types";

/**
 * The deterministic demo course.
 *
 * Authored, not generated, so the learning engine can be exercised — and its
 * tests can mean something — before any PDF is parsed or any model is called.
 * Every Concept carries a real source reference into the document below, so
 * "View source" works exactly as it will for uploaded material.
 *
 * Two Concepts are deliberately left as `draft` to prove the approval gate: they
 * appear in the review queue and nowhere else. Tests assert they never reach
 * teaching, retrieval, scheduling or the Today queue.
 */

export const PATHOLOGY_COURSE_ID = "course-pathology";
export const CELL_INJURY_LECTURE_ID = "lecture-cell-injury";
export const INFLAMMATION_LECTURE_ID = "lecture-inflammation";

export const pathologyCourse: Course = {
  id: PATHOLOGY_COURSE_ID,
  title: "Pathology",
  subject: "General Pathology",
  lectureIds: [CELL_INJURY_LECTURE_ID, INFLAMMATION_LECTURE_ID],
};

export const pathologyLectures: Lecture[] = [
  {
    id: CELL_INJURY_LECTURE_ID,
    courseId: PATHOLOGY_COURSE_ID,
    title: "Cell Injury",
    order: 1,
    documentId: "doc-cell-injury",
  },
  {
    id: INFLAMMATION_LECTURE_ID,
    courseId: PATHOLOGY_COURSE_ID,
    title: "Inflammation",
    order: 2,
    documentId: "doc-inflammation",
  },
];

export const pathologyDocuments: SourceDocument[] = [
  {
    id: "doc-cell-injury",
    lectureId: CELL_INJURY_LECTURE_ID,
    title: "Cell Injury — lecture slides",
    kind: "slides",
    pages: [
      {
        pageNumber: 1,
        text:
          "Reversible and irreversible cell injury. Most acute injury converges on a fall in " +
          "cellular ATP. Hypoxia and ischaemia are the commonest causes; ATP falls below " +
          "roughly 5–10% of normal and multiple ATP-dependent processes fail together.",
      },
      {
        pageNumber: 2,
        text:
          "The plasma membrane Na+/K+ ATPase is among the first casualties of ATP depletion. " +
          "With the pump inhibited, sodium accumulates intracellularly and potassium leaks " +
          "out; water follows sodium osmotically.",
      },
      {
        pageNumber: 3,
        text:
          "Cellular swelling (hydropic change) is the earliest morphological manifestation of " +
          "reversible injury. It is recognised on light microscopy as pallor, increased cell " +
          "volume and cytoplasmic vacuolation, and it is reversible if perfusion is restored.",
      },
      {
        pageNumber: 4,
        text:
          "With oxidative phosphorylation impaired, the cell switches to anaerobic glycolysis. " +
          "Glycogen stores are consumed, lactic acid accumulates and intracellular pH falls, " +
          "which causes clumping of nuclear chromatin.",
      },
      {
        pageNumber: 5,
        text:
          "Reactive oxygen species — superoxide, hydrogen peroxide and the hydroxyl radical — " +
          "are generated during injury and reperfusion. They damage cells by lipid " +
          "peroxidation of membranes, oxidative modification of proteins and DNA lesions. " +
          "Superoxide dismutase, catalase and glutathione peroxidase oppose them.",
      },
      {
        pageNumber: 6,
        text:
          "Mitochondrial injury marks the transition to irreversibility. Persistent opening of " +
          "the mitochondrial permeability transition pore dissipates the membrane potential " +
          "so ATP cannot be regenerated, and leakage of cytochrome c into the cytosol " +
          "activates apoptosis.",
      },
    ],
  },
  {
    id: "doc-inflammation",
    lectureId: INFLAMMATION_LECTURE_ID,
    title: "Inflammation — lecture slides",
    kind: "slides",
    pages: [
      {
        pageNumber: 1,
        text:
          "Acute inflammation is the rapid host response delivering leukocytes and plasma " +
          "proteins to a site of injury or infection. Its cardinal signs are rubor, calor, " +
          "tumor, dolor and functio laesa.",
      },
      {
        pageNumber: 2,
        text:
          "Vascular changes come first: transient vasoconstriction, then arteriolar " +
          "vasodilation mediated by histamine and nitric oxide, producing increased blood " +
          "flow — the heat and redness.",
      },
      {
        pageNumber: 3,
        text:
          "Increased vascular permeability allows a protein-rich exudate to escape. The " +
          "principal mechanism in acute inflammation is endothelial cell contraction in " +
          "post-capillary venules, an immediate transient response to histamine, bradykinin " +
          "and leukotrienes.",
      },
      {
        pageNumber: 4,
        text:
          "Loss of protein into the interstitium lowers intravascular osmotic pressure and " +
          "raises interstitial osmotic pressure, driving fluid out. Stasis follows as blood " +
          "becomes concentrated, and leukocytes marginate along the endothelium.",
      },
      {
        pageNumber: 5,
        text:
          "The leukocyte recruitment cascade proceeds through margination, selectin-mediated " +
          "rolling, integrin-mediated firm adhesion, transmigration through the endothelium " +
          "and chemotaxis along a gradient of C5a, LTB4 and bacterial peptides.",
      },
      {
        pageNumber: 6,
        text:
          "Neutrophils then phagocytose the offending agent. Killing is chiefly oxygen " +
          "dependent: the NADPH oxidase respiratory burst generates superoxide, converted to " +
          "hydrogen peroxide and, with myeloperoxidase, to hypochlorite.",
      },
    ],
  },
];

function excerpt(documentId: string, pageNumber: number): string {
  const document = pathologyDocuments.find((entry) => entry.id === documentId);
  const page = document?.pages.find((entry) => entry.pageNumber === pageNumber);
  return page?.text ?? "";
}

function cellInjurySource(pageNumber: number) {
  return {
    courseId: PATHOLOGY_COURSE_ID,
    lectureId: CELL_INJURY_LECTURE_ID,
    documentId: "doc-cell-injury",
    pageNumber,
    excerpt: excerpt("doc-cell-injury", pageNumber),
  };
}

function inflammationSource(pageNumber: number) {
  return {
    courseId: PATHOLOGY_COURSE_ID,
    lectureId: INFLAMMATION_LECTURE_ID,
    documentId: "doc-inflammation",
    pageNumber,
    excerpt: excerpt("doc-inflammation", pageNumber),
  };
}

export const pathologyConcepts: Concept[] = [
  {
    id: "concept-atp-depletion",
    courseId: PATHOLOGY_COURSE_ID,
    lectureId: CELL_INJURY_LECTURE_ID,
    title: "ATP depletion",
    summary:
      "Most acute cell injury runs through a fall in ATP; below about 5–10% of normal, the " +
      "ATP-dependent processes a cell depends on fail together.",
    explanation:
      "Almost every route into acute cell injury — hypoxia, ischaemia, toxins — converges on " +
      "the same bottleneck: the cell runs out of ATP. Below roughly 5–10% of normal levels, " +
      "several ATP-hungry processes fail at once rather than one at a time. That is why a " +
      "single upstream problem produces such a stereotyped picture downstream, and it is " +
      "worth fixing ATP as the hub that the rest of this lecture hangs off.",
    status: "approved",
    source: cellInjurySource(1),
    prerequisiteIds: [],
    order: 1,
  },
  {
    id: "concept-na-k-atpase",
    courseId: PATHOLOGY_COURSE_ID,
    lectureId: CELL_INJURY_LECTURE_ID,
    title: "Na+/K+ ATPase failure",
    summary:
      "The sodium pump is among the first things to fail when ATP falls; sodium accumulates " +
      "inside the cell and potassium leaks out.",
    explanation:
      "The plasma membrane Na+/K+ ATPase spends a large share of a cell's energy budget, so " +
      "it is among the first casualties of ATP depletion. With the pump inhibited, the " +
      "gradients it maintains collapse: sodium accumulates intracellularly and potassium " +
      "leaks out. Nothing has been damaged structurally yet — this is a pump running out of " +
      "fuel — which is why the injury at this stage is still reversible.",
    status: "approved",
    source: cellInjurySource(2),
    prerequisiteIds: ["concept-atp-depletion"],
    order: 2,
  },
  {
    id: "concept-cellular-swelling",
    courseId: PATHOLOGY_COURSE_ID,
    lectureId: CELL_INJURY_LECTURE_ID,
    title: "Cellular swelling",
    summary:
      "Water follows the accumulated sodium into the cell, making swelling the earliest " +
      "morphological sign of reversible injury.",
    explanation:
      "Once sodium is stuck inside the cell, water follows it osmotically and the cell " +
      "swells. This hydropic change is the earliest morphological manifestation of " +
      "reversible injury — under the microscope, pallor, increased cell volume and " +
      "cytoplasmic vacuolation. The word that matters is reversible: restore perfusion and " +
      "the cell recovers.",
    status: "approved",
    source: cellInjurySource(3),
    prerequisiteIds: ["concept-na-k-atpase"],
    order: 3,
  },
  {
    id: "concept-anaerobic-glycolysis",
    courseId: PATHOLOGY_COURSE_ID,
    lectureId: CELL_INJURY_LECTURE_ID,
    title: "Anaerobic glycolysis",
    summary:
      "With oxidative phosphorylation impaired the cell falls back on glycolysis, consuming " +
      "glycogen and accumulating lactic acid, so intracellular pH falls.",
    explanation:
      "Deprived of oxidative phosphorylation, the cell switches to anaerobic glycolysis to " +
      "keep making ATP. It is a poor substitute and it has costs: glycogen stores are " +
      "consumed, lactic acid accumulates, and intracellular pH falls. The falling pH is what " +
      "produces clumping of nuclear chromatin — a compensation with a visible signature.",
    status: "approved",
    source: cellInjurySource(4),
    prerequisiteIds: ["concept-atp-depletion"],
    order: 4,
  },
  {
    id: "concept-ros",
    courseId: PATHOLOGY_COURSE_ID,
    lectureId: CELL_INJURY_LECTURE_ID,
    title: "Reactive oxygen species",
    summary:
      "Superoxide, hydrogen peroxide and the hydroxyl radical injure cells through lipid " +
      "peroxidation, protein oxidation and DNA damage.",
    explanation:
      "Reactive oxygen species are generated during injury and, notably, during reperfusion — " +
      "restoring blood flow can itself do damage. Three species matter: superoxide, hydrogen " +
      "peroxide and the hydroxyl radical. They injure a cell along three routes: lipid " +
      "peroxidation of membranes, oxidative modification of proteins, and DNA lesions. " +
      "Against them the cell fields superoxide dismutase, catalase and glutathione " +
      "peroxidase.",
    status: "approved",
    source: cellInjurySource(5),
    prerequisiteIds: [],
    order: 5,
  },
  {
    id: "concept-mitochondrial-injury",
    courseId: PATHOLOGY_COURSE_ID,
    lectureId: CELL_INJURY_LECTURE_ID,
    title: "Mitochondrial injury",
    summary:
      "Persistent permeability transition pore opening dissipates the membrane potential and " +
      "releases cytochrome c — the point at which injury becomes irreversible.",
    explanation:
      "Mitochondrial injury is where reversible becomes irreversible. Persistent opening of " +
      "the mitochondrial permeability transition pore dissipates the membrane potential, so " +
      "ATP can no longer be regenerated — the cell cannot recover even if perfusion returns. " +
      "Separately, cytochrome c leaks into the cytosol, where it activates apoptosis. One " +
      "organelle, two routes to cell death.",
    status: "approved",
    source: cellInjurySource(6),
    prerequisiteIds: ["concept-atp-depletion", "concept-ros"],
    order: 6,
  },

  // --- Inflammation -------------------------------------------------------
  {
    id: "concept-acute-inflammation",
    courseId: PATHOLOGY_COURSE_ID,
    lectureId: INFLAMMATION_LECTURE_ID,
    title: "Acute inflammation",
    summary:
      "The rapid host response that delivers leukocytes and plasma proteins to a site of " +
      "injury or infection, with five cardinal signs.",
    explanation:
      "Acute inflammation is the rapid response that brings leukocytes and plasma proteins to " +
      "injured or infected tissue. Its five cardinal signs — rubor, calor, tumor, dolor and " +
      "functio laesa — are not a list to memorise for its own sake: each one is the visible " +
      "consequence of a vascular change covered in this lecture.",
    status: "approved",
    source: inflammationSource(1),
    prerequisiteIds: [],
    order: 1,
  },
  {
    id: "concept-vasodilation",
    courseId: PATHOLOGY_COURSE_ID,
    lectureId: INFLAMMATION_LECTURE_ID,
    title: "Vasodilation",
    summary:
      "After brief vasoconstriction, histamine and nitric oxide dilate arterioles, increasing " +
      "blood flow — the heat and redness.",
    explanation:
      "The vascular response opens with transient vasoconstriction, which is easy to miss, " +
      "and then arteriolar vasodilation mediated by histamine and nitric oxide. Blood flow " +
      "increases, and that increase is what a patient sees and feels as redness and heat. " +
      "Two of the five cardinal signs, accounted for by one mechanism.",
    status: "approved",
    source: inflammationSource(2),
    prerequisiteIds: ["concept-acute-inflammation"],
    order: 2,
  },
  {
    id: "concept-vascular-permeability",
    courseId: PATHOLOGY_COURSE_ID,
    lectureId: INFLAMMATION_LECTURE_ID,
    title: "Increased vascular permeability",
    summary:
      "Endothelial cell contraction in post-capillary venules lets a protein-rich exudate " +
      "escape — the principal mechanism in acute inflammation.",
    explanation:
      "Increased vascular permeability is what turns increased blood flow into swelling. The " +
      "principal mechanism is endothelial cell contraction in post-capillary venules, an " +
      "immediate transient response to histamine, bradykinin and leukotrienes. Gaps open " +
      "between endothelial cells and a protein-rich exudate escapes into the tissue.",
    status: "approved",
    source: inflammationSource(3),
    prerequisiteIds: ["concept-vasodilation"],
    order: 3,
  },
  {
    id: "concept-stasis",
    courseId: PATHOLOGY_COURSE_ID,
    lectureId: INFLAMMATION_LECTURE_ID,
    title: "Stasis and margination",
    summary:
      "Fluid loss concentrates the blood, flow slows, and leukocytes move to the vessel wall.",
    explanation:
      "Protein leaving the vessel lowers intravascular osmotic pressure and raises it in the " +
      "interstitium, so fluid follows it out. The blood left behind is concentrated and flow " +
      "slows — stasis. That slowing is what lets leukocytes leave the central stream and " +
      "marginate along the endothelium, which is the precondition for everything that " +
      "follows.",
    status: "approved",
    source: inflammationSource(4),
    prerequisiteIds: ["concept-vascular-permeability"],
    order: 4,
  },
  {
    id: "concept-leukocyte-recruitment",
    courseId: PATHOLOGY_COURSE_ID,
    lectureId: INFLAMMATION_LECTURE_ID,
    title: "Leukocyte recruitment cascade",
    summary:
      "Margination, selectin-mediated rolling, integrin-mediated firm adhesion, " +
      "transmigration, then chemotaxis.",
    explanation:
      "Getting a neutrophil out of a vessel and to the right place is a five-step cascade: " +
      "margination, rolling on selectins, firm adhesion via integrins, transmigration between " +
      "endothelial cells, and chemotaxis along a gradient of C5a, LTB4 and bacterial " +
      "peptides. The two adhesion steps are worth separating — selectins for the loose, " +
      "rolling contact, integrins for the firm grip.",
    status: "approved",
    source: inflammationSource(5),
    prerequisiteIds: ["concept-stasis"],
    order: 5,
  },
  {
    id: "concept-respiratory-burst",
    courseId: PATHOLOGY_COURSE_ID,
    lectureId: INFLAMMATION_LECTURE_ID,
    title: "Respiratory burst",
    summary:
      "NADPH oxidase generates superoxide, converted to hydrogen peroxide and then, with " +
      "myeloperoxidase, to hypochlorite.",
    explanation:
      "Once a neutrophil has phagocytosed its target, killing is chiefly oxygen dependent. " +
      "NADPH oxidase drives a respiratory burst producing superoxide, which is converted to " +
      "hydrogen peroxide and then, by myeloperoxidase, to hypochlorite — household bleach, " +
      "made on demand. Note that these are the same reactive oxygen species that cause cell " +
      "injury; here they are deployed deliberately.",
    status: "approved",
    source: inflammationSource(6),
    prerequisiteIds: ["concept-leukocyte-recruitment"],
    order: 6,
  },

  // --- Unapproved drafts, kept to exercise the approval gate ---------------
  {
    id: "concept-draft-apoptosis",
    courseId: PATHOLOGY_COURSE_ID,
    lectureId: CELL_INJURY_LECTURE_ID,
    title: "Apoptosis versus necrosis",
    summary:
      "Extracted from the source but not yet reviewed — awaiting a human decision.",
    explanation:
      "This Concept was proposed from the lecture text and has not been approved. It must " +
      "never be taught, retrieved, scheduled or counted towards mastery.",
    status: "draft",
    source: cellInjurySource(6),
    prerequisiteIds: [],
    order: 7,
  },
  {
    id: "concept-draft-chronic",
    courseId: PATHOLOGY_COURSE_ID,
    lectureId: INFLAMMATION_LECTURE_ID,
    title: "Chronic inflammation",
    summary:
      "Extracted from the source but not yet reviewed — awaiting a human decision.",
    explanation:
      "This Concept was proposed from the lecture text and has not been approved. It must " +
      "never be taught, retrieved, scheduled or counted towards mastery.",
    status: "draft",
    source: inflammationSource(1),
    prerequisiteIds: [],
    order: 7,
  },
];
