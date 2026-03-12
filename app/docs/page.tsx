import Link from "next/link";

import { MarketingLayout } from "@/components/marketing/marketing-layout";
import { DOC_SECTION_GROUPS, DOC_SECTIONS } from "@/lib/docs/content";

function SectionBody({
  callout,
  detail,
  points,
  promptExamples,
  status,
  steps
}: {
  callout?: string;
  detail: string;
  points?: string[];
  promptExamples?: string[];
  status?: string;
  steps?: string[];
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm leading-7 text-muted-foreground">{detail}</p>

      {status ? (
        <div className="rounded-2xl border border-warning/25 bg-warning/10 px-4 py-3 text-sm text-warning">
          {status}
        </div>
      ) : null}

      {steps?.length ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Workflow
          </p>
          <ol className="space-y-3 pl-5 text-sm leading-7 text-muted-foreground">
            {steps.map((step) => (
              <li key={step} className="list-decimal">
                {step}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {points?.length ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Key Details
          </p>
          <ul className="grid gap-3 md:grid-cols-2">
            {points.map((point) => (
              <li
                key={point}
                className="rounded-2xl border border-border/80 bg-background/70 px-4 py-3 text-sm leading-7 text-muted-foreground"
              >
                {point}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {promptExamples?.length ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Prompt Examples
          </p>
          <div className="grid gap-3">
            {promptExamples.map((prompt) => (
              <div
                key={prompt}
                className="rounded-2xl border border-border/80 bg-background/75 px-4 py-3"
              >
                <code className="text-sm leading-7 text-foreground">{prompt}</code>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {callout ? (
        <div className="rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm leading-7 text-accent">
          {callout}
        </div>
      ) : null}
    </div>
  );
}

export default function DocsPage() {
  return (
    <MarketingLayout>
      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 pt-6 md:px-6 lg:px-8">
        <nav className="sticky top-[74px] z-20 rounded-2xl border border-border bg-surface/95 p-3 backdrop-blur lg:hidden">
          <div className="flex gap-2 overflow-x-auto">
            {DOC_SECTIONS.map((section) => (
              <Link
                key={section.id}
                href={`/docs#${section.id}`}
                className="whitespace-nowrap rounded-full border border-border/70 bg-background/75 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-accent/40 hover:text-foreground"
              >
                {section.navLabel}
              </Link>
            ))}
          </div>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-[92px] rounded-3xl border border-border bg-surface/95 p-4 shadow-sm">
              <div className="space-y-1 border-b border-border/70 pb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Product Docs
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Jump directly to the workflow, canvas, or prompt guide you need.
                </p>
              </div>

              <div className="mt-4 space-y-5">
                {DOC_SECTION_GROUPS.map((group) => {
                  const groupSections = DOC_SECTIONS.filter((section) => section.groupId === group.id);
                  if (!groupSections.length) return null;

                  return (
                    <div key={group.id} className="space-y-2">
                      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {group.label}
                      </p>
                      <div className="space-y-1">
                        {groupSections.map((section) => (
                          <Link
                            key={section.id}
                            href={`/docs#${section.id}`}
                            className="block rounded-xl px-3 py-2 text-sm text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
                          >
                            {section.navLabel}
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 rounded-2xl border border-border/80 bg-background/70 p-4 text-sm text-muted-foreground">
                Go back to{" "}
                <Link href="/dashboard/pm" className="font-semibold text-accent underline">
                  PM Dashboard
                </Link>
                .
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            {DOC_SECTION_GROUPS.map((group) => {
              const groupSections = DOC_SECTIONS.filter((section) => section.groupId === group.id);
              if (!groupSections.length) return null;

              return (
                <section key={group.id} className="space-y-4">
                  <div className="px-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {group.label}
                    </p>
                  </div>

                  {groupSections.map((section) => (
                    <article
                      key={section.id}
                      id={section.id}
                      className="docs-section rounded-3xl border border-border bg-surface/95 p-6 shadow-sm"
                    >
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {group.label}
                        </p>
                        <h2 className="text-2xl font-semibold text-foreground">{section.title}</h2>
                      </div>

                      <div className="mt-5">
                        <SectionBody
                          callout={section.callout}
                          detail={section.detail}
                          points={section.points}
                          promptExamples={section.promptExamples}
                          status={section.status}
                          steps={section.steps}
                        />
                      </div>
                    </article>
                  ))}
                </section>
              );
            })}

            <p className="px-1 text-sm text-muted-foreground lg:hidden">
              Go back to{" "}
              <Link href="/dashboard/pm" className="text-accent underline">
                PM Dashboard
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
    </MarketingLayout>
  );
}
