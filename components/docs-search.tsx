"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Command, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { findBestDocSection } from "@/lib/docs/search-index";
import { cn } from "@/lib/utils";

export function DocsSearch({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isMacLikePlatform, setIsMacLikePlatform] = useState(false);

  const topMatch = useMemo(() => findBestDocSection(query), [query]);

  useEffect(() => {
    if (typeof navigator === "undefined") return;

    const navigatorWithUAData = navigator as Navigator & {
      userAgentData?: {
        platform?: string;
      };
    };
    const platform =
      navigatorWithUAData.userAgentData?.platform ?? navigator.platform ?? navigator.userAgent ?? "";
    setIsMacLikePlatform(/mac|iphone|ipad|ipod/i.test(platform));
  }, []);

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      if (target === inputRef.current) return false;

      const tagName = target.tagName.toLowerCase();
      return (
        target.isContentEditable ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      );
    }

    function handleShortcut(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k") return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.shiftKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      router.push("/docs");
      return;
    }

    const match = findBestDocSection(trimmed);
    if (!match) {
      router.push("/docs");
      return;
    }

    const target = `/docs#${match.id}`;
    if (pathname === "/docs" && typeof window !== "undefined") {
      window.location.hash = match.id;
      return;
    }
    router.push(target);
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "group flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-3 text-muted-foreground shadow-sm transition-colors focus-within:border-accent/60 focus-within:bg-surface-2",
        className
      )}
      role="search"
      aria-label="Search documentation"
    >
      <Search className="h-4 w-4 shrink-0" />
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search docs..."
        className="h-full w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/90 focus:outline-none"
        aria-label="Search documentation query"
      />
      <span
        className="hidden items-center gap-1 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground lg:inline-flex"
        aria-label={isMacLikePlatform ? "Shortcut Command K" : "Shortcut Control K"}
      >
        {isMacLikePlatform ? <Command className="h-3 w-3" /> : <span>Ctrl</span>}
        K
      </span>
      {topMatch ? (
        <span className="hidden max-w-[130px] truncate text-[11px] text-accent md:inline">
          {topMatch.title}
        </span>
      ) : null}
    </form>
  );
}
