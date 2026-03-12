"use client";

import { BarChart3, FlaskConical, Sparkles, Waypoints } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/contexts/session-context";
import { useRoleData } from "@/lib/queries/hooks";

type PmToolWipVariant = "ab-testing" | "analytics" | "journey-map";

const TOOL_ICONS = {
  analytics: BarChart3,
  "journey-map": Waypoints,
  "ab-testing": FlaskConical
} satisfies Record<PmToolWipVariant, typeof Sparkles>;

const TOOL_CONTENT: Record<
  PmToolWipVariant,
  {
    accentClassName: string;
    bullets: string[];
    description: string;
    docsAnchor: string;
    label: string;
    title: string;
  }
> = {
  analytics: {
    title: "Analytics Workspace",
    label: "Signal Layer",
    description:
      "This area is being shaped into a PM reporting workspace for baseline tracking, trend interpretation, and AI-assisted narrative summaries.",
    bullets: [
      "Snapshot key product metrics without leaving the PM workspace.",
      "Turn raw numbers into narrative summaries tied to product decisions.",
      "Feed performance signals back into PRD success metrics and roadmap tradeoffs."
    ],
    docsAnchor: "analytics-preview",
    accentClassName: "border-accent/30 bg-accent/10 text-accent"
  },
  "journey-map": {
    title: "User Journey Map",
    label: "Flow Mapping",
    description:
      "This area is being rebuilt into a structured journey mapping canvas for stages, friction, and opportunity design before scope moves into a PRD.",
    bullets: [
      "Lay out end-to-end stages across the customer journey.",
      "Pinpoint pain points and opportunity clusters in one view.",
      "Translate journey friction into clearer product requirements."
    ],
    docsAnchor: "journey-map-preview",
    accentClassName: "border-warning/30 bg-warning/10 text-warning"
  },
  "ab-testing": {
    title: "A/B Testing",
    label: "Experiment Layer",
    description:
      "This area is being turned into a product experimentation workspace for structured hypotheses, variant planning, and result-driven decision support.",
    bullets: [
      "Document the hypothesis, variants, and success metric in one place.",
      "Keep experiments tied to concrete PM questions instead of loose notes.",
      "Use experiment outcomes to refine PRDs and roadmap confidence."
    ],
    docsAnchor: "ab-testing-preview",
    accentClassName: "border-success/30 bg-success/10 text-success"
  }
};

function resolveScopeLabel(
  scopeProjectId: string | null,
  allProjectsSelected: boolean,
  projectName: string | undefined
) {
  if (scopeProjectId === null) return "Solo / Unassigned";
  if (allProjectsSelected) return "All Projects";
  return projectName ?? `Project ${scopeProjectId}`;
}

export function PmToolWip({ tool }: { tool: PmToolWipVariant }) {
  const { user } = useSession();
  const searchParams = useSearchParams();
  const selectedProjectId = searchParams.get("projectId");
  const isSoloMode = searchParams.get("mode") === "solo";
  const scopeProjectId = isSoloMode ? null : selectedProjectId;
  const allProjectsSelected = !scopeProjectId;
  const { projectsQuery } = useRoleData(user?.uid ?? null, user?.role ?? null);
  const content = TOOL_CONTENT[tool];

  const scopeLabel = useMemo(() => {
    const projectName =
      typeof scopeProjectId === "string" && scopeProjectId.length > 0
        ? projectsQuery.data?.find((project) => project.id === scopeProjectId)?.name
        : undefined;

    return resolveScopeLabel(scopeProjectId, allProjectsSelected, projectName);
  }, [allProjectsSelected, projectsQuery.data, scopeProjectId]);

  const ToolIcon = TOOL_ICONS[tool] ?? Sparkles;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-6 pb-12">
      <Card className="overflow-hidden border-border/80 bg-surface/95">
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${content.accentClassName}`}
              >
                Work In Progress
              </span>
              <div className="space-y-1">
                <CardTitle>{content.title}</CardTitle>
                <CardDescription>{content.description}</CardDescription>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Scope</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{scopeLabel}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <div className="space-y-5">
            <div className="pm-tool-wip-scene">
              <div className="pm-tool-wip-grid" />
              <div className="pm-tool-wip-orbit pm-tool-wip-orbit-a" />
              <div className="pm-tool-wip-orbit pm-tool-wip-orbit-b" />
              <div className="pm-tool-wip-pulse pm-tool-wip-pulse-a" />
              <div className="pm-tool-wip-pulse pm-tool-wip-pulse-b" />
              <div className="pm-tool-wip-core">
                <ToolIcon className="h-12 w-12 text-foreground" />
              </div>
              <div className="pm-tool-wip-card pm-tool-wip-card-a">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {content.label}
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">Structured around PM decisions</p>
              </div>
              <div className="pm-tool-wip-card pm-tool-wip-card-b">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  OrbitPlus
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">Designed to connect with research, PRD, and roadmap flows</p>
              </div>
              <div className="pm-tool-wip-chip pm-tool-wip-chip-a">
                <Sparkles className="h-3.5 w-3.5" />
                <span>In active design</span>
              </div>
              <div className="pm-tool-wip-chip pm-tool-wip-chip-b">
                <span>PM-first workflow</span>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {content.bullets.map((bullet) => (
                <div
                  key={bullet}
                  className="rounded-2xl border border-border/80 bg-background/70 p-4 text-sm leading-7 text-muted-foreground"
                >
                  {bullet}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-border/80 bg-background/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                What To Expect
              </p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                This tool is not ready for day-to-day production use yet. The current release
                intentionally shows a polished placeholder while the final workflow is being shaped
                to fit the broader PM system.
              </p>
            </div>

            <div className="rounded-3xl border border-border/80 bg-background/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Quick Links
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/dashboard/pm"
                  className="rounded-full border border-border/80 bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-2"
                >
                  Back to PM Dashboard
                </Link>
                <Link
                  href={`/docs#${content.docsAnchor}`}
                  className="rounded-full border border-border/80 bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-2"
                >
                  Read Docs
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
