"use client";

import { useEffect, useState } from "react";

import {
  HELPER_STUDY_INTEREST_OPTIONS,
  toggleHelperStudyInterest
} from "@/lib/helper/study-interests";
import { HelperProfile } from "@/types/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type HelperProfileFormProps = {
  description?: string;
  helperEmail?: string | null;
  initialProfile?: HelperProfile;
  isSaving?: boolean;
  onSave: (profile: HelperProfile) => void;
  submitLabel?: string;
  title?: string;
};

const EMPTY_PROFILE: HelperProfile = {
  displayName: "",
  expertise: "",
  availability: "",
  studyInterests: ["all"]
};

export function HelperProfileForm({
  description,
  helperEmail,
  initialProfile,
  isSaving,
  onSave,
  submitLabel = "Save Profile",
  title = "Your profile"
}: HelperProfileFormProps) {
  const [form, setForm] = useState<HelperProfile>(initialProfile ?? EMPTY_PROFILE);

  useEffect(() => {
    setForm(initialProfile ?? EMPTY_PROFILE);
  }, [initialProfile]);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </p>
        {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
        {helperEmail ? (
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground/80">
            Signed in as {helperEmail}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="helper-display-name">Display Name</Label>
        <Input
          id="helper-display-name"
          value={form.displayName}
          onChange={(event) =>
            setForm((current) => ({ ...current, displayName: event.target.value }))
          }
          placeholder="What should PMs call you?"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="helper-expertise">Background and Expertise</Label>
        <Textarea
          id="helper-expertise"
          value={form.expertise}
          onChange={(event) => setForm((current) => ({ ...current, expertise: event.target.value }))}
          placeholder="e.g. B2B SaaS onboarding, mobile UX, growth experiments"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="helper-availability">Availability</Label>
        <Textarea
          id="helper-availability"
          value={form.availability}
          onChange={(event) =>
            setForm((current) => ({ ...current, availability: event.target.value }))
          }
          placeholder="e.g. Weekdays after 6PM UTC, weekends, async only"
        />
      </div>

      <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Study interests</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Pick the kinds of studies you want to see first. Keep <span className="font-semibold text-foreground">All studies</span> selected if you want everything.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {HELPER_STUDY_INTEREST_OPTIONS.map((option) => {
            const selected = form.studyInterests.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    studyInterests: toggleHelperStudyInterest(current.studyInterests, option.id)
                  }))
                }
                className={
                  selected
                    ? "rounded-full border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent transition"
                    : "rounded-full border border-border bg-surface px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-border/70 hover:bg-surface-2 hover:text-foreground"
                }
                aria-pressed={selected}
                title={option.description}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <Button
        type="button"
        variant="success"
        onClick={() =>
          onSave({
            displayName: form.displayName.trim(),
            expertise: form.expertise.trim(),
            availability: form.availability.trim(),
            studyInterests: form.studyInterests
          })
        }
        disabled={Boolean(isSaving)}
      >
        {isSaving ? "Saving..." : submitLabel}
      </Button>
    </div>
  );
}
