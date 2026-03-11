import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { toast } from "sonner";

import { requireFirebaseDb } from "@/lib/firebase/client";
import {
  ActiveSurvey,
  AnalyticsReport,
  AbTestExperiment,
  HelperEarningsSummary,
  HelperProfile,
  JourneyMap,
  PMResearchSummary,
  PmResearchSession,
  PrdDocument,
  Project,
  RoadmapItem,
  RoadmapPriority,
  RoadmapQuarter,
  StudyStatus,
  SurveyAnswer,
  SurveyQuestion,
  SurveyQuestionType,
  Study
} from "@/types/app";

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function toMillis(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return undefined;
}

function getFirebaseErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  if (!("code" in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function requireDbClient() {
  return requireFirebaseDb();
}

function assertRequiredId(value: string | null | undefined, context: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    throw new Error(`Missing ${context}.`);
  }
  return normalized;
}

function handleFirestoreQueryError(error: unknown, fallbackMessage: string) {
  const code = getFirebaseErrorCode(error);
  if (process.env.NODE_ENV !== "production") {
    console.error(`[firestore] ${fallbackMessage}`, error);
  }

  if (code === "permission-denied") {
    toast.error(
      `${fallbackMessage} Firestore permission denied. Verify/deploy firestore.rules and confirm ownerId == request.auth.uid for this document.`
    );
    return;
  }

  if (code === "invalid-argument") {
    toast.error(
      `${fallbackMessage} Firestore received invalid query/input arguments. Verify required ids and client initialization.`
    );
    return;
  }

  if (code === "failed-precondition") {
    toast.error(
      `${fallbackMessage} Firestore is missing required configuration (index or project setup).`
    );
    return;
  }

  if (code) {
    toast.error(`${fallbackMessage} (${code})`);
    return;
  }

  toast.error(fallbackMessage);
}

async function deleteDocumentIdsInBatches(
  collectionName: string,
  ids: string[]
): Promise<void> {
  if (!ids.length) return;
  const db = requireDbClient();

  for (const batchIds of chunkArray(ids, 400)) {
    const write = writeBatch(db);
    batchIds.forEach((id) => {
      write.delete(doc(db, collectionName, id));
    });
    await write.commit();
  }
}

function isQuestionType(value: unknown): value is SurveyQuestionType {
  return value === "open_text" || value === "single_select" || value === "multi_select";
}

function normalizeStudyStatus(value: unknown): StudyStatus {
  return value === "draft" ? "draft" : "published";
}

function normalizeNullableProjectId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  return null;
}

async function resolveOwnedProjectId(
  projectId: string | null | undefined,
  ownerId: string
): Promise<string | null> {
  const normalizedProjectId = normalizeNullableProjectId(projectId);
  if (!normalizedProjectId) return null;
  const db = requireDbClient();

  const projectSnap = await getDoc(doc(db, "projects", normalizedProjectId));
  if (!projectSnap.exists()) return null;
  if (String(projectSnap.data().ownerId ?? "") !== ownerId) return null;
  return normalizedProjectId;
}

async function assertOwnedProjectId(
  projectId: string | null | undefined,
  ownerId: string
): Promise<string | null> {
  const normalizedProjectId = normalizeNullableProjectId(projectId);
  const resolvedProjectId = await resolveOwnedProjectId(normalizedProjectId, ownerId);
  if (normalizedProjectId && !resolvedProjectId) {
    throw new Error("Select a valid project from your workspace.");
  }
  return resolvedProjectId;
}

function normalizeSurveyQuestions(value: unknown): SurveyQuestion[] {
  if (!Array.isArray(value)) return [];

  if (value.every((item) => typeof item === "string")) {
    return value
      .map((question, index) => ({
        id: `legacy-q-${index + 1}`,
        prompt: question.trim(),
        type: "open_text" as const,
        options: []
      }))
      .filter((question) => question.prompt.length > 0);
  }

  return value
    .map((rawQuestion, index) => {
      if (!rawQuestion || typeof rawQuestion !== "object") return null;
      const record = rawQuestion as Record<string, unknown>;
      const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
      if (!prompt) return null;

      const type = isQuestionType(record.type) ? record.type : "open_text";
      const options =
        Array.isArray(record.options) && type !== "open_text"
          ? record.options
              .map((option) => String(option).trim())
              .filter(Boolean)
          : [];

      return {
        id: typeof record.id === "string" && record.id.trim() ? record.id : `q-${index + 1}`,
        prompt,
        type,
        options
      } satisfies SurveyQuestion;
    })
    .filter((question): question is SurveyQuestion => Boolean(question));
}

function toStudy(studyDoc: { id: string; data: () => Record<string, unknown> }): Study {
  const data = studyDoc.data();
  return {
    id: studyDoc.id,
    projectId: String(data.projectId ?? ""),
    ownerId: String(data.ownerId ?? ""),
    title: String(data.title ?? "Untitled study"),
    userSegment: String(data.userSegment ?? ""),
    budgetPerResponse:
      typeof data.budgetPerResponse === "number" ? data.budgetPerResponse : 0,
    surveyQuestions: normalizeSurveyQuestions(data.surveyQuestions),
    helperIds: Array.isArray(data.helperIds)
      ? data.helperIds.map((id) => String(id)).filter(Boolean)
      : [],
    status: normalizeStudyStatus(data.status),
    createdAt: typeof data.createdAt === "number" ? data.createdAt : undefined
  };
}

export async function getProjectsByOwner(ownerId: string): Promise<Project[]> {
  try {
    const db = requireDbClient();
    const normalizedOwnerId = assertRequiredId(ownerId, "PM user id while loading projects");
    const projectsRef = collection(db, "projects");
    const projectsQuery = query(projectsRef, where("ownerId", "==", normalizedOwnerId));
    const snapshot = await getDocs(projectsQuery);

    return snapshot.docs.map((projectDoc) => {
      const data = projectDoc.data();
      return {
        id: projectDoc.id,
        ownerId: String(data.ownerId ?? normalizedOwnerId),
        name: String(data.name ?? "Untitled project"),
        createdAt: toMillis(data.createdAt)
      } satisfies Project;
    });
  } catch (error) {
    handleFirestoreQueryError(error, "Could not load projects.");
    throw error;
  }
}

export async function getStudiesByHelper(helperId: string): Promise<Study[]> {
  try {
    const db = requireDbClient();
    const normalizedHelperId = assertRequiredId(helperId, "helper user id while loading studies");
    const studiesRef = collection(db, "studies");
    const studiesQuery = query(studiesRef, where("helperIds", "array-contains", normalizedHelperId));
    const snapshot = await getDocs(studiesQuery);

    return snapshot.docs.map((studyDoc) =>
      toStudy({
        id: studyDoc.id,
        data: () => studyDoc.data() as Record<string, unknown>
      })
    );
  } catch (error) {
    handleFirestoreQueryError(error, "Could not load assigned studies.");
    throw error;
  }
}

export async function getPublishedActiveSurveys(): Promise<ActiveSurvey[]> {
  try {
    const db = requireDbClient();
    const surveysRef = collection(db, "active_surveys");
    const surveysQuery = query(surveysRef, where("status", "==", "published"));
    const snapshot = await getDocs(surveysQuery);

    return snapshot.docs.map((surveyDoc) => {
      const data = surveyDoc.data();
      return {
        id: surveyDoc.id,
        studyId: String(data.studyId ?? surveyDoc.id),
        projectId: String(data.projectId ?? ""),
        ownerId: String(data.ownerId ?? ""),
        title: String(data.title ?? "Untitled survey"),
        description: data.description ? String(data.description) : undefined,
        userSegment: String(data.userSegment ?? ""),
        status: normalizeStudyStatus(data.status),
        rewardAmount:
          typeof data.rewardAmount === "number"
            ? data.rewardAmount
            : typeof data.budgetPerResponse === "number"
              ? data.budgetPerResponse
              : undefined,
        surveyQuestions: normalizeSurveyQuestions(data.surveyQuestions)
      };
    });
  } catch (error) {
    handleFirestoreQueryError(error, "Could not load published surveys.");
    throw error;
  }
}

export async function getStudiesByOwner(ownerId: string): Promise<Study[]> {
  try {
    const db = requireDbClient();
    const normalizedOwnerId = assertRequiredId(ownerId, "PM user id while loading studies");
    const studiesRef = collection(db, "studies");
    const studiesQuery = query(studiesRef, where("ownerId", "==", normalizedOwnerId));
    const snapshot = await getDocs(studiesQuery);

    return snapshot.docs.map((studyDoc) =>
      toStudy({
        id: studyDoc.id,
        data: () => studyDoc.data() as Record<string, unknown>
      })
    );
  } catch (error) {
    handleFirestoreQueryError(error, "Could not load studies.");
    throw error;
  }
}

export async function createProject(ownerId: string, name: string): Promise<string> {
  try {
    const db = requireDbClient();
    const normalizedOwnerId = assertRequiredId(ownerId, "PM user id while creating a project");
    const projectsRef = collection(db, "projects");
    const projectDoc = await addDoc(projectsRef, {
      ownerId: normalizedOwnerId,
      name,
      createdAt: serverTimestamp()
    });
    toast.success("Project created.");
    return projectDoc.id;
  } catch (error) {
    handleFirestoreQueryError(error, "Could not create project.");
    throw error;
  }
}

type CreateStudyInput = {
  projectId: string;
  ownerId: string;
  title: string;
  userSegment: string;
  budgetPerResponse: number;
  surveyQuestions: SurveyQuestion[];
  status?: StudyStatus;
};

export async function createStudy(input: CreateStudyInput): Promise<void> {
  try {
    const db = requireDbClient();
    const projectId = await assertOwnedProjectId(input.projectId, input.ownerId);
    if (!projectId) {
      throw new Error("Project is required.");
    }

    const studyRef = doc(collection(db, "studies"));
    const surveyRef = doc(db, "active_surveys", studyRef.id);
    const now = serverTimestamp();
    const write = writeBatch(db);
    const status = input.status ?? "published";

    write.set(studyRef, {
      projectId,
      ownerId: input.ownerId,
      title: input.title,
      userSegment: input.userSegment,
      budgetPerResponse: input.budgetPerResponse,
      surveyQuestions: input.surveyQuestions,
      helperIds: [],
      status,
      createdAt: now
    });

    write.set(surveyRef, {
      studyId: studyRef.id,
      projectId,
      ownerId: input.ownerId,
      title: input.title,
      description: `Audience: ${input.userSegment}`,
      userSegment: input.userSegment,
      surveyQuestions: input.surveyQuestions,
      status,
      rewardAmount: input.budgetPerResponse,
      budgetPerResponse: input.budgetPerResponse,
      createdAt: now
    });

    await write.commit();
    toast.success("Study created.");
  } catch (error) {
    handleFirestoreQueryError(error, "Could not create study.");
    throw error;
  }
}

export async function updateStudyStatus(
  studyId: string,
  ownerId: string,
  status: StudyStatus
): Promise<void> {
  try {
    const db = requireDbClient();
    const normalizedStudyId = assertRequiredId(studyId, "study id while updating study status");
    const normalizedOwnerId = assertRequiredId(ownerId, "PM user id while updating study status");
    const now = serverTimestamp();
    const write = writeBatch(db);
    write.set(
      doc(db, "studies", normalizedStudyId),
      {
        ownerId: normalizedOwnerId,
        status,
        updatedAt: now
      },
      { merge: true }
    );
    write.set(
      doc(db, "active_surveys", normalizedStudyId),
      {
        ownerId: normalizedOwnerId,
        status,
        updatedAt: now
      },
      { merge: true }
    );
    await write.commit();
    toast.success(status === "published" ? "Study published." : "Study moved to draft.");
  } catch (error) {
    handleFirestoreQueryError(error, "Could not update study status.");
    throw error;
  }
}

export async function createSubmission(
  studyId: string,
  helperId: string,
  answers: SurveyAnswer[],
  responseSummary = ""
): Promise<void> {
  try {
    const db = requireDbClient();
    const normalizedStudyId = assertRequiredId(studyId, "study id while submitting a study");
    const normalizedHelperId = assertRequiredId(helperId, "helper user id while submitting a study");
    const submissionsRef = collection(db, "submissions");
    const existingSubmissionQuery = query(
      submissionsRef,
      where("studyId", "==", normalizedStudyId),
      where("helperId", "==", normalizedHelperId)
    );
    const existingSnapshot = await getDocs(existingSubmissionQuery);
    if (!existingSnapshot.empty) {
      toast.error("You already submitted this study.");
      return;
    }

    await addDoc(submissionsRef, {
      studyId: normalizedStudyId,
      helperId: normalizedHelperId,
      answers,
      responseSummary,
      status: "pending_review",
      createdAt: serverTimestamp()
    });
    toast.success("Study submitted for review.");
  } catch (error) {
    handleFirestoreQueryError(error, "Could not submit study.");
    throw error;
  }
}

export async function getPmResearchSummary(
  ownerId: string,
  projectId?: string | null
): Promise<PMResearchSummary> {
  try {
    const db = requireDbClient();
    const normalizedOwnerId = assertRequiredId(ownerId, "PM user id while loading research summary");
    const studies = (await getStudiesByOwner(normalizedOwnerId)).filter((study) => {
      if (projectId === undefined) return true;
      if (projectId === null) return !study.projectId;
      return study.projectId === projectId;
    });
    if (!studies.length) {
      return {
        totalStudies: 0,
        totalResponses: 0,
        pendingReview: 0,
        studies: []
      };
    }

    const studiesById = new Map(studies.map((study) => [study.id, study]));
    const studyIdChunks = chunkArray(studies.map((study) => study.id), 10);
    const submissionSnapshots = await Promise.all(
      studyIdChunks.map((chunk) =>
        getDocs(query(collection(db, "submissions"), where("studyId", "in", chunk)))
      )
    );

    const counters = new Map<
      string,
      {
        responseCount: number;
        pendingReviewCount: number;
      }
    >();

    for (const snapshot of submissionSnapshots) {
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const studyId = String(data.studyId ?? "");
        if (!studyId || !studiesById.has(studyId)) continue;

        const current = counters.get(studyId) ?? { responseCount: 0, pendingReviewCount: 0 };
        current.responseCount += 1;
        if (data.status === "pending_review") {
          current.pendingReviewCount += 1;
        }
        counters.set(studyId, current);
      }
    }

    const studySummaries = studies.map((study) => {
      const totals = counters.get(study.id) ?? { responseCount: 0, pendingReviewCount: 0 };
      return {
        studyId: study.id,
        title: study.title,
        responseCount: totals.responseCount,
        pendingReviewCount: totals.pendingReviewCount
      };
    });

    return {
      totalStudies: studies.length,
      totalResponses: studySummaries.reduce((sum, item) => sum + item.responseCount, 0),
      pendingReview: studySummaries.reduce((sum, item) => sum + item.pendingReviewCount, 0),
      studies: studySummaries
    };
  } catch (error) {
    handleFirestoreQueryError(error, "Could not load research summary.");
    throw error;
  }
}

export async function getHelperEarningsSummary(
  helperId: string
): Promise<HelperEarningsSummary> {
  try {
    const db = requireDbClient();
    const normalizedHelperId = assertRequiredId(helperId, "helper user id while loading earnings");
    const submissionsRef = collection(db, "submissions");
    const submissionsQuery = query(submissionsRef, where("helperId", "==", normalizedHelperId));
    const submissionsSnap = await getDocs(submissionsQuery);

    if (submissionsSnap.empty) {
      return { totalPending: 0, pendingCount: 0, entries: [] };
    }

    const submissions = submissionsSnap.docs.map((docSnap) => ({
      submissionId: docSnap.id,
      studyId: String(docSnap.data().studyId ?? ""),
      status: String(docSnap.data().status ?? "pending_review")
    }));

    const studyIds = Array.from(new Set(submissions.map((submission) => submission.studyId))).filter(
      Boolean
    );
    const surveyMap = new Map<
      string,
      {
        title: string;
        rewardAmount: number;
      }
    >();

    for (const chunk of chunkArray(studyIds, 10)) {
      const surveysSnap = await getDocs(
        query(collection(db, "active_surveys"), where(documentId(), "in", chunk))
      );

      for (const surveyDoc of surveysSnap.docs) {
        surveyMap.set(surveyDoc.id, {
          title: String(surveyDoc.data().title ?? "Untitled survey"),
          rewardAmount:
            typeof surveyDoc.data().rewardAmount === "number"
              ? surveyDoc.data().rewardAmount
              : typeof surveyDoc.data().budgetPerResponse === "number"
                ? surveyDoc.data().budgetPerResponse
                : 0
        });
      }
    }

    const entries = submissions.map((submission) => {
      const survey = surveyMap.get(submission.studyId);
      return {
        submissionId: submission.submissionId,
        studyId: submission.studyId,
        title: survey?.title ?? "Unknown survey",
        rewardAmount: survey?.rewardAmount ?? 0,
        status: submission.status
      };
    });

    return {
      totalPending: entries.reduce((sum, entry) => {
        if (entry.status !== "pending_review") return sum;
        return sum + entry.rewardAmount;
      }, 0),
      pendingCount: entries.filter((entry) => entry.status === "pending_review").length,
      entries
    };
  } catch (error) {
    handleFirestoreQueryError(error, "Could not load earnings summary.");
    throw error;
  }
}

export async function getHelperProfile(helperId: string): Promise<HelperProfile> {
  try {
    const db = requireDbClient();
    const normalizedHelperId = assertRequiredId(helperId, "helper user id while loading profile");
    const userDoc = await getDoc(doc(db, "users", normalizedHelperId));
    const data = userDoc.data();

    return {
      displayName: typeof data?.displayName === "string" ? data.displayName : "",
      expertise: typeof data?.expertise === "string" ? data.expertise : "",
      availability: typeof data?.availability === "string" ? data.availability : ""
    };
  } catch (error) {
    handleFirestoreQueryError(error, "Could not load helper profile.");
    throw error;
  }
}

export async function updateHelperProfile(
  helperId: string,
  profile: HelperProfile
): Promise<void> {
  try {
    const db = requireDbClient();
    const normalizedHelperId = assertRequiredId(helperId, "helper user id while updating profile");
    await setDoc(
      doc(db, "users", normalizedHelperId),
      {
        displayName: profile.displayName,
        expertise: profile.expertise,
        availability: profile.availability,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    toast.success("Profile updated.");
  } catch (error) {
    handleFirestoreQueryError(error, "Could not update profile.");
    throw error;
  }
}

export async function getOrCreatePrdDocument(
  prdId: string,
  ownerId: string
): Promise<PrdDocument> {
  try {
    const db = requireDbClient();
    const normalizedPrdId = assertRequiredId(prdId, "PRD id while loading PRD");
    const normalizedOwnerId = assertRequiredId(ownerId, "PM user id while loading PRD");
    const prdRef = doc(db, "prds", normalizedPrdId);
    const prdSnap = await getDoc(prdRef);
    const inferredProjectId = await resolveOwnedProjectId(normalizedPrdId, normalizedOwnerId);

    if (!prdSnap.exists()) {
      const newDocument: Omit<PrdDocument, "id"> = {
        projectId: inferredProjectId,
        ownerId: normalizedOwnerId,
        title: "Product Requirements Document",
        content: ""
      };
      await setDoc(prdRef, { ...newDocument, updatedAt: serverTimestamp() });
      return { id: normalizedPrdId, ...newDocument };
    }

    const data = prdSnap.data();
    return {
      id: prdSnap.id,
      ownerId: String(data.ownerId ?? normalizedOwnerId),
      projectId: normalizeNullableProjectId(data.projectId) ?? inferredProjectId,
      title: String(data.title ?? "Product Requirements Document"),
      content: String(data.content ?? ""),
      impactScore: typeof data.impactScore === "number" ? data.impactScore : undefined,
      targetLaunchQuarter:
        typeof data.targetLaunchQuarter === "string"
          ? (data.targetLaunchQuarter as RoadmapQuarter)
          : undefined,
      updatedAt: toMillis(data.updatedAt)
    };
  } catch (error) {
    handleFirestoreQueryError(error, "Could not load PRD.");
    throw error;
  }
}

export async function createPrdDocument(
  ownerId: string,
  projectId: string | null,
  title = "Product Requirements Document"
): Promise<string> {
  try {
    const db = requireDbClient();
    const normalizedOwnerId = assertRequiredId(ownerId, "PM user id while creating PRD");
    const resolvedProjectId = await assertOwnedProjectId(projectId, normalizedOwnerId);
    const prdRef = doc(collection(db, "prds"));
    await setDoc(prdRef, {
      ownerId: normalizedOwnerId,
      projectId: resolvedProjectId,
      title,
      content: "",
      updatedAt: serverTimestamp()
    });
    toast.success("PRD draft created.");
    return prdRef.id;
  } catch (error) {
    handleFirestoreQueryError(error, "Could not create PRD draft.");
    throw error;
  }
}

export async function savePrdContent(
  prdId: string,
  ownerId: string,
  content: string,
  projectId?: string | null
): Promise<void> {
  try {
    const db = requireDbClient();
    const normalizedPrdId = assertRequiredId(prdId, "PRD id while saving PRD");
    const normalizedOwnerId = assertRequiredId(ownerId, "PM user id while saving PRD");
    const prdRef = doc(db, "prds", normalizedPrdId);
    const prdSnap = await getDoc(prdRef);
    if (prdSnap.exists() && String(prdSnap.data().ownerId ?? normalizedOwnerId) !== normalizedOwnerId) {
      throw new Error("You cannot edit this PRD.");
    }

    const payload: Record<string, unknown> = {
      ownerId: normalizedOwnerId,
      title: prdSnap.exists()
        ? String(prdSnap.data().title ?? "Product Requirements Document")
        : "Product Requirements Document",
      content,
      updatedAt: serverTimestamp()
    };
    if (projectId !== undefined) {
      payload.projectId = await assertOwnedProjectId(projectId, normalizedOwnerId);
    }

    await setDoc(
      prdRef,
      payload,
      { merge: true }
    );
    toast.success("PRD saved.");
  } catch (error) {
    handleFirestoreQueryError(error, "Could not save PRD.");
    throw error;
  }
}

export async function getPrdsByOwner(ownerId: string): Promise<PrdDocument[]> {
  try {
    const db = requireDbClient();
    const normalizedOwnerId = assertRequiredId(ownerId, "PM user id while loading PRDs");
    const prdsRef = collection(db, "prds");
    const prdsQuery = query(prdsRef, where("ownerId", "==", normalizedOwnerId));
    const snapshot = await getDocs(prdsQuery);

    return snapshot.docs.map((prdDoc) => {
      const data = prdDoc.data();
      return {
        id: prdDoc.id,
        ownerId: String(data.ownerId ?? normalizedOwnerId),
        projectId: normalizeNullableProjectId(data.projectId),
        title: String(data.title ?? "Product Requirements Document"),
        content: String(data.content ?? ""),
        impactScore: typeof data.impactScore === "number" ? data.impactScore : undefined,
        targetLaunchQuarter:
          typeof data.targetLaunchQuarter === "string"
            ? (data.targetLaunchQuarter as RoadmapQuarter)
            : undefined,
        updatedAt: toMillis(data.updatedAt)
      } satisfies PrdDocument;
    });
  } catch (error) {
    handleFirestoreQueryError(error, "Could not load roadmap PRDs.");
    throw error;
  }
}

export async function deletePrdDocument(prdId: string, ownerId: string): Promise<void> {
  try {
    const db = requireDbClient();
    const normalizedPrdId = assertRequiredId(prdId, "PRD id while deleting PRD");
    const normalizedOwnerId = assertRequiredId(ownerId, "PM user id while deleting PRD");
    const prdRef = doc(db, "prds", normalizedPrdId);
    const prdSnap = await getDoc(prdRef);
    if (!prdSnap.exists()) return;

    if (String(prdSnap.data().ownerId ?? "") !== normalizedOwnerId) {
      throw new Error("You cannot delete this PRD.");
    }

    await deleteDoc(prdRef);
    toast.success("PRD deleted.");
  } catch (error) {
    handleFirestoreQueryError(error, "Could not delete PRD.");
    throw error;
  }
}

export async function updatePrdLaunchQuarter(
  prdId: string,
  ownerId: string,
  quarter: RoadmapQuarter
): Promise<void> {
  try {
    const db = requireDbClient();
    const normalizedPrdId = assertRequiredId(prdId, "PRD id while updating roadmap quarter");
    const normalizedOwnerId = assertRequiredId(ownerId, "PM user id while updating roadmap quarter");
    const prdRef = doc(db, "prds", normalizedPrdId);
    const prdSnap = await getDoc(prdRef);
    if (!prdSnap.exists()) {
      throw new Error("This PRD no longer exists.");
    }
    if (String(prdSnap.data().ownerId ?? "") !== normalizedOwnerId) {
      throw new Error("You cannot edit this PRD.");
    }
    await setDoc(
      prdRef,
      {
        ownerId: normalizedOwnerId,
        targetLaunchQuarter: quarter,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    toast.success("Roadmap launch quarter updated.");
  } catch (error) {
    handleFirestoreQueryError(error, "Could not update roadmap quarter.");
    throw error;
  }
}

export async function createRoadmapPlaceholderPrd(
  ownerId: string,
  title: string,
  quarter: RoadmapQuarter,
  projectId: string | null = null
): Promise<void> {
  try {
    const db = requireDbClient();
    const normalizedOwnerId = assertRequiredId(ownerId, "PM user id while creating roadmap placeholder");
    const resolvedProjectId = await assertOwnedProjectId(projectId, normalizedOwnerId);
    const prdRef = doc(collection(db, "prds"));
    await setDoc(prdRef, {
      ownerId: normalizedOwnerId,
      projectId: resolvedProjectId,
      title,
      content: "Placeholder idea generated by AI strategy prompt.",
      targetLaunchQuarter: quarter,
      impactScore: 0,
      isPlaceholder: true,
      updatedAt: serverTimestamp()
    });
    toast.success("Placeholder added to roadmap.");
  } catch (error) {
    handleFirestoreQueryError(error, "Could not save roadmap placeholder.");
    throw error;
  }
}

type CreateRoadmapItemInput = {
  ownerId: string;
  projectId: string | null;
  quarter: RoadmapQuarter;
  title: string;
  description: string;
  priority: RoadmapPriority;
};

export async function createRoadmapItem(
  input: CreateRoadmapItemInput
): Promise<void> {
  try {
    const db = requireDbClient();
    const normalizedOwnerId = assertRequiredId(input.ownerId, "PM user id while creating roadmap item");
    const projectId = await assertOwnedProjectId(input.projectId, normalizedOwnerId);
    const roadmapItemsRef = collection(db, "roadmap_items");
    await addDoc(roadmapItemsRef, {
      ownerId: normalizedOwnerId,
      projectId,
      quarter: input.quarter,
      title: input.title,
      description: input.description,
      priority: input.priority,
      createdAt: serverTimestamp()
    });
    toast.success("Roadmap item added.");
  } catch (error) {
    handleFirestoreQueryError(error, "Could not create roadmap item.");
    throw error;
  }
}

export async function getRoadmapItemsByOwner(
  ownerId: string
): Promise<RoadmapItem[]> {
  try {
    const db = requireDbClient();
    const normalizedOwnerId = assertRequiredId(ownerId, "PM user id while loading roadmap items");
    const roadmapItemsRef = collection(db, "roadmap_items");
    const roadmapItemsQuery = query(roadmapItemsRef, where("ownerId", "==", normalizedOwnerId));
    const snapshot = await getDocs(roadmapItemsQuery);

    return snapshot.docs.map((itemDoc) => ({
      id: itemDoc.id,
      ownerId: String(itemDoc.data().ownerId ?? normalizedOwnerId),
      projectId: normalizeNullableProjectId(itemDoc.data().projectId),
      quarter: String(itemDoc.data().quarter ?? "Q1") as RoadmapQuarter,
      title: String(itemDoc.data().title ?? "Untitled item"),
      description: String(itemDoc.data().description ?? ""),
      priority: String(itemDoc.data().priority ?? "medium") as RoadmapPriority,
      createdAt:
        typeof itemDoc.data().createdAt === "number"
          ? itemDoc.data().createdAt
          : undefined
    }));
  } catch (error) {
    handleFirestoreQueryError(error, "Could not load roadmap items.");
    throw error;
  }
}

export async function deleteRoadmapItem(itemId: string, ownerId: string): Promise<void> {
  try {
    const db = requireDbClient();
    const normalizedItemId = assertRequiredId(itemId, "roadmap item id while deleting roadmap item");
    const normalizedOwnerId = assertRequiredId(ownerId, "PM user id while deleting roadmap item");
    const itemRef = doc(db, "roadmap_items", normalizedItemId);
    const itemSnap = await getDoc(itemRef);
    if (!itemSnap.exists()) return;

    if (String(itemSnap.data().ownerId ?? "") !== normalizedOwnerId) {
      throw new Error("You cannot delete this roadmap item.");
    }

    await deleteDoc(itemRef);
    toast.success("Roadmap item deleted.");
  } catch (error) {
    handleFirestoreQueryError(error, "Could not delete roadmap item.");
    throw error;
  }
}

type CreatePmResearchSessionInput = {
  ownerId: string;
  projectId: string | null;
  title: string;
  notes: string;
  insights: string;
};

export async function getPmResearchSessionsByOwner(
  ownerId: string
): Promise<PmResearchSession[]> {
  try {
    const db = requireDbClient();
    const normalizedOwnerId = assertRequiredId(ownerId, "PM user id while loading research sessions");
    const ref = collection(db, "pm_research_sessions");
    const q = query(ref, where("ownerId", "==", normalizedOwnerId));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        ownerId: String(data.ownerId ?? normalizedOwnerId),
        projectId: normalizeNullableProjectId(data.projectId),
        title: String(data.title ?? "Untitled session"),
        notes: String(data.notes ?? ""),
        insights: String(data.insights ?? ""),
        createdAt: toMillis(data.createdAt),
        updatedAt: toMillis(data.updatedAt)
      } satisfies PmResearchSession;
    });
  } catch (error) {
    handleFirestoreQueryError(error, "Could not load research sessions.");
    throw error;
  }
}

export async function createPmResearchSession(
  input: CreatePmResearchSessionInput
): Promise<void> {
  try {
    const db = requireDbClient();
    const normalizedOwnerId = assertRequiredId(input.ownerId, "PM user id while saving research session");
    const projectId = await assertOwnedProjectId(input.projectId, normalizedOwnerId);
    const ref = collection(db, "pm_research_sessions");
    await addDoc(ref, {
      ownerId: normalizedOwnerId,
      projectId,
      title: input.title,
      notes: input.notes,
      insights: input.insights,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    toast.success("Research session saved.");
  } catch (error) {
    handleFirestoreQueryError(error, "Could not save research session.");
    throw error;
  }
}

export async function deletePmResearchSession(
  sessionId: string,
  ownerId: string
): Promise<void> {
  try {
    const db = requireDbClient();
    const normalizedSessionId = assertRequiredId(sessionId, "research session id while deleting research session");
    const normalizedOwnerId = assertRequiredId(ownerId, "PM user id while deleting research session");
    const ref = doc(db, "pm_research_sessions", normalizedSessionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    if (String(snap.data().ownerId ?? "") !== normalizedOwnerId) {
      throw new Error("You cannot delete this research session.");
    }

    await deleteDoc(ref);
    toast.success("Research session deleted.");
  } catch (error) {
    handleFirestoreQueryError(error, "Could not delete research session.");
    throw error;
  }
}

type CreateAnalyticsReportInput = {
  ownerId: string;
  projectId: string | null;
  title: string;
  summary: string;
  metrics: string;
};

export async function getAnalyticsReportsByOwner(
  ownerId: string
): Promise<AnalyticsReport[]> {
  try {
    const db = requireDbClient();
    const normalizedOwnerId = assertRequiredId(ownerId, "PM user id while loading analytics reports");
    const ref = collection(db, "analytics_reports");
    const q = query(ref, where("ownerId", "==", normalizedOwnerId));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        ownerId: String(data.ownerId ?? normalizedOwnerId),
        projectId: normalizeNullableProjectId(data.projectId),
        title: String(data.title ?? "Untitled report"),
        summary: String(data.summary ?? ""),
        metrics: String(data.metrics ?? ""),
        createdAt: toMillis(data.createdAt),
        updatedAt: toMillis(data.updatedAt)
      } satisfies AnalyticsReport;
    });
  } catch (error) {
    handleFirestoreQueryError(error, "Could not load analytics reports.");
    throw error;
  }
}

export async function createAnalyticsReport(
  input: CreateAnalyticsReportInput
): Promise<void> {
  try {
    const db = requireDbClient();
    const normalizedOwnerId = assertRequiredId(input.ownerId, "PM user id while saving analytics report");
    const projectId = await assertOwnedProjectId(input.projectId, normalizedOwnerId);
    const ref = collection(db, "analytics_reports");
    await addDoc(ref, {
      ownerId: normalizedOwnerId,
      projectId,
      title: input.title,
      summary: input.summary,
      metrics: input.metrics,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    toast.success("Analytics report saved.");
  } catch (error) {
    handleFirestoreQueryError(error, "Could not save analytics report.");
    throw error;
  }
}

export async function deleteAnalyticsReport(
  reportId: string,
  ownerId: string
): Promise<void> {
  try {
    const db = requireDbClient();
    const normalizedReportId = assertRequiredId(reportId, "analytics report id while deleting analytics report");
    const normalizedOwnerId = assertRequiredId(ownerId, "PM user id while deleting analytics report");
    const ref = doc(db, "analytics_reports", normalizedReportId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    if (String(snap.data().ownerId ?? "") !== normalizedOwnerId) {
      throw new Error("You cannot delete this report.");
    }

    await deleteDoc(ref);
    toast.success("Analytics report deleted.");
  } catch (error) {
    handleFirestoreQueryError(error, "Could not delete analytics report.");
    throw error;
  }
}

type CreateJourneyMapInput = {
  ownerId: string;
  projectId: string | null;
  title: string;
  stages: string;
  painPoints: string;
  opportunities: string;
};

export async function getJourneyMapsByOwner(ownerId: string): Promise<JourneyMap[]> {
  try {
    const db = requireDbClient();
    const normalizedOwnerId = assertRequiredId(ownerId, "PM user id while loading journey maps");
    const ref = collection(db, "journey_maps");
    const q = query(ref, where("ownerId", "==", normalizedOwnerId));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        ownerId: String(data.ownerId ?? normalizedOwnerId),
        projectId: normalizeNullableProjectId(data.projectId),
        title: String(data.title ?? "Untitled journey map"),
        stages: String(data.stages ?? ""),
        painPoints: String(data.painPoints ?? ""),
        opportunities: String(data.opportunities ?? ""),
        createdAt: toMillis(data.createdAt),
        updatedAt: toMillis(data.updatedAt)
      } satisfies JourneyMap;
    });
  } catch (error) {
    handleFirestoreQueryError(error, "Could not load journey maps.");
    throw error;
  }
}

export async function createJourneyMap(input: CreateJourneyMapInput): Promise<void> {
  try {
    const db = requireDbClient();
    const normalizedOwnerId = assertRequiredId(input.ownerId, "PM user id while saving journey map");
    const projectId = await assertOwnedProjectId(input.projectId, normalizedOwnerId);
    const ref = collection(db, "journey_maps");
    await addDoc(ref, {
      ownerId: normalizedOwnerId,
      projectId,
      title: input.title,
      stages: input.stages,
      painPoints: input.painPoints,
      opportunities: input.opportunities,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    toast.success("Journey map saved.");
  } catch (error) {
    handleFirestoreQueryError(error, "Could not save journey map.");
    throw error;
  }
}

export async function deleteJourneyMap(mapId: string, ownerId: string): Promise<void> {
  try {
    const db = requireDbClient();
    const normalizedMapId = assertRequiredId(mapId, "journey map id while deleting journey map");
    const normalizedOwnerId = assertRequiredId(ownerId, "PM user id while deleting journey map");
    const ref = doc(db, "journey_maps", normalizedMapId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    if (String(snap.data().ownerId ?? "") !== normalizedOwnerId) {
      throw new Error("You cannot delete this journey map.");
    }

    await deleteDoc(ref);
    toast.success("Journey map deleted.");
  } catch (error) {
    handleFirestoreQueryError(error, "Could not delete journey map.");
    throw error;
  }
}

type CreateAbTestExperimentInput = {
  ownerId: string;
  projectId: string | null;
  title: string;
  hypothesis: string;
  variantA: string;
  variantB: string;
  successMetric: string;
  status?: "draft" | "running" | "completed";
};

export async function getAbTestExperimentsByOwner(
  ownerId: string
): Promise<AbTestExperiment[]> {
  try {
    const db = requireDbClient();
    const normalizedOwnerId = assertRequiredId(ownerId, "PM user id while loading A/B tests");
    const ref = collection(db, "ab_tests");
    const q = query(ref, where("ownerId", "==", normalizedOwnerId));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((item) => {
      const data = item.data();
      const status =
        data.status === "running" || data.status === "completed" ? data.status : "draft";

      return {
        id: item.id,
        ownerId: String(data.ownerId ?? normalizedOwnerId),
        projectId: normalizeNullableProjectId(data.projectId),
        title: String(data.title ?? "Untitled A/B test"),
        hypothesis: String(data.hypothesis ?? ""),
        variantA: String(data.variantA ?? ""),
        variantB: String(data.variantB ?? ""),
        successMetric: String(data.successMetric ?? ""),
        status,
        createdAt: toMillis(data.createdAt),
        updatedAt: toMillis(data.updatedAt)
      } satisfies AbTestExperiment;
    });
  } catch (error) {
    handleFirestoreQueryError(error, "Could not load A/B tests.");
    throw error;
  }
}

export async function createAbTestExperiment(
  input: CreateAbTestExperimentInput
): Promise<void> {
  try {
    const db = requireDbClient();
    const normalizedOwnerId = assertRequiredId(input.ownerId, "PM user id while saving A/B test");
    const projectId = await assertOwnedProjectId(input.projectId, normalizedOwnerId);
    const ref = collection(db, "ab_tests");
    await addDoc(ref, {
      ownerId: normalizedOwnerId,
      projectId,
      title: input.title,
      hypothesis: input.hypothesis,
      variantA: input.variantA,
      variantB: input.variantB,
      successMetric: input.successMetric,
      status: input.status ?? "draft",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    toast.success("A/B test saved.");
  } catch (error) {
    handleFirestoreQueryError(error, "Could not save A/B test.");
    throw error;
  }
}

export async function deleteAbTestExperiment(
  experimentId: string,
  ownerId: string
): Promise<void> {
  try {
    const db = requireDbClient();
    const normalizedExperimentId = assertRequiredId(experimentId, "A/B test id while deleting A/B test");
    const normalizedOwnerId = assertRequiredId(ownerId, "PM user id while deleting A/B test");
    const ref = doc(db, "ab_tests", normalizedExperimentId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    if (String(snap.data().ownerId ?? "") !== normalizedOwnerId) {
      throw new Error("You cannot delete this A/B test.");
    }

    await deleteDoc(ref);
    toast.success("A/B test deleted.");
  } catch (error) {
    handleFirestoreQueryError(error, "Could not delete A/B test.");
    throw error;
  }
}

async function getOwnedProjectArtifactIds(
  collectionName: string,
  ownerId: string,
  projectId: string
): Promise<string[]> {
  const db = requireDbClient();
  const ref = collection(db, collectionName);
  const q = query(ref, where("ownerId", "==", ownerId), where("projectId", "==", projectId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => item.id);
}

export async function deleteProjectCascade(
  projectId: string,
  ownerId: string
): Promise<void> {
  try {
    const db = requireDbClient();
    const normalizedProjectId = assertRequiredId(projectId, "project id while deleting project");
    const normalizedOwnerId = assertRequiredId(ownerId, "PM user id while deleting project");
    const projectRef = doc(db, "projects", normalizedProjectId);
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) return;

    if (String(projectSnap.data().ownerId ?? "") !== normalizedOwnerId) {
      throw new Error("You cannot delete this project.");
    }

    const studySnapshot = await getDocs(
      query(
        collection(db, "studies"),
        where("ownerId", "==", normalizedOwnerId),
        where("projectId", "==", normalizedProjectId)
      )
    );
    const studyIds = studySnapshot.docs.map((item) => item.id);

    const submissionIds: string[] = [];
    for (const batchStudyIds of chunkArray(studyIds, 10)) {
      const submissionSnapshot = await getDocs(
        query(collection(db, "submissions"), where("studyId", "in", batchStudyIds))
      );
      submissionIds.push(...submissionSnapshot.docs.map((item) => item.id));
    }

    const [prdIds, roadmapItemIds, analyticsIds, journeyIds, abTestIds, researchSessionIds] =
      await Promise.all([
        getOwnedProjectArtifactIds("prds", normalizedOwnerId, normalizedProjectId),
        getOwnedProjectArtifactIds("roadmap_items", normalizedOwnerId, normalizedProjectId),
        getOwnedProjectArtifactIds("analytics_reports", normalizedOwnerId, normalizedProjectId),
        getOwnedProjectArtifactIds("journey_maps", normalizedOwnerId, normalizedProjectId),
        getOwnedProjectArtifactIds("ab_tests", normalizedOwnerId, normalizedProjectId),
        getOwnedProjectArtifactIds("pm_research_sessions", normalizedOwnerId, normalizedProjectId)
      ]);

    await Promise.all([
      deleteDocumentIdsInBatches("studies", studyIds),
      deleteDocumentIdsInBatches("active_surveys", studyIds),
      deleteDocumentIdsInBatches("submissions", submissionIds),
      deleteDocumentIdsInBatches("prds", prdIds),
      deleteDocumentIdsInBatches("roadmap_items", roadmapItemIds),
      deleteDocumentIdsInBatches("analytics_reports", analyticsIds),
      deleteDocumentIdsInBatches("journey_maps", journeyIds),
      deleteDocumentIdsInBatches("ab_tests", abTestIds),
      deleteDocumentIdsInBatches("pm_research_sessions", researchSessionIds)
    ]);

    await deleteDoc(projectRef);
    toast.success("Project and all linked artifacts deleted.");
  } catch (error) {
    handleFirestoreQueryError(error, "Could not delete project.");
    throw error;
  }
}

