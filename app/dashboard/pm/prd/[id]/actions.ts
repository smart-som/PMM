"use server";

import { requestGeminiText } from "@/lib/ai/gemini";
import { getAdminDb } from "@/lib/firebase/admin";
import { PRD_SYSTEM_INSTRUCTIONS } from "@/lib/ai/prd-system-prompt";
import { CANONICAL_PRD_SECTION_TITLES, normalizeSectionMarkdown } from "@/lib/prd/markdown";
import { requirePmServerUser } from "@/lib/server/auth";
import {
  AiInsights,
  PrdAssistantCompetitor,
  PrdAssistantReadiness,
  PrdAssistantWorkspace,
  SurveyAnswer,
  SurveyQuestion,
  SurveyQuestionType
} from "@/types/app";

type StudyRecord = {
  id: string;
  title: string;
  userSegment: string;
  surveyQuestions: SurveyQuestion[];
};

type SubmissionRecord = {
  studyId: string;
  helperId: string;
  status: string;
  responseSummary?: string;
  answers: SurveyAnswer[];
};

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function extractJsonObject(rawText: string): Record<string, unknown> | null {
  const trimmed = rawText.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function parseJsonInsights(rawText: string): AiInsights {
  const parsed = extractJsonObject(rawText) as Partial<AiInsights> | null;
  if (!parsed) {
    return { topPainPoints: [], featureSuggestions: [] };
  }

  try {
    return {
      topPainPoints: Array.isArray(parsed.topPainPoints)
        ? parsed.topPainPoints.slice(0, 3).map(String)
        : [],
      featureSuggestions: Array.isArray(parsed.featureSuggestions)
        ? parsed.featureSuggestions.slice(0, 3).map(String)
        : []
    };
  } catch {
    return { topPainPoints: [], featureSuggestions: [] };
  }
}

function normalizeStringArray(value: unknown, limit = 6): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => String(entry).trim())
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeAssistantReadiness(value: unknown): PrdAssistantReadiness {
  if (value === "needs_more_info" || value === "ready_to_transfer") {
    return value;
  }
  return "needs_idea";
}

function normalizeCompetitors(value: unknown): PrdAssistantCompetitor[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<PrdAssistantCompetitor[]>((competitors, rawCompetitor) => {
    if (!rawCompetitor || typeof rawCompetitor !== "object") return competitors;
    const record = rawCompetitor as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const summary = typeof record.summary === "string" ? record.summary.trim() : "";
    if (!name) return competitors;
    competitors.push({ name, summary });
    return competitors;
  }, []).slice(0, 4);
}

function isCanonicalSectionTitle(value: string): value is (typeof CANONICAL_PRD_SECTION_TITLES)[number] {
  return CANONICAL_PRD_SECTION_TITLES.includes(
    value as (typeof CANONICAL_PRD_SECTION_TITLES)[number]
  );
}

function createIdeaDraftFallback(idea: string, clarificationNotes: string) {
  const assumptions = clarificationNotes.trim()
    ? clarificationNotes.trim()
    : "Assumption: The primary workflow, target segment, and success metric still need confirmation.";

  return `# Product Requirements Document
## Problem Statement
${idea.trim() || "A core product idea still needs to be defined."}

## Goals
- Validate whether the idea solves a clear user problem.
- Define a realistic v1 scope with measurable outcomes.

## Non-Goals
- Avoid assuming a complete solution before the user, workflow, and success criteria are confirmed.

## Target Users and Personas
- Primary user: TBD

## Key User Flows
- Core journey still needs to be mapped.

## Functional Requirements
- Core workflow: TBD

## Non-Functional Requirements
- Performance, reliability, and compliance requirements still need to be defined.

## User Stories
- As a primary user, I need a clear workflow so I can evaluate whether the product solves the problem.

## Acceptance Criteria
- Success conditions still need to be clarified.

## Success Metrics
- Define one outcome metric and one adoption metric for the first release.

## Risks and Mitigations
- Risk: The scope may be too broad without sharper constraints.

## Open Questions
- ${assumptions.replace(/\n+/g, "\n- ")}`;
}

function parseIdeaWorkspace(
  rawText: string,
  idea: string,
  clarificationNotes: string
): PrdAssistantWorkspace {
  const parsed = extractJsonObject(rawText);
  const fallbackReadiness: PrdAssistantReadiness = idea.trim() ? "needs_more_info" : "needs_idea";

  if (!parsed) {
    return {
      idea: idea.trim(),
      clarificationNotes: clarificationNotes.trim(),
      assistantOpinion: "The AI response could not be parsed into a structured PRD workspace.",
      ideaBreakdown: [],
      marketSummary: "",
      competitors: [],
      clarifyingQuestions: idea.trim()
        ? ["What user, workflow, and success metric should this PRD focus on first?"]
        : ["Start with a one-sentence product idea so the assistant can analyze it."],
      readiness: fallbackReadiness,
      draftMarkdown: createIdeaDraftFallback(idea, clarificationNotes)
    };
  }

  return {
    idea: idea.trim(),
    clarificationNotes: clarificationNotes.trim(),
    assistantOpinion:
      typeof parsed.assistantOpinion === "string" ? parsed.assistantOpinion.trim() : "",
    ideaBreakdown: normalizeStringArray(parsed.ideaBreakdown, 5),
    marketSummary: typeof parsed.marketSummary === "string" ? parsed.marketSummary.trim() : "",
    competitors: normalizeCompetitors(parsed.competitors),
    clarifyingQuestions: normalizeStringArray(parsed.clarifyingQuestions, 5),
    readiness: normalizeAssistantReadiness(parsed.readiness),
    draftMarkdown:
      typeof parsed.draftMarkdown === "string" && parsed.draftMarkdown.trim()
        ? parsed.draftMarkdown.trim()
        : createIdeaDraftFallback(idea, clarificationNotes)
  };
}

function createSectionContentFallback(sectionTitle: string, prompt: string) {
  return `## ${sectionTitle}
- TODO: Expand this section based on the request: ${prompt.trim() || "No prompt provided."}`;
}

function parseSectionContentResponse(
  rawText: string,
  sectionTitle: string,
  prompt: string
): { sectionTitle: string; sectionMarkdown: string } {
  const parsed = extractJsonObject(rawText);

  if (!parsed) {
    return {
      sectionTitle,
      sectionMarkdown: createSectionContentFallback(sectionTitle, prompt)
    };
  }

  const rawSectionMarkdown =
    typeof parsed.sectionMarkdown === "string" ? parsed.sectionMarkdown : "";

  return {
    sectionTitle,
    sectionMarkdown: normalizeSectionMarkdown(sectionTitle, rawSectionMarkdown)
  };
}

function isQuestionType(value: unknown): value is SurveyQuestionType {
  return value === "open_text" || value === "single_select" || value === "multi_select";
}

function normalizeSurveyQuestions(value: unknown): SurveyQuestion[] {
  if (!Array.isArray(value)) return [];

  if (value.every((item) => typeof item === "string")) {
    return value
      .map((question, index) => ({
        id: `legacy-q-${index + 1}`,
        prompt: question.trim(),
        type: "open_text" as const,
        options: []
      }))
      .filter((question) => question.prompt.length > 0);
  }

  return value
    .map((rawQuestion, index) => {
      if (!rawQuestion || typeof rawQuestion !== "object") return null;
      const record = rawQuestion as Record<string, unknown>;
      const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
      if (!prompt) return null;

      const type = isQuestionType(record.type) ? record.type : "open_text";
      const options =
        Array.isArray(record.options) && type !== "open_text"
          ? record.options
              .map((option) => String(option).trim())
              .filter(Boolean)
          : [];

      return {
        id: typeof record.id === "string" && record.id.trim() ? record.id : `q-${index + 1}`,
        prompt,
        type,
        options
      } satisfies SurveyQuestion;
    })
    .filter((question): question is SurveyQuestion => Boolean(question));
}

function normalizeSurveyAnswers(value: unknown): SurveyAnswer[] {
  if (!Array.isArray(value)) return [];
  return value.reduce<SurveyAnswer[]>((acc, rawAnswer) => {
    if (!rawAnswer || typeof rawAnswer !== "object") return acc;
    const record = rawAnswer as Record<string, unknown>;
    const questionId = typeof record.questionId === "string" ? record.questionId.trim() : "";
    if (!questionId) return acc;

    const answerText =
      typeof record.answerText === "string" ? record.answerText.trim() : undefined;
    const selectedOptions = Array.isArray(record.selectedOptions)
      ? record.selectedOptions.map((option) => String(option).trim()).filter(Boolean)
      : [];

    const normalized: SurveyAnswer = { questionId };
    if (answerText) normalized.answerText = answerText;
    if (selectedOptions.length > 0) normalized.selectedOptions = selectedOptions;
    acc.push(normalized);
    return acc;
  }, []);
}

type ProjectResearchContext = {
  studies: StudyRecord[];
  submissions: SubmissionRecord[];
};

type GeneratePrdIdeaWorkspaceInput = {
  prdId: string;
  projectId: string | null;
  idea: string;
  clarificationNotes: string;
  currentWorkspace?: Partial<PrdAssistantWorkspace>;
};

async function loadProjectResearchContext(
  projectId: string,
  ownerId: string
): Promise<ProjectResearchContext> {
  const adminDb = getAdminDb();
  const studiesSnapshot = await adminDb
    .collection("studies")
    .where("projectId", "==", projectId)
    .where("ownerId", "==", ownerId)
    .get();

  const studies: StudyRecord[] = studiesSnapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    title: String(docSnap.data().title ?? ""),
    userSegment: String(docSnap.data().userSegment ?? ""),
    surveyQuestions: normalizeSurveyQuestions(docSnap.data().surveyQuestions)
  }));

  if (!studies.length) {
    return { studies, submissions: [] };
  }

  const studyIds = studies.map((study) => study.id);
  const batches = chunk(studyIds, 10);
  const submissionDocs = await Promise.all(
    batches.map((batch) =>
      adminDb.collection("submissions").where("studyId", "in", batch).get()
    )
  );

  const submissions: SubmissionRecord[] = submissionDocs
    .flatMap((snapshot) => snapshot.docs)
    .map((docSnap) => ({
      studyId: String(docSnap.data().studyId ?? ""),
      helperId: String(docSnap.data().helperId ?? ""),
      status: String(docSnap.data().status ?? ""),
      responseSummary: docSnap.data().responseSummary
        ? String(docSnap.data().responseSummary)
        : undefined,
      answers: normalizeSurveyAnswers(docSnap.data().answers)
    }));

  return { studies, submissions };
}

export async function generateInsightsForProject(projectId: string): Promise<AiInsights> {
  const { uid } = await requirePmServerUser();

  let context: ProjectResearchContext;
  try {
    context = await loadProjectResearchContext(projectId, uid);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Missing Firebase Admin credentials")
    ) {
      return {
        topPainPoints: ["Admin credentials missing. Configure Firebase Admin env vars."],
        featureSuggestions: ["Set FIREBASE_ADMIN_* vars to enable AI insights analysis."]
      };
    }
    throw error;
  }

  if (!context.studies.length) {
    return {
      topPainPoints: ["No studies available for this project yet."],
      featureSuggestions: ["Create and run studies to unlock AI insights."]
    };
  }

  if (!context.submissions.length) {
    return {
      topPainPoints: ["No helper submissions yet for this project."],
      featureSuggestions: ["Assign helpers and collect responses for AI synthesis."]
    };
  }

  const prompt = `
You are a senior product analyst.
Analyze the project submissions and return strict JSON only:
{
  "topPainPoints": ["...", "...", "..."],
  "featureSuggestions": ["...", "...", "..."]
}

Studies:
${JSON.stringify(context.studies, null, 2)}

Submissions:
${JSON.stringify(context.submissions, null, 2)}
`;

  const text = await requestGeminiText({ prompt, temperature: 0.2 });
  const insights = parseJsonInsights(text);

  return {
    topPainPoints:
      insights.topPainPoints.length > 0
        ? insights.topPainPoints
        : ["Unable to infer pain points from current submissions."],
    featureSuggestions:
      insights.featureSuggestions.length > 0
        ? insights.featureSuggestions
        : ["Unable to infer feature suggestions from current submissions."]
  };
}

export async function generatePrdIdeaWorkspace(
  input: GeneratePrdIdeaWorkspaceInput
): Promise<PrdAssistantWorkspace> {
  const { uid } = await requirePmServerUser();

  if (!input.prdId.trim()) {
    throw new Error("PRD ID is required.");
  }

  const idea = input.idea.trim();
  if (!idea) {
    return {
      idea: "",
      clarificationNotes: input.clarificationNotes.trim(),
      assistantOpinion: "",
      ideaBreakdown: [],
      marketSummary: "",
      competitors: [],
      clarifyingQuestions: ["Start with a one-sentence product idea so the assistant can analyze it."],
      readiness: "needs_idea",
      draftMarkdown: ""
    };
  }

  let projectResearchContext: ProjectResearchContext | null = null;
  let projectResearchNote = "No linked project context.";

  if (input.projectId?.trim()) {
    try {
      projectResearchContext = await loadProjectResearchContext(input.projectId, uid);
      projectResearchNote = "Linked project research context included.";
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Missing Firebase Admin credentials")
      ) {
        projectResearchNote =
          "Linked project detected, but stored research context could not be loaded because Firebase Admin credentials are unavailable.";
      } else {
        throw error;
      }
    }
  }

  const currentWorkspace = input.currentWorkspace
    ? {
        assistantOpinion: input.currentWorkspace.assistantOpinion ?? "",
        ideaBreakdown: input.currentWorkspace.ideaBreakdown ?? [],
        marketSummary: input.currentWorkspace.marketSummary ?? "",
        competitors: input.currentWorkspace.competitors ?? [],
        clarifyingQuestions: input.currentWorkspace.clarifyingQuestions ?? [],
        readiness: input.currentWorkspace.readiness ?? "needs_idea",
        draftMarkdown: input.currentWorkspace.draftMarkdown ?? ""
      }
    : null;

  const prompt = `
You are a principal product manager helping turn a rough idea into a realistic PRD starter.
Return strict JSON only:
{
  "assistantOpinion": "2-4 sentence opinion on the idea's potential and realism",
  "ideaBreakdown": ["3-5 bullets that break the idea into product decisions or workstreams"],
  "marketSummary": "Short AI-generated market and competitor snapshot. Do not imply live or verified research.",
  "competitors": [
    {
      "name": "Competitor name",
      "summary": "How the competitor is relevant"
    }
  ],
  "clarifyingQuestions": ["1-5 specific questions needed to make the PRD realistic"],
  "readiness": "needs_idea | needs_more_info | ready_to_transfer",
  "draftMarkdown": "A concise but useful markdown PRD starter with assumptions where context is missing"
}

Rules:
- Use "needs_idea" only if the idea is empty or too vague to reason about.
- Use "needs_more_info" when the idea is promising but important details are still missing.
- Use "ready_to_transfer" only when the idea is specific enough for the draftMarkdown to be moved into the PRD canvas.
- Keep ideaBreakdown focused on practical product framing, scope, risks, and execution.
- Competitors must use broad model knowledge only. Do not claim live or verified current-market research.
- draftMarkdown must always be usable and should include explicit assumptions or open questions when details are missing.
- draftMarkdown must use this exact structure and exact headings:
  # Product Requirements Document
  ## Problem Statement
  ## Goals
  ## Non-Goals
  ## Target Users and Personas
  ## Key User Flows
  ## Functional Requirements
  ## Non-Functional Requirements
  ## User Stories
  ## Acceptance Criteria
  ## Success Metrics
  ## Risks and Mitigations
  ## Open Questions
- Keep the output concise, realistic, and execution-oriented.

PRD ID:
${input.prdId}

Linked project ID:
${input.projectId?.trim() || "None"}

Project context note:
${projectResearchNote}

Simple idea:
${idea}

Clarification notes:
${input.clarificationNotes.trim() || "None yet."}

Existing assistant workspace:
${currentWorkspace ? JSON.stringify(currentWorkspace, null, 2) : "None"}

Linked project research studies:
${projectResearchContext ? JSON.stringify(projectResearchContext.studies, null, 2) : "None"}

Linked project research submissions:
${projectResearchContext ? JSON.stringify(projectResearchContext.submissions, null, 2) : "None"}
`;

  const text = await requestGeminiText({ prompt, temperature: 0.2 });
  return parseIdeaWorkspace(text, idea, input.clarificationNotes);
}

type FullPrdInput = {
  projectId: string;
  currentPrdText: string;
};

export async function generateFullPrdFromProjectContext(
  input: FullPrdInput
): Promise<string> {
  const { uid } = await requirePmServerUser();

  if (!input.projectId.trim()) {
    throw new Error("Project ID is required.");
  }

  const context = await loadProjectResearchContext(input.projectId, uid);
  const prompt = `
You are a principal product manager.
Generate a complete Product Requirements Document in markdown.

Use this section structure exactly:
# Product Requirements Document
## Problem Statement
## Goals
## Non-Goals
## Target Users and Personas
## Key User Flows
## Functional Requirements
## Non-Functional Requirements
## User Stories
## Acceptance Criteria
## Success Metrics
## Risks and Mitigations
## Open Questions

Rules:
- Use all provided context.
- If context is missing, add explicit assumptions under the most relevant section.
- Keep the PRD execution-ready and concise.

Project ID:
${input.projectId}

Current PRD draft:
${input.currentPrdText || "No existing draft."}

Research studies context:
${JSON.stringify(context.studies, null, 2)}

Research submissions context:
${JSON.stringify(context.submissions, null, 2)}
`;

  return requestGeminiText({ prompt, temperature: 0.15 });
}

type GeneratePrdAppendInput = {
  prdId: string;
  prompt: string;
  currentPrdText: string;
};

type GeneratePrdSectionInput = {
  prdId: string;
  prompt: string;
  sectionTitle: string;
  currentSectionMarkdown: string;
  draftSectionMarkdown: string;
  currentPrdText: string;
};

export async function generateAndAppendPrdContent(
  input: GeneratePrdAppendInput
): Promise<string> {
  await requirePmServerUser();

  if (!input.prdId.trim()) {
    throw new Error("PRD ID is required.");
  }

  if (!input.prompt.trim()) {
    throw new Error("Prompt is required.");
  }

  const prompt = `
${PRD_SYSTEM_INSTRUCTIONS}

Current PRD:
${input.currentPrdText}

User request:
${input.prompt}
`;

  return requestGeminiText({ prompt, temperature: 0.2 });
}

export async function generatePrdSectionContent(
  input: GeneratePrdSectionInput
): Promise<{ sectionTitle: string; sectionMarkdown: string }> {
  await requirePmServerUser();

  if (!input.prdId.trim()) {
    throw new Error("PRD ID is required.");
  }

  if (!input.prompt.trim()) {
    throw new Error("Prompt is required.");
  }

  const sectionTitle = input.sectionTitle.trim();
  if (!isCanonicalSectionTitle(sectionTitle)) {
    throw new Error("A valid PRD section is required.");
  }

  const prompt = `
You are a principal product manager editing a single Product Requirements Document section.
Return strict JSON only:
{
  "sectionTitle": "${sectionTitle}",
  "sectionMarkdown": "## ${sectionTitle}\\n..."
}

Rules:
- sectionTitle must be exactly "${sectionTitle}".
- sectionMarkdown must start with "## ${sectionTitle}".
- Only write the requested section. Do not include the document title or any other ## section.
- Use the current section markdown when it exists.
- Use the AI draft section markdown when it is helpful.
- If details are missing, add explicit assumptions or open questions inside this section instead of inventing certainty.
- Keep the section concise, actionable, and consistent with the broader PRD.

${PRD_SYSTEM_INSTRUCTIONS}

PRD ID:
${input.prdId}

Target section:
${sectionTitle}

Current section markdown:
${input.currentSectionMarkdown.trim() || "Section not yet present in the canvas."}

AI draft section markdown:
${input.draftSectionMarkdown.trim() || "Section not yet present in the assistant draft."}

Full current PRD:
${input.currentPrdText.trim() || "No current PRD content."}

User request:
${input.prompt.trim()}
`;

  const text = await requestGeminiText({ prompt, temperature: 0.2 });
  return parseSectionContentResponse(text, sectionTitle, input.prompt);
}
