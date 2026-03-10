import Link from "next/link";

import { MarketingLayout } from "@/components/marketing/marketing-layout";

export default function HelpersLandingPage() {
  return (
    <MarketingLayout getStartedHref="/login?mode=signup&role=helper">
      <main className="bg-surface-2">
        <nav className="sticky top-[74px] z-20 border-b border-border bg-surface/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto px-6 py-3 md:px-10">
            <Link
              href="/helpers#overview"
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
            >
              Overview
            </Link>
            <Link
              href="/helpers#how-it-works"
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
            >
              How It Works
            </Link>
            <Link
              href="/docs#helper-workflow"
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
            >
              Docs
            </Link>
          </div>
        </nav>

        <section id="overview" className="mx-auto w-full max-w-7xl px-6 py-16 md:px-10 md:py-20">
          <p className="inline-flex rounded-full border border-success/35 bg-surface px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-success">
            Helper Marketplace
          </p>
          <h1 className="mt-5 max-w-3xl text-5xl font-black leading-tight text-foreground md:text-6xl">
            Get paid for your product insights.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Join top product teams, share practical feedback, and earn with every approved
            submission.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login?mode=signup&role=helper"
              className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground"
            >
              Start for Free
            </Link>
            <Link
              href="/portal/helper"
              className="rounded-md border border-success/45 bg-surface px-5 py-3 text-sm font-semibold text-success"
            >
              Open Helper Portal
            </Link>
          </div>
        </section>

        <section
          id="how-it-works"
          className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-6 pb-16 md:grid-cols-3 md:px-10"
        >
          <article className="interactive-lift rounded-2xl border border-border bg-surface p-6">
            <p className="text-sm font-semibold text-foreground">1. Join the network</p>
            <p className="mt-2 text-sm text-muted-foreground">Create your profile and verify your expertise.</p>
          </article>
          <article className="interactive-lift rounded-2xl border border-border bg-surface p-6">
            <p className="text-sm font-semibold text-foreground">2. Take 5-minute surveys</p>
            <p className="mt-2 text-sm text-muted-foreground">Pick studies that match your domain knowledge.</p>
          </article>
          <article className="interactive-lift rounded-2xl border border-border bg-surface p-6">
            <p className="text-sm font-semibold text-foreground">3. Get paid instantly</p>
            <p className="mt-2 text-sm text-muted-foreground">Receive payout once your response is approved.</p>
          </article>
        </section>
      </main>
    </MarketingLayout>
  );
}

