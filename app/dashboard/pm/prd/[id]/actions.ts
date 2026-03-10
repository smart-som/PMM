"use server";

import { requestGeminiText } from "@/lib/ai/gemini";
import { getAdminDb } from "@/lib/firebase/admin";
import { PRD_SYSTEM_INSTRUCTIONS } from "@/lib/ai/prd-system-prompt";
import { requirePmServerUser } from "@/lib/server/auth";
import { AiInsights, SurveyAnswer, SurveyQuestion, SurveyQuestionType } from "@/types/app";

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

function parseJsonInsights(rawText: string): AiInsights {
  const trimmed = rawText.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    return { topPainPoints: [], featureSuggestions: [] };
  }

  try {
    const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as Partial<AiInsights>;
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

type ImplementationSuggestionInput = {
  projectId: string;
  targetFilePath: string;
  prdContent: string;
};

export async function generateImplementationSuggestion(
  input: ImplementationSuggestionInput
): Promise<string> {
  await requirePmServerUser();

  if (!input.targetFilePath.trim()) {
    throw new Error("Target file path is required.");
  }

  if (!input.prdContent.trim()) {
    throw new Error("PRD content is required.");
  }

  const prompt = `
You are a principal full-stack engineer.
Given the PRD requirements and a mocked target file path, propose implementation edits.

Rules:
- Return markdown.
- Include exactly one code block.
- In the code block, show concrete lines to add or change for the target file.
- Mention insertion/replacement hints as comments (e.g. "// Add near imports", "// Replace existing handler").
- Keep output concise and implementation-oriented.

Project ID: ${input.projectId}
Mocked target file path: ${input.targetFilePath}

PRD requirements:
${input.prdContent}
`;

  return requestGeminiText({ prompt, temperature: 0.2 });
}

type GeneratePrdAppendInput = {
  prdId: string;
  prompt: string;
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
