"use client";

import { KeyboardEvent, useId, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type SelectOptionEditorProps = {
  options: string[];
  onChange(nextOptions: string[]): void;
  minOptions?: number;
  label?: string;
  disabled?: boolean;
};

export type SelectOptionValidation = {
  duplicateOptions: string[];
  hasDuplicates: boolean;
  hasMinimumOptions: boolean;
  isValid: boolean;
  normalizedOptions: string[];
  uniqueValidOptionCount: number;
  validOptionCount: number;
};

export function createSelectOptionDrafts(minOptions = 2): string[] {
  return Array.from({ length: minOptions }, () => "");
}

export function normalizeSelectOptionDrafts(options: string[]): string[] {
  return options.map((option) => option.trim());
}

export function sanitizeSelectOptions(options: string[]): string[] {
  return normalizeSelectOptionDrafts(options).filter(Boolean);
}

export function getSelectOptionValidation(
  options: string[],
  minOptions = 2
): SelectOptionValidation {
  const normalizedOptions = normalizeSelectOptionDrafts(options);
  const seenOptions = new Map<string, string>();
  const duplicateOptions = new Set<string>();

  normalizedOptions.forEach((option) => {
    if (!option) return;
    const normalizedKey = option.toLowerCase();
    if (seenOptions.has(normalizedKey)) {
      duplicateOptions.add(seenOptions.get(normalizedKey) ?? option);
      return;
    }
    seenOptions.set(normalizedKey, option);
  });

  const validOptionCount = normalizedOptions.filter(Boolean).length;
  const uniqueValidOptionCount = seenOptions.size;
  const hasDuplicates = duplicateOptions.size > 0;
  const hasMinimumOptions = uniqueValidOptionCount >= minOptions;

  return {
    duplicateOptions: [...duplicateOptions],
    hasDuplicates,
    hasMinimumOptions,
    isValid: hasMinimumOptions && !hasDuplicates,
    normalizedOptions,
    uniqueValidOptionCount,
    validOptionCount
  };
}

export function SelectOptionEditor({
  options,
  onChange,
  minOptions = 2,
  label = "Options",
  disabled = false
}: SelectOptionEditorProps) {
  const fieldId = useId();
  const validation = useMemo(
    () => getSelectOptionValidation(options, minOptions),
    [minOptions, options]
  );

  function updateOption(index: number, value: string) {
    onChange(options.map((option, optionIndex) => (optionIndex === index ? value : option)));
  }

  function commitTrim(index: number) {
    const trimmed = options[index]?.trim() ?? "";
    if (trimmed === options[index]) return;
    updateOption(index, trimmed);
  }

  function addOption() {
    onChange([...options, ""]);
  }

  function removeOption(index: number) {
    const nextOptions = options.filter((_, optionIndex) => optionIndex !== index);
    onChange(nextOptions.length ? nextOptions : [""]);
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLInputElement>, option: string) {
    if (event.key !== "Enter" || !option.trim() || disabled) return;
    event.preventDefault();
    addOption();
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-2">
        {options.map((option, index) => (
          <div key={`${fieldId}-${index}`} className="flex gap-2">
            <Input
              id={index === 0 ? fieldId : undefined}
              value={option}
              disabled={disabled}
              onBlur={() => commitTrim(index)}
              onChange={(event) => updateOption(index, event.target.value)}
              onKeyDown={(event) => handleOptionKeyDown(event, option)}
              placeholder={`Option ${index + 1}`}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => removeOption(index)}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={addOption}>
        Add option
      </Button>
      <p
        className={`text-xs ${
          validation.isValid ? "text-muted-foreground" : "text-danger"
        }`}
      >
        {validation.hasDuplicates
          ? `Options must be unique. Duplicate values: ${validation.duplicateOptions.join(", ")}.`
          : validation.hasMinimumOptions
            ? `${validation.uniqueValidOptionCount} valid options ready for helpers to choose from.`
            : `Add at least ${minOptions} non-empty options. ${validation.validOptionCount} currently filled.`}
      </p>
    </div>
  );
}
