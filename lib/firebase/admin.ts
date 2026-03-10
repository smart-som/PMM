import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getPrivateKey() {
  const key = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  return key ? key.replace(/\\n/g, "\n") : undefined;
}

function ensureAdminApp() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY."
    );
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
}

export function getAdminDb() {
  const adminApp = ensureAdminApp();
  return getFirestore(adminApp);
}

export function getAdminAuth() {
  const adminApp = ensureAdminApp();
  return getAuth(adminApp);
}
