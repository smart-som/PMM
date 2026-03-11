"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

import { AiKickstartModal } from "@/components/discovery/ai-kickstart-modal";
import { NewStudyModal } from "@/components/discovery/new-study-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/contexts/session-context";
import { createProject, deleteProjectCascade } from "@/lib/queries/firestore";
import { useRoleData } from "@/lib/queries/hooks";
import { Project } from "@/types/app";

type ProjectDeleteState = {
  id: string;
  name: string;
} | null;

const PROJECT_TOOL_LINKS = [
  { label: "Research", path: "/dashboard/pm/research" },
  { label: "PRD Canvas", path: "/dashboard/pm/prd" },
  { label: "Roadmap", path: "/dashboard/pm/roadmap" },
  { label: "Analytics", path: "/dashboard/pm/analytics" },
  { label: "Journey Map", path: "/dashboard/pm/journey-map" },
  { label: "A/B Testing", path: "/dashboard/pm/ab-testing" }
];

const SOLO_QUICK_ACTIONS = [
  { label: "Solo Research", href: "/dashboard/pm/research?mode=solo" },
  { label: "Quick PRD", href: "/dashboard/pm/prd?mode=solo" },
  { label: "Quick Roadmap", href: "/dashboard/pm/roadmap?mode=solo" },
  { label: "Quick Analytics", href: "/dashboard/pm/analytics?mode=solo" },
  { label: "Quick Journey Map", href: "/dashboard/pm/journey-map?mode=solo" },
  { label: "Quick A/B Test", href: "/dashboard/pm/ab-testing?mode=solo" }
];

export default function PMDashboardPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { projectsQuery } = useRoleData(user?.uid ?? null, user?.role ?? null);
  const [projectName, setProjectName] = useState("");
  const [deleteState, setDeleteState] = useState<ProjectDeleteState>(null);
  const [typedDeleteName, setTypedDeleteName] = useState("");
  const [isStudyModalOpen, setIsStudyModalOpen] = useState(false);
  const [isKickstartModalOpen, setIsKickstartModalOpen] = useState(false);

  const createProjectMutation = useMutation({
    mutationFn: (name: string) => createProject(user!.uid, name),
    onSuccess: async () => {
      setProjectName("");
      await queryClient.invalidateQueries({ queryKey: ["projects", user?.uid] });
    }
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (project: Project) => deleteProjectCascade(project.id, user!.uid),
    onSuccess: async () => {
      setDeleteState(null);
      setTypedDeleteName("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects", user?.uid] }),
        queryClient.invalidateQueries({ queryKey: ["pm-studies", user?.uid] }),
        queryClient.invalidateQueries({ queryKey: ["prds-index", user?.uid] }),
        queryClient.invalidateQueries({ queryKey: ["roadmap-prds", user?.uid] }),
        queryClient.invalidateQueries({ queryKey: ["roadmap-items", user?.uid] }),
        queryClient.invalidateQueries({ queryKey: ["pm-research-summary", user?.uid] }),
        queryClient.invalidateQueries({ queryKey: ["pm-research-sessions", user?.uid] }),
        queryClient.invalidateQueries({ queryKey: ["analytics-reports", user?.uid] }),
        queryClient.invalidateQueries({ queryKey: ["journey-maps", user?.uid] }),
        queryClient.invalidateQueries({ queryKey: ["ab-tests", user?.uid] })
      ]);
    }
  });

  const canCreateProject = useMemo(
    () => projectName.trim().length > 1 && !createProjectMutation.isPending,
    [createProjectMutation.isPending, projectName]
  );
  const hasProjects = Boolean(projectsQuery.data?.length);

  function onCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = projectName.trim();
    if (!name) return;
    createProjectMutation.mutate(name);
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Projects & Products</CardTitle>
          <CardDescription>
            Start with a project/product to unlock all PM tools. Solo quick checks are available, but
            project-first is recommended.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={onCreateProject}>
            <div className="flex-1 space-y-2">
              <Label htmlFor="project-name">New Project / Product</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="OrbitPlus mobile onboarding"
              />
            </div>
            <Button
              type="submit"
              className="sm:mt-7 sm:w-auto"
              disabled={!canCreateProject}
            >
              {createProjectMutation.isPending ? "Creating..." : "Add New Project/Product"}
            </Button>
          </form>

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Quick solo checks</p>
            <div className="flex flex-wrap gap-2">
              {SOLO_QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm text-muted-foreground transition hover:border-accent/40 hover:text-foreground"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Project setup</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsStudyModalOpen(true)}
                disabled={!hasProjects}
              >
                Create Study
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsKickstartModalOpen(true)}
                disabled={!hasProjects}
              >
                AI Kickstart
              </Button>
            </div>
            {!hasProjects && (
              <p className="mt-2 text-xs text-muted-foreground">
                Add a project first. Study creation and AI kickstart now require an existing project from your workspace.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Projects</CardTitle>
          <CardDescription>
            Every project has direct access to Research, PRD, Roadmap, Analytics, Journey Map, and A/B Testing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {projectsQuery.data?.map((project) => (
              <article
                key={project.id}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-foreground">{project.name}</p>
                    <p className="text-xs text-muted-foreground">Project ID: {project.id}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-danger/40 text-danger hover:bg-danger/10 hover:text-danger"
                    onClick={() => setDeleteState({ id: project.id, name: project.name })}
                  >
                    Delete Project
                  </Button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {PROJECT_TOOL_LINKS.map((tool) => (
                    <Link
                      key={tool.path}
                      href={`${tool.path}?projectId=${project.id}`}
                      className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm text-muted-foreground transition hover:border-accent/40 hover:text-foreground"
                    >
                      {tool.label}
                    </Link>
                  ))}
                </div>
              </article>
            ))}

            {!projectsQuery.data?.length && (
              <p className="text-sm text-muted-foreground">
                No projects yet. Create your first project/product to begin with full tool access.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {deleteState && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Delete Project</CardTitle>
              <CardDescription>
                This permanently deletes the project and linked studies, PRDs, roadmap items, analytics, journey maps,
                A/B tests, and PM research sessions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Type <span className="font-semibold text-foreground">{deleteState.name}</span> to confirm.
              </p>
              <Input
                value={typedDeleteName}
                onChange={(event) => setTypedDeleteName(event.target.value)}
                placeholder={deleteState.name}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDeleteState(null);
                    setTypedDeleteName("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-danger text-white hover:bg-danger/90"
                  disabled={
                    typedDeleteName.trim() !== deleteState.name || deleteProjectMutation.isPending
                  }
                  onClick={() =>
                    deleteProjectMutation.mutate({
                      id: deleteState.id,
                      ownerId: user?.uid ?? "",
                      name: deleteState.name
                    })
                  }
                >
                  {deleteProjectMutation.isPending ? "Deleting..." : "Delete Forever"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {user && (
        <>
          <NewStudyModal
            open={isStudyModalOpen}
            ownerId={user.uid}
            projects={projectsQuery.data ?? []}
            onClose={() => setIsStudyModalOpen(false)}
          />
          <AiKickstartModal
            open={isKickstartModalOpen}
            ownerId={user.uid}
            projects={projectsQuery.data ?? []}
            onClose={() => setIsKickstartModalOpen(false)}
          />
        </>
      )}
    </main>
  );
}
