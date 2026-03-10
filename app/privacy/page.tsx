import { MarketingLayout } from "@/components/marketing/marketing-layout";

export default function PrivacyPage() {
  return (
    <MarketingLayout>
      <main className="mx-auto w-full max-w-4xl px-6 py-16 md:px-10">
        <h1 className="text-4xl font-black text-foreground">Privacy</h1>
        <p className="mt-4 text-muted-foreground">
          OrbitPlus stores account details, study content, and submission summaries to operate
          the platform and improve product research quality.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          For this alpha, access is limited to invited testers. Production compliance language can
          be finalized before public beta.
        </p>
      </main>
    </MarketingLayout>
  );
}


