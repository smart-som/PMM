import { cn } from "@/lib/utils";

type OrbitPlusLogoProps = {
  className?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
};

export function OrbitPlusLogo({
  className,
  showWordmark = true,
  wordmarkClassName
}: OrbitPlusLogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative inline-flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-foreground/75">
        <span className="pointer-events-none absolute size-2 rounded-full bg-foreground/70" />
        <span className="orbitplus-logo-dot pointer-events-none absolute left-1/2 top-1/2 block size-1.5 -ml-[3px] -mt-[3px] rounded-full bg-accent" />
      </span>
      {showWordmark ? (
        <span className={cn("text-base font-extrabold tracking-tight text-foreground", wordmarkClassName)}>
          OrbitPlus
        </span>
      ) : null}
    </div>
  );
}
