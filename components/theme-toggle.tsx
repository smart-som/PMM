"use client";

import { Laptop, Moon, Sun } from "lucide-react";

import { useTheme, ThemeMode } from "@/contexts/theme-context";
import { cn } from "@/lib/utils";

const MODE_OPTIONS: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
  { mode: "light", icon: Sun, label: "Light" },
  { mode: "system", icon: Laptop, label: "System" },
  { mode: "dark", icon: Moon, label: "Dark" }
];

export function ThemeToggle({ className }: { className?: string }) {
  const { mode, setMode } = useTheme();

  return (
    <div
      className={cn(
        "inline-flex h-10 items-center rounded-full border border-border bg-background/80 p-1 shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.04)] backdrop-blur",
        className
      )}
      role="group"
      aria-label="Theme selection"
    >
      {MODE_OPTIONS.map(({ mode: optionMode, icon: Icon, label }) => {
        const active = mode === optionMode;
        return (
          <button
            key={optionMode}
            type="button"
            aria-label={`${label} mode`}
            aria-pressed={active}
            onClick={() => setMode(optionMode)}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-surface-2 text-foreground shadow-[0_1px_10px_hsl(var(--foreground)/0.18)]"
                : "text-muted-foreground hover:bg-surface/70 hover:text-foreground"
            )}
            title={label}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

