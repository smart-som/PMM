import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  LayoutTemplate,
  Radar,
  ScrollText,
  Sparkles,
  Users,
  Workflow
} from "lucide-react";

import { HeroPlanet } from "@/components/marketing/hero-planet";
import { MarketingLayout } from "@/components/marketing/marketing-layout";
import { Reveal } from "@/components/marketing/reveal";

const PLATFORM_LAYERS = [
  {
    title: "Research Builder",
    description:
      "Frame the audience, draft smarter question sets, publish studies, and pull real helper responses back into the product loop.",
    icon: Radar
  },
  {
    title: "Idea to PRD Canvas",
    description:
      "Turn rough product ideas into structured requirements, section by section, with AI support that stays editable by the PM.",
    icon: ScrollText
  },
  {
    title: "Roadmap Canvas",
    description:
      "Convert stable PRDs into realistic quarter-based deliverables instead of vague wish lists or disconnected backlog piles.",
    icon: Workflow
  },
  {
    title: "Helper Network",
    description:
      "Reach an active feedback layer without switching tools, then use that evidence to sharpen scope and reduce delivery guesswork.",
    icon: Users
  }
];

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Shape the signal",
    description:
      "Start with the problem, audience, and key uncertainty. OrbitPlus keeps the discovery input practical instead of abstract."
  },
  {
    step: "02",
    title: "Validate with real people",
    description:
      "Run helper-facing studies, review structured answers, and generate directional synthesis before moving into a spec."
  },
  {
    step: "03",
    title: "Draft the PRD with context",
    description:
      "Carry research directly into the PRD canvas so the document grows out of evidence, not just internal opinion."
  },
  {
    step: "04",
    title: "Plan a deliverable roadmap",
    description:
      "Mark the PRD ready, export it when needed, or generate roadmap deliverables that can be reviewed before they are applied."
  }
];

const PROOF_POINTS = [
  {
    title: "One connected PM system",
    value: "4",
    label: "research, PRD, roadmap, helper workflows"
  },
  {
    title: "PRD source of truth",
    value: "1",
    label: "canonical document across cards, markdown, AI draft, and export"
  },
  {
    title: "Context handoff friction",
    value: "Lower",
    label: "evidence follows the PM instead of being rewritten at every step"
  }
];

const PRODUCT_SURFACES = [
  "Research studies and helper submissions",
  "Idea-to-PRD drafting with section controls",
  "Roadmap deliverables generated from ready PRDs",
  "Shareable exports for stakeholder review"
];

const COMMAND_DECK_METRICS = [
  {
    label: "Research to spec",
    value: "Connected"
  },
  {
    label: "AI behavior",
    value: "Guided"
  },
  {
    label: "Delivery planning",
    value: "Reviewable"
  }
];

export default function HomePage() {
  return (
    <MarketingLayout getStartedHref="/login?mode=signup&role=pm" showSectionNav>
      <main>
        <section className="relative overflow-hidden border-b border-border/70">
          <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-6 pb-20 pt-16 md:px-10 md:pb-24 md:pt-20 lg:grid-cols-[1.05fr_0.95fr]">
            <Reveal className="orbitplus-enter flex flex-col justify-center">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                <Sparkles className="h-3.5 w-3.5" />
                <span>PM Operating System</span>
              </div>

              <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.92] tracking-tight text-foreground md:text-7xl xl:text-[5.5rem]">
                Build product decisions with actual evidence, not scattered guesses.
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
                OrbitPlus gives PMs one premium workspace for discovery, helper-backed research,
                AI-assisted PRD drafting, and roadmap planning. The product is designed to keep
                context alive from first idea to execution-ready plan.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/login?mode=signup&role=pm"
                  className="interactive-lift inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-[0_8px_20px_hsl(var(--accent)/0.22)] transition hover:brightness-110"
                >
                  <span>Start PM Workspace</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/docs#pm-workflow"
                  className="interactive-lift rounded-full border border-border/80 bg-background/70 px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-2"
                >
                  See the workflow
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <span className="rounded-full border border-border/80 bg-background/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Closed alpha
                </span>
                <span className="rounded-full border border-border/80 bg-background/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  AI-assisted drafting
                </span>
                <span className="rounded-full border border-border/80 bg-background/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Helper-backed research
                </span>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {PROOF_POINTS.map((item) => (
                  <div
                    key={item.title}
                    className="interactive-lift rounded-3xl border border-border/80 bg-background/72 p-4 shadow-[0_8px_20px_hsl(var(--foreground)/0.05)] backdrop-blur"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {item.title}
                    </p>
                    <p className="mt-3 text-3xl font-black text-foreground">{item.value}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal className="orbitplus-enter orbitplus-enter-delay lg:self-start">
              <HeroPlanet />
            </Reveal>
          </div>
        </section>

        <section id="command-deck" className="scroll-mt-28 border-b border-border/70 py-16 md:py-24">
          <div className="mx-auto w-full max-w-7xl px-6 md:px-10">
            <Reveal className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                  <BrainCircuit className="h-3.5 w-3.5" />
                  <span>Command Deck</span>
                </div>
                <h2 className="max-w-3xl text-4xl font-black tracking-tight text-foreground md:text-5xl">
                  A premium product workspace that keeps the core surfaces in one view.
                </h2>
                <p className="max-w-2xl text-base leading-8 text-muted-foreground">
                  OrbitPlus keeps the product surfaces close enough that PMs can move from research
                  signal to structured requirements, roadmap planning, and review artifacts without
                  losing context in the handoff.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {PRODUCT_SURFACES.map((surface) => (
                    <div
                      key={surface}
                      className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4 text-sm leading-7 text-muted-foreground shadow-[0_8px_18px_hsl(var(--foreground)/0.05)] backdrop-blur"
                    >
                      {surface}
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {COMMAND_DECK_METRICS.map((item) => (
                    <div key={item.label} className="marketing-metric-panel">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        {item.label}
                      </p>
                      <p className="mt-2 text-xl font-black text-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="platform" className="scroll-mt-28 border-b border-border/70 py-16 md:py-24">
          <div className="mx-auto w-full max-w-7xl px-6 md:px-10">
            <Reveal className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-4">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
                  Platform
                </p>
                <h2 className="max-w-3xl text-4xl font-black tracking-tight text-foreground md:text-5xl">
                  One premium PM system instead of five disconnected tools.
                </h2>
                <p className="max-w-xl text-base leading-8 text-muted-foreground">
                  The product is built around the real PM sequence: discover the problem, validate
                  it with users, write a grounded PRD, then sequence delivery with fewer blind spots.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {PLATFORM_LAYERS.map((item) => (
                  <article
                    key={item.title}
                    className="interactive-lift rounded-[1.75rem] border border-border/80 bg-background/72 p-6 shadow-[0_8px_20px_hsl(var(--foreground)/0.05)] backdrop-blur"
                  >
                    <div className="inline-flex rounded-2xl border border-accent/30 bg-accent/10 p-3 text-accent">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
                  </article>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section id="workflow" className="scroll-mt-28 py-16 md:py-24">
          <div className="mx-auto w-full max-w-7xl px-6 md:px-10">
            <Reveal className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
                Workflow
              </p>
              <h2 className="mt-3 text-4xl font-black tracking-tight text-foreground md:text-5xl">
                Built around the PM loop that actually matters.
              </h2>
              <p className="mt-4 text-base leading-8 text-muted-foreground">
                The best part of OrbitPlus is not one AI button. It is the way each layer hands
                forward useful structure so the next decision starts with better context.
              </p>
            </Reveal>

            <div className="mt-10 grid gap-4 lg:grid-cols-4">
              {WORKFLOW_STEPS.map((item, index) => (
                <Reveal
                  key={item.step}
                  className={index % 2 === 0 ? "marketing-tilt-panel" : "marketing-tilt-panel marketing-tilt-panel-delayed"}
                >
                  <article className="h-full rounded-[1.8rem] border border-border/80 bg-background/72 p-6 shadow-[0_8px_20px_hsl(var(--foreground)/0.05)] backdrop-blur">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Step {item.step}
                      </span>
                      <LayoutTemplate className="h-4 w-4 text-accent" />
                    </div>
                    <h3 className="mt-6 text-xl font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="proof" className="scroll-mt-28 border-y border-border/70 py-16 md:py-24">
          <div className="mx-auto grid w-full max-w-7xl gap-6 px-6 md:px-10 lg:grid-cols-[1.05fr_0.95fr]">
            <Reveal className="rounded-[2rem] border border-border/80 bg-background/72 p-6 shadow-[0_10px_24px_hsl(var(--foreground)/0.06)] backdrop-blur md:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
                Proof of fit
              </p>
              <h2 className="mt-4 text-4xl font-black tracking-tight text-foreground md:text-5xl">
                OrbitPlus is designed for PM teams that want tighter thinking, not noisier AI.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">
                Everything in the product is biased toward real PM artifacts: research studies,
                PRDs, roadmap deliverables, and sharable exports. That keeps the output useful when
                stakeholders, design, and engineering enter the room.
              </p>
            </Reveal>

            <Reveal className="grid gap-4">
              <div className="rounded-[2rem] border border-border/80 bg-background/72 p-6 shadow-[0_10px_24px_hsl(var(--foreground)/0.06)] backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Why teams use it
                </p>
                <ul className="mt-4 space-y-3">
                  <li className="rounded-2xl border border-border/70 bg-surface/70 px-4 py-3 text-sm leading-7 text-muted-foreground">
                    Discovery does not die when the PRD starts.
                  </li>
                  <li className="rounded-2xl border border-border/70 bg-surface/70 px-4 py-3 text-sm leading-7 text-muted-foreground">
                    The PRD stays editable whether you work in sections, markdown, or AI-assisted edits.
                  </li>
                  <li className="rounded-2xl border border-border/70 bg-surface/70 px-4 py-3 text-sm leading-7 text-muted-foreground">
                    Roadmap planning starts from a ready document instead of a vague idea pile.
                  </li>
                </ul>
              </div>

              <div className="rounded-[2rem] border border-border/80 bg-[linear-gradient(160deg,hsl(var(--accent)/0.12),transparent_55%),hsl(var(--background)/0.78)] p-6 shadow-[0_10px_24px_hsl(var(--foreground)/0.06)] backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Closed-alpha positioning
                </p>
                <p className="mt-4 text-lg font-semibold text-foreground">
                  Premium workflow design now, deeper platform breadth later.
                </p>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  OrbitPlus already covers the most important PM chain. Analytics, journey maps,
                  experimentation, and compensation systems are staged behind the same product
                  language so the surface can expand without feeling fragmented.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <Reveal className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 md:px-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
                Start now
              </p>
              <h3 className="max-w-3xl text-4xl font-black tracking-tight text-foreground md:text-5xl">
                If your PM process is split across tabs, OrbitPlus is built to pull it back into one flow.
              </h3>
              <p className="max-w-2xl text-base leading-8 text-muted-foreground">
                Start with the PM workspace, or explore the helper network that powers real product
                feedback inside the same system.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/login?mode=signup&role=pm"
                className="interactive-lift inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-[0_8px_20px_hsl(var(--accent)/0.22)] transition hover:brightness-110"
              >
                <span>Start for PM</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/helpers"
                className="interactive-lift rounded-full border border-border/80 bg-background/70 px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-2"
              >
                Explore helper network
              </Link>
            </div>
          </Reveal>
        </section>
      </main>
    </MarketingLayout>
  );
}
