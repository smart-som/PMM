"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  generateResearchQuestionDraft,
  generateStudyInsights
} from "@/app/dashboard/pm/research/actions";
import {
  SelectOptionEditor,
  createSelectOptionDrafts,
  getSelectOptionValidation,
  sanitizeSelectOptions
} from "@/components/research/select-option-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/contexts/session-context";
import {
  SOLO_RESEARCH_TRIAL_DAYS,
  cleanupExpiredSoloStudies,
  getPmResearchSummary,
  saveStudy
} from "@/lib/queries/firestore";
import { useRealtimeResearchStudy, useRoleData } from "@/lib/queries/hooks";
import {
  PMResearchStudySummary,
  Study,
  StudyDistributionMode,
  SurveyAnswer,
  SurveyQuestion,
  SurveyQuestionType
} from "@/types/app";

type StudyBuilderState = {
  budgetPerResponse: string;
  distributionMode: StudyDistributionMode;
  helperIdsText: string;
  projectId: string;
  studyId: string | null;
  surveyQuestions: SurveyQuestion[];
  title: string;
  userSegment: string;
};

type QuestionAnalytics = {
  answers: string[];
  counts: Array<{ count: number; option: string }>;
  question: SurveyQuestion;
};

type BuilderStatus = "ready" | "incomplete" | "blocked";

type QuestionDisplayState = {
  message: string;
  status: BuilderStatus;
};

type ResultsRailTab = "overview" | "insights" | "responses";

const builderStatusMeta: Record<
  BuilderStatus,
  { badgeClassName: string; label: string; panelClassName: string; textClassName: string }
> = {
  ready: {
    label: "Ready",
    badgeClassName: "border-success/30 bg-success/10 text-success",
    panelClassName: "border-success/20 bg-success/5",
    textClassName: "text-success"
  },
  incomplete: {
    label: "Incomplete",
    badgeClassName: "border-accent/30 bg-accent/10 text-accent",
    panelClassName: "border-border bg-surface/80",
    textClassName: "text-accent"
  },
  blocked: {
    label: "Blocked",
    badgeClassName: "border-danger/30 bg-danger/10 text-danger",
    panelClassName: "border-danger/20 bg-danger/5",
    textClassName: "text-danger"
  }
};

function StatusBadge({ status }: { status: BuilderStatus }) {
  const meta = builderStatusMeta[status];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${meta.badgeClassName}`}
    >
      {meta.label}
    </span>
  );
}

function BuilderSectionPanel({
  children,
  description,
  id,
  status,
  title
}: {
  children: ReactNode;
  description: string;
  id: string;
  status: BuilderStatus;
  title: string;
}) {
  const meta = builderStatusMeta[status];

  return (
    <section id={id} className={`scroll-mt-32 rounded-2xl border p-4 sm:p-5 ${meta.panelClassName}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function nextQuestionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `q-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function createEmptyQuestion(type: SurveyQuestionType = "open_text"): SurveyQuestion {
  return {
    id: nextQuestionId(),
    prompt: "",
    type,
    options: []
  };
}

function createInitialBuilderState(projectId = ""): StudyBuilderState {
  return {
    studyId: null,
    projectId,
    title: "",
    userSegment: "",
    budgetPerResponse: "10",
    distributionMode: "open",
    helperIdsText: "",
    surveyQuestions: [createEmptyQuestion()]
  };
}

function parseHelperIds(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeSurveyQuestionForSave(question: SurveyQuestion): SurveyQuestion {
  if (question.type === "open_text") {
    return {
      ...question,
      prompt: question.prompt.trim(),
      options: []
    };
  }

  return {
    ...question,
    prompt: question.prompt.trim(),
    options: sanitizeSelectOptions(question.options)
  };
}

function getQuestionDisplayState(question: SurveyQuestion): QuestionDisplayState {
  const prompt = question.prompt.trim();
  if (!prompt) {
    return {
      status: "incomplete",
      message: "Add a prompt to include this question in the study."
    };
  }

  if (question.type === "open_text") {
    return {
      status: "ready",
      message: "Open-text question is ready for helpers."
    };
  }

  const validation = getSelectOptionValidation(question.options);
  if (validation.hasDuplicates) {
    return {
      status: "blocked",
      message: `Make options unique. Duplicate values: ${validation.duplicateOptions.join(", ")}.`
    };
  }
  if (!validation.hasMinimumOptions) {
    return {
      status: "blocked",
      message: `Add at least 2 non-empty options. ${validation.validOptionCount} currently filled.`
    };
  }

  return {
    status: "ready",
    message: `${validation.uniqueValidOptionCount} valid options ready for helpers to choose from.`
  };
}

function formatTimestamp(value: number | undefined) {
  if (!value) return "Not generated yet";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

function formatDate(value: number | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium"
  }).format(value);
}

function getSummaryScopeKey(projectId: string | null | undefined) {
  if (projectId === null) return "solo";
  return projectId ?? "all";
}

function getStudyScopeLabel(study: Study) {
  return study.projectId ? "Project-linked" : "Solo / Unassigned";
}

function getSoloScopeMessage(expiresAt: number | undefined) {
  if (expiresAt) {
    return `Independent research trial. Expires ${formatDate(expiresAt)} unless you attach it to a project.`;
  }

  return `Independent research trial. It will expire ${SOLO_RESEARCH_TRIAL_DAYS} days after first save unless you attach it to a project.`;
}

function loadStudyIntoBuilder(study: Study): StudyBuilderState {
  return {
    studyId: study.id,
    projectId: study.projectId ?? "",
    title: study.title,
    userSegment: study.userSegment,
    budgetPerResponse: String(study.budgetPerResponse || 0),
    distributionMode: study.distributionMode,
    helperIdsText: study.helperIds.join("\n"),
    surveyQuestions: study.surveyQuestions.length
      ? study.surveyQuestions
      : [createEmptyQuestion()]
  };
}

function findAnswer(answers: SurveyAnswer[], questionId: string) {
  return answers.find((answer) => answer.questionId === questionId);
}

function buildQuestionAnalytics(
  study: Study | null,
  submissions: Array<{ answers: SurveyAnswer[] }>
): QuestionAnalytics[] {
  if (!study) return [];

  return study.surveyQuestions.map((question) => {
    if (question.type === "open_text") {
      return {
        question,
        counts: [],
        answers: submissions
          .map((submission) => findAnswer(submission.answers, question.id)?.answerText?.trim() ?? "")
          .filter(Boolean)
      };
    }

    const counts = new Map<string, number>();
    question.options.forEach((option) => counts.set(option, 0));

    submissions.forEach((submission) => {
      const selectedOptions = findAnswer(submission.answers, question.id)?.selectedOptions ?? [];
      selectedOptions.forEach((option) => {
        counts.set(option, (counts.get(option) ?? 0) + 1);
      });
    });

    return {
      question,
      answers: [],
      counts: Array.from(counts.entries())
        .map(([option, count]) => ({ option, count }))
        .sort((left, right) => right.count - left.count)
    };
  });
}

function PMResearchPageContent() {
  const { user } = useSession();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const selectedProjectId = searchParams.get("projectId");
  const isSoloMode = searchParams.get("mode") === "solo";
  const scopeProjectId = isSoloMode ? null : selectedProjectId?.trim() || undefined;
  const summaryScopeKey = getSummaryScopeKey(scopeProjectId);
  const { projectsQuery, pmStudiesQuery } = useRoleData(user?.uid ?? null, user?.role ?? null);

  const [builder, setBuilder] = useState<StudyBuilderState>(createInitialBuilderState(""));
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(null);
  const [aiGoal, setAiGoal] = useState("");
  const [aiContext, setAiContext] = useState("");
  const [resultsRailTab, setResultsRailTab] = useState<ResultsRailTab>("overview");
  const [holdEmptyStudySelection, setHoldEmptyStudySelection] = useState(false);
  const autoInsightsAttemptedRef = useRef<Record<string, boolean>>({});
  const builderSectionRef = useRef<HTMLDivElement | null>(null);
  const builderTitleInputRef = useRef<HTMLInputElement | null>(null);

  const summaryQuery = useQuery({
    queryKey: ["pm-research-summary", user?.uid, summaryScopeKey],
    queryFn: () => getPmResearchSummary(user!.uid, scopeProjectId),
    enabled: Boolean(user?.uid && user.role === "pm")
  });

  const scopedStudies = useMemo(() => {
    const studies = pmStudiesQuery.data ?? [];
    const filtered =
      scopeProjectId === null
        ? studies.filter((study) => !study.projectId)
        : scopeProjectId
          ? studies.filter((study) => study.projectId === scopeProjectId)
          : studies;

    return [...filtered].sort(
      (left, right) =>
        (right.updatedAt ?? right.createdAt ?? 0) - (left.updatedAt ?? left.createdAt ?? 0)
    );
  }, [pmStudiesQuery.data, scopeProjectId]);

  const selectedStudy = useMemo(
    () => scopedStudies.find((study) => study.id === selectedStudyId) ?? null,
    [scopedStudies, selectedStudyId]
  );

  const realtimeStudy = useRealtimeResearchStudy(
    selectedStudyId,
    Boolean(user?.uid && user.role === "pm" && selectedStudyId)
  );

  const activeStudy = realtimeStudy.study ?? selectedStudy;
  const questionAnalytics = useMemo(
    () => buildQuestionAnalytics(activeStudy, realtimeStudy.submissions),
    [activeStudy, realtimeStudy.submissions]
  );
  const recentResponseSummaries = useMemo(
    () =>
      realtimeStudy.submissions
        .filter((submission) => submission.responseSummary?.trim())
        .slice(0, 6),
    [realtimeStudy.submissions]
  );
  const studySummaryById = useMemo(
    () =>
      new Map<string, PMResearchStudySummary>(
        (summaryQuery.data?.studies ?? []).map((study) => [study.studyId, study])
      ),
    [summaryQuery.data?.studies]
  );
  const parsedHelperIds = useMemo(() => parseHelperIds(builder.helperIdsText), [builder.helperIdsText]);
  const normalizedBuilderQuestions = useMemo(
    () => builder.surveyQuestions.map(normalizeSurveyQuestionForSave),
    [builder.surveyQuestions]
  );
  const questionDisplayStates = useMemo(
    () => builder.surveyQuestions.map(getQuestionDisplayState),
    [builder.surveyQuestions]
  );
  const incompleteQuestionCount = useMemo(
    () => questionDisplayStates.filter((state) => state.status === "incomplete").length,
    [questionDisplayStates]
  );
  const blockedQuestionCount = useMemo(
    () => questionDisplayStates.filter((state) => state.status === "blocked").length,
    [questionDisplayStates]
  );
  const readyQuestionCount = useMemo(
    () => questionDisplayStates.filter((state) => state.status === "ready").length,
    [questionDisplayStates]
  );
  const hasCompleteQuestion = normalizedBuilderQuestions.length > 0;
  const canGenerateDraft = Boolean(builder.userSegment.trim() && aiGoal.trim() && aiContext.trim());
  const builderIsSolo = !builder.projectId.trim();
  const builderStudyContext =
    builder.studyId && activeStudy?.id === builder.studyId ? activeStudy : selectedStudy;
  const builderSoloExpiresAt =
    builderIsSolo && builderStudyContext && !builderStudyContext.projectId
      ? builderStudyContext.expiresAt
      : undefined;
  const setupIssues = useMemo(() => {
    const issues: string[] = [];

    if (!builder.title.trim()) issues.push("Add a study title.");
    if (!builder.userSegment.trim()) issues.push("Add a target user segment.");
    if (!(Number(builder.budgetPerResponse) > 0)) issues.push("Set a reward greater than $0.");
    if (builder.distributionMode === "assigned" && parsedHelperIds.length === 0) {
      issues.push("Assigned studies need helper IDs before publishing.");
    }

    return issues;
  }, [
    builder.budgetPerResponse,
    builder.distributionMode,
    builder.title,
    builder.userSegment,
    parsedHelperIds.length
  ]);
  const saveDraftIssues = useMemo(() => {
    const issues: string[] = [];

    if (!builder.title.trim()) issues.push("Add a study title.");
    if (!builder.userSegment.trim()) issues.push("Add a target user segment.");
    if (!(Number(builder.budgetPerResponse) > 0)) issues.push("Set a reward greater than $0.");
    if (!builder.surveyQuestions.length) issues.push("Add at least one question.");
    if (!hasCompleteQuestion) issues.push("Add at least one complete question before saving.");
    if (incompleteQuestionCount > 0) {
      issues.push(
        `Finish or remove ${incompleteQuestionCount} incomplete question${incompleteQuestionCount === 1 ? "" : "s"}.`
      );
    }
    if (blockedQuestionCount > 0) {
      issues.push(
        `Fix select options in ${blockedQuestionCount} question${blockedQuestionCount === 1 ? "" : "s"}.`
      );
    }

    return issues;
  }, [
    blockedQuestionCount,
    builder.budgetPerResponse,
    builder.surveyQuestions.length,
    builder.title,
    builder.userSegment,
    hasCompleteQuestion,
    incompleteQuestionCount
  ]);
  const publishIssues = useMemo(() => {
    const issues = [...saveDraftIssues];
    if (builder.distributionMode === "assigned" && parsedHelperIds.length === 0) {
      issues.push("Assigned studies need at least one helper ID before publishing.");
    }
    return issues;
  }, [builder.distributionMode, parsedHelperIds.length, saveDraftIssues]);
  const canSaveDraft = saveDraftIssues.length === 0;
  const canPublish = publishIssues.length === 0;
  const setupStatus: BuilderStatus = setupIssues.length > 0
    ? builder.distributionMode === "assigned" && parsedHelperIds.length === 0
      ? "blocked"
      : "incomplete"
    : "ready";
  const aiSectionStatus: BuilderStatus = canGenerateDraft ? "ready" : "incomplete";
  const questionSectionStatus: BuilderStatus = blockedQuestionCount
    ? "blocked"
    : incompleteQuestionCount || !hasCompleteQuestion
      ? "incomplete"
      : "ready";
  const reviewStatus: BuilderStatus = canPublish
    ? "ready"
    : blockedQuestionCount || (builder.distributionMode === "assigned" && parsedHelperIds.length === 0)
      ? "blocked"
      : "incomplete";
  const builderSections = useMemo(
    () => [
      { id: "builder-setup", title: "Study Setup", status: setupStatus },
      { id: "builder-ai", title: "AI Draft", status: aiSectionStatus },
      { id: "builder-questions", title: "Questions", status: questionSectionStatus },
      { id: "builder-review", title: "Review & Publish", status: reviewStatus }
    ],
    [aiSectionStatus, questionSectionStatus, reviewStatus, setupStatus]
  );

  useEffect(() => {
    setBuilder((current) => {
      if (typeof scopeProjectId === "string" && current.projectId !== scopeProjectId && !current.studyId) {
        return { ...current, projectId: scopeProjectId };
      }
      return current;
    });
  }, [scopeProjectId]);

  useEffect(() => {
    if (!scopedStudies.length) {
      setSelectedStudyId(null);
      return;
    }

    if (holdEmptyStudySelection) return;

    if (!selectedStudyId || !scopedStudies.some((study) => study.id === selectedStudyId)) {
      setSelectedStudyId(scopedStudies[0].id);
    }
  }, [holdEmptyStudySelection, scopedStudies, selectedStudyId]);

  useEffect(() => {
    if (!user?.uid || user.role !== "pm") return;

    let cancelled = false;

    void cleanupExpiredSoloStudies(user.uid)
      .then(async (deletedCount) => {
        if (cancelled || deletedCount === 0) return;
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["pm-studies", user.uid] }),
          queryClient.invalidateQueries({
            queryKey: ["pm-research-summary", user.uid, summaryScopeKey]
          })
        ]);
      })
      .catch((error) => {
        if (process.env.NODE_ENV !== "production") {
          console.error("[research] solo cleanup failed", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [queryClient, summaryScopeKey, user?.role, user?.uid]);

  const saveStudyMutation = useMutation({
    mutationFn: ({ status }: { status: "draft" | "published" }) =>
      saveStudy({
        studyId: builder.studyId ?? undefined,
        projectId: builder.projectId.trim() || null,
        ownerId: user!.uid,
        title: builder.title.trim(),
        userSegment: builder.userSegment.trim(),
        budgetPerResponse: Number(builder.budgetPerResponse),
        distributionMode: builder.distributionMode,
        helperIds: parsedHelperIds,
        surveyQuestions: normalizedBuilderQuestions,
        status
      }),
    onSuccess: async (studyId) => {
      setBuilder((current) => ({ ...current, studyId }));
      setHoldEmptyStudySelection(false);
      setSelectedStudyId(studyId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pm-studies", user?.uid] }),
        queryClient.invalidateQueries({
          queryKey: ["pm-research-summary", user?.uid, summaryScopeKey]
        })
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not save study.");
    }
  });

  const generateDraftMutation = useMutation({
    mutationFn: () =>
      generateResearchQuestionDraft({
        projectId: builder.projectId.trim() || null,
        researchGoal: aiGoal.trim(),
        productContext: aiContext.trim(),
        targetUserSegment: builder.userSegment.trim()
      }),
    onSuccess: (result) => {
      setBuilder((current) => ({
        ...current,
        title: result.suggestedTitle,
        userSegment: result.suggestedUserSegment,
        surveyQuestions: result.surveyQuestions
      }));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not generate AI questions.");
    }
  });

  const insightsMutation = useMutation({
    mutationFn: (force: boolean) => generateStudyInsights({ studyId: selectedStudyId!, force }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["pm-research-summary", user?.uid, summaryScopeKey]
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not generate research insights.");
    }
  });

  useEffect(() => {
    if (!selectedStudyId) return;
    if (realtimeStudy.submissions.length < 5) return;
    if (realtimeStudy.insight) return;
    if (insightsMutation.isPending) return;
    if (autoInsightsAttemptedRef.current[selectedStudyId]) return;

    autoInsightsAttemptedRef.current[selectedStudyId] = true;
    insightsMutation.mutate(false);
  }, [
    insightsMutation,
    realtimeStudy.insight,
    realtimeStudy.submissions.length,
    selectedStudyId
  ]);

  const scopeLabel = useMemo(() => {
    if (scopeProjectId === null) return "Solo / Unassigned";
    if (!scopeProjectId) return "All projects";
    return (
      projectsQuery.data?.find((project) => project.id === scopeProjectId)?.name ??
      `Project ${scopeProjectId}`
    );
  }, [projectsQuery.data, scopeProjectId]);

  function selectStudy(studyId: string) {
    setHoldEmptyStudySelection(false);
    setSelectedStudyId(studyId);
  }

  function startNewResearch() {
    setBuilder(createInitialBuilderState(typeof scopeProjectId === "string" ? scopeProjectId : ""));
    setSelectedStudyId(null);
    setHoldEmptyStudySelection(true);
    setAiGoal("");
    setAiContext("");
    setResultsRailTab("overview");

    window.requestAnimationFrame(() => {
      builderSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => {
        builderTitleInputRef.current?.focus();
      }, 150);
    });
  }

  function resetBuilder() {
    startNewResearch();
  }

  function onEditStudy(study: Study) {
    setHoldEmptyStudySelection(false);
    setBuilder(loadStudyIntoBuilder(study));
    setSelectedStudyId(study.id);
  }

  function updateQuestion(index: number, nextQuestion: SurveyQuestion) {
    setBuilder((current) => ({
      ...current,
      surveyQuestions: current.surveyQuestions.map((question, questionIndex) =>
        questionIndex === index ? nextQuestion : question
      )
    }));
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    setBuilder((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.surveyQuestions.length) return current;

      const nextQuestions = [...current.surveyQuestions];
      const [item] = nextQuestions.splice(index, 1);
      nextQuestions.splice(nextIndex, 0, item);
      return { ...current, surveyQuestions: nextQuestions };
    });
  }

  function removeQuestion(index: number) {
    setBuilder((current) => {
      const nextQuestions = current.surveyQuestions.filter((_, questionIndex) => questionIndex !== index);
      return {
        ...current,
        surveyQuestions: nextQuestions.length ? nextQuestions : [createEmptyQuestion()]
      };
    });
  }

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6">
      <Card className="overflow-hidden border-border/80 bg-surface/90">
        <CardHeader>
          <CardTitle>Research Workspace</CardTitle>
          <CardDescription>
            Scope: {scopeLabel}. Build helper-facing research surveys, publish them, and monitor live responses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href="/dashboard/pm" className="text-sm text-accent underline">
              Back to PM Dashboard
            </Link>
            <p className="text-xs text-muted-foreground">
              AI insights auto-run on the first 5-response threshold, then refresh manually.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs uppercase text-muted-foreground">Studies</p>
              <p className="mt-1 text-2xl font-semibold">{summaryQuery.data?.totalStudies ?? 0}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs uppercase text-muted-foreground">Drafts</p>
              <p className="mt-1 text-2xl font-semibold">{summaryQuery.data?.draftStudies ?? 0}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs uppercase text-muted-foreground">Published</p>
              <p className="mt-1 text-2xl font-semibold">
                {summaryQuery.data?.publishedStudies ?? 0}
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs uppercase text-muted-foreground">Responses</p>
              <p className="mt-1 text-2xl font-semibold">
                {summaryQuery.data?.totalResponses ?? 0}
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs uppercase text-muted-foreground">Latest Insight</p>
              <p className="mt-1 text-sm font-semibold">
                {formatTimestamp(summaryQuery.data?.latestInsightAt)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.75fr)_360px]">
        <div className="space-y-6">
        <Card className="border-border/70 bg-surface/75 p-5">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1.5">
                <CardTitle>Overview</CardTitle>
                <CardDescription>Current studies, response volume, and quick entry back into a draft.</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={saveStudyMutation.isPending}
                onClick={startNewResearch}
              >
                Create New Research
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {!projectsQuery.data?.length && (
              <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                No projects yet. You can still run independent research trials that expire after {SOLO_RESEARCH_TRIAL_DAYS} days unless you attach them to a project.
              </div>
            )}

            {scopedStudies.map((study) => {
              const summary = studySummaryById.get(study.id);
              const isActive = study.id === selectedStudyId;
              return (
                <div
                  key={study.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectStudy(study.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectStudy(study.id);
                    }
                  }}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    isActive ? "border-accent bg-accent/5" : "border-border bg-surface"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{study.title}</p>
                      <p className="text-xs uppercase text-muted-foreground">
                        {study.status} | {study.distributionMode}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {getStudyScopeLabel(study)}
                        </span>
                        {!study.projectId && study.expiresAt && (
                          <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                            Expires {formatDate(study.expiresAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditStudy(study);
                      }}
                    >
                      Edit
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {summary?.responseCount ?? 0} responses | {summary?.pendingReviewCount ?? 0} pending review
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Audience: {study.userSegment || "General"}
                  </p>
                </div>
              );
            })}

            {!scopedStudies.length && (
              <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                {scopeProjectId === null
                  ? "No solo research studies yet."
                  : scopeProjectId
                    ? "No research studies in this scope yet."
                    : "No research studies yet. Create a project-backed or independent study to begin."}
              </div>
            )}
          </CardContent>
        </Card>

        <div ref={builderSectionRef}>
        <Card className="border-border/80 bg-background/85 p-0">
          <CardHeader className="border-b border-border/70 px-6 pb-4 pt-6">
            <CardTitle>Builder</CardTitle>
            <CardDescription>
              Move through setup, AI drafting, questions, and review without losing track of what is ready.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-6 pb-6 pt-5">
            <nav className="rounded-xl border border-border bg-surface/95 p-3">
              <div className="flex flex-wrap gap-2">
                {builderSections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="flex items-center gap-2 rounded-xl border border-border bg-background/80 px-3 py-2 text-sm text-foreground transition hover:bg-surface-2"
                  >
                    <span className="font-medium">{section.title}</span>
                    <StatusBadge status={section.status} />
                  </a>
                ))}
              </div>
            </nav>

            <BuilderSectionPanel
              id="builder-setup"
              title="Study Setup"
              description="Lock the audience, reward, and scope before you draft questions."
              status={setupStatus}
            >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="research-project">Project (Optional)</Label>
                <select
                  id="research-project"
                  value={builder.projectId}
                  onChange={(event) =>
                    setBuilder((current) => ({ ...current, projectId: event.target.value }))
                  }
                  disabled={typeof scopeProjectId === "string"}
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">
                    Independent research ({SOLO_RESEARCH_TRIAL_DAYS}-day trial)
                  </option>
                  {(scopeProjectId
                    ? (projectsQuery.data ?? []).filter((project) => project.id === scopeProjectId)
                    : projectsQuery.data ?? []
                  ).map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {builder.projectId.trim()
                    ? "This study is linked to a project and will not expire."
                    : getSoloScopeMessage(builderSoloExpiresAt)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="research-budget">Reward Per Response</Label>
                <Input
                  id="research-budget"
                  type="number"
                  min="1"
                  step="0.01"
                  value={builder.budgetPerResponse}
                  onChange={(event) =>
                    setBuilder((current) => ({
                      ...current,
                      budgetPerResponse: event.target.value
                    }))
                  }
                />
              </div>
            </div>

              <div className="space-y-2">
                <Label htmlFor="research-title">Study Title</Label>
                <Input
                  ref={builderTitleInputRef}
                  id="research-title"
                  placeholder="Post-launch onboarding friction study"
                  value={builder.title}
                  onChange={(event) =>
                    setBuilder((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="research-segment">Target User Segment</Label>
                <Input
                  id="research-segment"
                  placeholder="New B2B trial users"
                  value={builder.userSegment}
                  onChange={(event) =>
                    setBuilder((current) => ({ ...current, userSegment: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="distribution-mode">Distribution Mode</Label>
                <select
                  id="distribution-mode"
                  value={builder.distributionMode}
                  onChange={(event) =>
                    setBuilder((current) => ({
                      ...current,
                      distributionMode: event.target.value as StudyDistributionMode
                    }))
                  }
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="open">Open to all helpers</option>
                  <option value="assigned">Assigned helpers only</option>
                </select>
              </div>
            </div>

            {builder.distributionMode === "assigned" && (
              <div className="space-y-2">
                <Label htmlFor="assigned-helpers">Assigned Helper IDs</Label>
                <Textarea
                  id="assigned-helpers"
                  placeholder="Paste helper IDs, one per line or comma-separated."
                  value={builder.helperIdsText}
                  onChange={(event) =>
                    setBuilder((current) => ({
                      ...current,
                      helperIdsText: event.target.value
                    }))
                  }
                  className="min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">
                  {parsedHelperIds.length
                    ? `${parsedHelperIds.length} helper ID${parsedHelperIds.length === 1 ? "" : "s"} selected for assigned distribution.`
                    : "Add helper IDs here if this study should only go to assigned helpers."}
                </p>
              </div>
            )}

            {setupIssues.length > 0 && (
              <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Setup Checks
                </p>
                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {setupIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
            </BuilderSectionPanel>

            <BuilderSectionPanel
              id="builder-ai"
              title="AI Draft"
              description="Use AI to quickly generate an editable first pass once the research goal is clear."
              status={aiSectionStatus}
            >
              <div className="grid gap-3 lg:grid-cols-[0.95fr_1.25fr]">
                <div className="space-y-2">
                  <Label htmlFor="ai-goal">Research Goal</Label>
                  <Input
                    id="ai-goal"
                    placeholder="Understand why new users abandon setup after the first task"
                    value={aiGoal}
                    onChange={(event) => setAiGoal(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai-context">Product Context</Label>
                  <Textarea
                    id="ai-context"
                    placeholder="We ship a collaborative finance app. We recently redesigned onboarding and want to test message clarity, trust, and task completion."
                    value={aiContext}
                    onChange={(event) => setAiContext(event.target.value)}
                    className="min-h-[110px]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/80 p-3">
                <p className="text-sm text-muted-foreground">
                  {canGenerateDraft
                    ? "AI has enough context to generate editable questions."
                    : "Add a target segment, research goal, product context, and project to enable AI drafting."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={generateDraftMutation.isPending || !canGenerateDraft}
                  onClick={() => generateDraftMutation.mutate()}
                >
                  {generateDraftMutation.isPending ? "Generating..." : "Generate AI Questions"}
                </Button>
              </div>
            </BuilderSectionPanel>

            <BuilderSectionPanel
              id="builder-questions"
              title="Questions"
              description="Shape the helper-facing survey with clear prompts, select types, and clean answer options."
              status={questionSectionStatus}
            >
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Total</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{builder.surveyQuestions.length}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Ready</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{readyQuestionCount}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Needs Attention</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {incompleteQuestionCount + blockedQuestionCount}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/80 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Question Flow</p>
                  <p className="text-sm text-muted-foreground">
                    Add, reorder, and refine questions without leaving the builder.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setBuilder((current) => ({
                      ...current,
                      surveyQuestions: [...current.surveyQuestions, createEmptyQuestion()]
                    }))
                  }
                >
                  Add Question
                </Button>
              </div>

              <div className="space-y-3">
                {builder.surveyQuestions.map((question, index) => {
                  const questionState = questionDisplayStates[index];
                  const questionMeta = builderStatusMeta[questionState.status];

                  return (
                    <div
                      key={question.id}
                      className="rounded-2xl border border-border/70 bg-background/85 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">Question {index + 1}</p>
                          <p className={`text-sm ${questionMeta.textClassName}`}>{questionState.message}</p>
                        </div>
                        <StatusBadge status={questionState.status} />
                      </div>

                      <div className="mt-4 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor={`question-prompt-${question.id}`}>Prompt</Label>
                          <Textarea
                            id={`question-prompt-${question.id}`}
                            value={question.prompt}
                            onChange={(event) =>
                              updateQuestion(index, { ...question, prompt: event.target.value })
                            }
                            placeholder="Ask one clear thing helpers can answer quickly."
                          />
                        </div>

                        <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
                          <div className="space-y-2">
                            <Label htmlFor={`question-type-${question.id}`}>Type</Label>
                            <select
                              id={`question-type-${question.id}`}
                              value={question.type}
                              onChange={(event) => {
                                const nextType = event.target.value as SurveyQuestionType;
                                updateQuestion(index, {
                                  ...question,
                                  type: nextType,
                                  options:
                                    nextType === "open_text"
                                      ? []
                                      : question.options.length
                                        ? question.options
                                        : createSelectOptionDrafts()
                                });
                              }}
                              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <option value="open_text">Open text</option>
                              <option value="single_select">Single select</option>
                              <option value="multi_select">Multi select</option>
                            </select>
                          </div>

                          <div className="rounded-xl border border-border/70 bg-surface/70 p-3 text-sm text-muted-foreground">
                            {question.type === "open_text"
                              ? "Helpers will respond in free text. Use this for exploratory or follow-up questions."
                              : "Helpers will choose from your structured options. Keep answers mutually exclusive where possible."}
                          </div>
                        </div>

                        {question.type !== "open_text" && (
                          <SelectOptionEditor
                            label="Options"
                            options={question.options}
                            onChange={(options) => updateQuestion(index, { ...question, options })}
                          />
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-surface/75 px-3 py-2">
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            {question.type.replace("_", " ")}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => moveQuestion(index, -1)}
                              disabled={index === 0}
                            >
                              Move Up
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => moveQuestion(index, 1)}
                              disabled={index === builder.surveyQuestions.length - 1}
                            >
                              Move Down
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-danger/40 text-danger hover:bg-danger/10 hover:text-danger"
                              onClick={() => removeQuestion(index)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            </BuilderSectionPanel>

            <BuilderSectionPanel
              id="builder-review"
              title="Review & Publish"
              description="Check readiness, save a clean draft, or publish once all blockers are resolved."
              status={reviewStatus}
            >
              <div className="rounded-xl border border-border/70 bg-background/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Study Scope</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {builderIsSolo
                        ? getSoloScopeMessage(builderSoloExpiresAt)
                        : "This study is attached to a project and will stay in your workspace without a solo expiry window."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-border/70 bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {builderIsSolo ? "Solo / Unassigned" : "Project-linked"}
                    </span>
                    {builderIsSolo && builderSoloExpiresAt && (
                      <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                        Expires {formatDate(builderSoloExpiresAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Questions</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{readyQuestionCount}</p>
                  <p className="mt-1 text-xs text-muted-foreground">ready out of {builder.surveyQuestions.length}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Distribution</p>
                  <p className="mt-2 text-2xl font-semibold capitalize text-foreground">{builder.distributionMode}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {builder.distributionMode === "assigned"
                      ? `${parsedHelperIds.length} helper ID${parsedHelperIds.length === 1 ? "" : "s"} added`
                      : "Available to all helpers"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Save Draft</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {canSaveDraft ? "Ready" : "Hold"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {canSaveDraft ? "All draft requirements are complete." : `${saveDraftIssues.length} issue(s) to fix`}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Publish</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {canPublish ? "Ready" : "Blocked"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {canPublish ? "Study can go live now." : `${publishIssues.length} blocker(s) remain`}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-background/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">Draft Readiness</p>
                    <StatusBadge status={canSaveDraft ? "ready" : "incomplete"} />
                  </div>
                  {canSaveDraft ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      The study is internally consistent and ready to save as a draft.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {saveDraftIssues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-xl border border-border/70 bg-background/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">Publish Readiness</p>
                    <StatusBadge status={reviewStatus} />
                  </div>
                  {canPublish ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Publishing will expose the study to the selected helper audience immediately.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {publishIssues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background/95 p-4 shadow-[0_16px_40px_hsl(var(--foreground)/0.08)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {builder.studyId ? "Editing existing study" : "New study draft"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {canPublish
                        ? "Everything is aligned for publish."
                        : "Resolve the items above before publishing."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetBuilder}
                      disabled={saveStudyMutation.isPending}
                    >
                      New Draft
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saveStudyMutation.isPending || !canSaveDraft}
                      onClick={() => saveStudyMutation.mutate({ status: "draft" })}
                    >
                      {saveStudyMutation.isPending ? "Saving..." : "Save Draft"}
                    </Button>
                    <Button
                      type="button"
                      className="bg-accent text-accent-foreground hover:bg-accent/90"
                      disabled={saveStudyMutation.isPending || !canPublish}
                      onClick={() => saveStudyMutation.mutate({ status: "published" })}
                    >
                      {saveStudyMutation.isPending ? "Publishing..." : "Publish Study"}
                    </Button>
                  </div>
                </div>
              </div>
            </BuilderSectionPanel>
          </CardContent>
        </Card>
        </div>
        </div>

        <Card className="self-start border-border/70 bg-surface/70 p-5">
          <CardHeader>
            <CardTitle>Live Results</CardTitle>
            <CardDescription>
              Realtime helper answers, grouped response counts, and stored AI insights.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeStudy && (
              <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                Select a study to inspect live results.
              </div>
            )}

            {activeStudy && (
              <>
                <div className="flex flex-wrap gap-2 rounded-xl border border-border/70 bg-background/80 p-2">
                  {([
                    { id: "overview", label: "Overview" },
                    { id: "insights", label: "Insights" },
                    { id: "responses", label: "Responses" }
                  ] as Array<{ id: ResultsRailTab; label: string }>).map((tab) => {
                    const isActive = resultsRailTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setResultsRailTab(tab.id)}
                        className={`rounded-lg border px-3 py-2 text-sm transition ${
                          isActive
                            ? "border-accent/30 bg-accent/10 text-accent"
                            : "border-border bg-surface text-foreground hover:bg-surface-2"
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {resultsRailTab === "overview" && (
                  <div className="space-y-3">
                    <div className="grid gap-3">
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs uppercase text-muted-foreground">Responses</p>
                        <p className="mt-1 text-2xl font-semibold">{realtimeStudy.submissions.length}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {realtimeStudy.submissions.filter((submission) => submission.status === "pending_review").length} pending review
                        </p>
                      </div>
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs uppercase text-muted-foreground">Study State</p>
                        <p className="mt-1 text-sm font-semibold">
                          {activeStudy.status} | {activeStudy.distributionMode}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Reward: ${activeStudy.budgetPerResponse.toFixed(2)}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Scope: {getStudyScopeLabel(activeStudy)}
                        </p>
                        {!activeStudy.projectId && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {getSoloScopeMessage(activeStudy.expiresAt)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {questionAnalytics.map((item) => (
                        <div key={item.question.id} className="rounded-lg border border-border p-3">
                          <p className="font-medium text-foreground">{item.question.prompt}</p>
                          <p className="mt-1 text-xs uppercase text-muted-foreground">
                            {item.question.type.replace("_", " ")}
                          </p>

                          {item.question.type === "open_text" ? (
                            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                              {item.answers.slice(0, 4).map((answer, index) => (
                                <p key={`${item.question.id}-answer-${index}`} className="rounded-md bg-surface-2 p-2">
                                  {answer}
                                </p>
                              ))}
                              {!item.answers.length && <p>No answers yet.</p>}
                            </div>
                          ) : (
                            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                              {item.counts.map((entry) => (
                                <div
                                  key={`${item.question.id}-${entry.option}`}
                                  className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2"
                                >
                                  <span>{entry.option}</span>
                                  <span>{entry.count}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}

                      {!questionAnalytics.length && (
                        <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                          No question analytics yet for this study.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {resultsRailTab === "insights" && (
                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">AI Insight Snapshot</p>
                        <p className="text-xs text-muted-foreground">
                          Latest update: {formatTimestamp(realtimeStudy.insight?.updatedAt)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={insightsMutation.isPending || realtimeStudy.submissions.length < 5}
                        onClick={() => {
                          if (!selectedStudyId) return;
                          autoInsightsAttemptedRef.current[selectedStudyId] = true;
                          insightsMutation.mutate(true);
                        }}
                      >
                        {insightsMutation.isPending ? "Generating..." : "Refresh Insights"}
                      </Button>
                    </div>

                    {realtimeStudy.submissions.length < 5 && (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Insights unlock after 5 helper responses. Current count: {realtimeStudy.submissions.length}.
                      </p>
                    )}

                    {realtimeStudy.insight ? (
                      <div className="mt-4 space-y-4 text-sm">
                        <div>
                          <p className="font-medium text-foreground">Summary</p>
                          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                            {realtimeStudy.insight.summary}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Themes</p>
                          <ul className="mt-1 space-y-1 text-muted-foreground">
                            {realtimeStudy.insight.themes.map((theme) => (
                              <li key={theme}>* {theme}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Recommendations</p>
                          <ul className="mt-1 space-y-1 text-muted-foreground">
                            {realtimeStudy.insight.recommendations.map((recommendation) => (
                              <li key={recommendation}>* {recommendation}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-muted-foreground">
                        No insight snapshot yet. Insights appear automatically after enough responses or when refreshed manually.
                      </p>
                    )}
                  </div>
                )}

                {resultsRailTab === "responses" && (
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-sm font-medium text-foreground">Recent Response Summaries</p>
                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {recentResponseSummaries.map((submission) => (
                        <div key={submission.id} className="rounded-md bg-surface-2 p-3">
                          <p className="font-medium text-foreground">Helper {submission.helperId}</p>
                          <p className="mt-1 whitespace-pre-wrap">{submission.responseSummary}</p>
                          <p className="mt-2 text-xs">{formatTimestamp(submission.createdAt)}</p>
                        </div>
                      ))}
                      {!recentResponseSummaries.length && (
                        <p>No response summaries yet. Helpers can still submit structured answers.</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function PMResearchPage() {
  return (
    <Suspense fallback={<main className="p-6">Loading...</main>}>
      <PMResearchPageContent />
    </Suspense>
  );
}
