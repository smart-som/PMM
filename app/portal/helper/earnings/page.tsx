"use client";

import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HelperEarningsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <Card className="overflow-hidden border-border/80 bg-[radial-gradient(circle_at_top_left,hsl(var(--warning)/0.2),transparent_36%),linear-gradient(180deg,hsl(var(--surface)),hsl(var(--surface-2)))]">
        <CardHeader className="border-b border-border/70">
          <div className="space-y-3">
            <p className="inline-flex rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-warning">
              Work in progress
            </p>
            <CardTitle className="text-2xl">Earnings and payouts are coming later</CardTitle>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
              Helpers can already join studies and submit responses, but money movement is not live
              yet. This area will become the home for payout status, approval tracking, and
              participation history once that workflow is ready.
            </p>
          </div>
        </CardHeader>

        <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/80 bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Status
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">Not live yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Study participation is active, but compensation tooling is still being built.
              </p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                What is next
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">Payout tracking</p>
              <p className="mt-1 text-sm text-muted-foreground">
                You will eventually see approvals, payout states, and completed study history here.
              </p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Today
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">Focus on studies</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep your profile current and answer studies clearly so your responses stay useful.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-border/80 bg-background/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Quick links
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/portal/helper"
                className="rounded-full border border-border/80 bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-2"
              >
                Browse studies
              </Link>
              <Link
                href="/portal/helper/profile"
                className="rounded-full border border-border/80 bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-2"
              >
                Update profile
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
