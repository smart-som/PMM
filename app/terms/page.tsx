import { MarketingLayout } from "@/components/marketing/marketing-layout";

export default function TermsPage() {
  return (
    <MarketingLayout>
      <main className="mx-auto w-full max-w-4xl px-6 py-16 md:px-10">
        <h1 className="text-4xl font-black text-foreground">Terms</h1>
        <p className="mt-4 text-muted-foreground">
          OrbitPlus is currently offered as an invitation-only alpha. Features and incentives
          may change as we validate workflows with testers.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Testers agree to provide honest feedback and avoid sharing confidential study details
          outside approved channels.
        </p>
      </main>
    </MarketingLayout>
  );
}


