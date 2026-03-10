"use client";

import { FormEvent, useMemo, useState } from "react";
import { Command, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { findBestDocSection } from "@/lib/docs/search-index";
import { cn } from "@/lib/utils";

export function DocsSearch({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  const topMatch = useMemo(() => findBestDocSection(query), [query]);

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
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search docs..."
        className="h-full w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/90 focus:outline-none"
        aria-label="Search documentation query"
      />
      <span className="hidden items-center gap-1 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground lg:inline-flex">
        <Command className="h-3 w-3" />
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

