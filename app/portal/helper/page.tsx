"use client";

import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/contexts/session-context";
import { createSubmission } from "@/lib/queries/firestore";
import { useRoleData } from "@/lib/queries/hooks";
import { SurveyAnswer } from "@/types/app";

type AnswerDraft = {
  answerText: string;
  selectedOptions: string[];
};

function isAnswerComplete(answer: AnswerDraft | undefined, type: string) {
  if (!answer) return false;
  if (type === "open_text") return answer.answerText.trim().length > 0;
  return answer.selectedOptions.length > 0;
}

export default function HelperPortalPage() {
  const { user, logout } = useSession();
  const [notesByStudy, setNotesByStudy] = useState<Record<string, string>>({});
  const [answersByStudy, setAnswersByStudy] = useState<Record<string, Record<string, AnswerDraft>>>(
    {}
  );
  const { studiesQuery } = useRoleData(user?.uid ?? null, user?.role ?? null);
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 p-8">
      <Card>
        <CardHeader>
          <CardTitle>Helper Portal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Signed in as {user?.email ?? "Unknown helper"}.
          </p>
          <Button variant="outline" onClick={() => void logout()}>
            Sign out
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Gigs</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {studiesQuery.data?.map((survey) => (
              <li key={survey.id} className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">{survey.title}</p>
                <p className="text-muted-foreground">
                  {survey.description ?? "No description provided."}
                </p>
                <p className="text-muted-foreground">Audience: {survey.userSegment || "General"}</p>
                <p className="text-muted-foreground">Status: {survey.status}</p>
                <p className="text-muted-foreground">
                  Access: {survey.distributionMode === "assigned" ? "Assigned" : "Open"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Reward: ${survey.rewardAmount ?? 0}
                </p>

                <div className="mt-3 space-y-3 rounded-md border border-border p-3">
                  {survey.surveyQuestions.map((question, index) => {
                    const answer = answersByStudy[survey.id]?.[question.id];
                    return (
                      <div key={question.id} className="space-y-2">
                        <p className="text-sm font-medium text-foreground">
                          {index + 1}. {question.prompt}
                        </p>

                        {question.type === "open_text" && (
                          <Textarea
                            placeholder="Type your answer..."
                            value={answer?.answerText ?? ""}
                            onChange={(event) =>
                              updateOpenText(survey.id, question.id, event.target.value)
                            }
                          />
                        )}

                        {question.type === "single_select" && (
                          <div className="space-y-1">
                            {question.options.map((option) => (
                              <label key={option} className="flex items-center gap-2 text-sm">
                                <input
                                  type="radio"
                                  name={`${survey.id}-${question.id}`}
                                  checked={answer?.selectedOptions?.[0] === option}
                                  onChange={() =>
                                    updateSingleSelect(survey.id, question.id, option)
                                  }
                                />
                                <span>{option}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {question.type === "multi_select" && (
                          <div className="space-y-1">
                            {question.options.map((option) => (
                              <label key={option} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={Boolean(answer?.selectedOptions?.includes(option))}
                                  onChange={() => toggleMultiSelect(survey.id, question.id, option)}
                                />
                                <span>{option}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!survey.surveyQuestions.length && (
                    <p className="text-xs text-muted-foreground">No structured questions provided.</p>
                  )}
                </div>

                <Textarea
                  className="mt-3"
                  placeholder="Optional: summarize key friction points you observed."
                  value={notesByStudy[survey.id] ?? ""}
                  onChange={(event) =>
                    setNotesByStudy((prev) => ({ ...prev, [survey.id]: event.target.value }))
                  }
                />

                <Button
                  className="mt-3 bg-success text-white hover:bg-success/90"
                  size="sm"
                  onClick={() => {
                    if (!user) return;
                    if (!completionByStudy[survey.id]) {
                      toast.error("Please answer all questions before submitting.");
                      return;
                    }

                    const answers = survey.surveyQuestions.map((question) => {
                      const answer = answersByStudy[survey.id]?.[question.id];
                      return {
                        questionId: question.id,
                        answerText:
                          question.type === "open_text" ? answer?.answerText?.trim() ?? "" : "",
                        selectedOptions:
                          question.type === "open_text"
                            ? []
                            : answer?.selectedOptions ?? []
                      } satisfies SurveyAnswer;
                    });

                    submitMutation.mutate({
                      studyId: survey.id,
                      helperId: user.uid,
                      answers,
                      responseSummary: notesByStudy[survey.id] ?? ""
                    });
                  }}
                  disabled={submitMutation.isPending || !user}
                >
                  Complete Study
                </Button>
              </li>
            ))}
            {!studiesQuery.data?.length && (
              <li className="text-sm text-muted-foreground">
                No research surveys are available for your helper account right now.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}


