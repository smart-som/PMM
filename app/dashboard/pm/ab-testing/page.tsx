"use client";

import { Suspense } from "react";

import { PmToolWip } from "@/components/pm/pm-tool-wip";

export default function AbTestingPage() {
  return (
    <Suspense fallback={<main className="p-6">Loading...</main>}>
      <PmToolWip tool="ab-testing" />
    </Suspense>
  );
}
