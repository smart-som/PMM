import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";

import {
  firebaseConfig,
  getMissingFirebasePublicEnvKeys
} from "@/lib/firebase/config";

export const FIREBASE_CLIENT_CONFIG_ERROR = "FIREBASE_CLIENT_CONFIG_MISSING";
export const FIREBASE_CLIENT_CONFIG_ERROR_MESSAGE =
  "Firebase client config missing/invalid. Set NEXT_PUBLIC_FIREBASE_* in deployment settings.";

let hasWarnedConfig = false;
let cachedApp: FirebaseApp | null | undefined;
let cachedAuth: Auth | null | undefined;
let cachedDb: Firestore | null | undefined;

function warnFirebaseConfig(message: string) {
  if (hasWarnedConfig) return;
  hasWarnedConfig = true;
  console.warn(`[firebase] ${message}`);
}

function hasValidFirebaseClientConfig() {
  return getMissingFirebasePublicEnvKeys().length === 0;
}

export function isFirebaseClientAvailable() {
  if (typeof window === "undefined") return false;
  return hasValidFirebaseClientConfig();
}

function getClientDeploymentRevision() {
  return (
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_APP_COMMIT_SHA ??
    "unknown"
  );
}

export function getFirebaseClientDiagnostics() {
  const missingKeys = getMissingFirebasePublicEnvKeys();
  return {
    deploymentRevision: getClientDeploymentRevision(),
    missingKeys,
    isAvailable: typeof window !== "undefined" && missingKeys.length === 0
  };
}

function resolveFirebaseAppOrNull(): FirebaseApp | null {
  if (cachedApp !== undefined) return cachedApp;

  if (typeof window === "undefined") {
    cachedApp = null;
    return cachedApp;
  }

  if (!hasValidFirebaseClientConfig()) {
    const diagnostics = getFirebaseClientDiagnostics();
    warnFirebaseConfig(
      `${FIREBASE_CLIENT_CONFIG_ERROR_MESSAGE} Missing keys: ${diagnostics.missingKeys.join(
        ", "
      ) || "none"}. Revision: ${diagnostics.deploymentRevision}.`
    );
    cachedApp = null;
    return cachedApp;
  }

  try {
    cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
    return cachedApp;
  } catch (error) {
    warnFirebaseConfig(
      `${FIREBASE_CLIENT_CONFIG_ERROR_MESSAGE} (${String(
        error instanceof Error ? error.message : error
      )})`
    );
    cachedApp = null;
    return cachedApp;
  }
}

export function getFirebaseApp() {
  return resolveFirebaseAppOrNull();
}

export async function getFirebaseAuth() {
  if (cachedAuth !== undefined) return cachedAuth;

  const app = resolveFirebaseAppOrNull();
  if (!app) {
    cachedAuth = null;
    return cachedAuth;
  }

  try {
    const { getAuth } = await import("firebase/auth");
    cachedAuth = getAuth(app);
    return cachedAuth;
  } catch (error) {
    warnFirebaseConfig(
      `${FIREBASE_CLIENT_CONFIG_ERROR_MESSAGE} (${String(
        error instanceof Error ? error.message : error
      )})`
    );
    cachedAuth = null;
    return cachedAuth;
  }
}

export function getFirebaseDb() {
  if (cachedDb !== undefined) return cachedDb;

  const app = resolveFirebaseAppOrNull();
  if (!app) {
    cachedDb = null;
    return cachedDb;
  }

  try {
    cachedDb = getFirestore(app);
    return cachedDb;
  } catch (error) {
    warnFirebaseConfig(
      `${FIREBASE_CLIENT_CONFIG_ERROR_MESSAGE} (${String(
        error instanceof Error ? error.message : error
      )})`
    );
    cachedDb = null;
    return cachedDb;
  }
}

function createLazyFirebaseProxy<T extends object>(resolver: () => T | null): T {
  return new Proxy({} as T, {
    get(_, property) {
      const instance = resolver();
      if (!instance) throw new Error(FIREBASE_CLIENT_CONFIG_ERROR);
      const value = Reflect.get(instance as unknown as object, property);
      if (typeof value === "function") {
        return value.bind(instance);
      }
      return value;
    }
  });
}

export const app = createLazyFirebaseProxy<FirebaseApp>(getFirebaseApp);
export const db = createLazyFirebaseProxy<Firestore>(getFirebaseDb);
