"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { HelperProfileForm } from "@/components/helper/helper-profile-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/contexts/session-context";
import {
  getHelperStudyInterestLabel,
  inferHelperStudyInterests
} from "@/lib/helper/study-interests";
import { createSubmission, getHelperProfile, updateHelperProfile } from "@/lib/queries/firestore";
import { useRoleData } from "@/lib/queries/hooks";
import {
  ActiveSurvey,
  HelperProfile,
  HelperStudyInterest,
  SurveyAnswer,
  SurveyQuestion
} from "@/types/app";

type AnswerDraft = {
  answerText: string;
  selectedOptions: string[];
};

type DecoratedSurvey = ActiveSurvey & {
  inferredInterests: HelperStudyInterest[];
  matchesPreference: boolean;
};

const DEFAULT_HELPER_INTERESTS: HelperStudyInterest[] = ["all"];
const EMPTY_STUDIES: ActiveSurvey[] = [];

function isAnswerComplete(answer: AnswerDraft | undefined, type: string) {
  if (!answer) return false;
  if (type === "open_text") return answer.answerText.trim().length > 0;
  return answer.selectedOptions.length > 0;
}

function getGreetingName(profile: HelperProfile | undefined, email: string | null | undefined) {
  if (profile?.displayName.trim()) return profile.displayName.trim();
  if (email) return email.split("@")[0];
  return "there";
}

function renderQuestionInput(
  surveyId: string,
  question: SurveyQuestion,
  answer: AnswerDraft | undefined,
  onOpenTextChange: (studyId: string, questionId: string, value: string) => void,
  onSingleSelectChange: (studyId: string, questionId: string, option: string) => void,
  onMultiSelectToggle: (studyId: string, questionId: string, option: string) => void
) {
  if (question.type === "open_text") {
    return (
      <Textarea
        placeholder="Type your answer..."
        value={answer?.answerText ?? ""}
        onChange={(event) => onOpenTextChange(surveyId, question.id, event.target.value)}
      />
    );
  }

  if (question.type === "single_select") {
    return (
      <div className="space-y-1.5">
        {question.options.map((option) => (
          <label key={option} className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/50 px-3 py-2 text-sm">
            <input
              type="radio"
              name={`${surveyId}-${question.id}`}
              checked={answer?.selectedOptions?.[0] === option}
              onChange={() => onSingleSelectChange(surveyId, question.id, option)}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {question.options.map((option) => (
        <label key={option} className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/50 px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(answer?.selectedOptions?.includes(option))}
            onChange={() => onMultiSelectToggle(surveyId, question.id, option)}
          />
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
}

function HelperStudyCard({
  answersByStudy,
  completionByStudy,
  notesByStudy,
  onMultiSelectToggle,
  onNotesChange,
  onOpenTextChange,
  onSingleSelectChange,
  onSubmit,
  survey,
  submitting
}: {
  answersByStudy: Record<string, Record<string, AnswerDraft>>;
  completionByStudy: Record<string, boolean>;
  notesByStudy: Record<string, string>;
  onMultiSelectToggle: (studyId: string, questionId: string, option: string) => void;
  onNotesChange: (studyId: string, value: string) => void;
  onOpenTextChange: (studyId: string, questionId: string, value: string) => void;
  onSingleSelectChange: (studyId: string, questionId: string, option: string) => void;
  onSubmit: (survey: ActiveSurvey) => void;
  survey: DecoratedSurvey;
  submitting: boolean;
}) {
  const visibleInterestBadges: HelperStudyInterest[] = survey.inferredInterests.length
    ? survey.inferredInterests
    : DEFAULT_HELPER_INTERESTS;

  return (
    <Card
      className={
        survey.matchesPreference
          ? "overflow-hidden border-accent/30 bg-accent/5"
          : "overflow-hidden border-border/80 bg-surface/95"
      }
    >
      <CardHeader className="border-b border-border/70">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">{survey.title}</CardTitle>
              {survey.matchesPreference ? (
                <span className="rounded-full border border-accent/35 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                  Matches your interests
                </span>
              ) : null}
            </div>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {survey.description ?? "No description provided."}
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
            <p>Questions: {survey.surveyQuestions.length}</p>
            <p>Audience: {survey.userSegment || "General"}</p>
            <p>Access: {survey.distributionMode === "assigned" ? "Assigned" : "Open"}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {visibleInterestBadges.map((interest) => (
            <span
              key={`${survey.id}-${interest}`}
              className="rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground"
            >
              {interest === "all" ? "General product feedback" : getHelperStudyInterestLabel(interest)}
            </span>
          ))}
          <span className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning">
            Earnings and payouts are coming soon
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-6">
        <div className="space-y-4 rounded-2xl border border-border/80 bg-background/50 p-4">
          {survey.surveyQuestions.map((question, index) => {
            const answer = answersByStudy[survey.id]?.[question.id];
            return (
              <div key={question.id} className="space-y-3 rounded-2xl border border-border/70 bg-surface/80 p-4">
                <p className="text-sm font-medium leading-6 text-foreground">
                  {index + 1}. {question.prompt}
                </p>
                {renderQuestionInput(
                  survey.id,
                  question,
                  answer,
                  onOpenTextChange,
                  onSingleSelectChange,
                  onMultiSelectToggle
                )}
              </div>
            );
          })}
          {!survey.surveyQuestions.length ? (
            <p className="text-xs text-muted-foreground">No structured questions provided.</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Optional notes</p>
          <Textarea
            placeholder="Summarize any friction points, surprises, or extra context."
            value={notesByStudy[survey.id] ?? ""}
            onChange={(event) => onNotesChange(survey.id, event.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {completionByStudy[survey.id]
              ? "All questions answered. Your response is ready to submit."
              : "Answer every question before submitting your response."}
          </p>
          <Button
            type="button"
            variant="success"
            size="sm"
            onClick={() => onSubmit(survey)}
            disabled={submitting}
          >
            Submit response
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HelperPortalPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [notesByStudy, setNotesByStudy] = useState<Record<string, string>>({});
  const [answersByStudy, setAnswersByStudy] = useState<Record<string, Record<string, AnswerDraft>>>(
    {}
  );
  const { studiesQuery } = useRoleData(user?.uid ?? null, user?.role ?? null);
  const profileQuery = useQuery({
    queryKey: ["helper-profile", user?.uid],
    queryFn: () => getHelperProfile(user!.uid),
    enabled: Boolean(user?.uid && user.role === "helper")
  });

  const submitMutation = useMutation({
    mutationFn: ({
      studyId,
      helperId,
      answers,
      responseSummary
    }: {
      studyId: string;
      helperId: string;
      answers: SurveyAnswer[];
      responseSummary: string;
    }) => createSubmission(studyId, helperId, answers, responseSummary),
    onSuccess: (_, variables) => {
      setAnswersByStudy((prev) => ({ ...prev, [variables.studyId]: {} }));
      setNotesByStudy((prev) => ({ ...prev, [variables.studyId]: "" }));
      void queryClient.invalidateQueries({ queryKey: ["studies", variables.helperId] });
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: (profile: HelperProfile) => updateHelperProfile(user!.uid, profile),
    onSuccess: () => {
      void profileQuery.refetch();
    }
  });

  const completionByStudy = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const survey of studiesQuery.data ?? []) {
      const answers = answersByStudy[survey.id] ?? {};
      map[survey.id] = survey.surveyQuestions.every((question) =>
        isAnswerComplete(answers[question.id], question.type)
      );
    }
    return map;
  }, [answersByStudy, studiesQuery.data]);

  const preferredInterests = profileQuery.data?.studyInterests ?? DEFAULT_HELPER_INTERESTS;
  const allStudies = studiesQuery.data ?? EMPTY_STUDIES;

  const studiesWithMeta = useMemo<DecoratedSurvey[]>(() => {
    return allStudies
      .map((survey) => {
        const inferredInterests = inferHelperStudyInterests(survey);
        const matchesPreference =
          preferredInterests.includes("all") ||
          inferredInterests.some((interest) => preferredInterests.includes(interest));

        return {
          ...survey,
          inferredInterests,
          matchesPreference
        };
      })
      .sort((left, right) => {
        if (left.matchesPreference === right.matchesPreference) {
          return (right.updatedAt ?? right.createdAt ?? 0) - (left.updatedAt ?? left.createdAt ?? 0);
        }
        return Number(right.matchesPreference) - Number(left.matchesPreference);
      });
  }, [allStudies, preferredInterests]);

  const matchedStudies = studiesWithMeta.filter((survey) => survey.matchesPreference);
  const otherStudies = studiesWithMeta.filter((survey) => !survey.matchesPreference);
  const greetingName = getGreetingName(profileQuery.data, user?.email);
  const openStudyCount = allStudies.filter((survey) => survey.distributionMode === "open").length;
  const assignedStudyCount = allStudies.filter((survey) => survey.distributionMode === "assigned").length;

  function updateOpenText(studyId: string, questionId: string, value: string) {
    setAnswersByStudy((prev) => ({
      ...prev,
      [studyId]: {
        ...(prev[studyId] ?? {}),
        [questionId]: {
          answerText: value,
          selectedOptions: []
        }
      }
    }));
  }

  function updateSingleSelect(studyId: string, questionId: string, option: string) {
    setAnswersByStudy((prev) => ({
      ...prev,
      [studyId]: {
        ...(prev[studyId] ?? {}),
        [questionId]: {
          answerText: "",
          selectedOptions: [option]
        }
      }
    }));
  }

  function toggleMultiSelect(studyId: string, questionId: string, option: string) {
    setAnswersByStudy((prev) => {
      const current = prev[studyId]?.[questionId]?.selectedOptions ?? [];
      const hasOption = current.includes(option);
      const selectedOptions = hasOption
        ? current.filter((entry) => entry !== option)
        : [...current, option];

      return {
        ...prev,
        [studyId]: {
          ...(prev[studyId] ?? {}),
          [questionId]: {
            answerText: "",
            selectedOptions
          }
        }
      };
    });
  }

  function submitStudy(survey: ActiveSurvey) {
    if (!user) return;
    if (!completionByStudy[survey.id]) {
      toast.error("Please answer all questions before submitting.");
      return;
    }

    const answers = survey.surveyQuestions.map((question) => {
      const answer = answersByStudy[survey.id]?.[question.id];
      return {
        questionId: question.id,
        answerText: question.type === "open_text" ? answer?.answerText?.trim() ?? "" : "",
        selectedOptions: question.type === "open_text" ? [] : answer?.selectedOptions ?? []
      } satisfies SurveyAnswer;
    });

    submitMutation.mutate({
      studyId: survey.id,
      helperId: user.uid,
      answers,
      responseSummary: notesByStudy[survey.id] ?? ""
    });
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <Card className="overflow-hidden border-border/80 bg-[radial-gradient(circle_at_top_left,hsl(var(--accent)/0.22),transparent_36%),linear-gradient(180deg,hsl(var(--surface)),hsl(var(--surface-2)))]">
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="space-y-3">
              <p className="inline-flex rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                Welcome back
              </p>
              <div className="space-y-2">
                <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                  {greetingName}, thanks for helping teams build with sharper insight.
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  Your portal is now tuned around the studies you care about most. Keep your profile
                  fresh, respond clearly, and OrbitPlus will surface the most relevant research work
                  first.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/80 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Available studies
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{allStudies.length}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {openStudyCount} open and {assignedStudyCount} assigned to helpers.
                </p>
              </div>
              <div className="rounded-2xl border border-border/80 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Matching your focus
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{matchedStudies.length}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Based on your selected study interests.
                </p>
              </div>
              <div className="rounded-2xl border border-border/80 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Earnings
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">Coming soon</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Participation is live. Payout tooling is still in progress.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(profileQuery.data?.studyInterests ?? ["all"]).map((interest) => (
                <span
                  key={interest}
                  className="rounded-full border border-accent/35 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent"
                >
                  {getHelperStudyInterestLabel(interest)}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/80 bg-surface/95">
          <CardHeader className="border-b border-border/70">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Profile and preferences
                </p>
                <CardTitle className="text-xl">Tell us which studies you want first</CardTitle>
              </div>
              <Link
                href="/portal/helper/profile"
                className="rounded-full border border-border/80 bg-background/80 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-2"
              >
                Open full profile
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <HelperProfileForm
              title="Quick setup"
              description="Set your name, working context, and the study categories you want OrbitPlus to prioritize in this portal."
              helperEmail={user?.email}
              initialProfile={profileQuery.data}
              isSaving={updateProfileMutation.isPending}
              onSave={(profile) => updateProfileMutation.mutate(profile)}
              submitLabel="Save preferences"
            />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Available studies
            </p>
            <h2 className="text-2xl font-semibold text-foreground">Research work you can respond to now</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              We are prioritizing relevance first. If a study matches your interests, it appears at
              the top, but you can still access every open or assigned study below.
            </p>
          </div>
        </div>

        {!preferredInterests.includes("all") && matchedStudies.length > 0 ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
              <p className="text-sm font-semibold text-accent">Matches for your selected interests</p>
              <p className="mt-1 text-sm text-muted-foreground">
                These studies were inferred from the current titles, descriptions, audiences, and
                survey prompts already in OrbitPlus.
              </p>
            </div>
            {matchedStudies.map((survey) => (
              <HelperStudyCard
                key={survey.id}
                answersByStudy={answersByStudy}
                completionByStudy={completionByStudy}
                notesByStudy={notesByStudy}
                onMultiSelectToggle={toggleMultiSelect}
                onNotesChange={(studyId, value) =>
                  setNotesByStudy((prev) => ({ ...prev, [studyId]: value }))
                }
                onOpenTextChange={updateOpenText}
                onSingleSelectChange={updateSingleSelect}
                onSubmit={submitStudy}
                survey={survey}
                submitting={submitMutation.isPending || !user}
              />
            ))}
          </div>
        ) : null}

        {!preferredInterests.includes("all") && matchedStudies.length === 0 && allStudies.length > 0 ? (
          <Card className="border-border/80 bg-surface/95">
            <CardContent className="p-6">
              <p className="text-sm font-semibold text-foreground">No direct matches yet</p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Nothing in the current study pool maps cleanly to your selected interests, so all
                available studies are shown below. You can keep your preferences or switch to All
                studies anytime.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {allStudies.length ? (
          <div className="space-y-4">
            {!preferredInterests.includes("all") && otherStudies.length ? (
              <div className="rounded-2xl border border-border/80 bg-surface/95 p-4">
                <p className="text-sm font-semibold text-foreground">More available studies</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  These are still open to you even if they do not match your current focus exactly.
                </p>
              </div>
            ) : null}

            {(preferredInterests.includes("all") ? studiesWithMeta : otherStudies).map((survey) => (
              <HelperStudyCard
                key={survey.id}
                answersByStudy={answersByStudy}
                completionByStudy={completionByStudy}
                notesByStudy={notesByStudy}
                onMultiSelectToggle={toggleMultiSelect}
                onNotesChange={(studyId, value) =>
                  setNotesByStudy((prev) => ({ ...prev, [studyId]: value }))
                }
                onOpenTextChange={updateOpenText}
                onSingleSelectChange={updateSingleSelect}
                onSubmit={submitStudy}
                survey={survey}
                submitting={submitMutation.isPending || !user}
              />
            ))}
          </div>
        ) : (
          <Card className="border-border/80 bg-surface/95">
            <CardContent className="p-6">
              <p className="text-sm font-semibold text-foreground">
                No research studies are available right now
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                When PMs publish new research work, it will appear here. Keep your profile updated so
                the portal can surface the most relevant studies first.
              </p>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
