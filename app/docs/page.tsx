import Link from "next/link";

import { MarketingLayout } from "@/components/marketing/marketing-layout";

const DOC_NAV = [
  { id: "overview", label: "Overview" },
  { id: "pm-workflow", label: "PM Workflow" },
  { id: "helper-workflow", label: "Helper Workflow" },
  { id: "prd-prompt-guide", label: "PRD Prompts" },
  { id: "research-prompt-guide", label: "Research Prompts" },
  { id: "roadmap-prompt-guide", label: "Roadmap Prompts" }
];

export default function DocsPage() {
  return (
    <MarketingLayout>
      <main className="mx-auto w-full max-w-5xl space-y-6 p-6 pb-12">
        <nav className="sticky top-[74px] z-20 rounded-xl border border-border bg-surface/95 p-3 backdrop-blur">
          <div className="flex gap-2 overflow-x-auto">
            {DOC_NAV.map((item) => (
              <Link
                key={item.id}
                href={`/docs#${item.id}`}
                className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <section id="overview" className="docs-section rounded-xl border border-border bg-surface p-5">
          <h1 className="text-2xl font-bold text-foreground">Product Documentation</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Learn how to run research, generate PRDs, and plan roadmap execution in OrbitPlus.
          </p>
        </section>

        <section id="pm-workflow" className="docs-section rounded-xl border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold text-foreground">PM Workflow</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Create a study manually or use AI Kickstart from PM Dashboard.</li>
            <li>Keep new AI-generated studies in draft, review questions, then publish.</li>
            <li>Open Smart PRD Canvas and use Generate Full PRD for complete first draft.</li>
            <li>Use append prompts to refine sections incrementally.</li>
            <li>Move to Roadmap Canvas to place PRDs across quarters.</li>
          </ol>
        </section>

        <section
          id="helper-workflow"
          className="docs-section rounded-xl border border-border bg-surface p-5"
        >
          <h2 className="text-lg font-semibold text-foreground">Helper Workflow</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Open Available Gigs and pick a published survey.</li>
            <li>Answer every question (open text, single-select, and multi-select).</li>
            <li>Add optional summary notes.</li>
            <li>Submit responses for PM review.</li>
          </ol>
        </section>

        <section
          id="prd-prompt-guide"
          className="docs-section rounded-xl border border-border bg-surface p-5"
        >
          <h2 className="text-lg font-semibold text-foreground">PRD Canvas Prompt Guide</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              Full draft:{" "}
              <code>Generate a full PRD for onboarding optimization using current research.</code>
            </li>
            <li>
              Refine scope: <code>Tighten non-goals and remove low-impact requirements.</code>
            </li>
            <li>
              Quality checks: <code>Add measurable acceptance criteria and success metrics.</code>
            </li>
            <li>
              Delivery risk: <code>Expand the risks and mitigations section for rollout.</code>
            </li>
          </ul>
        </section>

        <section
          id="research-prompt-guide"
          className="docs-section rounded-xl border border-border bg-surface p-5"
        >
          <h2 className="text-lg font-semibold text-foreground">Research Prompt Guide</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <code>
                Create 8 questions for B2B onboarding friction with 2 single-select and 2
                multi-select.
              </code>
            </li>
            <li>
              <code>Focus questions on activation drop-off between signup and first value moment.</code>
            </li>
            <li>
              <code>Suggest options that are mutually exclusive and easy to compare.</code>
            </li>
          </ul>
        </section>

        <section
          id="roadmap-prompt-guide"
          className="docs-section rounded-xl border border-border bg-surface p-5"
        >
          <h2 className="text-lg font-semibold text-foreground">Roadmap Prompt Guide</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <code>Plan for Q2 retention growth while protecting onboarding conversion.</code>
            </li>
            <li>
              <code>
                Prioritize quick wins this quarter and push platform rebuilds to next quarter.
              </code>
            </li>
            <li>
              <code>Balance impact and delivery risk across all four quarters.</code>
            </li>
          </ul>
        </section>

        <p className="text-sm text-muted-foreground">
          Go back to{" "}
          <Link href="/dashboard/pm" className="text-accent underline">
            PM Dashboard
          </Link>
          .
        </p>
      </main>
    </MarketingLayout>
  );
}

