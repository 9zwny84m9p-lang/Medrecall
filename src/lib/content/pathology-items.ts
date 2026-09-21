import type { RetrievalItem } from "@/lib/domain/types";

/**
 * Retrieval items for the demo course.
 *
 * Each Concept gets several formats so a Concept met repeatedly is asked a
 * different way each time — the student recalls the idea rather than a sentence.
 * `expectedPoints` and `modelAnswer` never leave the server; see
 * `content/registry.ts`.
 */

function point(id: string, label: string, alternatives: string[]) {
  return { id, label, alternatives };
}

export const pathologyItems: RetrievalItem[] = [
  // --- ATP depletion ------------------------------------------------------
  {
    id: "item-atp-basic",
    conceptId: "concept-atp-depletion",
    kind: "basic",
    prompt:
      "Most routes into acute cell injury converge on the same biochemical bottleneck. What is it?",
    expectedPoints: [point("atp", "the fall in ATP", ["atp", "adenosine triphosphate"])],
    modelAnswer:
      "A fall in cellular ATP — hypoxia, ischaemia and toxins all converge on ATP depletion.",
  },
  {
    id: "item-atp-cloze",
    conceptId: "concept-atp-depletion",
    kind: "cloze",
    prompt:
      "Complete: ATP-dependent processes begin to fail together once ATP falls below roughly ___ of normal.",
    expectedPoints: [point("threshold", "the 5–10% threshold", ["5", "five", "10", "ten"])],
    modelAnswer: "About 5–10% of normal levels.",
  },
  {
    id: "item-atp-mechanism",
    conceptId: "concept-atp-depletion",
    kind: "mechanism",
    prompt:
      "Why does a single upstream insult such as hypoxia produce such a stereotyped pattern of cell injury?",
    expectedPoints: [
      point("hub", "ATP as the shared bottleneck", ["atp", "adenosine triphosphate"]),
      point("simultaneous", "many ATP-dependent processes failing together", [
        "together",
        "simultaneous",
        "simultaneously",
        "at once",
        "multiple processes",
        "several processes",
        "many processes",
      ]),
    ],
    modelAnswer:
      "Because they all converge on ATP depletion, and below the critical threshold many " +
      "ATP-dependent processes fail simultaneously rather than one at a time.",
  },

  // --- Na+/K+ ATPase ------------------------------------------------------
  {
    id: "item-nak-basic",
    conceptId: "concept-na-k-atpase",
    kind: "basic",
    prompt: "Which membrane pump is among the first to fail as ATP falls, and what happens to the ions?",
    expectedPoints: [
      point("pump", "the Na+/K+ ATPase", [
        "na+/k+ atpase",
        "na/k atpase",
        "sodium potassium atpase",
        "sodium pump",
        "sodium-potassium pump",
      ]),
      point("ions", "sodium accumulating inside and potassium leaking out", [
        "sodium accumulates",
        "sodium in",
        "sodium influx",
        "potassium out",
        "potassium leaks",
        "potassium efflux",
      ]),
    ],
    modelAnswer:
      "The Na+/K+ ATPase. With it inhibited, sodium accumulates intracellularly and potassium leaks out.",
  },
  {
    id: "item-nak-cloze",
    conceptId: "concept-na-k-atpase",
    kind: "cloze",
    prompt:
      "Complete: with the sodium pump inhibited, ___ accumulates inside the cell while potassium leaks out.",
    expectedPoints: [point("sodium", "sodium", ["sodium", "na+", "na"])],
    modelAnswer: "Sodium.",
  },
  {
    id: "item-nak-mechanism",
    conceptId: "concept-na-k-atpase",
    kind: "mechanism",
    prompt: "Why is the sodium pump one of the earliest casualties of ATP depletion?",
    expectedPoints: [
      point("energy", "its large share of the cell's energy budget", [
        "energy",
        "atp",
        "expensive",
        "consumes",
        "budget",
        "demand",
      ]),
    ],
    modelAnswer:
      "It consumes a large share of the cell's ATP, so a falling supply reaches it first.",
  },

  // --- Cellular swelling --------------------------------------------------
  {
    id: "item-swelling-basic",
    conceptId: "concept-cellular-swelling",
    kind: "basic",
    prompt: "What is the earliest morphological manifestation of reversible cell injury?",
    expectedPoints: [
      point("swelling", "cellular swelling", ["swelling", "hydropic", "oedema", "edema"]),
    ],
    modelAnswer: "Cellular swelling — hydropic change.",
  },
  {
    id: "item-swelling-mechanism",
    conceptId: "concept-cellular-swelling",
    kind: "mechanism",
    prompt: "Why does the cell swell once the sodium pump has failed?",
    expectedPoints: [
      point("sodium", "sodium accumulating intracellularly", ["sodium", "na+", "na"]),
      point("water", "water following osmotically", ["water", "osmotic", "osmosis", "osmotically"]),
    ],
    modelAnswer: "Sodium accumulates inside the cell and water follows it osmotically.",
  },
  {
    id: "item-swelling-free",
    conceptId: "concept-cellular-swelling",
    kind: "free_recall",
    prompt:
      "Describe how cellular swelling appears on light microscopy, and say whether it can be reversed.",
    expectedPoints: [
      point("appearance", "pallor, increased volume or vacuolation", [
        "pallor",
        "pale",
        "vacuolation",
        "vacuoles",
        "increased volume",
        "larger",
        "swollen",
      ]),
      point("reversible", "that it is reversible", ["reversible", "recovers", "recover", "reverses"]),
    ],
    modelAnswer:
      "Pallor, increased cell volume and cytoplasmic vacuolation — and it is reversible if " +
      "perfusion is restored.",
  },

  // --- Anaerobic glycolysis -----------------------------------------------
  {
    id: "item-glycolysis-basic",
    conceptId: "concept-anaerobic-glycolysis",
    kind: "basic",
    prompt:
      "With oxidative phosphorylation impaired, what does the cell switch to, and what accumulates as a result?",
    expectedPoints: [
      point("glycolysis", "anaerobic glycolysis", ["anaerobic glycolysis", "glycolysis"]),
      point("lactate", "lactic acid", ["lactic acid", "lactate", "lactic"]),
    ],
    modelAnswer: "Anaerobic glycolysis, which consumes glycogen and accumulates lactic acid.",
  },
  {
    id: "item-glycolysis-mechanism",
    conceptId: "concept-anaerobic-glycolysis",
    kind: "mechanism",
    prompt: "How does the switch to anaerobic glycolysis end up clumping nuclear chromatin?",
    expectedPoints: [
      point("lactate", "lactic acid accumulating", ["lactic", "lactate"]),
      point("ph", "the fall in intracellular pH", ["ph", "acidosis", "acidic", "acidity"]),
    ],
    modelAnswer:
      "Lactic acid accumulates, intracellular pH falls, and the falling pH clumps nuclear chromatin.",
  },

  // --- Reactive oxygen species --------------------------------------------
  {
    id: "item-ros-basic",
    conceptId: "concept-ros",
    kind: "basic",
    prompt: "Name the three reactive oxygen species highlighted in this lecture.",
    expectedPoints: [
      point("superoxide", "superoxide", ["superoxide", "o2-"]),
      point("peroxide", "hydrogen peroxide", ["hydrogen peroxide", "h2o2", "peroxide"]),
      point("hydroxyl", "the hydroxyl radical", ["hydroxyl", "oh radical", "oh-"]),
    ],
    modelAnswer: "Superoxide, hydrogen peroxide and the hydroxyl radical.",
  },
  {
    id: "item-ros-mechanism",
    conceptId: "concept-ros",
    kind: "mechanism",
    prompt: "By what three routes do reactive oxygen species injure a cell?",
    expectedPoints: [
      point("lipid", "lipid peroxidation of membranes", ["lipid peroxidation", "lipid", "membrane"]),
      point("protein", "oxidative modification of proteins", ["protein"]),
      point("dna", "DNA lesions", ["dna", "genetic", "nucleic"]),
    ],
    modelAnswer:
      "Lipid peroxidation of membranes, oxidative modification of proteins, and DNA lesions.",
  },
  {
    id: "item-ros-free",
    conceptId: "concept-ros",
    kind: "free_recall",
    prompt: "Which enzymes does the cell use to defend itself against reactive oxygen species?",
    expectedPoints: [
      point("sod", "superoxide dismutase", ["superoxide dismutase", "sod"]),
      point("catalase", "catalase", ["catalase"]),
      point("gpx", "glutathione peroxidase", ["glutathione peroxidase", "glutathione"]),
    ],
    modelAnswer: "Superoxide dismutase, catalase and glutathione peroxidase.",
  },

  // --- Mitochondrial injury -----------------------------------------------
  {
    id: "item-mito-basic",
    conceptId: "concept-mitochondrial-injury",
    kind: "basic",
    prompt: "Which event marks the transition from reversible to irreversible cell injury?",
    expectedPoints: [
      point("mito", "mitochondrial injury", [
        "mitochondrial",
        "mitochondria",
        "mitochondrion",
        "permeability transition",
        "mptp",
      ]),
    ],
    modelAnswer:
      "Mitochondrial injury — persistent opening of the mitochondrial permeability transition pore.",
  },
  {
    id: "item-mito-mechanism",
    conceptId: "concept-mitochondrial-injury",
    kind: "mechanism",
    prompt:
      "Give the two ways mitochondrial injury kills the cell once the permeability transition pore opens.",
    expectedPoints: [
      point("atp", "loss of membrane potential so ATP cannot be regenerated", [
        "membrane potential",
        "atp",
        "cannot regenerate",
        "no atp",
      ]),
      point("cytc", "cytochrome c release activating apoptosis", [
        "cytochrome c",
        "cytochrome",
        "apoptosis",
      ]),
    ],
    modelAnswer:
      "The membrane potential is dissipated so ATP cannot be regenerated, and cytochrome c " +
      "leaks into the cytosol where it activates apoptosis.",
  },

  // --- Acute inflammation --------------------------------------------------
  {
    id: "item-acute-basic",
    conceptId: "concept-acute-inflammation",
    kind: "basic",
    prompt: "What does acute inflammation deliver to a site of injury or infection?",
    expectedPoints: [
      point("leukocytes", "leukocytes", ["leukocyte", "leucocyte", "white cell", "neutrophil"]),
      point("proteins", "plasma proteins", ["plasma protein", "plasma", "protein"]),
    ],
    modelAnswer: "Leukocytes and plasma proteins.",
  },
  {
    id: "item-acute-free",
    conceptId: "concept-acute-inflammation",
    kind: "free_recall",
    prompt: "List the cardinal signs of acute inflammation.",
    expectedPoints: [
      point("rubor", "rubor — redness", ["rubor", "redness", "red"]),
      point("calor", "calor — heat", ["calor", "heat", "hot", "warmth"]),
      point("tumor", "tumor — swelling", ["tumor", "tumour", "swelling"]),
      point("dolor", "dolor — pain", ["dolor", "pain", "painful"]),
    ],
    modelAnswer: "Rubor, calor, tumor, dolor and functio laesa.",
  },

  // --- Vasodilation --------------------------------------------------------
  {
    id: "item-vasodilation-basic",
    conceptId: "concept-vasodilation",
    kind: "basic",
    prompt: "Which two mediators drive the arteriolar vasodilation of acute inflammation?",
    expectedPoints: [
      point("histamine", "histamine", ["histamine"]),
      point("no", "nitric oxide", ["nitric oxide", "no"]),
    ],
    modelAnswer: "Histamine and nitric oxide.",
  },
  {
    id: "item-vasodilation-mechanism",
    conceptId: "concept-vasodilation",
    kind: "mechanism",
    prompt: "Which cardinal signs does vasodilation account for, and why?",
    expectedPoints: [
      point("signs", "redness and heat", ["redness", "red", "rubor", "heat", "calor", "hot"]),
      point("flow", "increased blood flow", ["blood flow", "flow", "perfusion"]),
    ],
    modelAnswer: "Redness and heat, because arteriolar dilation increases blood flow.",
  },

  // --- Vascular permeability -----------------------------------------------
  {
    id: "item-permeability-basic",
    conceptId: "concept-vascular-permeability",
    kind: "basic",
    prompt:
      "What is the principal mechanism of increased vascular permeability in acute inflammation, and where?",
    expectedPoints: [
      point("contraction", "endothelial cell contraction", [
        "endothelial cell contraction",
        "endothelial contraction",
        "contraction",
        "gaps",
      ]),
      point("venule", "post-capillary venules", ["post-capillary venule", "postcapillary", "venule"]),
    ],
    modelAnswer: "Endothelial cell contraction in post-capillary venules.",
  },
  {
    id: "item-permeability-cloze",
    conceptId: "concept-vascular-permeability",
    kind: "cloze",
    prompt: "Complete: increased permeability lets a ___-rich exudate escape into the tissue.",
    expectedPoints: [point("protein", "protein", ["protein"])],
    modelAnswer: "Protein.",
  },

  // --- Stasis ---------------------------------------------------------------
  {
    id: "item-stasis-mechanism",
    conceptId: "concept-stasis",
    kind: "mechanism",
    prompt: "How does loss of protein from the vessel lead to stasis and leukocyte margination?",
    expectedPoints: [
      point("osmotic", "the shift in osmotic pressure drawing fluid out", [
        "osmotic",
        "oncotic",
        "fluid out",
        "fluid leaves",
      ]),
      point("slow", "blood concentrating and flow slowing", [
        "concentrated",
        "slows",
        "slow",
        "viscous",
        "stasis",
      ]),
    ],
    modelAnswer:
      "Protein loss lowers intravascular osmotic pressure and raises it interstitially, so " +
      "fluid leaves the vessel; the concentrated blood flows more slowly and leukocytes " +
      "marginate along the endothelium.",
  },
  {
    id: "item-stasis-basic",
    conceptId: "concept-stasis",
    kind: "basic",
    prompt: "What do leukocytes do once blood flow slows in an inflamed vessel?",
    expectedPoints: [
      point("marginate", "marginate along the endothelium", [
        "marginate",
        "marginating",
        "margination",
        "vessel wall",
        "endothelium",
      ]),
    ],
    modelAnswer: "They marginate — moving out of the central stream to line the endothelium.",
  },

  // --- Leukocyte recruitment ------------------------------------------------
  {
    id: "item-recruitment-free",
    conceptId: "concept-leukocyte-recruitment",
    kind: "free_recall",
    prompt: "Walk through the leukocyte recruitment cascade in order.",
    expectedPoints: [
      point("margination", "margination", ["margination", "marginate", "marginating"]),
      point("rolling", "rolling on selectins", ["rolling", "selectin"]),
      point("adhesion", "firm adhesion via integrins", ["adhesion", "integrin", "adhere"]),
      point("transmigration", "transmigration", [
        "transmigration",
        "transmigrate",
        "diapedesis",
        "migration",
      ]),
      point("chemotaxis", "chemotaxis", ["chemotaxis", "chemotactic", "gradient"]),
    ],
    modelAnswer:
      "Margination, selectin-mediated rolling, integrin-mediated firm adhesion, " +
      "transmigration through the endothelium, then chemotaxis along a gradient.",
  },
  {
    id: "item-recruitment-basic",
    conceptId: "concept-leukocyte-recruitment",
    kind: "basic",
    prompt: "Which adhesion molecules mediate rolling, and which mediate firm adhesion?",
    expectedPoints: [
      point("selectins", "selectins for rolling", ["selectin"]),
      point("integrins", "integrins for firm adhesion", ["integrin"]),
    ],
    modelAnswer: "Selectins mediate rolling; integrins mediate firm adhesion.",
  },

  // --- Respiratory burst ----------------------------------------------------
  {
    id: "item-burst-basic",
    conceptId: "concept-respiratory-burst",
    kind: "basic",
    prompt: "Which enzyme drives the neutrophil respiratory burst, and what does it generate first?",
    expectedPoints: [
      point("oxidase", "NADPH oxidase", ["nadph oxidase", "nadph"]),
      point("superoxide", "superoxide", ["superoxide"]),
    ],
    modelAnswer: "NADPH oxidase, generating superoxide.",
  },
  {
    id: "item-burst-mechanism",
    conceptId: "concept-respiratory-burst",
    kind: "mechanism",
    prompt: "Trace superoxide through to the final microbicidal species, naming the enzyme involved.",
    expectedPoints: [
      point("peroxide", "conversion to hydrogen peroxide", ["hydrogen peroxide", "h2o2", "peroxide"]),
      point("mpo", "myeloperoxidase", ["myeloperoxidase", "mpo"]),
      point("hocl", "hypochlorite", ["hypochlorite", "hocl", "bleach"]),
    ],
    modelAnswer:
      "Superoxide is converted to hydrogen peroxide, which myeloperoxidase converts to hypochlorite.",
  },
];
