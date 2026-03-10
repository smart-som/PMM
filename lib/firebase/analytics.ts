import { getAnalytics, isSupported } from "firebase/analytics";

import { app } from "@/lib/firebase/client";

export async function initializeFirebaseAnalytics() {
  if (typeof window === "undefined") return null;

  const supported = await isSupported();
  if (!supported) return null;

  return getAnalytics(app);
}
