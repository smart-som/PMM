import type { User } from "firebase/auth";
import { arrayUnion, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import {
  FIREBASE_CLIENT_CONFIG_ERROR,
  getFirebaseAuth,
  getFirebaseDb
} from "@/lib/firebase/client";
import { AppUser, UserRole } from "@/types/app";

function requireFirebaseDb() {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error(FIREBASE_CLIENT_CONFIG_ERROR);
  }
  return db;
}

export async function resolveUserProfile(uid: string, email: string | null): Promise<AppUser> {
  const db = requireFirebaseDb();
  const profileRef = doc(db, "users", uid);
  const profileSnap = await getDoc(profileRef);

  if (!profileSnap.exists()) {
    throw new Error("USER_PROFILE_NOT_FOUND");
  }

  const role = profileSnap.data()?.role as UserRole | undefined;
  if (role !== "pm" && role !== "helper") {
    throw new Error("USER_ROLE_INVALID");
  }

  return {
    uid,
    email,
    role,
    displayName:
      typeof profileSnap.data()?.displayName === "string"
        ? profileSnap.data()?.displayName
        : undefined
  };
}

export async function loginAndResolveRole(
  email: string,
  password: string
): Promise<AppUser> {
  const auth = await getFirebaseAuth();
  if (!auth) {
    throw new Error(FIREBASE_CLIENT_CONFIG_ERROR);
  }

  const { signInWithEmailAndPassword } = await import("firebase/auth");
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return resolveUserProfile(credential.user.uid, credential.user.email);
}

type ResolveOrCreateUserProfileOptions = {
  selectedRole?: UserRole;
  providerId?: string | null;
};

function normalizedProvider(providerId: string | null | undefined) {
  if (!providerId) return null;
  return providerId;
}

export async function resolveOrCreateUserProfile(
  firebaseUser: User,
  options?: ResolveOrCreateUserProfileOptions
): Promise<AppUser> {
  const db = requireFirebaseDb();
  const profileRef = doc(db, "users", firebaseUser.uid);
  const profileSnap = await getDoc(profileRef);
  const providerId = normalizedProvider(options?.providerId ?? null);

  if (!profileSnap.exists()) {
    if (!options?.selectedRole) {
      throw new Error("ROLE_SELECTION_REQUIRED");
    }

    await setDoc(profileRef, {
      email: firebaseUser.email,
      role: options.selectedRole,
      displayName: firebaseUser.displayName ?? "",
      expertise: "",
      availability: "",
      createdAt: serverTimestamp(),
      authProviders: providerId ? [providerId] : []
    });

    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      role: options.selectedRole,
      displayName: firebaseUser.displayName ?? undefined
    };
  }

  const role = profileSnap.data()?.role as UserRole | undefined;
  if (role !== "pm" && role !== "helper") {
    throw new Error("USER_ROLE_INVALID");
  }

  if (options?.selectedRole && role !== options.selectedRole) {
    throw new Error("SOCIAL_ACCOUNT_ROLE_MISMATCH");
  }

  const nextProfileUpdates: Record<string, unknown> = {};
  if (providerId) {
    nextProfileUpdates.authProviders = arrayUnion(providerId);
  }
  if (
    !profileSnap.data()?.displayName &&
    typeof firebaseUser.displayName === "string" &&
    firebaseUser.displayName.trim()
  ) {
    nextProfileUpdates.displayName = firebaseUser.displayName.trim();
  }
  if (firebaseUser.email && !profileSnap.data()?.email) {
    nextProfileUpdates.email = firebaseUser.email;
  }

  if (Object.keys(nextProfileUpdates).length) {
    await setDoc(profileRef, nextProfileUpdates, { merge: true });
  }

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    role,
    displayName:
      typeof profileSnap.data()?.displayName === "string"
        ? profileSnap.data()?.displayName
        : firebaseUser.displayName ?? undefined
  };
}
