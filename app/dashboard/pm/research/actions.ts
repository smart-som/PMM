"use server";

import { requestGeminiText } from "@/lib/ai/gemini";
import { getAdminDb } from "@/lib/firebase/admin";
import { requirePmServerUser } from "@/lib/server/auth";
import {
  StudyInsights,
  SurveyAnswer,
  SurveyQuestion,
  SurveyQuestionType
} from "@/types/app";

type ResearchQuestionDraftInput = {
  productContext: string;
  projectId?: string | null;
  researchGoal: string;
  targetUserSegment: string;
};

type GeneratedQuestion = {
  options?: string[];
  prompt?: string;
  type?: SurveyQuestionType;
};

type GeneratedQuestionDraftPayload = {
  questions?: GeneratedQuestion[];
  suggestedTitle?: string;
  suggestedUserSegment?: string;
};

type GenerateStudyInsightsInput = {
  force?: boolean;
  studyId: string;
};

type StudySubmissionRecord = {
  answers: SurveyAnswer[];
  createdAt?: string;
  helperId: string;
  responseSummary?: string;
  status: string;
};

function parseJsonPayload<T>(raw: string): Partial<T> {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) return {};

  try {
    return JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as Partial<T>;
  } catch {
    return {};
  }
}

function isQuestionType(value: unknown): value is SurveyQuestionType {
  return value === "open_text" || value === "single_select" || value === "multi_select";
}

function normalizeQuestions(value: unknown): SurveyQuestion[] {
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
          ? record.options.map((option) => String(option).trim()).filter(Boolean)
          : [];

      if (type !== "open_text" && options.length < 2) return null;

      return {
        id: typeof record.id === "string" && record.id.trim() ? record.id : `ai-q-${index + 1}`,
        prompt,
        type,
        options
      } satisfies SurveyQuestion;
    })
    .filter((question): question is SurveyQuestion => Boolean(question));
}

function normalizeAnswers(value: unknown): SurveyAnswer[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<SurveyAnswer[]>((answers, rawAnswer) => {
    if (!rawAnswer || typeof rawAnswer !== "object") return answers;
    const record = rawAnswer as Record<string, unknown>;
    const questionId = typeof record.questionId === "string" ? record.questionId.trim() : "";
    if (!questionId) return answers;

    answers.push({
      questionId,
      answerText: typeof record.answerText === "string" ? record.answerText.trim() : undefined,
      selectedOptions: Array.isArray(record.selectedOptions)
        ? record.selectedOptions.map((option) => String(option).trim()).filter(Boolean)
        : []
    });
    return answers;
  }, []);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim()).filter(Boolean);
}

function toIsoDate(value: unknown): string | undefined {
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") {
      return (toDate as () => Date)().toISOString();
    }
  }
  return undefined;
}

export async function generateResearchQuestionDraft(input: ResearchQuestionDraftInput) {
  const { uid } = await requirePmServerUser();
  const adminDb = getAdminDb();
  const researchGoal = input.researchGoal.trim();
  const productContext = input.productContext.trim();
  const targetUserSegment = input.targetUserSegment.trim();
  const projectId = input.projectId?.trim() || "";

  if (!researchGoal) {
    throw new Error("Research goal is required.");
  }
  if (!productContext) {
    throw new Error("Product context is required.");
  }
  if (!targetUserSegment) {
    throw new Error("Target user segment is required.");
  }

  let projectSummary = "No specific project selected.";
  if (projectId) {
    const projectSnap = await adminDb.collection("projects").doc(projectId).get();
    if (!projectSnap.exists || String(projectSnap.data()?.ownerId ?? "") !== uid) {
      throw new Error("Select a valid project from your workspace.");
    }
    projectSummary = `Project ID: ${projectId}\nProject name: ${String(projectSnap.data()?.name ?? "Untitled project")}`;
  }

  const prompt = `
You are a senior product researcher.
Generate strict JSON only for a helper-facing product research survey.

JSON schema:
{
  "suggestedTitle": "string",
  "suggestedUserSegment": "string",
  "questions": [
    {
      "prompt": "string",
      "type": "open_text|single_select|multi_select",
      "options": ["string", "string"]
    }
  ]
}

Rules:
- Generate 6 to 10 questions.
- Focus on what a product manager needs to learn before building, while building, or after launch.
- Use a mix of open_text and select questions where appropriate.
- For single_select and multi_select, include at least 2 options.
- Avoid duplicate or vague questions.
- Helpers are the respondents.

Research goal:
${researchGoal}

Product context:
${productContext}

Target user segment:
${targetUserSegment}

Project context:
${projectSummary}
`;

  const text = await requestGeminiText({ prompt, temperature: 0.2 });
  const payload = parseJsonPayload<GeneratedQuestionDraftPayload>(text);
  const surveyQuestions = normalizeQuestions(payload.questions);

  if (!surveyQuestions.length) {
    throw new Error("AI could not generate valid research questions. Please retry.");
  }

  return {
    suggestedTitle:
      typeof payload.suggestedTitle === "string" && payload.suggestedTitle.trim()
        ? payload.suggestedTitle.trim()
        : "AI Research Draft",
    suggestedUserSegment:
      typeof payload.suggestedUserSegment === "string" && payload.suggestedUserSegment.trim()
        ? payload.suggestedUserSegment.trim()
        : targetUserSegment,
    surveyQuestions
  };
}

export async function generateStudyInsights(
  input: GenerateStudyInsightsInput
): Promise<StudyInsights> {
  const { uid } = await requirePmServerUser();
  const adminDb = getAdminDb();
  const studyId = input.studyId.trim();

  if (!studyId) {
    throw new Error("Study ID is required.");
  }

  const studySnap = await adminDb.collection("studies").doc(studyId).get();
  if (!studySnap.exists) {
    throw new Error("This study no longer exists.");
  }

  const studyData = studySnap.data();
  if (String(studyData?.ownerId ?? "") !== uid) {
    throw new Error("You cannot analyze this study.");
  }

  const submissionsSnap = await adminDb
    .collection("submissions")
    .where("studyId", "==", studyId)
    .get();

  const submissions: StudySubmissionRecord[] = submissionsSnap.docs.map((docSnap) => ({
    helperId: String(docSnap.data().helperId ?? ""),
    status: String(docSnap.data().status ?? ""),
    responseSummary:
      typeof docSnap.data().responseSummary === "string"
        ? docSnap.data().responseSummary.trim()
        : undefined,
    answers: normalizeAnswers(docSnap.data().answers),
    createdAt: toIsoDate(docSnap.data().createdAt)
  }));

  if (submissions.length < 5) {
    throw new Error("AI insights unlock after at least 5 helper responses.");
  }

  const existingInsightSnap = await adminDb.collection("study_insights").doc(studyId).get();
  if (existingInsightSnap.exists && !input.force) {
    const data = existingInsightSnap.data();
    if (typeof data?.summary === "string" && data.summary.trim()) {
      return {
        studyId,
        ownerId: String(data.ownerId ?? uid),
        responseCountAtGeneration:
          typeof data.responseCountAtGeneration === "number"
            ? data.responseCountAtGeneration
            : submissions.length,
        themes: normalizeStringArray(data.themes),
        summary: String(data.summary ?? ""),
        recommendations: normalizeStringArray(data.recommendations),
        updatedAt:
          data?.updatedAt && typeof data.updatedAt.toMillis === "function"
            ? data.updatedAt.toMillis()
            : undefined
      };
    }
  }

  const prompt = `
You are a principal product researcher.
Analyze the helper research responses and return strict JSON only.

JSON schema:
{
  "themes": ["string", "string", "string"],
  "summary": "string",
  "recommendations": ["string", "string", "string"]
}

Rules:
- Focus on practical product insights, not generic observations.
- Themes should be short labels.
- Summary should be 3 to 6 sentences.
- Recommendations should be specific product actions.

Study:
${JSON.stringify(
    {
      id: studyId,
      title: String(studyData?.title ?? ""),
      userSegment: String(studyData?.userSegment ?? ""),
      distributionMode: String(studyData?.distributionMode ?? "open"),
      questions: normalizeQuestions(studyData?.surveyQuestions)
    },
    null,
    2
  )}

Submissions:
${JSON.stringify(submissions, null, 2)}
`;

  const text = await requestGeminiText({ prompt, temperature: 0.2 });
  const payload = parseJsonPayload<{
    recommendations?: string[];
    summary?: string;
    themes?: string[];
  }>(text);

  const insight: StudyInsights = {
    studyId,
    ownerId: uid,
    responseCountAtGeneration: submissions.length,
    themes: normalizeStringArray(payload.themes).slice(0, 5),
    summary:
      typeof payload.summary === "string" && payload.summary.trim()
        ? payload.summary.trim()
        : "AI could not produce a clean written summary for this response set.",
    recommendations: normalizeStringArray(payload.recommendations).slice(0, 5)
  };

  await adminDb.collection("study_insights").doc(studyId).set({
    ...insight,
    updatedAt: new Date()
  });

  return {
    ...insight,
    updatedAt: Date.now()
  };
}
