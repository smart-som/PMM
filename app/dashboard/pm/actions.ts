"use server";

import { requestGeminiText } from "@/lib/ai/gemini";
import { getAdminDb } from "@/lib/firebase/admin";
import { requirePmServerUser } from "@/lib/server/auth";
import {
  RoadmapPriority,
  RoadmapQuarter,
  StudyStatus,
  SurveyQuestion,
  SurveyQuestionType
} from "@/types/app";

type KickstartInput = {
  projectId: string;
  ideaPrompt: string;
  budgetPerResponse: number;
  userSegment: string;
};

type KickstartResult = {
  projectId: string;
  studyId: string;
  prdId: string;
  roadmapItemCount: number;
  status: StudyStatus;
};

type KickstartPayload = {
  study?: {
    title?: string;
    userSegment?: string;
    questions?: KickstartQuestion[];
  };
  prdMarkdown?: string;
  roadmap?: {
    items?: Array<{
      title?: string;
      description?: string;
      quarter?: RoadmapQuarter;
      priority?: RoadmapPriority;
    }>;
  };
};

type KickstartQuestion = {
  prompt?: string;
  type?: SurveyQuestionType;
  options?: string[];
};

function isQuestionType(value: unknown): value is SurveyQuestionType {
  return value === "open_text" || value === "single_select" || value === "multi_select";
}

function isQuarter(value: unknown): value is RoadmapQuarter {
  return value === "Q1" || value === "Q2" || value === "Q3" || value === "Q4";
}

function isPriority(value: unknown): value is RoadmapPriority {
  return value === "low" || value === "medium" || value === "high";
}

function nextQuestionId(index: number) {
  return `kickstart-q-${index + 1}`;
}

function parseKickstartPayload(raw: string): KickstartPayload {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) return {};

  try {
    return JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as KickstartPayload;
  } catch {
    return {};
  }
}

function normalizeQuestions(questions: KickstartQuestion[] | undefined): SurveyQuestion[] {
  if (!Array.isArray(questions)) return [];

  return questions
    .map((question, index) => {
      const prompt = typeof question?.prompt === "string" ? question.prompt.trim() : "";
      if (!prompt) return null;

      const type = isQuestionType(question?.type) ? question.type : "open_text";
      const options =
        Array.isArray(question?.options) && type !== "open_text"
          ? question.options
              .map((option) => String(option).trim())
              .filter(Boolean)
          : [];

      return {
        id: nextQuestionId(index),
        prompt,
        type,
        options
      } satisfies SurveyQuestion;
    })
    .filter((question): question is SurveyQuestion => Boolean(question))
    .filter((question) => question.type === "open_text" || question.options.length >= 2);
}

export async function generateProjectKickstart(
  input: KickstartInput
): Promise<KickstartResult> {
  const { uid } = await requirePmServerUser();

  if (!input.projectId.trim()) {
    throw new Error("Project ID is required.");
  }
  if (!input.ideaPrompt.trim()) {
    throw new Error("Idea prompt is required.");
  }
  if (input.budgetPerResponse <= 0) {
    throw new Error("Budget per response must be greater than zero.");
  }

  const prompt = `
You are a senior product manager and researcher.
Generate strict JSON only for kickstarting a project from an idea.

JSON schema:
{
  "study": {
    "title": "string",
    "userSegment": "string",
    "questions": [
      {
        "prompt": "string",
        "type": "open_text|single_select|multi_select",
        "options": ["string", "string"]
      }
    ]
  },
  "prdMarkdown": "full markdown PRD with sections",
  "roadmap": {
    "items": [
      {
        "title": "string",
        "description": "string",
        "quarter": "Q1|Q2|Q3|Q4",
        "priority": "low|medium|high"
      }
    ]
  }
}

Rules:
- Include 6-10 study questions.
- Use options only for single_select/multi_select and include at least 2 options.
- PRD markdown must include: Problem Statement, Goals, Non-Goals, Personas, Requirements, User Stories, Acceptance Criteria, Metrics, Risks, Open Questions.
- Roadmap items: max 8.

Idea prompt:
${input.ideaPrompt}

Project ID:
${input.projectId}

Target user segment:
${input.userSegment}
`;

  const generatedText = await requestGeminiText({ prompt, temperature: 0.2 });
  const payload = parseKickstartPayload(generatedText);
  const normalizedQuestions = normalizeQuestions(payload.study?.questions);

  if (!normalizedQuestions.length) {
    throw new Error("AI could not generate valid research questions. Please retry.");
  }

  const studyTitle =
    typeof payload.study?.title === "string" && payload.study.title.trim()
      ? payload.study.title.trim()
      : "AI Kickstart Study";
  const userSegment =
    typeof payload.study?.userSegment === "string" && payload.study.userSegment.trim()
      ? payload.study.userSegment.trim()
      : input.userSegment.trim() || "General users";
  const prdMarkdown =
    typeof payload.prdMarkdown === "string" && payload.prdMarkdown.trim()
      ? payload.prdMarkdown.trim()
      : "# Product Requirements Document\n\n## Problem Statement\n\n## Goals\n\n## Non-Goals";

  const roadmapItems = Array.isArray(payload.roadmap?.items)
    ? payload.roadmap.items
        .map((item) => {
          const title = typeof item?.title === "string" ? item.title.trim() : "";
          if (!title) return null;
          return {
            title,
            description:
              typeof item?.description === "string" ? item.description.trim() : "",
            quarter: isQuarter(item?.quarter) ? item.quarter : "Q1",
            priority: isPriority(item?.priority) ? item.priority : "medium"
          };
        })
        .filter((item): item is { title: string; description: string; quarter: RoadmapQuarter; priority: RoadmapPriority } => Boolean(item))
        .slice(0, 8)
    : [];

  const adminDb = getAdminDb();
  const status: StudyStatus = "draft";
  const studyRef = adminDb.collection("studies").doc();
  const surveyRef = adminDb.collection("active_surveys").doc(studyRef.id);
  const prdRef = adminDb.collection("prds").doc(input.projectId);
  const batch = adminDb.batch();
  const now = new Date();

  batch.set(studyRef, {
    projectId: input.projectId.trim(),
    ownerId: uid,
    title: studyTitle,
    userSegment,
    budgetPerResponse: input.budgetPerResponse,
    surveyQuestions: normalizedQuestions,
    helperIds: [],
    status,
    createdAt: now
  });

  batch.set(surveyRef, {
    studyId: studyRef.id,
    projectId: input.projectId.trim(),
    ownerId: uid,
    title: studyTitle,
    description: `Audience: ${userSegment}`,
    userSegment,
    surveyQuestions: normalizedQuestions,
    status,
    rewardAmount: input.budgetPerResponse,
    budgetPerResponse: input.budgetPerResponse,
    createdAt: now
  });

  batch.set(
    prdRef,
    {
      projectId: input.projectId.trim(),
      ownerId: uid,
      title: "Product Requirements Document",
      content: prdMarkdown,
      updatedAt: now
    },
    { merge: true }
  );

  roadmapItems.forEach((item) => {
    const itemRef = adminDb.collection("roadmap_items").doc();
    batch.set(itemRef, {
      ownerId: uid,
      projectId: input.projectId.trim(),
      quarter: item.quarter,
      title: item.title,
      description: item.description,
      priority: item.priority,
      createdAt: now
    });
  });

  await batch.commit();

  return {
    projectId: input.projectId.trim(),
    studyId: studyRef.id,
    prdId: prdRef.id,
    roadmapItemCount: roadmapItems.length,
    status
  };
}
