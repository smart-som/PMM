"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/contexts/session-context";
import { getHelperProfile, updateHelperProfile } from "@/lib/queries/firestore";

export default function HelperProfilePage() {
  const { user } = useSession();
  const profileQuery = useQuery({
    queryKey: ["helper-profile", user?.uid],
    queryFn: () => getHelperProfile(user!.uid),
    enabled: Boolean(user?.uid && user.role === "helper")
  });
  const [displayName, setDisplayName] = useState("");
  const [expertise, setExpertise] = useState("");
  const [availability, setAvailability] = useState("");

  useEffect(() => {
    if (!profileQuery.data) return;
    setDisplayName(profileQuery.data.displayName);
    setExpertise(profileQuery.data.expertise);
    setAvailability(profileQuery.data.availability);
  }, [profileQuery.data]);

  const updateProfileMutation = useMutation({
    mutationFn: () =>
      updateHelperProfile(user!.uid, {
        displayName: displayName.trim(),
        expertise: expertise.trim(),
        availability: availability.trim()
      }),
    onSuccess: () => {
      void profileQuery.refetch();
    }
  });

  return (
    <main className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Helper Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your preferred name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expertise">Expertise</Label>
            <Textarea
              id="expertise"
              value={expertise}
              onChange={(event) => setExpertise(event.target.value)}
              placeholder="e.g. SaaS onboarding, mobile UX, fintech"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="availability">Availability</Label>
            <Textarea
              id="availability"
              value={availability}
              onChange={(event) => setAvailability(event.target.value)}
              placeholder="e.g. Weekdays after 6PM UTC"
            />
          </div>

          <Button
            type="button"
            className="bg-success text-white hover:bg-success/90"
            onClick={() => updateProfileMutation.mutate()}
            disabled={updateProfileMutation.isPending || !user}
          >
            {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

