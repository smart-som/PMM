"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/contexts/session-context";
import {
  createPrdDocument,
  deletePrdDocument,
  getPrdsByOwner
} from "@/lib/queries/firestore";
import { useRoleData } from "@/lib/queries/hooks";

function PrdIndexPageContent() {
  const { user } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const selectedProjectId = searchParams.get("projectId");
  const isSoloMode = searchParams.get("mode") === "solo";
  const scopeProjectId = isSoloMode ? null : selectedProjectId;
  const { projectsQuery } = useRoleData(user?.uid ?? null, user?.role ?? null);

  const prdsQuery = useQuery({
    queryKey: ["prds-index", user?.uid],
    queryFn: () => getPrdsByOwner(user!.uid),
    enabled: Boolean(user?.uid && user?.role === "pm")
  });

  const createPrdMutation = useMutation({
    mutationFn: () => createPrdDocument(user!.uid, scopeProjectId),
    onSuccess: async (prdId) => {
      await queryClient.invalidateQueries({ queryKey: ["prds-index", user?.uid] });
      router.push(`/dashboard/pm/prd/${prdId}`);
    }
  });

  const deletePrdMutation = useMutation({
    mutationFn: (prdId: string) => deletePrdDocument(prdId, user!.uid),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["prds-index", user?.uid] });
    }
  });

  const filteredPrds = useMemo(() => {
    const prds = prdsQuery.data ?? [];
    if (scopeProjectId === null) {
      return prds.filter((prd) => !prd.projectId);
    }
    if (typeof scopeProjectId === "string" && scopeProjectId.length > 0) {
      return prds.filter((prd) => prd.projectId === scopeProjectId);
    }
    return prds;
  }, [prdsQuery.data, scopeProjectId]);

  const scopeLabel = useMemo(() => {
    if (scopeProjectId === null) return "Solo / Unassigned";
    if (!scopeProjectId) return "All Projects";
    return (
      projectsQuery.data?.find((project) => project.id === scopeProjectId)?.name ??
      `Project ${scopeProjectId}`
    );
  }, [projectsQuery.data, scopeProjectId]);

  return (
    <main className="space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>PRD Canvas</CardTitle>
          <CardDescription>Scope: {scopeLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            onClick={() => createPrdMutation.mutate()}
            disabled={createPrdMutation.isPending || !user}
          >
            {createPrdMutation.isPending ? "Creating..." : "Create PRD Draft"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>PRD Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {filteredPrds.map((prd) => (
              <li key={prd.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{prd.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {prd.projectId ? `Project ID: ${prd.projectId}` : "Solo / Unassigned"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-danger/30 text-danger hover:bg-danger/10 hover:text-danger"
                    onClick={() => deletePrdMutation.mutate(prd.id)}
                    disabled={deletePrdMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
                <Link
                  href={`/dashboard/pm/prd/${prd.id}`}
                  className="mt-2 inline-flex text-xs font-semibold text-accent underline"
                >
                  Open PRD Canvas
                </Link>
              </li>
            ))}
            {!filteredPrds.length && (
              <li className="text-sm text-muted-foreground">
                No PRDs in this scope yet.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}

export default function PrdIndexPage() {
  return (
    <Suspense fallback={<main className="p-6">Loading...</main>}>
      <PrdIndexPageContent />
    </Suspense>
  );
}
