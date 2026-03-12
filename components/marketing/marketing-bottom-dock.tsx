"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FileText, MoonStar, ShieldCheck, Sparkles, X } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

type DockPanelId = "alpha" | "privacy" | "terms" | null;

const PANEL_CONTENT = {
  alpha: {
    icon: Sparkles,
    eyebrow: "Alpha note",
    title: "OrbitPlus is still evolving quickly.",
    body:
      "Features, helper incentives, and workflow details can change as the product moves from closed alpha toward public beta. Expect iteration, not policy finality.",
    href: "/roadmap",
    hrefLabel: "View roadmap"
  },
  privacy: {
    icon: ShieldCheck,
    eyebrow: "Privacy",
    title: "We keep the note small here on purpose.",
    body:
      "OrbitPlus stores account details, study content, PRD drafts, and helper submissions to run the product and improve the research workflow. The full privacy page covers the current alpha scope.",
    href: "/privacy",
    hrefLabel: "Read privacy page"
  },
  terms: {
    icon: FileText,
    eyebrow: "Terms",
    title: "Closed-alpha terms are intentionally lightweight.",
    body:
      "Testers are expected to use the platform responsibly, share honest feedback, and avoid distributing confidential study information outside approved channels.",
    href: "/terms",
    hrefLabel: "Read terms page"
  }
} as const;

export function MarketingBottomDock() {
  const [activePanel, setActivePanel] = useState<DockPanelId>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activePanel) return;

    function handlePointerDown(event: MouseEvent) {
      if (!dockRef.current?.contains(event.target as Node)) {
        setActivePanel(null);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActivePanel(null);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [activePanel]);

  const panel = activePanel ? PANEL_CONTENT[activePanel] : null;
  const PanelIcon = panel?.icon;

  return (
    <div
      ref={dockRef}
      className="pointer-events-none fixed inset-x-0 bottom-3 z-[70] flex justify-center px-3"
    >
      <div className="pointer-events-auto relative w-full max-w-max">
        {panel ? (
          <div className="absolute bottom-[calc(100%+12px)] left-1/2 w-[min(92vw,360px)] -translate-x-1/2 rounded-3xl border border-border/80 bg-background/95 p-5 shadow-[0_24px_80px_hsl(var(--foreground)/0.28)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                  {PanelIcon ? <PanelIcon className="h-3.5 w-3.5" /> : null}
                  <span>{panel.eyebrow}</span>
                </div>
                <div className="space-y-2">
                  <p className="text-base font-semibold text-foreground">{panel.title}</p>
                  <p className="text-sm leading-6 text-muted-foreground">{panel.body}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActivePanel(null)}
                className="rounded-full border border-border/80 bg-surface p-2 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
                aria-label="Close notice"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Short legal note
              </p>
              <Link
                href={panel.href}
                className="text-sm font-semibold text-accent transition hover:opacity-80"
              >
                {panel.hrefLabel}
              </Link>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-2 rounded-full border border-border/80 bg-background/88 px-2 py-2 shadow-[0_18px_60px_hsl(var(--foreground)/0.24)] backdrop-blur-xl">
          <span className="hidden pl-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:inline">
            OrbitPlus Alpha
          </span>
          <div className="rounded-full border border-border/80 bg-surface/80 px-1 py-1">
            <ThemeToggle className="border-none bg-transparent p-0 shadow-none backdrop-blur-none" />
          </div>
          <DockButton
            active={activePanel === "alpha"}
            icon={MoonStar}
            label="Alpha Note"
            onClick={() => setActivePanel((current) => (current === "alpha" ? null : "alpha"))}
          />
          <DockButton
            active={activePanel === "privacy"}
            icon={ShieldCheck}
            label="Privacy"
            onClick={() => setActivePanel((current) => (current === "privacy" ? null : "privacy"))}
          />
          <DockButton
            active={activePanel === "terms"}
            icon={FileText}
            label="Terms"
            onClick={() => setActivePanel((current) => (current === "terms" ? null : "terms"))}
          />
        </div>
      </div>
    </div>
  );
}

function DockButton({
  active,
  icon: Icon,
  label,
  onClick
}: {
  active?: boolean;
  icon: typeof MoonStar;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition",
        active
          ? "border-accent/35 bg-accent/10 text-accent"
          : "border-border/80 bg-surface/80 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}
