"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createStudy } from "@/lib/queries/firestore";
import { SurveyQuestion, SurveyQuestionType } from "@/types/app";

type NewStudyModalProps = {
  open: boolean;
  ownerId: string;
  onClose: () => void;
};

function nextQuestionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `q-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function NewStudyModal({ open, ownerId, onClose }: NewStudyModalProps) {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [userSegment, setUserSegment] = useState("");
  const [budgetPerResponse, setBudgetPerResponse] = useState("");

  const [questionPrompt, setQuestionPrompt] = useState("");
  const [questionType, setQuestionType] = useState<SurveyQuestionType>("open_text");
  const [optionDraft, setOptionDraft] = useState("");
  const [questionOptions, setQuestionOptions] = useState<string[]>([]);
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>([]);

  const canSubmit = useMemo(
    () =>
      title.trim().length > 0 &&
      projectId.trim().length > 0 &&
      userSegment.trim().length > 0 &&
      Number(budgetPerResponse) > 0 &&
      surveyQuestions.length > 0,
    [budgetPerResponse, projectId, surveyQuestions.length, title, userSegment]
  );

  const createStudyMutation = useMutation({
    mutationFn: createStudy,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pm-studies", ownerId] });
      setProjectId("");
      setTitle("");
      setUserSegment("");
      setBudgetPerResponse("");
      setQuestionPrompt("");
      setQuestionType("open_text");
      setOptionDraft("");
      setQuestionOptions([]);
      setSurveyQuestions([]);
      onClose();
    }
  });

  function resetQuestionDraft() {
    setQuestionPrompt("");
    setQuestionType("open_text");
    setOptionDraft("");
    setQuestionOptions([]);
  }

  function addOption() {
    const trimmed = optionDraft.trim();
    if (!trimmed) return;
    if (questionOptions.some((option) => option.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }
    setQuestionOptions((prev) => [...prev, trimmed]);
    setOptionDraft("");
  }

  function removeOption(index: number) {
    setQuestionOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function addQuestion() {
    const prompt = questionPrompt.trim();
    if (!prompt) return;
    if (questionType !== "open_text" && questionOptions.length < 2) return;

    setSurveyQuestions((prev) => [
      ...prev,
      {
        id: nextQuestionId(),
        prompt,
        type: questionType,
        options: questionType === "open_text" ? [] : questionOptions
      }
    ]);
    resetQuestionDraft();
  }

  function removeQuestion(index: number) {
    setSurveyQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    createStudyMutation.mutate({
      projectId: projectId.trim(),
      ownerId,
      title: title.trim(),
      userSegment: userSegment.trim(),
      budgetPerResponse: Number(budgetPerResponse),
      surveyQuestions
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>New Study</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="study-project-id">Project ID</Label>
              <Input
                id="study-project-id"
                placeholder="project_alpha"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="study-title">Title</Label>
              <Input
                id="study-title"
                placeholder="Improve onboarding conversion"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="study-segment">User Segment</Label>
              <Input
                id="study-segment"
                placeholder="Engineers"
                value={userSegment}
                onChange={(event) => setUserSegment(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="study-budget">Budget per response</Label>
              <Input
                id="study-budget"
                type="number"
                min="1"
                step="0.01"
                placeholder="20"
                value={budgetPerResponse}
                onChange={(event) => setBudgetPerResponse(event.target.value)}
              />
            </div>

            <div className="space-y-2 rounded-md border border-border p-3">
              <Label htmlFor="question-prompt">Question Prompt</Label>
              <Textarea
                id="question-prompt"
                value={questionPrompt}
                onChange={(event) => setQuestionPrompt(event.target.value)}
                placeholder="What frustrates you most in your current workflow?"
              />

              <div className="space-y-2">
                <Label htmlFor="question-type">Question Type</Label>
                <select
                  id="question-type"
                  value={questionType}
                  onChange={(event) => {
                    const type = event.target.value as SurveyQuestionType;
                    setQuestionType(type);
                    if (type === "open_text") {
                      setOptionDraft("");
                      setQuestionOptions([]);
                    }
                  }}
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="open_text">Open text</option>
                  <option value="single_select">Single select</option>
                  <option value="multi_select">Multi select</option>
                </select>
              </div>

              {questionType !== "open_text" && (
                <div className="space-y-2">
                  <Label>Options (min 2)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={optionDraft}
                      onChange={(event) => setOptionDraft(event.target.value)}
                      placeholder="Add option"
                    />
                    <Button type="button" variant="outline" onClick={addOption}>
                      Add
                    </Button>
                  </div>
                  <ul className="space-y-1">
                    {questionOptions.map((option, index) => (
                      <li
                        key={`${option}-${index}`}
                        className="flex items-center justify-between rounded-md border border-border px-2 py-1 text-sm"
                      >
                        <span>{option}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeOption(index)}
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                  Add question
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Survey Questions</Label>
              <ul className="space-y-2">
                {surveyQuestions.map((question, index) => (
                  <li
                    key={question.id}
                    className="rounded-md border border-border p-2 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{question.prompt}</p>
                        <p className="mt-1 text-xs uppercase text-muted-foreground">
                          {question.type.replace("_", " ")}
                        </p>
                        {question.options.length > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Options: {question.options.join(", ")}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeQuestion(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  </li>
                ))}
                {!surveyQuestions.length && (
                  <li className="text-sm text-muted-foreground">No questions added yet.</li>
                )}
              </ul>
            </div>

            <Button
              type="submit"
              disabled={!canSubmit || createStudyMutation.isPending}
              className="w-full"
            >
              {createStudyMutation.isPending ? "Saving..." : "Save Study"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


