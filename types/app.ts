export type UserRole = "pm" | "helper";

export type AppUser = {
  uid: string;
  email: string | null;
  role: UserRole;
  displayName?: string;
};

export type RoadmapQuarter = "Q1" | "Q2" | "Q3" | "Q4";
export type SurveyQuestionType = "open_text" | "single_select" | "multi_select";
export type StudyStatus = "draft" | "published";
export type StudyDistributionMode = "open" | "assigned";

export type SurveyQuestion = {
  id: string;
  prompt: string;
  type: SurveyQuestionType;
  options: string[];
};

export type SurveyAnswer = {
  questionId: string;
  answerText?: string;
  selectedOptions?: string[];
};

export type Project = {
  id: string;
  ownerId: string;
  name: string;
  createdAt?: number;
};

export type Study = {
  id: string;
  projectId: string | null;
  ownerId: string;
  title: string;
  userSegment: string;
  budgetPerResponse: number;
  surveyQuestions: SurveyQuestion[];
  distributionMode: StudyDistributionMode;
  helperIds: string[];
  status: StudyStatus;
  expiresAt?: number;
  createdAt?: number;
  updatedAt?: number;
};

export type Submission = {
  id: string;
  studyId: string;
  helperId: string;
  answers: SurveyAnswer[];
  responseSummary?: string;
  status: "pending_review";
  createdAt?: number;
};

export type PrdDocument = {
  id: string;
  projectId: string | null;
  ownerId: string;
  title: string;
  content: string;
  impactScore?: number;
  targetLaunchQuarter?: RoadmapQuarter;
  updatedAt?: number;
};

export type ActiveSurvey = {
  id: string;
  studyId: string;
  projectId: string | null;
  ownerId: string;
  title: string;
  description?: string;
  userSegment: string;
  status: StudyStatus;
  distributionMode: StudyDistributionMode;
  helperIds: string[];
  rewardAmount?: number;
  surveyQuestions: SurveyQuestion[];
  expiresAt?: number;
  createdAt?: number;
  updatedAt?: number;
};

export type StudyInsights = {
  studyId: string;
  ownerId: string;
  responseCountAtGeneration: number;
  themes: string[];
  summary: string;
  recommendations: string[];
  updatedAt?: number;
};

export type RoadmapCard = {
  id: string;
  title: string;
  impactScore?: number;
  targetLaunchQuarter?: RoadmapQuarter;
  isPlaceholder?: boolean;
};

export type RoadmapPriority = "low" | "medium" | "high";

export type RoadmapItem = {
  id: string;
  ownerId: string;
  projectId: string | null;
  quarter: RoadmapQuarter;
  title: string;
  description: string;
  priority: RoadmapPriority;
  createdAt?: number;
};

export type AnalyticsReport = {
  id: string;
  ownerId: string;
  projectId: string | null;
  title: string;
  summary: string;
  metrics: string;
  createdAt?: number;
  updatedAt?: number;
};

export type JourneyMap = {
  id: string;
  ownerId: string;
  projectId: string | null;
  title: string;
  stages: string;
  painPoints: string;
  opportunities: string;
  createdAt?: number;
  updatedAt?: number;
};

export type AbTestExperiment = {
  id: string;
  ownerId: string;
  projectId: string | null;
  title: string;
  hypothesis: string;
  variantA: string;
  variantB: string;
  successMetric: string;
  status: "draft" | "running" | "completed";
  createdAt?: number;
  updatedAt?: number;
};

export type PmResearchSession = {
  id: string;
  ownerId: string;
  projectId: string | null;
  title: string;
  notes: string;
  insights: string;
  createdAt?: number;
  updatedAt?: number;
};

export type AiInsights = {
  topPainPoints: string[];
  featureSuggestions: string[];
};

export type RoadmapStrategySuggestion = {
  moves: Array<{
    prdId: string;
    quarter: RoadmapQuarter;
    reason: string;
  }>;
  placeholders: Array<{
    title: string;
    quarter: RoadmapQuarter;
    reason: string;
  }>;
};

export type HelperProfile = {
  displayName: string;
  expertise: string;
  availability: string;
};

export type HelperEarningsEntry = {
  submissionId: string;
  studyId: string;
  title: string;
  rewardAmount: number;
  status: string;
};

export type HelperEarningsSummary = {
  totalPending: number;
  pendingCount: number;
  entries: HelperEarningsEntry[];
};

export type PMResearchStudySummary = {
  studyId: string;
  title: string;
  status: StudyStatus;
  distributionMode: StudyDistributionMode;
  responseCount: number;
  pendingReviewCount: number;
};

export type PMResearchSummary = {
  totalStudies: number;
  draftStudies: number;
  publishedStudies: number;
  totalResponses: number;
  pendingReview: number;
  latestInsightAt?: number;
  studies: PMResearchStudySummary[];
};
