"use client";

import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/contexts/session-context";
import { getHelperEarningsSummary } from "@/lib/queries/firestore";

export default function HelperEarningsPage() {
  const { user } = useSession();
  const earningsQuery = useQuery({
    queryKey: ["helper-earnings", user?.uid],
    queryFn: () => getHelperEarningsSummary(user!.uid),
    enabled: Boolean(user?.uid && user.role === "helper")
  });

  const earnings = earningsQuery.data;

  return (
    <main className="space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Earnings Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">Pending balance</p>
            <p className="mt-1 text-2xl font-semibold">${(earnings?.totalPending ?? 0).toFixed(2)}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">Pending submissions</p>
            <p className="mt-1 text-2xl font-semibold">{earnings?.pendingCount ?? 0}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submission Earnings</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {earnings?.entries.map((entry) => (
              <li key={entry.submissionId} className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">{entry.title}</p>
                <p className="text-muted-foreground">Study ID: {entry.studyId}</p>
                <p className="text-muted-foreground">Status: {entry.status}</p>
                <p className="text-muted-foreground">Reward: ${entry.rewardAmount.toFixed(2)}</p>
              </li>
            ))}
            {!earnings?.entries.length && (
              <li className="text-sm text-muted-foreground">
                No submissions yet. Complete a study to start earning.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
