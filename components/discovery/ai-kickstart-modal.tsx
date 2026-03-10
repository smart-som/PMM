"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

import { generateProjectKickstart } from "@/app/dashboard/pm/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type AiKickstartModalProps = {
  open: boolean;
  ownerId: string;
  onClose: () => void;
};

export function AiKickstartModal({ open, ownerId, onClose }: AiKickstartModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [userSegment, setUserSegment] = useState("General users");
  const [budgetPerResponse, setBudgetPerResponse] = useState("20");
  const [ideaPrompt, setIdeaPrompt] = useState("");

  const canSubmit = useMemo(
    () =>
      projectId.trim().length > 0 &&
      ideaPrompt.trim().length > 0 &&
      Number(budgetPerResponse) > 0,
    [budgetPerResponse, ideaPrompt, projectId]
  );

  const kickstartMutation = useMutation({
    mutationFn: generateProjectKickstart,
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pm-studies", ownerId] }),
        queryClient.invalidateQueries({ queryKey: ["prds-index", ownerId] }),
        queryClient.invalidateQueries({ queryKey: ["roadmap-prds", ownerId] }),
        queryClient.invalidateQueries({ queryKey: ["roadmap-items", ownerId] })
      ]);
      toast.success(
        `Draft study + PRD + ${result.roadmapItemCount} roadmap item(s) created for ${result.projectId}.`
      );
      onClose();
      router.push(`/dashboard/pm/prd/${result.prdId}`);
    },
    onError: (error) => {
      if (error instanceof Error && error.message) {
        toast.error(error.message);
        return;
      }
      toast.error("Could not generate kickstart assets.");
    }
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    kickstartMutation.mutate({
      projectId: projectId.trim(),
      ideaPrompt: ideaPrompt.trim(),
      budgetPerResponse: Number(budgetPerResponse),
      userSegment: userSegment.trim() || "General users"
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>AI Kickstart Project</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="kickstart-project-id">Project ID</Label>
              <Input
                id="kickstart-project-id"
                placeholder="project_alpha"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="kickstart-segment">Primary User Segment</Label>
                <Input
                  id="kickstart-segment"
                  placeholder="Engineers"
                  value={userSegment}
                  onChange={(event) => setUserSegment(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kickstart-budget">Budget per response</Label>
                <Input
                  id="kickstart-budget"
                  type="number"
                  min="1"
                  step="0.01"
                  value={budgetPerResponse}
                  onChange={(event) => setBudgetPerResponse(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="kickstart-idea">Idea Prompt</Label>
              <Textarea
                id="kickstart-idea"
                value={ideaPrompt}
                onChange={(event) => setIdeaPrompt(event.target.value)}
                placeholder="Describe your product idea, target users, and the outcome you want to drive."
                className="min-h-[140px]"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={!canSubmit || kickstartMutation.isPending}
            >
              {kickstartMutation.isPending ? "Generating drafts..." : "Generate Draft Study + PRD + Roadmap"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


