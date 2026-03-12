export type PrdSectionDefinition = {
  id: string;
  title: string;
};

export type ParsedPrdSection = PrdSectionDefinition & {
  endIndex: number;
  index: number;
  markdown: string;
  present: boolean;
};

export type ParsedPrdDocument = {
  additionalNotes: string;
  sections: ParsedPrdSection[];
};

export const ROOT_PRD_TITLE = "# Product Requirements Document";

export const PRD_SECTIONS: PrdSectionDefinition[] = [
  { id: "problem-statement", title: "Problem Statement" },
  { id: "goals", title: "Goals" },
  { id: "non-goals", title: "Non-Goals" },
  { id: "target-users-and-personas", title: "Target Users and Personas" },
  { id: "key-user-flows", title: "Key User Flows" },
  { id: "functional-requirements", title: "Functional Requirements" },
  { id: "non-functional-requirements", title: "Non-Functional Requirements" },
  { id: "user-stories", title: "User Stories" },
  { id: "acceptance-criteria", title: "Acceptance Criteria" },
  { id: "success-metrics", title: "Success Metrics" },
  { id: "risks-and-mitigations", title: "Risks and Mitigations" },
  { id: "open-questions", title: "Open Questions" }
];

export const CANONICAL_PRD_SECTION_TITLES = PRD_SECTIONS.map((section) => section.title);
const CANONICAL_SECTION_SET = new Set(CANONICAL_PRD_SECTION_TITLES);
const CANONICAL_SECTION_TITLE_BY_KEY = new Map(
  PRD_SECTIONS.map((section) => [normalizeSectionTitleKey(section.title), section.title])
);

export function normalizeSectionTitleKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function getEditDistance(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const current = previous[rightIndex];
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + cost
      );
      diagonal = current;
    }
  }

  return previous[right.length];
}

export function resolveCanonicalSectionTitle(title: string) {
  const trimmed = title.trim();
  if (!trimmed) return "";
  if (CANONICAL_SECTION_SET.has(trimmed)) return trimmed;

  const normalized = normalizeSectionTitleKey(trimmed);
  const exactKeyMatch = CANONICAL_SECTION_TITLE_BY_KEY.get(normalized);
  if (exactKeyMatch) return exactKeyMatch;

  let bestMatch = trimmed;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const section of PRD_SECTIONS) {
    const canonicalKey = normalizeSectionTitleKey(section.title);
    const distance = getEditDistance(normalized, canonicalKey);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = section.title;
    }
  }

  return bestDistance <= 2 ? bestMatch : trimmed;
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findSectionIndex(content: string, title: string) {
  if (!content.trim()) return -1;
  const match = content.match(new RegExp(`^##\\s+${escapeRegExp(title)}\\s*$`, "im"));
  return match?.index ?? -1;
}

export function stripRootTitle(content: string) {
  return content.replace(/^#\s+Product Requirements Document\s*\n*/i, "").trim();
}

export function getSectionBody(markdown: string, title: string) {
  return markdown
    .replace(new RegExp(`^##\\s+${escapeRegExp(title)}\\s*$\\n*`, "i"), "")
    .trim();
}

export function normalizeSectionMarkdown(title: string, markdown: string) {
  const trimmed = markdown.trim();
  if (!trimmed) {
    return `## ${title}\n`;
  }

  const withoutRootTitle = trimmed
    .replace(/^#\s+Product Requirements Document\s*\n*/i, "")
    .trimStart();
  const exactHeadingPattern = new RegExp(`^##\\s+${escapeRegExp(title)}\\s*$\\n*`, "i");
  const withoutLeadingHeading = withoutRootTitle.replace(/^##\s+.+?\s*$\n*/i, "").trimStart();
  const body = exactHeadingPattern.test(withoutRootTitle)
    ? withoutRootTitle.replace(exactHeadingPattern, "").trim()
    : withoutLeadingHeading.trim();

  return body ? `## ${title}\n${body}` : `## ${title}\n`;
}

export function getOrderedSectionTitles(titles: string[]) {
  const titleSet = new Set(titles);
  return PRD_SECTIONS.map((section) => section.title).filter((title) => titleSet.has(title));
}

export function getPresentSectionTitles(sections: ParsedPrdSection[]) {
  return sections.filter((section) => section.present).map((section) => section.title);
}

export function serializePrdDocument(sections: ParsedPrdSection[], additionalNotes: string) {
  const normalizedSections = PRD_SECTIONS.map((section) => {
    const matchingSection = sections.find((candidate) => candidate.title === section.title);
    if (!matchingSection?.present) return "";
    return normalizeSectionMarkdown(section.title, matchingSection.markdown);
  }).filter(Boolean);
  const trimmedAdditionalNotes = additionalNotes.trim();

  if (!normalizedSections.length && !trimmedAdditionalNotes) {
    return "";
  }

  return [ROOT_PRD_TITLE, ...normalizedSections, trimmedAdditionalNotes]
    .filter(Boolean)
    .join("\n\n");
}

export function parsePrdDocument(content: string): ParsedPrdDocument {
  const matches = Array.from(content.matchAll(/^##\s+(.+?)\s*$/gm)).map((match) => ({
    startIndex: match.index ?? -1,
    title: match[1]?.trim() ?? ""
  }));
  const matchedSections = new Map<string, ParsedPrdSection>();
  const additionalParts: string[] = [];

  const preamble = matches.length
    ? content.slice(0, matches[0].startIndex).trim()
    : content.trim();
  const strippedPreamble = stripRootTitle(preamble);
  if (strippedPreamble) {
    additionalParts.push(strippedPreamble);
  }

  matches.forEach((match, index) => {
    const endIndex = matches[index + 1]?.startIndex ?? content.length;
    const markdown = content.slice(match.startIndex, endIndex).trim();
    const resolvedTitle = resolveCanonicalSectionTitle(match.title);
    const sectionSnapshot: ParsedPrdSection = {
      id: resolvedTitle.toLowerCase().replace(/\s+/g, "-"),
      title: resolvedTitle,
      endIndex,
      markdown,
      present: Boolean(markdown),
      index: match.startIndex
    };

    if (CANONICAL_SECTION_SET.has(resolvedTitle) && !matchedSections.has(resolvedTitle)) {
      matchedSections.set(resolvedTitle, sectionSnapshot);
      return;
    }

    if (markdown) {
      additionalParts.push(markdown);
    }
  });

  return {
    additionalNotes: additionalParts.join("\n\n").trim(),
    sections: PRD_SECTIONS.map((section) => {
      const matchedSection = matchedSections.get(section.title);
      return (
        matchedSection ?? {
          ...section,
          endIndex: -1,
          markdown: "",
          present: false,
          index: -1
        }
      );
    })
  };
}

export function upsertSectionInDocument(content: string, title: string, sectionMarkdown: string) {
  const normalizedSectionMarkdown = normalizeSectionMarkdown(title, sectionMarkdown);
  const parsedDocument = parsePrdDocument(content);
  const nextSections = parsedDocument.sections.map((section) =>
    section.title === title
      ? {
          ...section,
          markdown: normalizedSectionMarkdown,
          present: true
        }
      : section
  );
  const nextText = serializePrdDocument(nextSections, parsedDocument.additionalNotes);

  return {
    nextText,
    sectionIndex: findSectionIndex(nextText, title)
  };
}
