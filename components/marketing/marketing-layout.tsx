import Link from "next/link";
import { ReactNode } from "react";

import { DocsSearch } from "@/components/docs-search";
import { OrbitPlusLogo } from "@/components/marketing/orbitplus-logo";
import { ThemeToggle } from "@/components/theme-toggle";

type MarketingLayoutProps = {
  children: ReactNode;
  getStartedHref?: string;
  showSectionNav?: boolean;
};

const SECTION_LINKS = [
  { label: "About", href: "/#about" },
  { label: "Services", href: "/#services" },
  { label: "Use Cases", href: "/#use-cases" }
];

export function MarketingLayout({
  children,
  getStartedHref = "/login?mode=signup&role=pm",
  showSectionNav = false
}: MarketingLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-10">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/" className="shrink-0" aria-label="OrbitPlus home">
              <OrbitPlusLogo />
            </Link>
            {showSectionNav ? (
              <nav className="hidden items-center gap-1 lg:flex">
                {SECTION_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>

          <nav className="flex items-center gap-2">
            <ThemeToggle />
            <DocsSearch className="w-[40vw] min-w-[110px] max-w-[320px] sm:w-[46vw] sm:min-w-[150px]" />
            <Link
              href="/docs"
              className="inline-flex rounded-md px-2.5 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
            >
              Docs
            </Link>
            <Link
              href="/helpers"
              className="hidden rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-surface-2 hover:text-foreground md:inline-flex"
            >
              Earn as a Helper
            </Link>
            <Link
              href={getStartedHref}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm transition hover:brightness-110"
            >
              Get Started
            </Link>
          </nav>
        </div>

        {showSectionNav ? (
          <nav className="border-t border-border/70 lg:hidden">
            <div className="mx-auto flex w-full max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2 md:px-10">
              {SECTION_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        ) : null}
      </header>

      {children}
    </div>
  );
}
