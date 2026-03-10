"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/contexts/session-context";
import {
  createAbTestExperiment,
  deleteAbTestExperiment,
  getAbTestExperimentsByOwner
} from "@/lib/queries/firestore";
import { useRoleData } from "@/lib/queries/hooks";

export default function AbTestingPage() {
  const { user } = useSession();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const selectedProjectId = searchParams.get("projectId");
  const isSoloMode = searchParams.get("mode") === "solo";
  const scopeProjectId = isSoloMode ? null : selectedProjectId;
  const { projectsQuery } = useRoleData(user?.uid ?? null, user?.role ?? null);

  const [title, setTitle] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [variantA, setVariantA] = useState("");
  const [variantB, setVariantB] = useState("");
  const [successMetric, setSuccessMetric] = useState("");
  const [status, setStatus] = useState<"draft" | "running" | "completed">("draft");

  const experimentsQuery = useQuery({
    queryKey: ["ab-tests", user?.uid],
    queryFn: () => getAbTestExperimentsByOwner(user!.uid),
    enabled: Boolean(user?.uid && user.role === "pm")
  });

  const createMutation = useMutation({
    mutationFn: (payload: {
      title: string;
      hypothesis: string;
      variantA: string;
      variantB: string;
      successMetric: string;
      status: "draft" | "running" | "completed";
    }) =>
      createAbTestExperiment({
        ownerId: user!.uid,
        projectId: scopeProjectId,
        title: payload.title,
        hypothesis: payload.hypothesis,
        variantA: payload.variantA,
        variantB: payload.variantB,
        successMetric: payload.successMetric,
        status: payload.status
      }),
    onSuccess: async () => {
      setTitle("");
      setHypothesis("");
      setVariantA("");
      setVariantB("");
      setSuccessMetric("");
      setStatus("draft");
      await queryClient.invalidateQueries({ queryKey: ["ab-tests", user?.uid] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (experimentId: string) => deleteAbTestExperiment(experimentId, user!.uid),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ab-tests", user?.uid] });
    }
  });

  const scopeLabel = useMemo(() => {
    if (scopeProjectId === null) return "Solo / Unassigned";
    if (!scopeProjectId) return "All Projects";
    return (
      projectsQuery.data?.find((project) => project.id === scopeProjectId)?.name ??
      `Project ${scopeProjectId}`
    );
  }, [projectsQuery.data, scopeProjectId]);

  const filteredExperiments = useMemo(() => {
    const items = experimentsQuery.data ?? [];
    if (scopeProjectId === null) {
      return items.filter((item) => !item.projectId);
    }
    if (typeof scopeProjectId === "string" && scopeProjectId.length > 0) {
      return items.filter((item) => item.projectId === scopeProjectId);
    }
    return items;
  }, [experimentsQuery.data, scopeProjectId]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;

    createMutation.mutate({
      title: title.trim(),
      hypothesis: hypothesis.trim(),
      variantA: variantA.trim(),
      variantB: variantB.trim(),
      successMetric: successMetric.trim(),
      status
    });
  }

  return (
    <main className="space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>A/B Testing</CardTitle>
          <CardDescription>Scope: {scopeLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="ab-title">Experiment title</Label>
              <Input
                id="ab-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Onboarding CTA wording test"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ab-hypothesis">Hypothesis</Label>
              <Textarea
                id="ab-hypothesis"
                value={hypothesis}
                onChange={(event) => setHypothesis(event.target.value)}
                placeholder="Changing CTA from 'Create workspace' to 'Get started free' increases activation."
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ab-variant-a">Variant A</Label>
              <Textarea
                id="ab-variant-a"
                value={variantA}
                onChange={(event) => setVariantA(event.target.value)}
                placeholder="Current control experience"
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ab-variant-b">Variant B</Label>
              <Textarea
                id="ab-variant-b"
                value={variantB}
                onChange={(event) => setVariantB(event.target.value)}
                placeholder="Proposed variation"
                className="min-h-[80px]"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ab-metric">Success metric</Label>
                <Input
                  id="ab-metric"
                  value={successMetric}
                  onChange={(event) => setSuccessMetric(event.target.value)}
                  placeholder="Activation conversion rate"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ab-status">Status</Label>
                <select
                  id="ab-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as "draft" | "running" | "completed")}
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="draft">Draft</option>
                  <option value="running">Running</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
            <Button type="submit" disabled={!title.trim() || createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Save A/B Experiment"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved Experiments</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {filteredExperiments.map((experiment) => (
              <li key={experiment.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{experiment.title}</p>
                    <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      {experiment.status}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-danger/30 text-danger hover:bg-danger/10 hover:text-danger"
                    onClick={() => deleteMutation.mutate(experiment.id)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{experiment.hypothesis}</p>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">A: {experiment.variantA}</p>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">B: {experiment.variantB}</p>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                  Metric: {experiment.successMetric}
                </p>
              </li>
            ))}
            {!filteredExperiments.length && (
              <li className="text-sm text-muted-foreground">
                No A/B experiments for this scope.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
