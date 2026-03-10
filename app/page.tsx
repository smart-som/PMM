import Link from "next/link";

import { HeroPlanet } from "@/components/marketing/hero-planet";
import { Reveal } from "@/components/marketing/reveal";
import { MarketingLayout } from "@/components/marketing/marketing-layout";

const SERVICES = [
  {
    title: "Continuous Discovery",
    description:
      "Connect product inputs from support channels and notes so the team sees friction trends as they happen."
  },
  {
    title: "Research Network Access",
    description:
      "Launch fast studies with vetted helpers and get practical feedback without waiting for long recruitment cycles."
  },
  {
    title: "AI-Powered PRD Canvas",
    description:
      "Turn validated findings into structured PRD drafts with measurable requirements, risks, and release criteria."
  }
];

const USE_CASES = [
  {
    title: "Onboarding Conversion Rescue",
    summary: "Identify signup drop-off points, test solutions quickly, and ship only what improves activation."
  },
  {
    title: "Quarterly Roadmap Prioritization",
    summary:
      "Rank initiatives by impact and delivery risk so planning stays tied to validated user evidence."
  },
  {
    title: "Cross-Team Requirement Alignment",
    summary: "Give design and engineering a single source of truth from discovery through implementation."
  }
];

export default function HomePage() {
  return (
    <MarketingLayout getStartedHref="/login?mode=signup&role=pm" showSectionNav>
      <main>
        <section className="relative overflow-hidden border-b border-border/80 bg-surface">
          <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-6 py-16 md:px-10 md:py-20 lg:grid-cols-[1.15fr_0.85fr]">
            <Reveal className="orbitplus-enter flex flex-col justify-center">
              <p className="inline-flex w-fit rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                Product Management Platform
              </p>
              <h1 className="mt-5 max-w-3xl text-5xl font-black leading-[0.95] text-foreground md:text-7xl">
                Build better product decisions with OrbitPlus.
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
                OrbitPlus helps PM teams discover real user pain, validate ideas with fast research,
                and produce implementation-ready PRDs without guesswork.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/login?mode=signup&role=pm"
                  className="interactive-lift rounded-md bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground shadow-sm transition duration-200 hover:brightness-110"
                >
                  Start for Free
                </Link>
                <Link
                  href="/helpers"
                  className="interactive-lift rounded-md border border-border bg-surface px-5 py-3 text-sm font-semibold text-foreground transition duration-200 hover:bg-surface-2"
                >
                  Explore Helper Network
                </Link>
              </div>
            </Reveal>

            <Reveal className="orbitplus-enter orbitplus-enter-delay flex flex-col gap-4">
              <HeroPlanet />
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border/80 bg-surface p-3 shadow-[0_10px_24px_hsl(var(--foreground)/0.14)]">
                  <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Signal Confidence</p>
                  <p className="mt-2 text-xl font-black text-foreground">97.4%</p>
                </div>
                <div className="rounded-2xl border border-border/80 bg-surface p-3 shadow-[0_10px_24px_hsl(var(--foreground)/0.14)]">
                  <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Research Speed</p>
                  <p className="mt-2 text-xl font-black text-foreground">15 min</p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="about" className="scroll-mt-28 border-b border-border/70 bg-surface py-16 md:py-20">
          <Reveal className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-6 md:grid-cols-2 md:px-10">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
                About the Product
              </p>
              <h2 className="mt-3 text-4xl font-black text-foreground md:text-5xl">
                One system from insight to roadmap.
              </h2>
            </div>
            <p className="text-lg leading-relaxed text-muted-foreground">
              OrbitPlus combines discovery, user research, PRD generation, and roadmap planning in
              one PM workspace. Teams can validate ideas with real users first, then ship with
              higher confidence and fewer delivery surprises.
            </p>
          </Reveal>
        </section>

        <section id="services" className="scroll-mt-28 bg-surface-2 py-16 md:py-20">
          <div className="mx-auto w-full max-w-7xl px-6 md:px-10">
            <Reveal className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
                Services
              </p>
              <h2 className="mt-3 text-4xl font-black text-foreground md:text-5xl">
                What OrbitPlus delivers for PM teams.
              </h2>
            </Reveal>
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              {SERVICES.map((service) => (
                <Reveal key={service.title} className="h-full">
                  <article className="interactive-lift h-full rounded-2xl border border-border/80 bg-surface p-6 shadow-[0_10px_30px_hsl(var(--foreground)/0.05)]">
                    <h3 className="text-lg font-semibold text-foreground">{service.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {service.description}
                    </p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="use-cases" className="scroll-mt-28 bg-surface py-16 md:py-20">
          <div className="mx-auto w-full max-w-7xl px-6 md:px-10">
            <Reveal className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
                Use Cases
              </p>
              <h2 className="mt-3 text-4xl font-black text-foreground md:text-5xl">
                Where OrbitPlus creates immediate value.
              </h2>
            </Reveal>
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              {USE_CASES.map((item) => (
                <Reveal key={item.title} className="h-full">
                  <article className="interactive-lift h-full rounded-2xl border border-border/80 bg-surface p-6">
                    <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.summary}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border/70 bg-surface-2 py-16">
          <Reveal className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-5 px-6 md:flex-row md:items-center md:px-10">
            <div>
              <h3 className="text-3xl font-black text-foreground">Ready to move faster with better evidence?</h3>
              <p className="mt-2 text-muted-foreground">
                Start with OrbitPlus for PM workflows or join the helper network to earn.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/login?mode=signup&role=pm"
                className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground shadow-sm transition duration-200 hover:brightness-110"
              >
                Start for Free
              </Link>
              <Link
                href="/helpers"
                className="rounded-md border border-border bg-surface px-5 py-3 text-sm font-semibold text-foreground transition duration-200 hover:bg-surface-2"
              >
                Earn as a Helper
              </Link>
            </div>
          </Reveal>
        </section>
      </main>
    </MarketingLayout>
  );
}
