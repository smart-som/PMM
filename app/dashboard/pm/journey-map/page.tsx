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
  createJourneyMap,
  deleteJourneyMap,
  getJourneyMapsByOwner
} from "@/lib/queries/firestore";
import { useRoleData } from "@/lib/queries/hooks";

function JourneyMapPageContent() {
  const { user } = useSession();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const selectedProjectId = searchParams.get("projectId");
  const isSoloMode = searchParams.get("mode") === "solo";
  const scopeProjectId = isSoloMode ? null : selectedProjectId;
  const { projectsQuery } = useRoleData(user?.uid ?? null, user?.role ?? null);

  const [title, setTitle] = useState("");
  const [stages, setStages] = useState("");
  const [painPoints, setPainPoints] = useState("");
  const [opportunities, setOpportunities] = useState("");

  const journeyMapsQuery = useQuery({
    queryKey: ["journey-maps", user?.uid],
    queryFn: () => getJourneyMapsByOwner(user!.uid),
    enabled: Boolean(user?.uid && user.role === "pm")
  });

  const createMutation = useMutation({
    mutationFn: (payload: {
      title: string;
      stages: string;
      painPoints: string;
      opportunities: string;
    }) =>
      createJourneyMap({
        ownerId: user!.uid,
        projectId: scopeProjectId,
        title: payload.title,
        stages: payload.stages,
        painPoints: payload.painPoints,
        opportunities: payload.opportunities
      }),
    onSuccess: async () => {
      setTitle("");
      setStages("");
      setPainPoints("");
      setOpportunities("");
      await queryClient.invalidateQueries({ queryKey: ["journey-maps", user?.uid] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (mapId: string) => deleteJourneyMap(mapId, user!.uid),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["journey-maps", user?.uid] });
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

  const filteredJourneyMaps = useMemo(() => {
    const maps = journeyMapsQuery.data ?? [];
    if (scopeProjectId === null) {
      return maps.filter((item) => !item.projectId);
    }
    if (typeof scopeProjectId === "string" && scopeProjectId.length > 0) {
      return maps.filter((item) => item.projectId === scopeProjectId);
    }
    return maps;
  }, [journeyMapsQuery.data, scopeProjectId]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    createMutation.mutate({
      title: title.trim(),
      stages: stages.trim(),
      painPoints: painPoints.trim(),
      opportunities: opportunities.trim()
    });
  }

  return (
    <main className="space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>User Journey Map</CardTitle>
          <CardDescription>Scope: {scopeLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="journey-title">Map title</Label>
              <Input
                id="journey-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Self-serve signup journey"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="journey-stages">Journey stages</Label>
              <Textarea
                id="journey-stages"
                value={stages}
                onChange={(event) => setStages(event.target.value)}
                placeholder="Discover -> Try -> Activate -> Expand"
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="journey-pain-points">Pain points</Label>
              <Textarea
                id="journey-pain-points"
                value={painPoints}
                onChange={(event) => setPainPoints(event.target.value)}
                placeholder="High drop-off at onboarding checklist step 2"
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="journey-opportunities">Opportunities</Label>
              <Textarea
                id="journey-opportunities"
                value={opportunities}
                onChange={(event) => setOpportunities(event.target.value)}
                placeholder="Add progressive profile setup and in-product hints"
                className="min-h-[100px]"
              />
            </div>
            <Button type="submit" disabled={!title.trim() || createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Save Journey Map"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved Journey Maps</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {filteredJourneyMaps.map((map) => (
              <li key={map.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{map.title}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-danger/30 text-danger hover:bg-danger/10 hover:text-danger"
                    onClick={() => deleteMutation.mutate(map.id)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{map.stages}</p>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{map.painPoints}</p>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{map.opportunities}</p>
              </li>
            ))}
            {!filteredJourneyMaps.length && (
              <li className="text-sm text-muted-foreground">
                No journey maps for this scope.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}

export default function JourneyMapPage() {
  return (
    <Suspense fallback={<main className="p-6">Loading...</main>}>
      <JourneyMapPageContent />
    </Suspense>
  );
}
