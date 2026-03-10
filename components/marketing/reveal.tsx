"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type RevealProps = {
  children: ReactNode;
  className?: string;
  threshold?: number;
};

export function Reveal({ children, className, threshold = 0.15 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!ref.current || isVisible) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [isVisible, threshold]);

  return (
    <div ref={ref} className={cn("reveal", isVisible && "reveal-visible", className)}>
      {children}
    </div>
  );
}

