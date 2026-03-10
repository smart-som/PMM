import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";

import { firebaseConfig } from "@/lib/firebase/config";

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

function isPlaceholderValue(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    normalized.includes("your-") ||
    normalized.includes("replace-")
  );
}

function hasValidFirebaseClientConfig() {
  const required = [
    firebaseConfig.apiKey,
    firebaseConfig.authDomain,
    firebaseConfig.projectId,
    firebaseConfig.appId
  ];
  return required.every(
    (value) => typeof value === "string" && !isPlaceholderValue(value)
  );
}

export function isFirebaseClientAvailable() {
  if (typeof window === "undefined") return false;
  return hasValidFirebaseClientConfig();
}

function resolveFirebaseAppOrNull(): FirebaseApp | null {
  if (cachedApp !== undefined) return cachedApp;

  if (typeof window === "undefined") {
    cachedApp = null;
    return cachedApp;
  }

  if (!hasValidFirebaseClientConfig()) {
    warnFirebaseConfig(FIREBASE_CLIENT_CONFIG_ERROR_MESSAGE);
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

export function getFirebaseAuth() {
  if (cachedAuth !== undefined) return cachedAuth;

  const app = resolveFirebaseAppOrNull();
  if (!app) {
    cachedAuth = null;
    return cachedAuth;
  }

  try {
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
export const auth = createLazyFirebaseProxy<Auth>(getFirebaseAuth);
export const db = createLazyFirebaseProxy<Firestore>(getFirebaseDb);
