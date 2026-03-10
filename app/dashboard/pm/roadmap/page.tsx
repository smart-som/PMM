"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, WandSparkles } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { generateRoadmapStrategy } from "@/app/dashboard/pm/roadmap/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/contexts/session-context";
import {
  createRoadmapItem,
  createRoadmapPlaceholderPrd,
  deleteRoadmapItem,
  getPrdsByOwner,
  getRoadmapItemsByOwner,
  updatePrdLaunchQuarter
} from "@/lib/queries/firestore";
import { useRoleData } from "@/lib/queries/hooks";
import { RoadmapCard, RoadmapItem, RoadmapPriority, RoadmapQuarter } from "@/types/app";

const QUARTERS: RoadmapQuarter[] = ["Q1", "Q2", "Q3", "Q4"];

export default function RoadmapCanvasPage() {
  const { user } = useSession();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const selectedProjectId = searchParams.get("projectId");
  const isSoloMode = searchParams.get("mode") === "solo";
  const scopeProjectId = isSoloMode ? null : selectedProjectId;
  const { projectsQuery } = useRoleData(user?.uid ?? null, user?.role ?? null);

  const [cards, setCards] = useState<RoadmapCard[]>([]);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [strategyPrompt, setStrategyPrompt] = useState("");
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualQuarter, setManualQuarter] = useState<RoadmapQuarter>("Q1");
  const [manualTitle, setManualTitle] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualPriority, setManualPriority] = useState<RoadmapPriority>("medium");

  const prdsQuery = useQuery({
    queryKey: ["roadmap-prds", user?.uid],
    queryFn: () => getPrdsByOwner(user!.uid),
    enabled: Boolean(user?.uid && user?.role === "pm")
  });

  const roadmapItemsQuery = useQuery({
    queryKey: ["roadmap-items", user?.uid],
    queryFn: () => getRoadmapItemsByOwner(user!.uid),
    enabled: Boolean(user?.uid && user?.role === "pm")
  });

  const scopedPrds = useMemo(() => {
    const prds = prdsQuery.data ?? [];
    if (scopeProjectId === null) {
      return prds.filter((prd) => !prd.projectId);
    }
    if (typeof scopeProjectId === "string" && scopeProjectId.length > 0) {
      return prds.filter((prd) => prd.projectId === scopeProjectId);
    }
    return prds;
  }, [prdsQuery.data, scopeProjectId]);

  const scopedRoadmapItems = useMemo(() => {
    const items = roadmapItemsQuery.data ?? [];
    if (scopeProjectId === null) {
      return items.filter((item) => !item.projectId);
    }
    if (typeof scopeProjectId === "string" && scopeProjectId.length > 0) {
      return items.filter((item) => item.projectId === scopeProjectId);
    }
    return items;
  }, [roadmapItemsQuery.data, scopeProjectId]);

  const scopeLabel = useMemo(() => {
    if (scopeProjectId === null) return "Solo / Unassigned";
    if (!scopeProjectId) return "All Projects";
    return (
      projectsQuery.data?.find((project) => project.id === scopeProjectId)?.name ??
      `Project ${scopeProjectId}`
    );
  }, [projectsQuery.data, scopeProjectId]);

  useEffect(() => {
    setCards(
      scopedPrds.map((prd) => ({
        id: prd.id,
        title: prd.title || "Untitled PRD",
        impactScore: typeof prd.impactScore === "number" ? prd.impactScore : undefined,
        targetLaunchQuarter: prd.targetLaunchQuarter,
        isPlaceholder: (prd as unknown as { isPlaceholder?: boolean }).isPlaceholder ?? false
      }))
    );
  }, [scopedPrds]);

  const updateQuarterMutation = useMutation({
    mutationFn: (payload: { prdId: string; quarter: RoadmapQuarter }) =>
      updatePrdLaunchQuarter(payload.prdId, user!.uid, payload.quarter)
  });

  const persistPlaceholderMutation = useMutation({
    mutationFn: (payload: { title: string; quarter: RoadmapQuarter }) =>
      createRoadmapPlaceholderPrd(user!.uid, payload.title, payload.quarter, scopeProjectId ?? null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["roadmap-prds", user?.uid] });
    }
  });

  const createManualItemMutation = useMutation({
    mutationFn: (payload: {
      quarter: RoadmapQuarter;
      title: string;
      description: string;
      priority: RoadmapPriority;
    }) =>
      createRoadmapItem({
        ownerId: user!.uid,
        projectId: scopeProjectId ?? null,
        quarter: payload.quarter,
        title: payload.title,
        description: payload.description,
        priority: payload.priority
      }),
    onSuccess: async () => {
      setManualTitle("");
      setManualDescription("");
      setManualPriority("medium");
      setIsManualModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["roadmap-items", user?.uid] });
    }
  });

  const deleteRoadmapItemMutation = useMutation({
    mutationFn: (itemId: string) => deleteRoadmapItem(itemId, user!.uid),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["roadmap-items", user?.uid] });
    }
  });

  const strategyMutation = useMutation({
    mutationFn: (goal: string) =>
      generateRoadmapStrategy({
        goal,
        prds: scopedPrds.map((prd) => ({
          id: prd.id,
          title: prd.title,
          content: prd.content,
          impactScore: prd.impactScore,
          targetLaunchQuarter: prd.targetLaunchQuarter
        }))
      }),
    onSuccess: async (result) => {
      if (result.moves.length === 0 && result.placeholders.length === 0) {
        toast.error("AI returned no roadmap suggestions.");
        return;
      }

      const shouldApply = confirm("Apply AI roadmap suggestions?");
      if (!shouldApply) return;

      for (const move of result.moves) {
        setCards((prev) =>
          prev.map((card) =>
            card.id === move.prdId ? { ...card, targetLaunchQuarter: move.quarter } : card
          )
        );
        await updateQuarterMutation.mutateAsync({ prdId: move.prdId, quarter: move.quarter });
      }

      const newPlaceholders: RoadmapCard[] = result.placeholders.map((placeholder, index) => ({
        id: `placeholder-${Date.now()}-${index}`,
        title: placeholder.title,
        targetLaunchQuarter: placeholder.quarter,
        impactScore: 0,
        isPlaceholder: true
      }));

      setCards((prev) => [...prev, ...newPlaceholders]);
      setStrategyPrompt("");
      toast.success("Roadmap suggestions applied.");
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(error.message);
        return;
      }
      toast.error("Could not generate roadmap strategy.");
    }
  });

  const cardsByQuarter = useMemo(() => {
    return QUARTERS.reduce<Record<RoadmapQuarter, RoadmapCard[]>>((acc, quarter) => {
      acc[quarter] = cards
        .filter((card) => (card.targetLaunchQuarter ?? "Q1") === quarter)
        .sort((a, b) => (b.impactScore ?? 0) - (a.impactScore ?? 0));
      return acc;
    }, { Q1: [], Q2: [], Q3: [], Q4: [] });
  }, [cards]);

  const manualItemsByQuarter = useMemo(() => {
    return QUARTERS.reduce<Record<RoadmapQuarter, RoadmapItem[]>>(
      (acc, quarter) => {
        acc[quarter] = scopedRoadmapItems.filter((item) => item.quarter === quarter);
        return acc;
      },
      { Q1: [], Q2: [], Q3: [], Q4: [] }
    );
  }, [scopedRoadmapItems]);

  function onDropOnQuarter(quarter: RoadmapQuarter) {
    if (!draggingCardId || !user) return;

    const card = cards.find((item) => item.id === draggingCardId);
    if (!card) return;

    setCards((prev) =>
      prev.map((item) =>
        item.id === draggingCardId ? { ...item, targetLaunchQuarter: quarter } : item
      )
    );

    if (!card.isPlaceholder) {
      updateQuarterMutation.mutate({ prdId: draggingCardId, quarter });
    }

    setDraggingCardId(null);
  }

  function onPersistPlaceholder(card: RoadmapCard) {
    if (!card.isPlaceholder || !card.targetLaunchQuarter || !user) return;

    persistPlaceholderMutation.mutate(
      { title: card.title, quarter: card.targetLaunchQuarter },
      {
        onSuccess: () => {
          setCards((prev) => prev.filter((item) => item.id !== card.id));
        }
      }
    );
  }

  function openManualModal(quarter: RoadmapQuarter) {
    setManualQuarter(quarter);
    setIsManualModalOpen(true);
  }

  function onSubmitManualItem() {
    const title = manualTitle.trim();
    if (!title) {
      toast.error("Title is required.");
      return;
    }

    createManualItemMutation.mutate({
      quarter: manualQuarter,
      title,
      description: manualDescription.trim(),
      priority: manualPriority
    });
  }

  return (
    <main className="p-6 pb-28">
      <Card>
        <CardHeader>
          <CardTitle>Roadmap Canvas</CardTitle>
          <CardDescription>
            Scope: {scopeLabel}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center justify-between">
            <Link href="/dashboard/pm" className="text-sm text-accent underline">
              Back to PM Dashboard
            </Link>
            <p className="text-xs text-muted-foreground">
              Drag PRD cards across quarters. Add manual roadmap items with +.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            {QUARTERS.map((quarter) => (
              <section
                key={quarter}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => onDropOnQuarter(quarter)}
                className="min-h-[420px] rounded-xl border border-border bg-surface-2 p-3"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-muted-foreground">{quarter}</h2>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 w-8 rounded-full bg-accent p-0 text-accent-foreground hover:bg-accent/90"
                    onClick={() => openManualModal(quarter)}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  {cardsByQuarter[quarter].map((card) => (
                    <article
                      key={card.id}
                      draggable
                      onDragStart={() => setDraggingCardId(card.id)}
                      className="cursor-grab rounded-lg border border-border bg-surface p-3 text-sm shadow-sm"
                    >
                      <p className="font-medium text-foreground">{card.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Impact: {card.impactScore ?? 0}</p>
                      {card.isPlaceholder && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-3 w-full"
                          onClick={() => onPersistPlaceholder(card)}
                          disabled={persistPlaceholderMutation.isPending}
                        >
                          Persist Placeholder
                        </Button>
                      )}
                    </article>
                  ))}

                  {manualItemsByQuarter[quarter]?.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-lg border border-accent/30 bg-surface p-3 text-sm shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-foreground">{item.title}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 text-danger hover:bg-danger/10 hover:text-danger"
                          onClick={() => deleteRoadmapItemMutation.mutate(item.id)}
                          disabled={deleteRoadmapItemMutation.isPending}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{item.description || "No description."}</p>
                      <p className="mt-2 text-[11px] font-semibold uppercase text-muted-foreground">
                        Priority: {item.priority}
                      </p>
                    </article>
                  ))}

                  {!cardsByQuarter[quarter].length && !manualItemsByQuarter[quarter]?.length && (
                    <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                      Drop roadmap items here or use + to add manually.
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        </CardContent>
      </Card>

      {isManualModalOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-surface p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">Add Roadmap Item ({manualQuarter})</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground" htmlFor="manual-title">
                  Title
                </label>
                <Input
                  id="manual-title"
                  value={manualTitle}
                  onChange={(event) => setManualTitle(event.target.value)}
                  placeholder="Launch onboarding checklist"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground" htmlFor="manual-description">
                  Description
                </label>
                <Textarea
                  id="manual-description"
                  value={manualDescription}
                  onChange={(event) => setManualDescription(event.target.value)}
                  placeholder="Describe the roadmap item"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground" htmlFor="manual-priority">
                  Priority
                </label>
                <select
                  id="manual-priority"
                  value={manualPriority}
                  onChange={(event) => setManualPriority(event.target.value as RoadmapPriority)}
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsManualModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={onSubmitManualItem}
                disabled={createManualItemMutation.isPending}
              >
                {createManualItemMutation.isPending ? "Saving..." : "Save Item"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-20 flex justify-center px-4">
        <div className="pointer-events-auto flex w-full max-w-4xl items-center gap-2 rounded-full border border-accent bg-surface px-4 py-2 shadow-[0_16px_40px_hsl(var(--accent)/0.2)]">
          <WandSparkles className="size-4 shrink-0 text-accent" />
          <Input
            value={strategyPrompt}
            onChange={(event) => setStrategyPrompt(event.target.value)}
            placeholder="Strategy Prompt: Focus on mobile retention for Q2"
            className="h-10 border-0 bg-transparent px-0 focus-visible:ring-0"
          />
          <Button
            type="button"
            className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={strategyMutation.isPending || !strategyPrompt.trim() || !user}
            onClick={() => strategyMutation.mutate(strategyPrompt)}
          >
            {strategyMutation.isPending ? "Planning..." : "Generate Strategy"}
          </Button>
        </div>
      </div>
    </main>
  );
}
