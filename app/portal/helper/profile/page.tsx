"use client";

import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";

import { HelperProfileForm } from "@/components/helper/helper-profile-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/contexts/session-context";
import { getHelperProfile, updateHelperProfile } from "@/lib/queries/firestore";
import { getHelperStudyInterestLabel } from "@/lib/helper/study-interests";
import { HelperProfile } from "@/types/app";

export default function HelperProfilePage() {
  const { user } = useSession();
  const profileQuery = useQuery({
    queryKey: ["helper-profile", user?.uid],
    queryFn: () => getHelperProfile(user!.uid),
    enabled: Boolean(user?.uid && user.role === "helper")
  });

  const updateProfileMutation = useMutation({
    mutationFn: (profile: HelperProfile) => updateHelperProfile(user!.uid, profile),
    onSuccess: () => {
      void profileQuery.refetch();
    }
  });

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <Card className="overflow-hidden border-border/80 bg-surface/95">
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="inline-flex rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                Helper Profile
              </p>
              <CardTitle>Shape the studies you want to see</CardTitle>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Your profile helps OrbitPlus surface the most relevant helper studies first. Keep
                it current so the portal stays aligned with your background and availability.
              </p>
            </div>

            <Link
              href="/portal/helper"
              className="rounded-full border border-border/80 bg-background/80 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-2"
            >
              Back to portal
            </Link>
          </div>
        </CardHeader>

        <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="rounded-3xl border border-border/80 bg-background/70 p-5">
            <HelperProfileForm
              title="Profile settings"
              description="Save a clear name, your working context, and the study categories you want to prioritize."
              helperEmail={user?.email}
              initialProfile={profileQuery.data}
              isSaving={updateProfileMutation.isPending}
              onSave={(profile) => updateProfileMutation.mutate(profile)}
              submitLabel="Save helper profile"
            />
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-border/80 bg-background/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Current focus
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(profileQuery.data?.studyInterests ?? ["all"]).map((interest) => (
                  <span
                    key={interest}
                    className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent"
                  >
                    {getHelperStudyInterestLabel(interest)}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-border/80 bg-background/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                How it is used
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                <li>Relevant studies can be surfaced earlier in your helper portal.</li>
                <li>PMs still receive the same response flow you see in available gigs.</li>
                <li>Earnings and payout tooling are not live yet and will arrive later.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
