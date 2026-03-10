"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { WandSparkles } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  generateAndAppendPrdContent,
  generateFullPrdFromProjectContext,
  generateImplementationSuggestion,
  generateInsightsForProject
} from "@/app/dashboard/pm/prd/[id]/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/contexts/session-context";
import { getOrCreatePrdDocument, savePrdContent } from "@/lib/queries/firestore";
import { AiInsights } from "@/types/app";

export default function PrdCanvasPage() {
  const params = useParams<{ id: string }>();
  const prdId = params.id;
  const { user } = useSession();
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [insights, setInsights] = useState<AiInsights>({
    topPainPoints: [],
    featureSuggestions: []
  });
  const [editorText, setEditorText] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [targetFilePath, setTargetFilePath] = useState("src/components/Header.tsx");
  const [implementationSuggestion, setImplementationSuggestion] = useState("");

  function getActionErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallback;
  }

  const prdQuery = useQuery({
    queryKey: ["prd", prdId, user?.uid],
    queryFn: () => getOrCreatePrdDocument(prdId, user!.uid),
    enabled: Boolean(user?.uid && prdId)
  });
  const projectContextId = prdQuery.data?.projectId ?? null;

  useEffect(() => {
    if (prdQuery.data?.content !== undefined) {
      setEditorText(prdQuery.data.content);
    }
  }, [prdQuery.data?.content]);

  const saveMutation = useMutation({
    mutationFn: (content: string) =>
      savePrdContent(prdId, user!.uid, content, prdQuery.data?.projectId ?? null)
  });
  const suggestionMutation = useMutation({
    mutationFn: (payload: { projectId: string; targetFilePath: string; prdContent: string }) =>
      generateImplementationSuggestion(payload),
    onSuccess: (result) => setImplementationSuggestion(result),
    onError: (error) =>
      toast.error(getActionErrorMessage(error, "Could not generate implementation suggestion."))
  });
  const generateAppendMutation = useMutation({
    mutationFn: (payload: { prdId: string; prompt: string; currentPrdText: string }) =>
      generateAndAppendPrdContent(payload),
    onSuccess: (generatedText, variables) => {
      const nextText = variables.currentPrdText.trim()
        ? `${variables.currentPrdText.trimEnd()}\n\n${generatedText}`
        : generatedText;
      setEditorText(nextText);
      setAiPrompt("");
      if (user) {
        saveMutation.mutate(nextText);
      }
      toast.success("AI content appended to PRD.");
    },
    onError: (error) =>
      toast.error(getActionErrorMessage(error, "Could not generate PRD content."))
  });
  const generateFullPrdMutation = useMutation({
    mutationFn: (payload: { projectId: string; currentPrdText: string }) =>
      generateFullPrdFromProjectContext(payload),
    onSuccess: (generatedText) => {
      setEditorText(generatedText);
      if (user) {
        saveMutation.mutate(generatedText);
      }
      toast.success("Full PRD generated and replaced.");
    },
    onError: (error) =>
      toast.error(getActionErrorMessage(error, "Could not generate full PRD."))
  });

  const cards = useMemo(
    () => [
      ...insights.topPainPoints.map((text) => ({ type: "Pain Point", text })),
      ...insights.featureSuggestions.map((text) => ({ type: "Feature", text }))
    ],
    [insights.featureSuggestions, insights.topPainPoints]
  );

  function loadInsights() {
    if (!projectContextId) {
      toast.error("AI insights require a linked project. Open a project-scoped PRD.");
      return;
    }

    startTransition(async () => {
      try {
        const nextInsights = await generateInsightsForProject(projectContextId);
        setInsights(nextInsights);
      } catch (error) {
        toast.error(getActionErrorMessage(error, "Could not generate AI insights."));
        console.error(error);
      }
    });
  }

  function insertAtCursor(textToInsert: string) {
    const area = editorRef.current;
    if (!area) return;

    const start = area.selectionStart;
    const end = area.selectionEnd;
    const nextValue =
      editorText.slice(0, start) + `\n- ${textToInsert}\n` + editorText.slice(end);
    setEditorText(nextValue);

    requestAnimationFrame(() => {
      area.focus();
      const cursor = start + textToInsert.length + 4;
      area.setSelectionRange(cursor, cursor);
    });
  }

  function extractCodeFromMarkdown(markdown: string) {
    const match = markdown.match(/```[\w-]*\n([\s\S]*?)```/);
    return (match?.[1] ?? markdown).trim();
  }

  async function copySuggestedCode() {
    if (!implementationSuggestion.trim()) {
      toast.error("No generated code to copy.");
      return;
    }

    try {
      await navigator.clipboard.writeText(extractCodeFromMarkdown(implementationSuggestion));
      toast.success("Code copied to clipboard.");
    } catch {
      toast.error("Could not copy code.");
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

    generateAppendMutation.mutate({
      prdId,
      prompt,
      currentPrdText: editorText
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

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 gap-4 p-6 pb-28 lg:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Smart PRD Canvas</CardTitle>
          <CardDescription>
            {projectContextId ? `Project ID: ${projectContextId}` : "Solo / Unassigned"} | PRD ID: {prdId}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            ref={editorRef}
            value={editorText}
            onChange={(event) => setEditorText(event.target.value)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const payload = event.dataTransfer.getData("text/plain");
              if (!payload) return;
              insertAtCursor(payload);
            }}
            className="min-h-[520px]"
            placeholder="Write your PRD here..."
          />

          <div className="flex gap-2">
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
            <Button variant="outline" onClick={loadInsights} disabled={isPending || !user || !projectContextId}>
              {isPending ? "Generating..." : "Generate AI Insights"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>AI Insights</CardTitle>
            <CardDescription>Drag any card into the PRD editor.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {cards.map((card, index) => (
                <li
                  key={`${card.type}-${index}`}
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData("text/plain", card.text)}
                  className="cursor-grab rounded-md border border-border bg-surface p-3 text-sm active:cursor-grabbing"
                >
                  <p className="mb-1 text-xs uppercase text-muted-foreground">{card.type}</p>
                  <p>{card.text}</p>
                </li>
              ))}
              {!cards.length && (
                <li className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                  Click &quot;Generate AI Insights&quot; to populate cards.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dev-Sync</CardTitle>
            <CardDescription>
              Generate implementation suggestions for a mocked target file path.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">Target File Path</p>
              <Input
                value={targetFilePath}
                onChange={(event) => setTargetFilePath(event.target.value)}
                placeholder="src/components/Header.tsx"
              />
            </div>

            <Button
              variant="outline"
              className="w-full"
              disabled={suggestionMutation.isPending || !targetFilePath.trim() || !editorText.trim()}
              onClick={() =>
                suggestionMutation.mutate({
                  projectId: projectContextId ?? prdId,
                  targetFilePath,
                  prdContent: editorText
                })
              }
            >
              {suggestionMutation.isPending
                ? "Generating..."
                : "Generate Implementation Suggestion"}
            </Button>

            <div className="rounded-md border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Suggested Patch</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copySuggestedCode()}
                >
                  Copy to Clipboard
                </Button>
              </div>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                {implementationSuggestion ||
                  "Suggestion output will appear here as markdown with a code block."}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-20 flex justify-center px-4">
        <div className="pointer-events-auto flex w-full max-w-3xl items-center gap-2 rounded-full border border-accent bg-surface px-4 py-2 shadow-[0_16px_40px_hsl(var(--accent)/0.2)]">
          <WandSparkles className="size-4 shrink-0 text-accent" />
          <Input
            value={aiPrompt}
            onChange={(event) => setAiPrompt(event.target.value)}
            placeholder="Try: Refine acceptance criteria for the onboarding flow"
            className="h-10 border-0 bg-transparent px-0 focus-visible:ring-0"
          />
          <Button
            type="button"
            className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={generateAppendMutation.isPending || !aiPrompt.trim() || !user}
            onClick={onGenerateFromPrompt}
          >
            {generateAppendMutation.isPending ? "Generating..." : "Generate"}
          </Button>
        </div>
      </div>
    </main>
  );
}



