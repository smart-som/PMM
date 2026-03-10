"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/contexts/session-context";
import {
  createAnalyticsReport,
  deleteAnalyticsReport,
  getAnalyticsReportsByOwner
} from "@/lib/queries/firestore";
import { useRoleData } from "@/lib/queries/hooks";

function AnalyticsPageContent() {
  const { user } = useSession();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const selectedProjectId = searchParams.get("projectId");
  const isSoloMode = searchParams.get("mode") === "solo";
  const scopeProjectId = isSoloMode ? null : selectedProjectId;
  const { projectsQuery } = useRoleData(user?.uid ?? null, user?.role ?? null);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [metrics, setMetrics] = useState("");

  const reportsQuery = useQuery({
    queryKey: ["analytics-reports", user?.uid],
    queryFn: () => getAnalyticsReportsByOwner(user!.uid),
    enabled: Boolean(user?.uid && user.role === "pm")
  });

  const createMutation = useMutation({
    mutationFn: (payload: { title: string; summary: string; metrics: string }) =>
      createAnalyticsReport({
        ownerId: user!.uid,
        projectId: scopeProjectId,
        title: payload.title,
        summary: payload.summary,
        metrics: payload.metrics
      }),
    onSuccess: async () => {
      setTitle("");
      setSummary("");
      setMetrics("");
      await queryClient.invalidateQueries({ queryKey: ["analytics-reports", user?.uid] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (reportId: string) => deleteAnalyticsReport(reportId, user!.uid),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["analytics-reports", user?.uid] });
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

  const filteredReports = useMemo(() => {
    const reports = reportsQuery.data ?? [];
    if (scopeProjectId === null) {
      return reports.filter((report) => !report.projectId);
    }
    if (typeof scopeProjectId === "string" && scopeProjectId.length > 0) {
      return reports.filter((report) => report.projectId === scopeProjectId);
    }
    return reports;
  }, [reportsQuery.data, scopeProjectId]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    createMutation.mutate({
      title: title.trim(),
      summary: summary.trim(),
      metrics: metrics.trim()
    });
  }

  return (
    <main className="space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Analytics</CardTitle>
          <CardDescription>Scope: {scopeLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="analytics-title">Report title</Label>
              <Input
                id="analytics-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Activation funnel baseline"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="analytics-summary">Summary</Label>
              <Textarea
                id="analytics-summary"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="What did the numbers reveal?"
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="analytics-metrics">Key metrics</Label>
              <Textarea
                id="analytics-metrics"
                value={metrics}
                onChange={(event) => setMetrics(event.target.value)}
                placeholder="Activation rate: 42%, D7 retention: 18%"
                className="min-h-[100px]"
              />
            </div>
            <Button type="submit" disabled={!title.trim() || createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Save Analytics Report"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {filteredReports.map((report) => (
              <li key={report.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{report.title}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-danger/30 text-danger hover:bg-danger/10 hover:text-danger"
                    onClick={() => deleteMutation.mutate(report.id)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{report.summary}</p>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{report.metrics}</p>
              </li>
            ))}
            {!filteredReports.length && (
              <li className="text-sm text-muted-foreground">
                No analytics reports for this scope.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<main className="p-6">Loading...</main>}>
      <AnalyticsPageContent />
    </Suspense>
  );
}
