"use server";

import { requestGeminiText } from "@/lib/ai/gemini";
import { getSectionBody, parsePrdDocument } from "@/lib/prd/markdown";
import { requirePmServerUser } from "@/lib/server/auth";
import {
  GeneratedRoadmapDeliverable,
  RoadmapCard,
  RoadmapPriority,
  RoadmapQuarter,
  RoadmapStrategySuggestion
} from "@/types/app";

type StrategyInput = {
  goal: string;
  prds: Array<Pick<RoadmapCard, "id" | "title" | "impactScore" | "targetLaunchQuarter"> & { content: string }>;
};

type GenerateRoadmapDeliverablesFromPrdInput = {
  prdId: string;
  projectId: string | null;
  title: string;
  content: string;
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

function isRoadmapQuarter(value: unknown): value is RoadmapQuarter {
  return value === "Q1" || value === "Q2" || value === "Q3" || value === "Q4";
}

function isRoadmapPriority(value: unknown): value is RoadmapPriority {
  return value === "low" || value === "medium" || value === "high";
}

function parseRoadmapDeliverables(rawText: string): { deliverables: GeneratedRoadmapDeliverable[] } {
  const trimmed = rawText.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1) {
    return { deliverables: [] };
  }

  try {
    const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as {
      deliverables?: Array<Partial<GeneratedRoadmapDeliverable>>;
    };

    const deliverables = Array.isArray(parsed.deliverables)
      ? parsed.deliverables
          .map((deliverable) => ({
            title: String(deliverable.title ?? "").trim(),
            description: String(deliverable.description ?? "").trim(),
            quarter: deliverable.quarter,
            priority: deliverable.priority,
            reason: String(deliverable.reason ?? "").trim()
          }))
          .filter(
            (
              deliverable
            ): deliverable is GeneratedRoadmapDeliverable =>
              Boolean(deliverable.title) &&
              Boolean(deliverable.description) &&
              isRoadmapQuarter(deliverable.quarter) &&
              isRoadmapPriority(deliverable.priority)
          )
          .slice(0, 8)
      : [];

    return { deliverables };
  } catch {
    return { deliverables: [] };
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

export async function generateRoadmapDeliverablesFromPrd(
  input: GenerateRoadmapDeliverablesFromPrdInput
): Promise<{ deliverables: GeneratedRoadmapDeliverable[] }> {
  await requirePmServerUser();

  if (!input.prdId.trim()) {
    throw new Error("PRD ID is required.");
  }
  if (!input.content.trim()) {
    throw new Error("PRD content is required.");
  }

  const parsedPrd = parsePrdDocument(input.content);
  const prdSections = parsedPrd.sections
    .filter((section) => section.present)
    .map((section) => ({
      title: section.title,
      body: getSectionBody(section.markdown, section.title)
    }));

  const prompt = `
You are a principal product manager turning one Product Requirements Document into a realistic delivery roadmap.
Return strict JSON only:
{
  "deliverables": [
    {
      "title": "Deliverable title",
      "description": "What this deliverable includes and why it matters",
      "quarter": "Q1|Q2|Q3|Q4",
      "priority": "low|medium|high",
      "reason": "Why it belongs in that quarter"
    }
  ]
}

Rules:
- Generate 4 to 8 realistic roadmap deliverables.
- Use the PRD scope, risks, metrics, and dependencies to sequence work across quarters.
- Deliverables should be implementation-oriented, not vague themes.
- Spread work realistically across quarters when appropriate.
- Keep titles concise and descriptions practical.
- Avoid duplicates.
- Use only the listed quarter and priority values.

PRD ID:
${input.prdId}

Project ID:
${input.projectId?.trim() || "None"}

PRD title:
${input.title.trim() || "Product Requirements Document"}

PRD sections:
${JSON.stringify(prdSections, null, 2)}

Additional notes:
${parsedPrd.additionalNotes.trim() || "None"}
`;

  const text = await requestGeminiText({ prompt, temperature: 0.2 });
  const result = parseRoadmapDeliverables(text);

  if (!result.deliverables.length) {
    throw new Error("AI returned no roadmap deliverables.");
  }

  return result;
}
