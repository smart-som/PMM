export type DocSectionIndex = {
  id: string;
  title: string;
  content: string;
};

export const DOC_SECTION_INDEX: DocSectionIndex[] = [
  {
    id: "pm-workflow",
    title: "PM Workflow",
    content:
      "Create a study manually or use AI Kickstart. Keep generated studies in draft, review questions, publish, generate full PRD, refine sections with append prompts, and map delivery in roadmap canvas."
  },
  {
    id: "helper-workflow",
    title: "Helper Workflow",
    content:
      "Open available gigs, pick published surveys, answer open text and select questions, add summary notes, and submit responses for PM review."
  },
  {
    id: "prd-prompt-guide",
    title: "PRD Canvas Prompt Guide",
    content:
      "Generate full PRD from research, refine scope and non-goals, add measurable acceptance criteria, define success metrics, and expand risks and mitigations."
  },
  {
    id: "research-prompt-guide",
    title: "Research Prompt Guide",
    content:
      "Create onboarding friction questions, focus on activation drop-off, and suggest mutually exclusive options for cleaner analysis."
  },
  {
    id: "roadmap-prompt-guide",
    title: "Roadmap Prompt Guide",
    content:
      "Plan quarterly retention growth, prioritize quick wins, delay heavy rebuilds, and balance impact against delivery risk."
  }
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function findBestDocSection(query: string) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return null;

  const tokens = normalizedQuery.split(" ").filter((token) => token.length > 1);
  if (!tokens.length) return null;

  let best: DocSectionIndex | null = null;
  let bestScore = 0;

  for (const section of DOC_SECTION_INDEX) {
    const normalizedTitle = normalize(section.title);
    const normalizedContent = normalize(section.content);
    const normalizedBlob = `${normalizedTitle} ${normalizedContent}`;

    let score = 0;

    if (normalizedTitle.includes(normalizedQuery)) score += 10;
    if (normalizedBlob.includes(normalizedQuery)) score += 5;

    for (const token of tokens) {
      if (normalizedTitle.includes(token)) score += 4;
      if (normalizedContent.includes(token)) score += 2;
    }

    if (score > bestScore) {
      best = section;
      bestScore = score;
    }
  }

  return bestScore > 0 ? best : null;
}

