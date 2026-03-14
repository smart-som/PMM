import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

type SectionLabelTone = "accent" | "success" | "warning";

const TONE_STYLES: Record<SectionLabelTone, { text: string; line: string }> = {
  accent: {
    text: "text-accent",
    line: "bg-accent/55"
  },
  success: {
    text: "text-success",
    line: "bg-success/55"
  },
  warning: {
    text: "text-warning",
    line: "bg-warning/65"
  }
};

export function SectionLabel({
  children,
  className,
  icon: Icon,
  tone = "accent"
}: {
  children: ReactNode;
  className?: string;
  icon?: LucideIcon;
  tone?: SectionLabelTone;
}) {
  const styles = TONE_STYLES[tone];

  return (
    <div
      className={cn(
        "relative inline-flex w-fit items-center gap-2 pl-4 text-[11px] font-semibold uppercase tracking-[0.18em]",
        styles.text,
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0 top-1/2 h-8 w-px -translate-y-1/2 rounded-full",
          styles.line
        )}
      />
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
      <span>{children}</span>
    </div>
  );
}
