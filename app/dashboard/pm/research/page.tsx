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
  createPmResearchSession,
  deletePmResearchSession,
  getPmResearchSessionsByOwner,
  getPmResearchSummary
} from "@/lib/queries/firestore";
import { useRoleData } from "@/lib/queries/hooks";

function PMResearchPageContent() {
  const { user } = useSession();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const selectedProjectId = searchParams.get("projectId");
  const isSoloMode = searchParams.get("mode") === "solo";
  const scopeProjectId = isSoloMode ? null : selectedProjectId;
  const { projectsQuery } = useRoleData(user?.uid ?? null, user?.role ?? null);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [insights, setInsights] = useState("");

  const summaryQuery = useQuery({
    queryKey: ["pm-research-summary", user?.uid, scopeProjectId, isSoloMode],
    queryFn: () => getPmResearchSummary(user!.uid, scopeProjectId),
    enabled: Boolean(user?.uid && user.role === "pm")
  });

  const sessionsQuery = useQuery({
    queryKey: ["pm-research-sessions", user?.uid],
    queryFn: () => getPmResearchSessionsByOwner(user!.uid),
    enabled: Boolean(user?.uid && user.role === "pm")
  });

  const createSessionMutation = useMutation({
    mutationFn: (payload: { title: string; notes: string; insights: string }) =>
      createPmResearchSession({
        ownerId: user!.uid,
        projectId: scopeProjectId,
        title: payload.title,
        notes: payload.notes,
        insights: payload.insights
      }),
    onSuccess: async () => {
      setTitle("");
      setNotes("");
      setInsights("");
      await queryClient.invalidateQueries({ queryKey: ["pm-research-sessions", user?.uid] });
    }
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: string) => deletePmResearchSession(sessionId, user!.uid),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pm-research-sessions", user?.uid] });
    }
  });

  const filteredSessions = useMemo(() => {
    const sessions = sessionsQuery.data ?? [];
    if (scopeProjectId === null) {
      return sessions.filter((item) => !item.projectId);
    }
    if (typeof scopeProjectId === "string" && scopeProjectId.length > 0) {
      return sessions.filter((item) => item.projectId === scopeProjectId);
    }
    return sessions;
  }, [scopeProjectId, sessionsQuery.data]);

  const activeProjectName = useMemo(() => {
    if (!scopeProjectId) return "Solo / Unassigned";
    return (
      projectsQuery.data?.find((project) => project.id === scopeProjectId)?.name ??
      `Project ${scopeProjectId}`
    );
  }, [projectsQuery.data, scopeProjectId]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    createSessionMutation.mutate({
      title: title.trim(),
      notes: notes.trim(),
      insights: insights.trim()
    });
  }

  return (
    <main className="space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Research Workspace</CardTitle>
          <CardDescription>Scope: {activeProjectName}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">Studies</p>
            <p className="mt-1 text-2xl font-semibold">{summaryQuery.data?.totalStudies ?? 0}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">Responses</p>
            <p className="mt-1 text-2xl font-semibold">
              {summaryQuery.data?.totalResponses ?? 0}
            </p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">Pending review</p>
            <p className="mt-1 text-2xl font-semibold">
              {summaryQuery.data?.pendingReview ?? 0}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick PM Research Check</CardTitle>
          <CardDescription>
            Save PM-only internal notes and insights for this scope.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="session-title">Title</Label>
              <Input
                id="session-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Onboarding friction review"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-notes">Notes</Label>
              <Textarea
                id="session-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="What did you review and why?"
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-insights">Insights</Label>
              <Textarea
                id="session-insights"
                value={insights}
                onChange={(event) => setInsights(event.target.value)}
                placeholder="Top findings and recommended next actions"
                className="min-h-[100px]"
              />
            </div>
            <Button type="submit" disabled={createSessionMutation.isPending || !title.trim()}>
              {createSessionMutation.isPending ? "Saving..." : "Save Research Session"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved Research Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {filteredSessions.map((session) => (
              <li key={session.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{session.title}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-danger/30 text-danger hover:bg-danger/10 hover:text-danger"
                    onClick={() => deleteSessionMutation.mutate(session.id)}
                    disabled={deleteSessionMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{session.notes}</p>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{session.insights}</p>
              </li>
            ))}
            {!filteredSessions.length && (
              <li className="text-sm text-muted-foreground">
                No saved PM research sessions for this scope.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
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
