"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/contexts/session-context";

export default function PMSettingsPage() {
  const { user, logout } = useSession();

  return (
    <main className="space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Workspace Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-md border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">Email</p>
            <p className="font-medium">{user?.email ?? "Unknown"}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">Role</p>
            <p className="font-medium">{user?.role ?? "Unknown"}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">User ID</p>
            <p className="font-medium">{user?.uid ?? "Unknown"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void logout()}>
              Sign out
            </Button>
            <Link
              href="/dashboard/pm"
              className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-transparent px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              Back to Dashboard
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
