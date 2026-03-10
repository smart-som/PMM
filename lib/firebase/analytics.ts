import { getAnalytics, isSupported } from "firebase/analytics";

import { getFirebaseApp } from "@/lib/firebase/client";

export async function initializeFirebaseAnalytics() {
  if (typeof window === "undefined") return null;

  const supported = await isSupported();
  if (!supported) return null;

  const app = getFirebaseApp();
  if (!app) return null;

  return getAnalytics(app);
}
