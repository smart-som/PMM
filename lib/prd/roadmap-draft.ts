import { PrdRoadmapDraftPayload } from "@/types/app";

const ROADMAP_DRAFT_PREFIX = "prd-roadmap-draft:";

export function getPrdRoadmapDraftStorageKey(prdId: string) {
  return `${ROADMAP_DRAFT_PREFIX}${prdId}`;
}

export function buildRoadmapCanvasUrl(options: {
  draft?: "ai";
  prdId?: string | null;
  projectId?: string | null;
}) {
  const params = new URLSearchParams();
  if (options.projectId) {
    params.set("projectId", options.projectId);
  } else {
    params.set("mode", "solo");
  }
  if (options.prdId) {
    params.set("sourcePrdId", options.prdId);
  }
  if (options.draft) {
    params.set("draft", options.draft);
  }

  const query = params.toString();
  return query ? `/dashboard/pm/roadmap?${query}` : "/dashboard/pm/roadmap";
}

export function readStoredPrdRoadmapDraft(prdId: string) {
  if (typeof window === "undefined") return null;
  const rawPayload = window.sessionStorage.getItem(getPrdRoadmapDraftStorageKey(prdId));
  if (!rawPayload) return null;

  try {
    const parsed = JSON.parse(rawPayload) as PrdRoadmapDraftPayload;
    return parsed && Array.isArray(parsed.deliverables) ? parsed : null;
  } catch {
    return null;
  }
}

export function storePrdRoadmapDraft(payload: PrdRoadmapDraftPayload) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    getPrdRoadmapDraftStorageKey(payload.prdId),
    JSON.stringify(payload)
  );
}

export function clearStoredPrdRoadmapDraft(prdId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(getPrdRoadmapDraftStorageKey(prdId));
}
