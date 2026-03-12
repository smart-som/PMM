import { DOC_SECTIONS } from "@/lib/docs/content";

export type DocSectionIndex = {
  content: string;
  id: string;
  title: string;
};

export const DOC_SECTION_INDEX: DocSectionIndex[] = DOC_SECTIONS.map((section) => ({
  id: section.id,
  title: section.title,
  content: [
    section.detail,
    section.callout ?? "",
    section.status ?? "",
    ...(section.steps ?? []),
    ...(section.points ?? []),
    ...(section.promptExamples ?? [])
  ]
    .filter(Boolean)
    .join(" ")
}));

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
