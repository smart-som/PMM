import { MarketingLayout } from "@/components/marketing/marketing-layout";

export default function PublicRoadmapPage() {
  return (
    <MarketingLayout>
      <main className="mx-auto w-full max-w-4xl px-6 py-16 md:px-10">
        <h1 className="text-4xl font-black text-foreground">OrbitPlus Roadmap</h1>
        <p className="mt-4 text-muted-foreground">
          This closed-alpha focuses on end-to-end PM study creation, helper submissions, AI-assisted
          PRD drafting, and roadmap planning.
        </p>
        <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
          <li className="rounded-md border border-border bg-surface p-4">
            In progress: social sign-in hardening and unified access flow.
          </li>
          <li className="rounded-md border border-border bg-surface p-4">
            Next: payout automation and submission quality scoring.
          </li>
          <li className="rounded-md border border-border bg-surface p-4">
            Planned: study recruitment tooling and helper reputation signals.
          </li>
        </ul>
      </main>
    </MarketingLayout>
  );
}


