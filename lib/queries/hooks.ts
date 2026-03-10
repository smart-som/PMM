"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getPublishedActiveSurveys,
  getProjectsByOwner,
  getStudiesByOwner
} from "@/lib/queries/firestore";
import { UserRole } from "@/types/app";

export function useRoleData(uid: string | null, role: UserRole | null) {
  const projectsQuery = useQuery({
    queryKey: ["projects", uid],
    queryFn: () => getProjectsByOwner(uid as string),
    enabled: Boolean(uid && role === "pm")
  });

  const studiesQuery = useQuery({
    queryKey: ["studies", uid],
    queryFn: () => getPublishedActiveSurveys(),
    enabled: Boolean(uid && role === "helper")
  });

  const pmStudiesQuery = useQuery({
    queryKey: ["pm-studies", uid],
    queryFn: () => getStudiesByOwner(uid as string),
    enabled: Boolean(uid && role === "pm")
  });

  return { projectsQuery, studiesQuery, pmStudiesQuery };
}
