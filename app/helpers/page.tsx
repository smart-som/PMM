import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Layers3,
  MessageSquareQuote,
  Sparkles,
  TimerReset,
  UserRoundSearch
} from "lucide-react";

import { MarketingLayout } from "@/components/marketing/marketing-layout";
import { Reveal } from "@/components/marketing/reveal";
import { HELPER_STUDY_INTEREST_OPTIONS } from "@/lib/helper/study-interests";

const HELPER_STEPS = [
  {
    title: "Build your profile",
    description:
      "Add your background, availability, and the study types you care about so OrbitPlus can surface relevant work first.",
    icon: UserRoundSearch
  },
  {
    title: "Respond to studies",
    description:
      "Answer structured questions, add notes where useful, and keep the signal practical for PMs reviewing submissions.",
    icon: ClipboardCheck
  },
  {
    title: "Grow with the network",
    description:
      "The current alpha is focused on participation quality. Compensation and payout tooling are planned, but not live yet.",
    icon: TimerReset
  }
];

const HELPER_BENEFITS = [
  "A calmer study flow with clean prompts and simple submission UX.",
  "Study preferences that help the portal prioritize the categories you actually want.",
  "A direct role in shaping real PM decisions before product teams lock scope.",
  "A product direction that already anticipates payouts, history, and reputation signals."
];

const STUDY_TYPE_LABELS = HELPER_STUDY_INTEREST_OPTIONS.filter((option) => option.id !== "all").map(
  (option) => option.label
);

export default function HelpersLandingPage() {
  return (
    <MarketingLayout getStartedHref="/login?mode=signup&role=helper">
      <main>
        <nav className="sticky top-[74px] z-20 border-b border-border/70 bg-background/85 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto px-6 py-3 md:px-10">
            {[
              { label: "Overview", href: "/helpers#overview" },
              { label: "Study Types", href: "/helpers#study-types" },
              { label: "How It Works", href: "/helpers#how-it-works" },
              { label: "Portal", href: "/helpers#portal" }
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-full border border-border/70 bg-background/75 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-accent/40 hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <section id="overview" className="overflow-hidden border-b border-border/70">
          <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-6 pb-20 pt-16 md:px-10 md:pb-24 md:pt-20 lg:grid-cols-[1.02fr_0.98fr]">
            <Reveal className="orbitplus-enter flex flex-col justify-center">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-success/35 bg-success/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-success">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Helper Network</span>
              </div>

              <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.92] tracking-tight text-foreground md:text-7xl">
                Help shape better products before payout tooling even goes live.
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
                OrbitPlus lets helpers respond to real PM studies in a cleaner, more focused portal.
                Today the alpha is about high-quality product insight. Compensation systems are in
                progress and will come later.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/login?mode=signup&role=helper"
                  className="interactive-lift inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-[0_8px_20px_hsl(var(--accent)/0.22)] transition hover:brightness-110"
                >
                  <span>Join as a helper</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/portal/helper"
                  className="interactive-lift rounded-full border border-border/80 bg-background/70 px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-2"
                >
                  Open helper portal
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <span className="rounded-full border border-border/80 bg-background/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Research participation live
                </span>
                <span className="rounded-full border border-warning/30 bg-warning/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-warning">
                  Payouts coming later
                </span>
                <span className="rounded-full border border-border/80 bg-background/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Preference-based matching
                </span>
              </div>
            </Reveal>

            <Reveal className="orbitplus-enter orbitplus-enter-delay">
              <div className="marketing-showcase">
                <div className="marketing-showcase-grid" />
                <div className="marketing-showcase-orbit marketing-showcase-orbit-a" />
                <div className="marketing-showcase-orbit marketing-showcase-orbit-b" />
                <div className="marketing-showcase-glow marketing-showcase-glow-a" />
                <div className="marketing-showcase-glow marketing-showcase-glow-b" />

                <div className="relative z-10 grid gap-4 p-5 sm:p-6">
                  <div className="marketing-glass-panel">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Why it feels better
                        </p>
                        <p className="text-2xl font-black tracking-tight text-foreground">
                          A helper portal that is welcoming, simple, and tuned to your interests.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-success/30 bg-success/10 p-3 text-success">
                        <Layers3 className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {HELPER_BENEFITS.map((benefit) => (
                        <div
                          key={benefit}
                          className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm leading-7 text-muted-foreground"
                        >
                          {benefit}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="marketing-metric-panel">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        Profile-first
                      </p>
                      <p className="mt-2 text-xl font-black text-foreground">Yes</p>
                    </div>
                    <div className="marketing-metric-panel">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        Study filtering
                      </p>
                      <p className="mt-2 text-xl font-black text-foreground">Interest-based</p>
                    </div>
                    <div className="marketing-metric-panel">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        Money tooling
                      </p>
                      <p className="mt-2 text-xl font-black text-foreground">Later</p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="study-types" className="scroll-mt-28 border-b border-border/70 py-16 md:py-24">
          <div className="mx-auto w-full max-w-7xl px-6 md:px-10">
            <Reveal className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
                Study types
              </p>
              <h2 className="mt-3 text-4xl font-black tracking-tight text-foreground md:text-5xl">
                Helpers can now choose the categories they want to see first.
              </h2>
              <p className="mt-4 text-base leading-8 text-muted-foreground">
                OrbitPlus supports a broad set of product research categories. Helpers can choose
                all studies or focus on the work that fits their background and curiosity best.
              </p>
            </Reveal>

            <div className="mt-8 flex flex-wrap gap-3">
              {STUDY_TYPE_LABELS.map((label) => (
                <div
                  key={label}
                  className="interactive-lift rounded-full border border-border/80 bg-background/72 px-4 py-3 text-sm font-semibold text-foreground shadow-[0_8px_18px_hsl(var(--foreground)/0.05)] backdrop-blur"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-28 py-16 md:py-24">
          <div className="mx-auto w-full max-w-7xl px-6 md:px-10">
            <Reveal className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
                How it works
              </p>
              <h2 className="mt-3 text-4xl font-black tracking-tight text-foreground md:text-5xl">
                Join early, answer clearly, and help PMs make sharper calls.
              </h2>
            </Reveal>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {HELPER_STEPS.map((item, index) => (
                <Reveal
                  key={item.title}
                  className={index === 1 ? "marketing-tilt-panel marketing-tilt-panel-delayed" : "marketing-tilt-panel"}
                >
                  <article className="h-full rounded-[1.8rem] border border-border/80 bg-background/72 p-6 shadow-[0_8px_20px_hsl(var(--foreground)/0.05)] backdrop-blur">
                    <div className="inline-flex rounded-2xl border border-accent/30 bg-accent/10 p-3 text-accent">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-xl font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="portal" className="scroll-mt-28 border-y border-border/70 py-16 md:py-24">
          <div className="mx-auto grid w-full max-w-7xl gap-6 px-6 md:px-10 lg:grid-cols-[1fr_1fr]">
            <Reveal className="rounded-[2rem] border border-border/80 bg-background/72 p-6 shadow-[0_10px_24px_hsl(var(--foreground)/0.06)] backdrop-blur md:p-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                <MessageSquareQuote className="h-3.5 w-3.5" />
                <span>Portal experience</span>
              </div>
              <h2 className="mt-4 text-4xl font-black tracking-tight text-foreground md:text-5xl">
                The active helper portal is already aligned with the current product.
              </h2>
              <p className="mt-5 text-base leading-8 text-muted-foreground">
                Helpers see a welcoming profile-first screen, can choose study interests, and no
                longer keep seeing the same study after they submit it. The portal is intentionally
                simple because the alpha goal is strong response quality, not feature overload.
              </p>
            </Reveal>

            <Reveal className="grid gap-4">
              <div className="rounded-[2rem] border border-border/80 bg-background/72 p-6 shadow-[0_10px_24px_hsl(var(--foreground)/0.06)] backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Current reality
                </p>
                <ul className="mt-4 space-y-3">
                  <li className="rounded-2xl border border-border/70 bg-surface/70 px-4 py-3 text-sm leading-7 text-muted-foreground">
                    Studies are available now and can be completed in the helper portal.
                  </li>
                  <li className="rounded-2xl border border-border/70 bg-surface/70 px-4 py-3 text-sm leading-7 text-muted-foreground">
                    Interest selection helps sort studies without hiding the rest of the pool.
                  </li>
                  <li className="rounded-2xl border border-border/70 bg-surface/70 px-4 py-3 text-sm leading-7 text-muted-foreground">
                    Earnings screens are visible as a work-in-progress preview, not an active money system.
                  </li>
                </ul>
              </div>

              <div className="rounded-[2rem] border border-warning/25 bg-warning/10 p-6 shadow-[0_10px_24px_hsl(var(--foreground)/0.05)]">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-warning">
                  Important note
                </p>
                <p className="mt-3 text-lg font-semibold text-foreground">
                  Compensation messaging is intentionally conservative during alpha.
                </p>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  We want helpers to know the current state clearly: research participation is live,
                  but payout mechanics are still under construction.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <Reveal className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 md:px-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
                Join the network
              </p>
              <h3 className="max-w-3xl text-4xl font-black tracking-tight text-foreground md:text-5xl">
                If you enjoy spotting product friction and giving practical feedback, OrbitPlus is being built for you too.
              </h3>
              <p className="max-w-2xl text-base leading-8 text-muted-foreground">
                Create a helper account, set your interests, and start responding to studies in a
                cleaner portal that is growing toward a fuller helper marketplace.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/login?mode=signup&role=helper"
                className="interactive-lift inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-[0_8px_20px_hsl(var(--accent)/0.22)] transition hover:brightness-110"
              >
                <span>Start as a helper</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/docs#helper-workflow"
                className="interactive-lift rounded-full border border-border/80 bg-background/70 px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-2"
              >
                Read helper docs
              </Link>
            </div>
          </Reveal>
        </section>
      </main>
    </MarketingLayout>
  );
}
