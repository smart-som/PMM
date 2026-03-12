"use client";

import { Suspense } from "react";

import { PmToolWip } from "@/components/pm/pm-tool-wip";

export default function JourneyMapPage() {
  return (
    <Suspense fallback={<main className="p-6">Loading...</main>}>
      <PmToolWip tool="journey-map" />
    </Suspense>
  );
}
