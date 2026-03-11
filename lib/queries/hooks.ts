"use client";

import { useQuery } from "@tanstack/react-query";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where
} from "firebase/firestore";
import { useEffect, useState } from "react";

import { getFirebaseDb } from "@/lib/firebase/client";
import {
  getAvailableActiveSurveysByHelper,
  getProjectsByOwner,
  getStudiesByOwner,
  isExpiredSoloStudy
} from "@/lib/queries/firestore";
import {
  Study,
  StudyInsights,
  Submission,
  SurveyAnswer,
  SurveyQuestion,
  SurveyQuestionType,
  UserRole
} from "@/types/app";

function toMillis(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return undefined;
}

function isQuestionType(value: unknown): value is SurveyQuestionType {
  return value === "open_text" || value === "single_select" || value === "multi_select";
}

function normalizeNullableProjectId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  return null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim()).filter(Boolean);
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
          ? record.options.map((option) => String(option).trim()).filter(Boolean)
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
      selectedOptions: normalizeStringArray(record.selectedOptions)
    });
    return answers;
  }, []);
}

function toStudy(studyId: string, data: Record<string, unknown>): Study {
  return {
    id: studyId,
    projectId: normalizeNullableProjectId(data.projectId),
    ownerId: String(data.ownerId ?? ""),
    title: String(data.title ?? "Untitled study"),
    userSegment: String(data.userSegment ?? ""),
    budgetPerResponse:
      typeof data.budgetPerResponse === "number" ? data.budgetPerResponse : 0,
    surveyQuestions: normalizeSurveyQuestions(data.surveyQuestions),
    distributionMode: data.distributionMode === "assigned" ? "assigned" : "open",
    helperIds: normalizeStringArray(data.helperIds),
    status: data.status === "draft" ? "draft" : "published",
    expiresAt: toMillis(data.expiresAt),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt)
  };
}

function toSubmission(submissionId: string, data: Record<string, unknown>): Submission {
  return {
    id: submissionId,
    studyId: String(data.studyId ?? ""),
    helperId: String(data.helperId ?? ""),
    answers: normalizeAnswers(data.answers),
    responseSummary:
      typeof data.responseSummary === "string" ? data.responseSummary.trim() : undefined,
    status: "pending_review",
    createdAt: toMillis(data.createdAt)
  };
}

function toStudyInsights(studyId: string, data: Record<string, unknown>): StudyInsights {
  return {
    studyId,
    ownerId: String(data.ownerId ?? ""),
    responseCountAtGeneration:
      typeof data.responseCountAtGeneration === "number" ? data.responseCountAtGeneration : 0,
    themes: normalizeStringArray(data.themes),
    summary: String(data.summary ?? ""),
    recommendations: normalizeStringArray(data.recommendations),
    updatedAt: toMillis(data.updatedAt)
  };
}

export function useRoleData(uid: string | null, role: UserRole | null) {
  const projectsQuery = useQuery({
    queryKey: ["projects", uid],
    queryFn: () => getProjectsByOwner(uid as string),
    enabled: Boolean(uid && role === "pm")
  });

  const studiesQuery = useQuery({
    queryKey: ["studies", uid],
    queryFn: () => getAvailableActiveSurveysByHelper(uid as string),
    enabled: Boolean(uid && role === "helper")
  });

  const pmStudiesQuery = useQuery({
    queryKey: ["pm-studies", uid],
    queryFn: () => getStudiesByOwner(uid as string),
    enabled: Boolean(uid && role === "pm")
  });

  return { projectsQuery, studiesQuery, pmStudiesQuery };
}

type RealtimeResearchState = {
  insight: StudyInsights | null;
  isLoading: boolean;
  study: Study | null;
  submissions: Submission[];
};

export function useRealtimeResearchStudy(
  studyId: string | null,
  enabled = true
): RealtimeResearchState {
  const [study, setStudy] = useState<Study | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [insight, setInsight] = useState<StudyInsights | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(studyId && enabled));

  useEffect(() => {
    if (!studyId || !enabled) {
      setStudy(null);
      setSubmissions([]);
      setInsight(null);
      setIsLoading(false);
      return;
    }

    const db = getFirebaseDb();
    if (!db) {
      setStudy(null);
      setSubmissions([]);
      setInsight(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const loaded = {
      insight: false,
      study: false,
      submissions: false
    };
    const markLoaded = (key: keyof typeof loaded) => {
      loaded[key] = true;
      if (loaded.study && loaded.submissions && loaded.insight) {
        setIsLoading(false);
      }
    };

    const unsubscribeStudy = onSnapshot(
      doc(db, "studies", studyId),
      (snapshot) => {
        const nextStudy = snapshot.exists()
          ? toStudy(snapshot.id, snapshot.data() as Record<string, unknown>)
          : null;
        if (nextStudy && isExpiredSoloStudy(nextStudy)) {
          setStudy(null);
          setSubmissions([]);
          setInsight(null);
        } else {
          setStudy(nextStudy);
        }
        markLoaded("study");
      },
      (error) => {
        console.error("[research] study subscription failed", error);
        setStudy(null);
        markLoaded("study");
      }
    );

    const unsubscribeSubmissions = onSnapshot(
      query(collection(db, "submissions"), where("studyId", "==", studyId)),
      (snapshot) => {
        const nextSubmissions = snapshot.docs
          .map((docSnap) => toSubmission(docSnap.id, docSnap.data() as Record<string, unknown>))
          .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        setSubmissions(nextSubmissions);
        markLoaded("submissions");
      },
      (error) => {
        console.error("[research] submissions subscription failed", error);
        setSubmissions([]);
        markLoaded("submissions");
      }
    );

    const unsubscribeInsights = onSnapshot(
      doc(db, "study_insights", studyId),
      (snapshot) => {
        setInsight(
          snapshot.exists()
            ? toStudyInsights(snapshot.id, snapshot.data() as Record<string, unknown>)
            : null
        );
        markLoaded("insight");
      },
      (error) => {
        console.error("[research] insight subscription failed", error);
        setInsight(null);
        markLoaded("insight");
      }
    );

    return () => {
      unsubscribeStudy();
      unsubscribeSubmissions();
      unsubscribeInsights();
    };
  }, [enabled, studyId]);

  return { study, submissions, insight, isLoading };
}
