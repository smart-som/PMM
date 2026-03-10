"use server";

import { requestGeminiText } from "@/lib/ai/gemini";
import { requirePmServerUser } from "@/lib/server/auth";
import { RoadmapCard, RoadmapQuarter, RoadmapStrategySuggestion } from "@/types/app";

type StrategyInput = {
  goal: string;
  prds: Array<Pick<RoadmapCard, "id" | "title" | "impactScore" | "targetLaunchQuarter"> & { content: string }>;
};

function parseStrategyJson(rawText: string): RoadmapStrategySuggestion {
  const trimmed = rawText.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1) {
    return { moves: [], placeholders: [] };
  }

  try {
    const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as Partial<RoadmapStrategySuggestion>;
    const allowedQuarters: RoadmapQuarter[] = ["Q1", "Q2", "Q3", "Q4"];

    const moves = Array.isArray(parsed.moves)
      ? parsed.moves
          .map((move) => ({
            prdId: String(move.prdId ?? ""),
            quarter: String(move.quarter ?? "") as RoadmapQuarter,
            reason: String(move.reason ?? "")
          }))
          .filter((move) => move.prdId && allowedQuarters.includes(move.quarter))
      : [];

    const placeholders = Array.isArray(parsed.placeholders)
      ? parsed.placeholders
          .map((placeholder) => ({
            title: String(placeholder.title ?? ""),
            quarter: String(placeholder.quarter ?? "") as RoadmapQuarter,
            reason: String(placeholder.reason ?? "")
          }))
          .filter(
            (placeholder) => placeholder.title && allowedQuarters.includes(placeholder.quarter)
          )
      : [];

    return { moves, placeholders };
  } catch {
    return { moves: [], placeholders: [] };
  }
}

export async function generateRoadmapStrategy(
  input: StrategyInput
): Promise<RoadmapStrategySuggestion> {
  await requirePmServerUser();

  if (!input.goal.trim()) {
    throw new Error("Strategy goal is required.");
  }

  const prompt = `
You are a senior product strategy lead.
Given PRDs and a quarterly roadmap goal, output strict JSON only:
{
  "moves": [{ "prdId": "...", "quarter": "Q1|Q2|Q3|Q4", "reason": "..." }],
  "placeholders": [{ "title": "...", "quarter": "Q1|Q2|Q3|Q4", "reason": "..." }]
}

Rules:
- Prioritize higher impactScore PRDs for the target goal.
- Use at most 5 moves and 5 placeholders.
- Placeholder titles should be concise feature ideas.

Goal:
${input.goal}

PRDs:
${JSON.stringify(input.prds, null, 2)}
`;

  const text = await requestGeminiText({ prompt, temperature: 0.2 });

  return parseStrategyJson(text);
}
