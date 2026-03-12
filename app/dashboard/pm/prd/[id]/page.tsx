"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, ChevronUp, Download, Plus, WandSparkles } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  generateFullPrdFromProjectContext,
  generateInsightsForProject,
  generatePrdIdeaWorkspace,
  generatePrdSectionContent
} from "@/app/dashboard/pm/prd/[id]/actions";
import { generateRoadmapDeliverablesFromPrd } from "@/app/dashboard/pm/roadmap/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/contexts/session-context";
import {
  buildPrdExportFilename,
  createPrdDocxBlob,
  createPrdPdfBlob
} from "@/lib/prd/export";
import {
  ParsedPrdDocument,
  PRD_SECTIONS,
  ROOT_PRD_TITLE,
  getOrderedSectionTitles,
  getPresentSectionTitles,
  getSectionBody,
  parsePrdDocument,
  serializePrdDocument,
  upsertSectionInDocument
} from "@/lib/prd/markdown";
import {
  buildRoadmapCanvasUrl,
  storePrdRoadmapDraft
} from "@/lib/prd/roadmap-draft";
import {
  getOrCreatePrdDocument,
  savePrdAssistantWorkspace,
  savePrdContent,
  updatePrdReadiness,
  updatePrdRoadmapPromptState
} from "@/lib/queries/firestore";
import { useRoleData } from "@/lib/queries/hooks";
import { cn } from "@/lib/utils";
import {
  AiInsights,
  PrdAssistantReadiness,
  PrdAssistantWorkspace,
  PrdRoadmapPromptState
} from "@/types/app";

type CompanionPanel = "idea_prep" | "research_insights";

const assistantReadinessMeta: Record<
  PrdAssistantReadiness,
  { badgeClassName: string; helperText: string; label: string }
> = {
  needs_idea: {
    label: "Needs Idea",
    helperText: "Start with a clear one-sentence concept so the assistant has something concrete to shape.",
    badgeClassName: "border-border bg-surface-2 text-muted-foreground"
  },
  needs_more_info: {
    label: "Needs More Info",
    helperText: "The concept is promising, but the PRD still needs sharper constraints or assumptions.",
    badgeClassName: "border-warning/30 bg-warning/10 text-warning"
  },
  ready_to_transfer: {
    label: "Ready To Transfer",
    helperText: "The draft is specific enough to move into the main PRD canvas.",
    badgeClassName: "border-success/30 bg-success/10 text-success"
  }
};

function createEmptyAssistantWorkspace(): PrdAssistantWorkspace {
  return {
    idea: "",
    clarificationNotes: "",
    assistantOpinion: "",
    ideaBreakdown: [],
    marketSummary: "",
    competitors: [],
    clarifyingQuestions: [],
    readiness: "needs_idea",
    draftMarkdown: ""
  };
}

function getActionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function formatTimestamp(value: number | null) {
  if (!value) return "Not saved yet";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

function OverviewMetric({
  detail,
  label,
  value
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/80 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold text-foreground sm:text-xl">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

export default function PrdCanvasPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const prdId = params.id;
  const { user } = useSession();
  const { projectsQuery } = useRoleData(user?.uid ?? null, user?.role ?? null);
  const builderColumnRef = useRef<HTMLDivElement | null>(null);
  const addSectionMenuRef = useRef<HTMLDivElement | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const sectionTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const draftPreviewRef = useRef<HTMLDivElement | null>(null);
  const draftPreviewSectionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const lastSavedAssistantRevisionRef = useRef(0);
  const [isPending, startTransition] = useTransition();
  const [insights, setInsights] = useState<AiInsights>({
    topPainPoints: [],
    featureSuggestions: []
  });
  const [editorText, setEditorText] = useState("");
  const [savedEditorText, setSavedEditorText] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [assistantWorkspace, setAssistantWorkspace] = useState<PrdAssistantWorkspace>(
    createEmptyAssistantWorkspace()
  );
  const [assistantManualRevision, setAssistantManualRevision] = useState(0);
  const [activeCompanionPanel, setActiveCompanionPanel] = useState<CompanionPanel>("idea_prep");
  const [activeSectionTitle, setActiveSectionTitle] = useState(PRD_SECTIONS[0].title);
  const [openSectionTitles, setOpenSectionTitles] = useState<string[]>([]);
  const [showManualCanvas, setShowManualCanvas] = useState(true);
  const [showAddSectionMenu, setShowAddSectionMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [readyAt, setReadyAt] = useState<number | null>(null);
  const [roadmapPromptState, setRoadmapPromptState] = useState<PrdRoadmapPromptState>("pending");
  const [showRoadmapPromptModal, setShowRoadmapPromptModal] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<"docx" | "pdf" | null>(null);
  const [builderColumnMetrics, setBuilderColumnMetrics] = useState<{
    left: number;
    width: number;
  } | null>(null);

  const prdQuery = useQuery({
    queryKey: ["prd", prdId, user?.uid],
    queryFn: () => getOrCreatePrdDocument(prdId, user!.uid),
    enabled: Boolean(user?.uid && prdId),
    refetchOnWindowFocus: false
  });
  const projectContextId = prdQuery.data?.projectId ?? null;

  useEffect(() => {
    if (prdQuery.data?.content !== undefined) {
      const nextContent = prdQuery.data.content;
      const parsedContent = parsePrdDocument(nextContent);
      const presentTitles = getPresentSectionTitles(parsedContent.sections);
      setEditorText(nextContent);
      setOpenSectionTitles(presentTitles);
      setActiveSectionTitle(presentTitles[0] ?? PRD_SECTIONS[0].title);
      setSavedEditorText(nextContent);
      setLastSavedAt(prdQuery.data.updatedAt ?? null);
    }
  }, [prdQuery.data?.content, prdQuery.data?.updatedAt]);

  useEffect(() => {
    if (!prdQuery.data) return;
    setAssistantWorkspace(prdQuery.data.assistantWorkspace ?? createEmptyAssistantWorkspace());
    setAssistantManualRevision(0);
    lastSavedAssistantRevisionRef.current = 0;
  }, [prdId, prdQuery.data]);

  useEffect(() => {
    if (!prdQuery.data) return;
    setIsReady(Boolean(prdQuery.data.isReady));
    setReadyAt(prdQuery.data.readyAt ?? null);
    setRoadmapPromptState(prdQuery.data.roadmapPromptState ?? "pending");
  }, [prdQuery.data]);

  useEffect(() => {
    const column = builderColumnRef.current;
    if (!column) return;

    const updateMetrics = () => {
      const rect = column.getBoundingClientRect();
      setBuilderColumnMetrics({
        left: rect.left,
        width: rect.width
      });
    };

    updateMetrics();

    const resizeObserver = new ResizeObserver(() => {
      updateMetrics();
    });
    resizeObserver.observe(column);
    window.addEventListener("resize", updateMetrics);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateMetrics);
    };
  }, []);

  useEffect(() => {
    if (!showAddSectionMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (addSectionMenuRef.current?.contains(event.target as Node)) return;
      setShowAddSectionMenu(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [showAddSectionMenu]);

  useEffect(() => {
    if (!showExportMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (exportMenuRef.current?.contains(event.target as Node)) return;
      setShowExportMenu(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [showExportMenu]);

  const saveMutation = useMutation({
    mutationFn: (content: string) =>
      savePrdContent(prdId, user!.uid, content, prdQuery.data?.projectId ?? null),
    onSuccess: (_, content) => {
      setSavedEditorText(content);
      setLastSavedAt(Date.now());
    }
  });
  const saveAssistantMutation = useMutation({
    mutationFn: (workspace: PrdAssistantWorkspace) =>
      savePrdAssistantWorkspace(prdId, user!.uid, workspace, prdQuery.data?.projectId ?? null),
    onError: (error) =>
      toast.error(getActionErrorMessage(error, "Could not save PRD assistant."))
  });
  const generateFullPrdMutation = useMutation({
    mutationFn: (payload: { projectId: string; currentPrdText: string }) =>
      generateFullPrdFromProjectContext(payload),
    onSuccess: (generatedText) => {
      replaceDocumentAndOpenSections(generatedText);
      if (user) {
        saveMutation.mutate(generatedText);
      }
      toast.success("Full PRD generated and replaced.");
    },
    onError: (error) =>
      toast.error(getActionErrorMessage(error, "Could not generate full PRD."))
  });
  const generateIdeaWorkspaceMutation = useMutation({
    mutationFn: (payload: {
      prdId: string;
      projectId: string | null;
      idea: string;
      clarificationNotes: string;
      currentWorkspace: Partial<PrdAssistantWorkspace>;
    }) => generatePrdIdeaWorkspace(payload),
    onSuccess: (nextWorkspace) => {
      setAssistantWorkspace(nextWorkspace);
      if (user) {
        saveAssistantMutation.mutate(nextWorkspace, {
          onSuccess: () => {
            lastSavedAssistantRevisionRef.current = assistantManualRevision;
          }
        });
      }
      toast.success("Idea analysis updated.");
    },
    onError: (error) =>
      toast.error(getActionErrorMessage(error, "Could not analyze the PRD idea."))
  });
  const readinessMutation = useMutation({
    mutationFn: (nextReady: boolean) => updatePrdReadiness(prdId, user!.uid, nextReady),
    onSuccess: (_, nextReady) => {
      setIsReady(nextReady);
      setReadyAt(nextReady ? Date.now() : null);
      if (!nextReady) {
        setShowRoadmapPromptModal(false);
      }
    },
    onError: (error) =>
      toast.error(getActionErrorMessage(error, "Could not update PRD readiness."))
  });
  const roadmapPromptStateMutation = useMutation({
    mutationFn: (nextState: PrdRoadmapPromptState) =>
      updatePrdRoadmapPromptState(prdId, user!.uid, nextState),
    onSuccess: (_, nextState) => {
      setRoadmapPromptState(nextState);
      if (nextState !== "pending") {
        setShowRoadmapPromptModal(false);
      }
    },
    onError: (error) =>
      toast.error(getActionErrorMessage(error, "Could not update roadmap prompt state."))
  });
  const generateRoadmapDraftMutation = useMutation({
    mutationFn: () =>
      generateRoadmapDeliverablesFromPrd({
        prdId,
        projectId: projectContextId,
        title: prdQuery.data?.title ?? "Product Requirements Document",
        content: editorText
      }),
    onError: (error) =>
      toast.error(getActionErrorMessage(error, "Could not create roadmap draft."))
  });
  const generateSectionMutation = useMutation({
    mutationFn: (payload: {
      prdId: string;
      prompt: string;
      sectionTitle: string;
      currentSectionMarkdown: string;
      draftSectionMarkdown: string;
      currentPrdText: string;
    }) => generatePrdSectionContent(payload),
    onSuccess: (result, variables) => {
      const { nextText } = upsertSectionInDocument(
        variables.currentPrdText,
        result.sectionTitle,
        result.sectionMarkdown
      );
      setEditorText(nextText);
      setOpenSectionTitles((previous) =>
        getOrderedSectionTitles([...previous, result.sectionTitle])
      );
      setAiPrompt("");
      setActiveSectionTitle(result.sectionTitle);
      focusSectionTextarea(result.sectionTitle);
      if (user) {
        saveMutation.mutate(nextText);
      }
      toast.success(`Updated ${result.sectionTitle} in the PRD canvas.`);
    },
    onError: (error) =>
      toast.error(getActionErrorMessage(error, "Could not generate section content."))
  });
  const isSavingAssistant = saveAssistantMutation.isPending;
  const mutateAssistantWorkspace = saveAssistantMutation.mutate;

  useEffect(() => {
    if (!user || !prdQuery.data) return;
    if (assistantManualRevision === 0) return;
    if (assistantManualRevision <= lastSavedAssistantRevisionRef.current) return;
    if (isSavingAssistant) return;

    const timeoutId = window.setTimeout(() => {
      const revisionToSave = assistantManualRevision;
      mutateAssistantWorkspace(assistantWorkspace, {
        onSuccess: () => {
          lastSavedAssistantRevisionRef.current = Math.max(
            lastSavedAssistantRevisionRef.current,
            revisionToSave
          );
        }
      });
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [
    assistantManualRevision,
    assistantWorkspace,
    isSavingAssistant,
    mutateAssistantWorkspace,
    prdQuery.data,
    user
  ]);

  const cards = useMemo(
    () => [
      ...insights.topPainPoints.map((text) => ({ type: "Pain Point", text })),
      ...insights.featureSuggestions.map((text) => ({ type: "Feature", text }))
    ],
    [insights.featureSuggestions, insights.topPainPoints]
  );
  const assistantHasAnalysis = useMemo(
    () =>
      Boolean(
        assistantWorkspace.assistantOpinion.trim() ||
          assistantWorkspace.ideaBreakdown.length ||
          assistantWorkspace.marketSummary.trim() ||
          assistantWorkspace.competitors.length ||
          assistantWorkspace.clarifyingQuestions.length ||
          assistantWorkspace.draftMarkdown.trim()
      ),
    [assistantWorkspace]
  );
  const canTransferAssistantDraft = Boolean(assistantWorkspace.draftMarkdown.trim());
  const readinessMeta = assistantReadinessMeta[assistantWorkspace.readiness];
  const prdTitle = prdQuery.data?.title ?? "Product Requirements Document";
  const projectLabel = useMemo(() => {
    if (!projectContextId) return "Solo / Unassigned";

    return (
      projectsQuery.data?.find((project) => project.id === projectContextId)?.name ??
      `Project ${projectContextId}`
    );
  }, [projectContextId, projectsQuery.data]);
  const parsedEditorDocument = useMemo(() => parsePrdDocument(editorText), [editorText]);
  const parsedDraftDocument = useMemo(
    () => parsePrdDocument(assistantWorkspace.draftMarkdown),
    [assistantWorkspace.draftMarkdown]
  );
  const presentSectionTitles = useMemo(
    () => getPresentSectionTitles(parsedEditorDocument.sections),
    [parsedEditorDocument.sections]
  );
  const sectionStates = useMemo(
    () =>
      PRD_SECTIONS.map((section, index) => ({
        ...section,
        canvasMarkdown: parsedEditorDocument.sections[index].markdown,
        canvasPresent: parsedEditorDocument.sections[index].present,
        draftMarkdown: parsedDraftDocument.sections[index].markdown,
        draftPresent: parsedDraftDocument.sections[index].present
      })),
    [parsedDraftDocument.sections, parsedEditorDocument.sections]
  );
  const visibleSectionStates = useMemo(
    () => sectionStates.filter((section) => section.canvasPresent),
    [sectionStates]
  );
  const availableSections = useMemo(
    () => sectionStates.filter((section) => !section.canvasPresent),
    [sectionStates]
  );
  const activeSectionState = useMemo(
    () => sectionStates.find((section) => section.title === activeSectionTitle) ?? sectionStates[0],
    [activeSectionTitle, sectionStates]
  );
  const presentSectionCount = useMemo(
    () => sectionStates.filter((section) => section.canvasPresent).length,
    [sectionStates]
  );
  const editorIsDirty = editorText !== savedEditorText;
  const workspaceState = useMemo(() => {
    if (prdQuery.isLoading) {
      return {
        detail: "Loading the PRD workspace.",
        label: "Loading"
      };
    }
    if (saveMutation.isPending || isSavingAssistant) {
      return {
        detail: "Syncing document or assistant changes.",
        label: "Saving"
      };
    }
    if (editorIsDirty) {
      return {
        detail: "Canvas edits are local until you save the PRD.",
        label: "Unsaved"
      };
    }
    if (isReady) {
      return {
        detail: readyAt
          ? `Marked ready ${formatTimestamp(readyAt)}.`
          : "This PRD is ready for export and roadmap planning.",
        label: "Ready"
      };
    }
    if (lastSavedAt) {
      return {
        detail: `Last synced ${formatTimestamp(lastSavedAt)}.`,
        label: "Saved"
      };
    }
    if (editorText.trim() || assistantHasAnalysis) {
      return {
        detail: "Draft content exists but has not been saved in this session.",
        label: "In Progress"
      };
    }
    return {
      detail: "Start in the canvas or use the companion rail to generate a draft.",
      label: "Empty"
    };
  }, [
    assistantHasAnalysis,
    editorIsDirty,
    editorText,
    isReady,
    isSavingAssistant,
    lastSavedAt,
    prdQuery.isLoading,
    readyAt,
    saveMutation.isPending
  ]);

  useEffect(() => {
    if (isReady && roadmapPromptState === "pending") {
      setShowRoadmapPromptModal(true);
      return;
    }

    setShowRoadmapPromptModal(false);
  }, [isReady, roadmapPromptState]);

  useEffect(() => {
    const container = draftPreviewRef.current;
    const target = draftPreviewSectionRefs.current[activeSectionTitle];
    if (!container || !target) return;

    const nextTop = Math.max(0, target.offsetTop - container.offsetTop - 12);
    container.scrollTo({ behavior: "smooth", top: nextTop });
  }, [activeSectionTitle, parsedDraftDocument.sections]);

  useEffect(() => {
    if (!presentSectionTitles.length) {
      if (activeSectionTitle !== PRD_SECTIONS[0].title) {
        setActiveSectionTitle(PRD_SECTIONS[0].title);
      }
      return;
    }

    if (!presentSectionTitles.includes(activeSectionTitle)) {
      setActiveSectionTitle(presentSectionTitles[0]);
    }
  }, [activeSectionTitle, presentSectionTitles]);

  function updateAssistantIdea(nextIdea: string) {
    setAssistantWorkspace((previous) => ({
      ...previous,
      idea: nextIdea,
      readiness: nextIdea.trim() ? previous.readiness : "needs_idea"
    }));
    setAssistantManualRevision((previous) => previous + 1);
  }

  function updateAssistantClarificationNotes(nextNotes: string) {
    setAssistantWorkspace((previous) => ({
      ...previous,
      clarificationNotes: nextNotes
    }));
    setAssistantManualRevision((previous) => previous + 1);
  }

  function runIdeaAnalysis() {
    if (!assistantWorkspace.idea.trim()) {
      toast.error("Start with a simple product idea.");
      return;
    }

    generateIdeaWorkspaceMutation.mutate({
      prdId,
      projectId: projectContextId,
      idea: assistantWorkspace.idea,
      clarificationNotes: assistantWorkspace.clarificationNotes,
      currentWorkspace: assistantWorkspace
    });
  }

  function loadInsights() {
    if (!projectContextId) {
      toast.error("AI insights require a linked project. Open a project-scoped PRD.");
      return;
    }

    startTransition(async () => {
      try {
        const nextInsights = await generateInsightsForProject(projectContextId);
        setInsights(nextInsights);
        setActiveCompanionPanel("research_insights");
      } catch (error) {
        toast.error(getActionErrorMessage(error, "Could not generate AI insights."));
        console.error(error);
      }
    });
  }

  function replaceDocumentAndOpenSections(nextText: string, preferredTitle?: string | null) {
    const parsedNextDocument = parsePrdDocument(nextText);
    const nextPresentTitles = getPresentSectionTitles(parsedNextDocument.sections);
    const nextActiveTitle =
      preferredTitle && nextPresentTitles.includes(preferredTitle)
        ? preferredTitle
        : nextPresentTitles[0] ?? PRD_SECTIONS[0].title;

    setEditorText(nextText);
    setOpenSectionTitles(nextPresentTitles);
    setActiveSectionTitle(nextActiveTitle);

    return nextActiveTitle;
  }

  function resolveSectionTitleAtCursor(
    parsedDocument: ParsedPrdDocument,
    cursorPosition: number | null | undefined
  ) {
    if (typeof cursorPosition !== "number") return null;

    return (
      parsedDocument.sections.find(
        (section) =>
          section.present &&
          section.index >= 0 &&
          cursorPosition >= section.index &&
          cursorPosition <= section.endIndex
      )?.title ?? null
    );
  }

  function syncManualCanvasSelection(cursorPosition: number | null | undefined) {
    const sectionTitle = resolveSectionTitleAtCursor(parsedEditorDocument, cursorPosition);
    if (!sectionTitle) return;

    setActiveSectionTitle(sectionTitle);
    setOpenSectionTitles((previous) => getOrderedSectionTitles([...previous, sectionTitle]));
  }

  function focusSectionTextarea(sectionTitle: string) {
    const focusTarget = () => {
      const area = sectionTextareaRefs.current[sectionTitle];
      if (!area) return false;

      area.focus();
      area.scrollIntoView({ behavior: "smooth", block: "center" });
      const cursor = area.value.length;
      area.setSelectionRange(cursor, cursor);
      return true;
    };

    requestAnimationFrame(() => {
      if (focusTarget()) return;
      requestAnimationFrame(() => {
        focusTarget();
      });
    });
  }

  function ensureSectionVisible(
    sectionTitle: string,
    options?: { ensureCanvas?: boolean; focusTextarea?: boolean }
  ) {
    let nextText = editorText;
    const targetSection =
      sectionStates.find((section) => section.title === sectionTitle) ?? sectionStates[0];

    if (options?.ensureCanvas && targetSection && !targetSection.canvasPresent) {
      nextText = upsertSectionInDocument(editorText, sectionTitle, `## ${sectionTitle}\n`).nextText;
      setEditorText(nextText);
    }

    setOpenSectionTitles((previous) => getOrderedSectionTitles([...previous, sectionTitle]));
    setActiveSectionTitle(sectionTitle);

    if (options?.focusTextarea) {
      focusSectionTextarea(sectionTitle);
    }

    return nextText;
  }

  function updateManualCanvas(nextText: string, cursorPosition?: number | null) {
    const nextParsedDocument = parsePrdDocument(nextText);
    const nextPresentTitles = getPresentSectionTitles(nextParsedDocument.sections);
    const nextPresentTitleSet = new Set(nextPresentTitles);
    const previousPresentTitleSet = new Set(presentSectionTitles);
    const newlyPresentTitles = nextPresentTitles.filter((title) => !previousPresentTitleSet.has(title));
    const sectionAtCursor = resolveSectionTitleAtCursor(nextParsedDocument, cursorPosition);
    const nextActiveTitle =
      sectionAtCursor ??
      newlyPresentTitles[0] ??
      (nextPresentTitleSet.has(activeSectionTitle)
        ? activeSectionTitle
        : nextPresentTitles[0] ?? PRD_SECTIONS[0].title);

    setEditorText(nextText);
    setOpenSectionTitles((previous) => {
      const retainedTitles = previous.filter((title) => nextPresentTitleSet.has(title));
      return getOrderedSectionTitles([...retainedTitles, ...newlyPresentTitles]);
    });
    setActiveSectionTitle(nextActiveTitle);
  }

  function updateSectionBody(sectionTitle: string, nextBody: string) {
    const nextSectionMarkdown = nextBody.trim()
      ? `## ${sectionTitle}\n${nextBody}`
      : `## ${sectionTitle}\n`;
    const nextText = upsertSectionInDocument(editorText, sectionTitle, nextSectionMarkdown).nextText;
    setEditorText(nextText);
    setOpenSectionTitles((previous) => getOrderedSectionTitles([...previous, sectionTitle]));
  }

  function updateAdditionalNotes(nextAdditionalNotes: string) {
    const nextText = serializePrdDocument(parsedEditorDocument.sections, nextAdditionalNotes);
    setEditorText(nextText);
  }

  function toggleSection(sectionTitle: string) {
    const isOpen = openSectionTitles.includes(sectionTitle);

    if (isOpen) {
      const nextOpenTitles = openSectionTitles.filter((title) => title !== sectionTitle);
      setOpenSectionTitles(nextOpenTitles);
      if (activeSectionTitle === sectionTitle && nextOpenTitles.length > 0) {
        setActiveSectionTitle(nextOpenTitles[0]);
      }
      return;
    }

    setOpenSectionTitles((previous) => getOrderedSectionTitles([...previous, sectionTitle]));
    setActiveSectionTitle(sectionTitle);
    focusSectionTextarea(sectionTitle);
  }

  function addSection(sectionTitle: string) {
    const nextText = upsertSectionInDocument(editorText, sectionTitle, `## ${sectionTitle}\n`).nextText;
    setEditorText(nextText);
    setOpenSectionTitles((previous) => getOrderedSectionTitles([...previous, sectionTitle]));
    setActiveSectionTitle(sectionTitle);
    setShowAddSectionMenu(false);
    focusSectionTextarea(sectionTitle);
  }

  function insertInsightIntoSection(textToInsert: string, preferredSectionTitle?: string) {
    const resolvedSectionTitle =
      preferredSectionTitle ??
      (activeSectionState.canvasPresent
        ? activeSectionState.title
        : openSectionTitles[0] ?? presentSectionTitles[0] ?? PRD_SECTIONS[0].title);
    const currentTarget =
      sectionStates.find((section) => section.title === resolvedSectionTitle) ?? sectionStates[0];
    const seededText =
      currentTarget && currentTarget.canvasPresent
        ? editorText
        : upsertSectionInDocument(editorText, resolvedSectionTitle, `## ${resolvedSectionTitle}\n`)
            .nextText;
    const seededDocument = parsePrdDocument(seededText);
    const targetMarkdown =
      seededDocument.sections.find((section) => section.title === resolvedSectionTitle)?.markdown ??
      `## ${resolvedSectionTitle}\n`;
    const currentBody = getSectionBody(targetMarkdown, resolvedSectionTitle);
    const nextBody = currentBody.trim()
      ? `${currentBody.trimEnd()}\n- ${textToInsert}`
      : `- ${textToInsert}`;
    const nextText = upsertSectionInDocument(
      seededText,
      resolvedSectionTitle,
      `## ${resolvedSectionTitle}\n${nextBody}`
    ).nextText;

    setEditorText(nextText);
    setOpenSectionTitles((previous) =>
      getOrderedSectionTitles([...previous, resolvedSectionTitle])
    );
    setActiveSectionTitle(resolvedSectionTitle);
    focusSectionTextarea(resolvedSectionTitle);
  }

  function downloadBlob(blob: Blob, fileName: string) {
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0);
  }

  async function ensureCanvasSaved() {
    if (!user) {
      toast.error("You must be logged in as a PM.");
      return false;
    }

    if (!editorIsDirty) {
      return true;
    }

    try {
      await saveMutation.mutateAsync(editorText);
      return true;
    } catch {
      return false;
    }
  }

  async function onTogglePrdReady(nextReady: boolean) {
    if (nextReady && !editorText.trim()) {
      toast.error("Add PRD content before marking it ready.");
      return;
    }

    const didSave = await ensureCanvasSaved();
    if (!didSave) return;

    readinessMutation.mutate(nextReady, {
      onSuccess: () => {
        if (nextReady && roadmapPromptState === "pending") {
          setShowRoadmapPromptModal(true);
        }
      }
    });
  }

  async function onExport(format: "docx" | "pdf") {
    if (!isReady) {
      toast.error("Mark the PRD ready before exporting.");
      return;
    }

    const didSave = await ensureCanvasSaved();
    if (!didSave) return;

    setShowExportMenu(false);
    setExportingFormat(format);

    try {
      const exportedAt = new Date();
      const exportInput = {
        content: editorText,
        exportedAtLabel: formatTimestamp(exportedAt.getTime()),
        projectLabel,
        title: prdTitle
      };
      const blob =
        format === "docx"
          ? await createPrdDocxBlob(exportInput)
          : createPrdPdfBlob(exportInput);
      downloadBlob(blob, buildPrdExportFilename(prdTitle, format, exportedAt));
      toast.success(`PRD exported as ${format.toUpperCase()}.`);
    } catch (error) {
      toast.error(getActionErrorMessage(error, `Could not export PRD as ${format.toUpperCase()}.`));
    } finally {
      setExportingFormat(null);
    }
  }

  async function onDismissRoadmapPrompt() {
    if (!user) {
      toast.error("You must be logged in as a PM.");
      return;
    }

    await roadmapPromptStateMutation.mutateAsync("dismissed");
  }

  async function onCreateRoadmapFromPrd() {
    if (!user) {
      toast.error("You must be logged in as a PM.");
      return;
    }

    const didSave = await ensureCanvasSaved();
    if (!didSave) return;

    try {
      const result = await generateRoadmapDraftMutation.mutateAsync();
      storePrdRoadmapDraft({
        prdId,
        projectId: projectContextId,
        prdTitle,
        generatedAt: Date.now(),
        deliverables: result.deliverables
      });
      await roadmapPromptStateMutation.mutateAsync("accepted");
      router.push(
        buildRoadmapCanvasUrl({
          draft: "ai",
          prdId,
          projectId: projectContextId
        })
      );
    } catch {
      // Errors are surfaced by the involved mutations.
    }
  }

  function onGenerateFromPrompt() {
    const prompt = aiPrompt.trim();
    if (!prompt) {
      toast.error("Type a prompt first.");
      return;
    }

    if (!user) {
      toast.error("You must be logged in as a PM.");
      return;
    }

    generateSectionMutation.mutate({
      prdId,
      prompt,
      sectionTitle: activeSectionState.title,
      currentSectionMarkdown: activeSectionState.canvasMarkdown,
      currentPrdText: editorText,
      draftSectionMarkdown: activeSectionState.draftMarkdown
    });
  }

  function onGenerateFullPrd() {
    if (!projectContextId) {
      toast.error("Full PRD generation from context requires a linked project.");
      return;
    }

    if (!user) {
      toast.error("You must be logged in as a PM.");
      return;
    }

    const shouldReplace = confirm(
      "Generate a full PRD from current project context and replace existing content?"
    );
    if (!shouldReplace) return;

    generateFullPrdMutation.mutate({
      projectId: projectContextId,
      currentPrdText: editorText
    });
  }

  function onSendToCanvas() {
    if (!assistantWorkspace.draftMarkdown.trim()) {
      toast.error("Generate a PRD draft first.");
      return;
    }

    if (!user) {
      toast.error("You must be logged in as a PM.");
      return;
    }

    let confirmationMessage = "";

    if (assistantWorkspace.readiness !== "ready_to_transfer" && editorText.trim()) {
      confirmationMessage =
        "The AI draft still has open questions and this will replace the current canvas content. Send the full draft anyway?";
    } else if (assistantWorkspace.readiness !== "ready_to_transfer") {
      confirmationMessage =
        "The AI draft still has open questions. Send the current full draft to the main canvas anyway?";
    } else if (editorText.trim()) {
      confirmationMessage =
        "Replace the current canvas content with the full assistant draft?";
    }

    if (confirmationMessage) {
      const shouldReplace = confirm(confirmationMessage);
      if (!shouldReplace) return;
    }

    replaceDocumentAndOpenSections(assistantWorkspace.draftMarkdown, activeSectionTitle);
    saveMutation.mutate(assistantWorkspace.draftMarkdown);
    toast.success("Full AI draft transferred to the PRD canvas.");
  }

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 pb-36 sm:p-6 sm:pb-32">
      <Card className="overflow-hidden border-border/80 bg-surface/90">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <Link href="/dashboard/pm/prd" className="text-sm font-medium text-accent underline">
                Back to PRD Documents
              </Link>
              <div className="space-y-1">
                <CardTitle>PRD Workspace</CardTitle>
                <CardDescription>
                  Shape the document in one canvas, jump between missing sections quickly, and use AI when it adds leverage.
                </CardDescription>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Workspace</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{projectLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                PRD ID: {prdId}
                {projectContextId ? ` | Project ID: ${projectContextId}` : ""}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <OverviewMetric
              label="Project"
              value={projectLabel}
              detail={
                projectContextId
                  ? "This PRD is linked to a project and can use project-aware AI features."
                  : "This is a solo PRD draft without linked project research context."
              }
            />
            <OverviewMetric
              label="Assistant"
              value={readinessMeta.label}
              detail={readinessMeta.helperText}
            />
            <OverviewMetric
              label="Sections"
              value={`${presentSectionCount}/${PRD_SECTIONS.length}`}
              detail={
                presentSectionCount === PRD_SECTIONS.length
                  ? "All canonical PRD sections are present in the canvas."
                  : `${PRD_SECTIONS.length - presentSectionCount} section${PRD_SECTIONS.length - presentSectionCount === 1 ? "" : "s"} still missing from the canvas.`
              }
            />
            <OverviewMetric
              label="Draft State"
              value={workspaceState.label}
              detail={workspaceState.detail}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_380px]">
        <div ref={builderColumnRef} className="space-y-6">
          <Card className="border-border/80 bg-background/85 p-0">
            <CardHeader className="border-b border-border/70 px-6 pb-4 pt-6">
              <div className="space-y-1.5">
                <CardTitle>PRD Builder</CardTitle>
                <CardDescription>
                  Use section cards or the raw markdown canvas. Both stay in sync and save as the same PRD document.
                </CardDescription>
              </div>
              <p className="text-xs text-muted-foreground">
                {projectContextId
                  ? `${projectLabel} | Project-linked draft`
                  : "Solo / Unassigned draft"}{" "}
                | Present sections stay open by default, and headings typed in the manual canvas automatically open matching section cards.
              </p>
            </CardHeader>
            <CardContent className="space-y-5 overflow-visible px-6 pb-6 pt-5">
              <div className="sticky top-4 z-20 overflow-visible rounded-xl border border-border/70 bg-background/95 p-3 shadow-sm backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Canvas Actions</p>
                    <p className="text-xs text-muted-foreground">
                      Add missing sections, type raw markdown, generate a full draft, then mark the PRD ready for export and roadmap handoff.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div ref={addSectionMenuRef} className="relative isolate">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowAddSectionMenu((previous) => !previous)}
                        disabled={!availableSections.length}
                      >
                        <Plus className="mr-2 size-4" />
                        {availableSections.length ? "Add Section" : "All Sections Added"}
                      </Button>
                      {showAddSectionMenu && (
                        <div className="absolute left-0 top-full z-[60] mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-background shadow-[0_24px_56px_hsl(var(--foreground)/0.22)]">
                          <div className="border-b border-border/70 bg-surface/95 px-3 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              PRD Sections
                            </p>
                          </div>
                          <div className="max-h-[320px] space-y-1 overflow-y-auto bg-background p-2">
                            {sectionStates.map((section) => (
                              <button
                                key={`${section.id}-add-section`}
                                type="button"
                                disabled={section.canvasPresent}
                                onClick={() => addSection(section.title)}
                                className={cn(
                                  "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition",
                                  section.canvasPresent
                                    ? "cursor-not-allowed border-border/60 bg-surface text-muted-foreground"
                                    : "border-transparent bg-background text-foreground hover:border-border/70 hover:bg-surface-2"
                                )}
                              >
                                <span className="min-w-0 flex-1 truncate">{section.title}</span>
                                <span className="shrink-0 text-[10px] uppercase tracking-[0.16em]">
                                  {section.canvasPresent ? "Added" : "Add"}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowManualCanvas((previous) => !previous)}
                    >
                      {showManualCanvas ? "Hide Manual Canvas" : "Open Manual Canvas"}
                    </Button>
                    <Button
                      type="button"
                      variant={isReady ? "outline" : "success"}
                      onClick={() => void onTogglePrdReady(!isReady)}
                      disabled={readinessMutation.isPending || saveMutation.isPending || !user}
                    >
                      <CheckCircle2 className="mr-2 size-4" />
                      {readinessMutation.isPending
                        ? isReady
                          ? "Updating..."
                          : "Marking Ready..."
                        : isReady
                          ? "Mark Not Ready"
                          : "Mark PRD Ready"}
                    </Button>
                    {isReady && (
                      <div ref={exportMenuRef} className="relative isolate">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowExportMenu((previous) => !previous)}
                          disabled={exportingFormat !== null}
                        >
                          <Download className="mr-2 size-4" />
                          {exportingFormat ? "Exporting..." : "Export"}
                        </Button>
                        {showExportMenu && (
                          <div className="absolute left-0 top-full z-[60] mt-2 w-48 overflow-hidden rounded-2xl border border-border bg-background shadow-[0_24px_56px_hsl(var(--foreground)/0.22)]">
                            <div className="border-b border-border/70 bg-surface/95 px-3 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                Export PRD
                              </p>
                            </div>
                            <div className="space-y-1 bg-background p-2">
                              <button
                                type="button"
                                onClick={() => void onExport("pdf")}
                                className="flex w-full items-center justify-between rounded-xl border border-transparent bg-background px-3 py-2.5 text-left text-sm text-foreground transition hover:border-border/70 hover:bg-surface-2"
                              >
                                <span>Export PDF</span>
                                <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                                  PDF
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void onExport("docx")}
                                className="flex w-full items-center justify-between rounded-xl border border-transparent bg-background px-3 py-2.5 text-left text-sm text-foreground transition hover:border-border/70 hover:bg-surface-2"
                              >
                                <span>Export DOCX</span>
                                <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                                  DOCX
                                </span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <Button
                      className="bg-accent text-accent-foreground hover:bg-accent/90"
                      onClick={() => saveMutation.mutate(editorText)}
                      disabled={saveMutation.isPending || !user}
                    >
                      {saveMutation.isPending ? "Saving..." : "Save PRD"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={onGenerateFullPrd}
                      disabled={generateFullPrdMutation.isPending || !user || !projectContextId}
                    >
                      {generateFullPrdMutation.isPending ? "Generating full PRD..." : "Generate Full PRD"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-surface/95">
                <button
                  type="button"
                  onClick={() => setShowManualCanvas((previous) => !previous)}
                  className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Manual Markdown Canvas</p>
                    <p className="text-xs text-muted-foreground">
                      Type raw PRD markdown directly. Canonical headings such as
                      <span className="font-medium text-foreground"> Problem Statement </span>
                      automatically open the matching section cards below.
                    </p>
                  </div>
                  <span className="rounded-full border border-border bg-background/80 p-1 text-muted-foreground">
                    {showManualCanvas ? (
                      <ChevronUp className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </span>
                </button>

                {showManualCanvas && (
                  <div className="border-t border-border/70 px-4 pb-4 pt-3">
                    <Textarea
                      value={editorText}
                      onChange={(event) =>
                        updateManualCanvas(event.target.value, event.target.selectionStart)
                      }
                      onSelect={(event) =>
                        syncManualCanvasSelection(event.currentTarget.selectionStart)
                      }
                      onClick={(event) =>
                        syncManualCanvasSelection(event.currentTarget.selectionStart)
                      }
                      onKeyUp={(event) =>
                        syncManualCanvasSelection(event.currentTarget.selectionStart)
                      }
                      className="min-h-[240px] rounded-xl border-border/70 bg-background/85 px-4 py-4 font-mono text-sm leading-6"
                      placeholder={`${ROOT_PRD_TITLE}\n\n## Problem Statement\nDescribe the user problem and why it matters.\n\n## Goals\nList the outcomes this PRD should achieve.`}
                    />
                  </div>
                )}
              </div>

              <div
                className="space-y-3"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const payload = event.dataTransfer.getData("text/plain");
                  if (!payload) return;
                  insertInsightIntoSection(payload);
                }}
              >
                {visibleSectionStates.length > 0 ? (
                  visibleSectionStates.map((section) => {
                    const isOpen = openSectionTitles.includes(section.title);
                    const sectionBody = getSectionBody(section.canvasMarkdown, section.title);

                    return (
                      <div
                        key={section.id}
                        className={cn(
                          "rounded-2xl border bg-surface/95 transition",
                          section.title === activeSectionTitle
                            ? "border-accent/60 shadow-sm"
                            : "border-border/70"
                        )}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          const payload = event.dataTransfer.getData("text/plain");
                          if (!payload) return;
                          insertInsightIntoSection(payload, section.title);
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSection(section.title)}
                          className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">{section.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {isOpen
                                ? "Open for manual editing and AI targeting."
                                : "Collapsed. Click to expand this section."}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {section.title === activeSectionTitle && (
                              <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                                Active
                              </span>
                            )}
                            {section.draftPresent && (
                              <span className="rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-success">
                                AI Draft
                              </span>
                            )}
                            <span className="rounded-full border border-border bg-background/80 p-1 text-muted-foreground">
                              {isOpen ? (
                                <ChevronUp className="size-4" />
                              ) : (
                                <ChevronDown className="size-4" />
                              )}
                            </span>
                          </div>
                        </button>

                        {isOpen && (
                          <div className="border-t border-border/70 px-4 pb-4 pt-3">
                            <Textarea
                              ref={(node) => {
                                sectionTextareaRefs.current[section.title] = node;
                              }}
                              value={sectionBody}
                              onChange={(event) => updateSectionBody(section.title, event.target.value)}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => {
                                event.preventDefault();
                                const payload = event.dataTransfer.getData("text/plain");
                                if (!payload) return;
                                insertInsightIntoSection(payload, section.title);
                              }}
                              onFocus={() => {
                                setActiveSectionTitle(section.title);
                                setOpenSectionTitles((previous) =>
                                  getOrderedSectionTitles([...previous, section.title])
                                );
                              }}
                              className="min-h-40 rounded-xl border-border/70 bg-background/85 px-4 py-4 text-sm leading-6"
                              placeholder={`Add ${section.title.toLowerCase()} details here...`}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-surface/80 px-5 py-10 text-center">
                    <p className="text-sm font-medium text-foreground">No PRD sections yet</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Use <span className="font-medium text-foreground">Add Section</span>, the AI draft,
                      or Quick PRD Command to start building the document.
                    </p>
                  </div>
                )}

                {parsedEditorDocument.additionalNotes && (
                  <div className="rounded-2xl border border-border/70 bg-surface/95">
                    <div className="space-y-1 px-4 py-4">
                      <p className="text-sm font-semibold text-foreground">Additional Notes</p>
                      <p className="text-xs text-muted-foreground">
                        Non-canonical content is preserved here so nothing from the markdown draft is lost.
                      </p>
                    </div>
                    <div className="border-t border-border/70 px-4 pb-4 pt-3">
                      <Textarea
                        value={parsedEditorDocument.additionalNotes}
                        onChange={(event) => updateAdditionalNotes(event.target.value)}
                        className="min-h-32 rounded-xl border-border/70 bg-background/85 px-4 py-4 text-sm leading-6"
                        placeholder="Add supporting notes here..."
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="overflow-hidden border-border/80 bg-surface/95 p-0">
            <CardHeader className="border-b border-border/70 px-5 pb-4 pt-5">
              <CardTitle>Companion Rail</CardTitle>
              <CardDescription>
                Use Idea Prep to shape the draft or switch to Research Insights for drag-and-drop synthesis.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-5 pb-5 pt-4">
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/70 bg-background/80 p-1">
                <button
                  type="button"
                  onClick={() => setActiveCompanionPanel("idea_prep")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    activeCompanionPanel === "idea_prep"
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  Idea Prep
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCompanionPanel("research_insights")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    activeCompanionPanel === "research_insights"
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  Research Insights
                </button>
              </div>

              {activeCompanionPanel === "idea_prep" ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-surface-2/40 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">Assistant State</p>
                        <p className="text-xs text-muted-foreground">{readinessMeta.helperText}</p>
                      </div>
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${readinessMeta.badgeClassName}`}
                      >
                        {readinessMeta.label}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Simple Idea</p>
                    <Textarea
                      value={assistantWorkspace.idea}
                      onChange={(event) => updateAssistantIdea(event.target.value)}
                      placeholder="Example: A PRD co-pilot that turns rough product ideas into realistic, editable draft specs."
                      className="min-h-28"
                      disabled={generateIdeaWorkspaceMutation.isPending}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={runIdeaAnalysis}
                        disabled={generateIdeaWorkspaceMutation.isPending || !assistantWorkspace.idea.trim()}
                      >
                        {generateIdeaWorkspaceMutation.isPending
                          ? "Analyzing..."
                          : assistantHasAnalysis
                            ? "Re-analyze Idea"
                            : "Analyze Idea"}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        {projectContextId
                          ? "Uses linked project research context when available."
                          : "Runs from the idea alone because this PRD is not project-linked."}
                      </p>
                    </div>
                  </div>

                  {assistantWorkspace.assistantOpinion.trim() ? (
                    <section className="space-y-2">
                      <p className="text-sm font-medium text-foreground">AI Take</p>
                      <div className="rounded-xl border border-border bg-background/85 p-3 text-sm text-muted-foreground">
                        <p>{assistantWorkspace.assistantOpinion}</p>
                        {assistantWorkspace.ideaBreakdown.length > 0 && (
                          <ul className="mt-3 space-y-2">
                            {assistantWorkspace.ideaBreakdown.map((item, index) => (
                              <li
                                key={`${item}-${index}`}
                                className="rounded-lg border border-border/70 bg-surface px-3 py-2 text-foreground"
                              >
                                {item}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </section>
                  ) : null}

                  {assistantWorkspace.marketSummary.trim() || assistantWorkspace.competitors.length > 0 ? (
                    <section className="space-y-2">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">AI Market Snapshot</p>
                        <p className="text-xs text-muted-foreground">
                          Broad AI-generated framing only, not live or verified current-market research.
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-background/85 p-3 text-sm text-muted-foreground">
                        {assistantWorkspace.marketSummary.trim() ? (
                          <p>{assistantWorkspace.marketSummary}</p>
                        ) : (
                          <p>No market summary yet.</p>
                        )}
                        {assistantWorkspace.competitors.length > 0 && (
                          <div className="mt-3 grid gap-2">
                            {assistantWorkspace.competitors.map((competitor) => (
                              <div
                                key={competitor.name}
                                className="rounded-lg border border-border/70 bg-surface px-3 py-3"
                              >
                                <p className="text-sm font-medium text-foreground">{competitor.name}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {competitor.summary || "No summary provided."}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </section>
                  ) : null}

                  <section className="space-y-2">
                    <p className="text-sm font-medium text-foreground">What AI Still Needs</p>
                    <div className="rounded-xl border border-border bg-background/85 p-3 text-sm text-muted-foreground">
                      {assistantWorkspace.clarifyingQuestions.length > 0 ? (
                        <ol className="space-y-2">
                          {assistantWorkspace.clarifyingQuestions.map((question, index) => (
                            <li key={`${question}-${index}`} className="flex gap-2">
                              <span className="font-semibold text-foreground">{index + 1}.</span>
                              <span>{question}</span>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p>Run analysis to see the next questions the assistant needs answered.</p>
                      )}
                    </div>
                  </section>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Clarification Notes</p>
                    <Textarea
                      value={assistantWorkspace.clarificationNotes}
                      onChange={(event) => updateAssistantClarificationNotes(event.target.value)}
                      placeholder="Answer the clarifying questions, add scope limits, describe the target user, and note what success should look like."
                      className="min-h-28"
                      disabled={generateIdeaWorkspaceMutation.isPending}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={runIdeaAnalysis}
                        disabled={generateIdeaWorkspaceMutation.isPending || !assistantWorkspace.idea.trim()}
                      >
                        {generateIdeaWorkspaceMutation.isPending ? "Updating..." : "Update Analysis"}
                      </Button>
                      {isSavingAssistant && (
                        <p className="text-xs text-muted-foreground">Saving assistant workspace...</p>
                      )}
                    </div>
                  </div>

                  <section className="space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">Draft Preview</p>
                        <p className="text-xs text-muted-foreground">
                          The preview follows the active builder section and stays read-only.
                        </p>
                      </div>
                      <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                        Active: {activeSectionState.title}
                      </span>
                    </div>
                    <div
                      ref={draftPreviewRef}
                      className="max-h-80 space-y-3 overflow-auto rounded-xl border border-border bg-background/85 p-3"
                    >
                      {assistantWorkspace.draftMarkdown.trim() ? (
                        <>
                          {sectionStates.some((section) => section.draftPresent) ? (
                            sectionStates
                              .filter((section) => section.draftPresent)
                              .map((section) => {
                                const sectionBody = getSectionBody(section.draftMarkdown, section.title);

                                return (
                                  <button
                                    key={`${section.id}-draft-preview`}
                                    ref={(node) => {
                                      draftPreviewSectionRefs.current[section.title] = node;
                                    }}
                                    type="button"
                                    onClick={() =>
                                      ensureSectionVisible(section.title, {
                                        ensureCanvas: true,
                                        focusTextarea: true
                                      })
                                    }
                                    className={cn(
                                      "w-full rounded-xl border p-3 text-left transition",
                                      section.title === activeSectionTitle
                                        ? "border-accent bg-accent/10 shadow-sm"
                                        : "border-border/70 bg-surface hover:bg-surface-2"
                                    )}
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <p className="text-sm font-semibold text-foreground">{section.title}</p>
                                      <span
                                        className={cn(
                                          "rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                                          section.canvasPresent
                                            ? "border-success/30 bg-success/10 text-success"
                                            : "border-border bg-background/80 text-muted-foreground"
                                        )}
                                      >
                                        {section.canvasPresent ? "In Canvas" : "Canvas Missing"}
                                      </span>
                                    </div>
                                    <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                                      {sectionBody || "The AI draft has not added detail to this section yet."}
                                    </p>
                                  </button>
                                );
                              })
                          ) : (
                            <div className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                              No canonical PRD sections are available in the AI draft yet.
                            </div>
                          )}

                          {!activeSectionState.draftPresent && (
                            <div className="rounded-xl border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                              The AI draft has not filled{" "}
                              <span className="font-semibold text-foreground">
                                {activeSectionState.title}
                              </span>{" "}
                              yet. Quick PRD commands can still create or update it in the canvas.
                            </div>
                          )}

                          {parsedDraftDocument.additionalNotes && (
                            <div className="rounded-xl border border-border/70 bg-surface p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                Additional Notes
                              </p>
                              <pre className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                                {parsedDraftDocument.additionalNotes}
                              </pre>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          The assistant draft will appear here after analysis.
                        </p>
                      )}
                    </div>
                  </section>

                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Send the full AI draft into the main PRD canvas and open every section it contains.
                    </p>
                    <Button
                      type="button"
                      className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                      onClick={onSendToCanvas}
                      disabled={!canTransferAssistantDraft || saveMutation.isPending}
                    >
                      Send Full Draft To Canvas
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-background/85 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">Research Insights</p>
                        <p className="text-xs text-muted-foreground">
                          Generate project-aware synthesis and drag any card into the PRD canvas.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={loadInsights}
                        disabled={isPending || !user || !projectContextId}
                      >
                        {isPending ? "Generating..." : "Generate AI Insights"}
                      </Button>
                    </div>
                    {!projectContextId && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Link this PRD to a project if you want research-backed AI insights.
                      </p>
                    )}
                  </div>

                  <ul className="space-y-2">
                    {cards.map((card, index) => (
                      <li
                        key={`${card.type}-${index}`}
                        draggable
                        onDragStart={(event) => event.dataTransfer.setData("text/plain", card.text)}
                        className="cursor-grab rounded-xl border border-border bg-background/85 p-3 text-sm active:cursor-grabbing"
                      >
                        <p className="mb-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">{card.type}</p>
                        <p className="text-foreground">{card.text}</p>
                      </li>
                    ))}
                    {!cards.length && (
                      <li className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                        Generate AI insights to populate the companion rail with drag-and-drop research cards.
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      {showRoadmapPromptModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 px-4">
          <div className="w-full max-w-lg rounded-3xl border border-border/80 bg-surface p-6 shadow-[0_28px_80px_hsl(var(--foreground)/0.28)]">
            <div className="space-y-3">
              <div className="inline-flex rounded-full border border-success/30 bg-success/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-success">
                PRD Ready
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-foreground">
                  Should AI create a roadmap for this PRD?
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  The roadmap canvas can open with a realistic draft of quarterly deliverables based
                  on this PRD. You can review and apply the draft there before anything is
                  persisted.
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-sm font-medium text-foreground">{prdTitle}</p>
                <p className="mt-1 text-xs text-muted-foreground">Scope: {projectLabel}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void onDismissRoadmapPrompt()}
                disabled={roadmapPromptStateMutation.isPending || generateRoadmapDraftMutation.isPending}
              >
                Not Now
              </Button>
              <Button
                type="button"
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={() => void onCreateRoadmapFromPrd()}
                disabled={roadmapPromptStateMutation.isPending || generateRoadmapDraftMutation.isPending}
              >
                {generateRoadmapDraftMutation.isPending ? "Creating Roadmap..." : "Yes, Create Roadmap"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div
        className="fixed bottom-4 z-20"
        style={
          builderColumnMetrics
            ? {
                left: `${builderColumnMetrics.left}px`,
                width: `${builderColumnMetrics.width}px`
              }
            : {
                left: "16px",
                right: "16px"
              }
        }
      >
        <div className="rounded-2xl border border-border/80 bg-surface/94 p-3 shadow-[0_10px_22px_hsl(var(--foreground)/0.1)] backdrop-blur">
          <div className="space-y-2 px-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Quick PRD Command
              </p>
              <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                Target: {activeSectionState.title}
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground">
              {activeSectionState.canvasPresent
                ? "This will replace the selected section in the canvas."
                : "This will create the selected section in the canvas."}
            </p>

            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2">
                <WandSparkles className="size-4 shrink-0 text-accent" />
                <Input
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  placeholder={`Refine ${activeSectionState.title.toLowerCase()} with sharper detail`}
                  className="h-9 min-w-0 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </div>
              <Button
                type="button"
                className="h-10 rounded-xl bg-accent px-4 text-accent-foreground hover:bg-accent/90 md:min-w-[148px]"
                disabled={generateSectionMutation.isPending || !aiPrompt.trim() || !user}
                onClick={onGenerateFromPrompt}
              >
                {generateSectionMutation.isPending ? "Generating..." : "Run Command"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
