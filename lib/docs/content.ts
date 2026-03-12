export type DocsSectionGroup = {
  id: string;
  label: string;
};

export type DocsSection = {
  callout?: string;
  detail: string;
  groupId: string;
  id: string;
  navLabel: string;
  points?: string[];
  promptExamples?: string[];
  status?: string;
  steps?: string[];
  title: string;
};

export const DOC_SECTION_GROUPS: DocsSectionGroup[] = [
  { id: "start-here", label: "Start Here" },
  { id: "core-tools", label: "Core PM Tools" },
  { id: "prompt-guides", label: "Prompt Guides" },
  { id: "upcoming", label: "Upcoming" }
];

export const DOC_SECTIONS: DocsSection[] = [
  {
    id: "overview",
    groupId: "start-here",
    navLabel: "Overview",
    title: "OrbitPlus Product Manual",
    detail:
      "OrbitPlus is organized around one PM workflow: gather evidence, structure the product requirement, then move the work into a realistic roadmap. The docs below are written to help a PM move between those stages without guessing what each canvas is for or when to use AI.",
    points: [
      "Project-scoped work carries research context from discovery into PRD and roadmap flows.",
      "Solo mode keeps drafts unassigned when you want to work outside a specific project.",
      "AI is used as a drafting and planning assistant, but every output stays editable before it becomes part of the saved workspace.",
      "Exports and roadmap handoff are tied to the PRD readiness workflow so planning happens from a stable document."
    ],
    callout:
      "Recommended sequence: Research Builder -> PRD Canvas -> Mark PRD Ready -> Export or hand off to Roadmap Canvas."
  },
  {
    id: "pm-workflow",
    groupId: "start-here",
    navLabel: "PM Workflow",
    title: "PM Workflow",
    detail:
      "The PM workflow is designed to keep product discovery, specification, and delivery planning connected. Each stage should leave behind structured output that the next stage can reuse instead of forcing a PM to rewrite context by hand.",
    steps: [
      "Create or choose a project scope from the PM dashboard. Use solo mode only when the work should stay unassigned.",
      "Run Research Builder to create studies manually or use AI to draft question sets that you can review before publishing.",
      "Review helper submissions and AI synthesis so the project has usable problem evidence, language, and feature direction.",
      "Open the PRD Canvas, transfer the AI draft when helpful, then refine the document through section cards, manual markdown, and quick PRD commands.",
      "Mark the PRD ready once the document is stable enough for export and delivery planning.",
      "Export the PRD as PDF or DOCX when you need a shareable artifact, or launch the AI roadmap handoff to draft quarterly deliverables."
    ]
  },
  {
    id: "helper-workflow",
    groupId: "start-here",
    navLabel: "Helper Workflow",
    title: "Helper Workflow",
    detail:
      "Helpers are the research response layer. Their flow is intentionally simple so PMs get clean inputs back into the discovery process without extra formatting work.",
    steps: [
      "Open available gigs and choose a published study that matches your context.",
      "Answer open-text, single-select, and multi-select questions directly in the survey flow.",
      "Add optional notes when a short summary makes the response easier for the PM to understand.",
      "Submit the response so it enters PM review and can be included in AI synthesis."
    ],
    points: [
      "Helpers do not write PRDs or roadmaps directly.",
      "The value of helper responses is that they enrich research context used later by the PRD and roadmap tools."
    ]
  },
  {
    id: "research-builder",
    groupId: "core-tools",
    navLabel: "Research Builder",
    title: "Research Builder",
    detail:
      "Research Builder is the discovery workspace for creating studies, refining survey questions, and generating early synthesis. It is the best place to define the user problem before you move into a PRD.",
    steps: [
      "Start with a manual study or ask AI to draft a question set around a specific user problem, funnel drop-off, or product decision.",
      "Keep the study in draft while you tune prompts, question types, and answer choices so the instrument is clean before launch.",
      "Publish when the survey is ready for helpers, then monitor incoming responses and summary patterns.",
      "Use AI-generated insights to identify pain points, opportunity areas, or themes that should influence PRD scope."
    ],
    points: [
      "Project-linked studies create reusable context for PRD and roadmap generation later.",
      "Question quality matters more than quantity. Narrow prompts tend to produce more useful insight than broad surveys.",
      "Research synthesis should be treated as directional input for the PRD, not as a replacement for PM judgment."
    ],
    callout:
      "Move to PRD Canvas when the research has clarified the problem, target user, and first release direction."
  },
  {
    id: "prd-canvas",
    groupId: "core-tools",
    navLabel: "PRD Canvas",
    title: "PRD Canvas",
    detail:
      "The PRD Canvas is the main requirements workspace. It supports both structured section editing and raw markdown editing, while keeping the underlying PRD document synchronized in one canonical format.",
    steps: [
      "Use Idea Prep when you have a rough concept and want AI to break it down, ask clarifying questions, and produce a first draft.",
      "Send the full AI draft to the canvas when it is useful, then refine individual sections through cards or the manual markdown canvas.",
      "Add missing sections with the section menu or type canonical headings directly in the markdown canvas to auto-open those sections.",
      "Use Quick PRD Command to rewrite or create the currently active section without replacing the whole document.",
      "Mark the PRD ready once the canvas is stable, then export it or hand it off into Roadmap Canvas."
    ],
    points: [
      "Section cards, manual markdown, and quick PRD commands all operate on the same PRD source of truth.",
      "The AI draft preview is read-only and meant to support transfer or section-level guidance, not replace the canvas.",
      "Ready PRDs unlock PDF and DOCX export, plus the AI roadmap prompt.",
      "The roadmap prompt appears once per PRD and opens the roadmap canvas with a reviewable AI draft rather than auto-persisting deliverables."
    ],
    callout:
      "Treat the PRD as ready when it is specific enough for execution, stakeholder review, or roadmap planning."
  },
  {
    id: "roadmap-canvas",
    groupId: "core-tools",
    navLabel: "Roadmap Canvas",
    title: "Roadmap Canvas",
    detail:
      "Roadmap Canvas translates PRDs into quarter-based delivery planning. It supports manual prioritization, AI strategy prompts, and PRD-driven roadmap handoff.",
    steps: [
      "Use the quarter columns to organize PRD cards and manual roadmap items by delivery timing.",
      "Add manual items when a roadmap needs supporting work that is not represented by an existing PRD.",
      "Use AI strategy prompts to rebalance the roadmap around a goal such as retention, activation, or delivery risk.",
      "Open the roadmap from a ready PRD when you want AI to propose deliverables directly from the specification.",
      "Review AI draft deliverables in the canvas first, then apply or discard them."
    ],
    points: [
      "AI roadmap handoff produces review-only deliverables before persistence.",
      "Quarter planning should reflect scope, dependencies, risks, and realistic sequencing rather than just impact.",
      "Roadmap placeholders are useful when strategy work exists before a full PRD has been written."
    ]
  },
  {
    id: "analytics-preview",
    groupId: "upcoming",
    navLabel: "Analytics",
    title: "Analytics",
    detail:
      "Analytics is being shaped into a PM-facing workspace for baseline reporting, trend interpretation, and decision-ready summaries that can feed directly into PRDs and roadmap tradeoffs.",
    points: [
      "Planned focus: AI-assisted metric narratives, report snapshots, and PM-readable interpretation.",
      "Expected use case: compare funnel health, retention shifts, and adoption metrics before changing product scope.",
      "Longer-term role: connect observed performance to PRD success metrics and roadmap prioritization."
    ],
    status: "Work in progress"
  },
  {
    id: "journey-map-preview",
    groupId: "upcoming",
    navLabel: "Journey Map",
    title: "User Journey Map",
    detail:
      "Journey Map is planned as a structured customer-flow workspace for mapping stages, friction points, and opportunity areas in one place before they are converted into requirements.",
    points: [
      "Planned focus: stage mapping, pain-point clustering, and opportunity framing.",
      "Expected use case: trace where users stall, drop off, or need support across the full experience.",
      "Longer-term role: connect research evidence to a concrete user flow before PRD scoping."
    ],
    status: "Work in progress"
  },
  {
    id: "ab-testing-preview",
    groupId: "upcoming",
    navLabel: "A/B Testing",
    title: "A/B Testing",
    detail:
      "A/B Testing is being positioned as the PM experimentation layer for turning product hypotheses into structured experiments with clear variants and decision metrics.",
    points: [
      "Planned focus: experiment framing, variant documentation, and outcome tracking.",
      "Expected use case: test messaging, onboarding flow changes, or conversion improvements against a success metric.",
      "Longer-term role: feed experiment results back into PRD updates and roadmap confidence."
    ],
    status: "Work in progress"
  },
  {
    id: "research-prompt-guide",
    groupId: "prompt-guides",
    navLabel: "Research Prompts",
    title: "Research Prompt Guide",
    detail:
      "Good research prompts are concrete about audience, product moment, and output format. Use prompts that tell the AI what decision the study needs to support.",
    promptExamples: [
      "Create 8 survey questions for B2B onboarding friction with 2 single-select and 2 multi-select questions.",
      "Focus the study on activation drop-off between signup and first value moment for new trial users.",
      "Suggest answer choices that are mutually exclusive, easy to compare, and useful for PM synthesis.",
      "Rewrite these questions to remove bias and tighten them around feature adoption blockers."
    ],
    callout:
      "Ask for a smaller, sharper question set when the goal is clarity. Broad prompts usually create noisier studies."
  },
  {
    id: "prd-prompt-guide",
    groupId: "prompt-guides",
    navLabel: "PRD Prompts",
    title: "PRD Prompt Guide",
    detail:
      "PRD prompts work best when they target a specific document outcome: generate a full draft, deepen one section, tighten scope, or stress-test execution quality.",
    promptExamples: [
      "Generate a full PRD for onboarding optimization using current research context.",
      "Tighten non-goals and remove low-impact requirements from this draft.",
      "Add measurable acceptance criteria and success metrics for the current release scope.",
      "Expand the risks and mitigations section with rollout and dependency concerns.",
      "Rewrite the functional requirements section so it is specific enough for engineering planning."
    ],
    callout:
      "Quick PRD Command is best for section-level changes. Use full-document generation only when you intend to replace the canvas."
  },
  {
    id: "roadmap-prompt-guide",
    groupId: "prompt-guides",
    navLabel: "Roadmap Prompts",
    title: "Roadmap Prompt Guide",
    detail:
      "Roadmap prompts should define the planning goal clearly so the AI can trade off timing, impact, and risk instead of just reshuffling work randomly.",
    promptExamples: [
      "Plan for Q2 retention growth while protecting onboarding conversion.",
      "Prioritize quick wins this quarter and move platform rebuild work to later quarters.",
      "Balance delivery risk and expected impact across all four quarters.",
      "Resequence the roadmap around launch readiness for one flagship workflow.",
      "Create realistic quarterly deliverables from this ready PRD without overloading Q1."
    ],
    callout:
      "If the roadmap must stay realistic, mention delivery constraints, dependencies, and the metric you are trying to move."
  }
];
