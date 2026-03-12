import { ActiveSurvey, HelperStudyInterest } from "@/types/app";

type HelperStudyInterestOption = {
  description: string;
  id: HelperStudyInterest;
  keywords: string[];
  label: string;
};

export const HELPER_STUDY_INTEREST_OPTIONS: HelperStudyInterestOption[] = [
  {
    id: "all",
    label: "All studies",
    description: "See every study in your portal.",
    keywords: []
  },
  {
    id: "usability-testing",
    label: "Usability testing",
    description: "Navigation, task completion, UX friction, and ease of use.",
    keywords: ["usability", "ux", "ease of use", "navigation", "task", "flow", "friction"]
  },
  {
    id: "concept-validation",
    label: "Concept validation",
    description: "Early ideas, prototypes, MVPs, and idea validation.",
    keywords: ["concept", "prototype", "idea", "validation", "mvp", "mockup"]
  },
  {
    id: "feature-feedback",
    label: "Feature feedback",
    description: "Feedback on features, workflows, and product capabilities.",
    keywords: ["feature", "workflow", "tool", "capability", "functionality", "feature request"]
  },
  {
    id: "onboarding",
    label: "Onboarding",
    description: "Signup, setup, activation, and first value moments.",
    keywords: ["onboarding", "signup", "sign up", "activation", "setup", "first value"]
  },
  {
    id: "pricing-research",
    label: "Pricing research",
    description: "Pricing, packaging, billing, and willingness to pay.",
    keywords: ["pricing", "price", "billing", "subscription", "plan", "package"]
  },
  {
    id: "messaging-copy",
    label: "Messaging and copy",
    description: "Positioning, headlines, value propositions, and copy clarity.",
    keywords: ["messaging", "copy", "headline", "positioning", "value proposition", "tone"]
  },
  {
    id: "customer-satisfaction",
    label: "Customer satisfaction",
    description: "NPS, sentiment, delight, and general customer experience.",
    keywords: ["satisfaction", "nps", "csat", "sentiment", "delight", "experience"]
  },
  {
    id: "market-discovery",
    label: "Market discovery",
    description: "Audience needs, unmet demand, and new market opportunities.",
    keywords: ["market", "discovery", "audience", "demand", "need", "opportunity"]
  },
  {
    id: "competitive-research",
    label: "Competitive research",
    description: "Alternatives, switching behavior, and competitor comparisons.",
    keywords: ["competitor", "alternative", "compare", "comparison", "switching", "replacement"]
  },
  {
    id: "retention-loyalty",
    label: "Retention and loyalty",
    description: "Repeat usage, churn, stickiness, and long-term value.",
    keywords: ["retention", "churn", "loyalty", "stickiness", "repeat", "returning"]
  },
  {
    id: "beta-feedback",
    label: "Beta feedback",
    description: "Early access, pilot, alpha, and beta-program feedback.",
    keywords: ["beta", "pilot", "alpha", "early access", "preview", "test build"]
  },
  {
    id: "checkout-conversion",
    label: "Checkout and conversion",
    description: "Funnels, carts, checkout, and conversion optimization.",
    keywords: ["checkout", "conversion", "cart", "purchase", "funnel", "payment"]
  },
  {
    id: "mobile-experience",
    label: "Mobile experience",
    description: "Mobile UX, iOS, Android, and app-first experiences.",
    keywords: ["mobile", "ios", "android", "app", "touch", "phone"]
  },
  {
    id: "b2b-workflows",
    label: "B2B workflows",
    description: "Team workflows, admin tools, enterprise, and ops use cases.",
    keywords: ["b2b", "team", "admin", "enterprise", "ops", "dashboard", "workspace"]
  }
];

const VALID_HELPER_STUDY_INTERESTS = new Set(
  HELPER_STUDY_INTEREST_OPTIONS.map((option) => option.id)
);

export function normalizeHelperStudyInterests(input: unknown): HelperStudyInterest[] {
  if (!Array.isArray(input)) return ["all"];

  const normalized = input.filter(
    (value): value is HelperStudyInterest =>
      typeof value === "string" &&
      VALID_HELPER_STUDY_INTERESTS.has(value as HelperStudyInterest)
  );

  if (!normalized.length || normalized.includes("all")) return ["all"];

  return Array.from(new Set(normalized));
}

export function toggleHelperStudyInterest(
  current: HelperStudyInterest[],
  next: HelperStudyInterest
): HelperStudyInterest[] {
  if (next === "all") return ["all"];

  const withoutAll = current.filter((entry) => entry !== "all");
  if (withoutAll.includes(next)) {
    const remaining = withoutAll.filter((entry) => entry !== next);
    return remaining.length ? remaining : ["all"];
  }

  return [...withoutAll, next];
}

export function getHelperStudyInterestLabel(interest: HelperStudyInterest) {
  return (
    HELPER_STUDY_INTEREST_OPTIONS.find((option) => option.id === interest)?.label ??
    "General feedback"
  );
}

export function inferHelperStudyInterests(
  survey: Pick<ActiveSurvey, "description" | "surveyQuestions" | "title" | "userSegment">
): HelperStudyInterest[] {
  const haystack = [
    survey.title,
    survey.description ?? "",
    survey.userSegment,
    survey.surveyQuestions.map((question) => question.prompt).join(" "),
    survey.surveyQuestions.flatMap((question) => question.options).join(" ")
  ]
    .join(" ")
    .toLowerCase();

  return HELPER_STUDY_INTEREST_OPTIONS.filter((option) => option.id !== "all")
    .filter((option) => option.keywords.some((keyword) => haystack.includes(keyword)))
    .map((option) => option.id);
}
