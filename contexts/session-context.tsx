"use client";

import type { User } from "firebase/auth";
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { toast } from "sonner";

import {
  FIREBASE_CLIENT_CONFIG_ERROR,
  FIREBASE_CLIENT_CONFIG_ERROR_MESSAGE,
  getFirebaseAuth,
  getFirebaseDb,
  isFirebaseClientAvailable
} from "@/lib/firebase/client";
import {
  loginAndResolveRole,
  resolveOrCreateUserProfile
} from "@/lib/firebase/auth";
import { AppUser, UserRole } from "@/types/app";

type SessionContextValue = {
  user: AppUser | null;
  firebaseUser: User | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
    options?: { entryContext?: "pm" | "helper" | "general" }
  ) => Promise<AppUser>;
  loginWithGoogle: (selectedRole?: UserRole) => Promise<AppUser | null>;
  loginWithApple: (selectedRole?: UserRole) => Promise<AppUser | null>;
  signup: (email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);
const PENDING_SOCIAL_ROLE_KEY = "pending_social_role";
type SessionApiErrorCode =
  | "SESSION_ID_TOKEN_MISSING"
  | "SESSION_REQUEST_INVALID"
  | "SESSION_ADMIN_CONFIG_MISSING"
  | "SESSION_ID_TOKEN_INVALID"
  | "SESSION_COOKIE_CREATE_FAILED"
  | "SESSION_SYNC_FAILED";

function getFirebaseErrorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return null;
}

function getAuthErrorMessage(
  error: unknown,
  mode: "login" | "signup" | "logout" | "google" | "apple"
) {
  if (error instanceof Error) {
    const customErrorMap: Record<string, string> = {
      REDIRECT_IN_PROGRESS: "",
      ROLE_SELECTION_REQUIRED: "Select PM or Helper before continuing.",
      SOCIAL_ACCOUNT_ROLE_MISMATCH:
        "This account is already linked to a different portal role.",
      UNAUTHORIZED_PORTAL_ROLE: "Unauthorized for this portal selection.",
      SESSION_ADMIN_CONFIG_MISSING:
        "Server auth config missing. Set FIREBASE_ADMIN_* in deployment.",
      SESSION_ID_TOKEN_INVALID: "Session token is invalid or expired. Please sign in again.",
      SESSION_COOKIE_CREATE_FAILED: "Could not create server session. Please try again.",
      SESSION_REQUEST_INVALID: "Session request payload was invalid. Please try again.",
      SESSION_ID_TOKEN_MISSING: "Session token is missing. Please sign in again.",
      SESSION_SYNC_FAILED: "Could not sync server session. Please try again.",
      [FIREBASE_CLIENT_CONFIG_ERROR]: FIREBASE_CLIENT_CONFIG_ERROR_MESSAGE
    };

    if (customErrorMap[error.message] !== undefined) {
      return customErrorMap[error.message];
    }
  }

  const firebaseErrorCode = getFirebaseErrorCode(error);
  if (firebaseErrorCode) {
    const map: Record<string, string> = {
      "auth/invalid-api-key": "Firebase API key is invalid. Check NEXT_PUBLIC_FIREBASE_API_KEY.",
      "auth/email-already-in-use":
        "An account with this email already exists. Please log in instead.",
      "auth/invalid-email": "Email format is invalid.",
      "auth/weak-password": "Password is too weak. Use at least 6 characters.",
      "auth/operation-not-allowed":
        mode === "apple"
          ? "Apple sign-in is not configured yet. Enable Apple in Firebase Auth and add Apple keys in Apple Developer."
          : mode === "google"
            ? "Google sign-in is not enabled. Enable Google provider in Firebase Authentication."
            : "Email/password auth is disabled in Firebase Console. Enable it in Authentication > Sign-in method.",
      "auth/popup-blocked":
        "Popup was blocked by the browser. Switching to redirect sign-in.",
      "auth/popup-closed-by-user": "The sign-in popup was closed before completion.",
      "auth/account-exists-with-different-credential":
        "An account with this email already exists. Please log in with your existing sign-in method.",
      "auth/network-request-failed": "Network error. Please check your connection.",
      "auth/unauthorized-domain":
        "Current domain is not authorized in Firebase Authentication settings."
    };
    return map[firebaseErrorCode] ?? `Auth error: ${firebaseErrorCode}`;
  }

  if (mode === "login") return "Sign in failed.";
  if (mode === "signup") return "Sign up failed.";
  if (mode === "google" || mode === "apple") return "Social sign-in failed.";
  return "Sign out failed.";
}

function getFirestoreProfileErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === FIREBASE_CLIENT_CONFIG_ERROR) {
    return FIREBASE_CLIENT_CONFIG_ERROR_MESSAGE;
  }

  const firebaseErrorCode = getFirebaseErrorCode(error);
  if (firebaseErrorCode) {
    if (firebaseErrorCode === "permission-denied") {
      return "Profile write denied by Firestore rules. Deploy latest firestore.rules.";
    }
    if (firebaseErrorCode === "failed-precondition") {
      return "Firestore is not fully configured in this Firebase project.";
    }
    return `Profile save failed: ${firebaseErrorCode}`;
  }
  return "Could not save user profile.";
}

function setSessionCookies(user: AppUser | null) {
  if (typeof document === "undefined") return;

  const maxAge = 60 * 60 * 24 * 7;
  if (!user) {
    document.cookie = "app_role=; path=/; Max-Age=0; SameSite=Lax";
    document.cookie = "app_uid=; path=/; Max-Age=0; SameSite=Lax";
    return;
  }

  document.cookie = `app_role=${user.role}; path=/; Max-Age=${maxAge}; SameSite=Lax`;
  document.cookie = `app_uid=${user.uid}; path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

function persistPendingSocialRole(role?: UserRole) {
  if (typeof window === "undefined" || !role) return;
  sessionStorage.setItem(PENDING_SOCIAL_ROLE_KEY, role);
}

function consumePendingSocialRole(): UserRole | undefined {
  if (typeof window === "undefined") return undefined;
  const pendingRole = sessionStorage.getItem(PENDING_SOCIAL_ROLE_KEY);
  if (pendingRole !== "pm" && pendingRole !== "helper") return undefined;
  sessionStorage.removeItem(PENDING_SOCIAL_ROLE_KEY);
  return pendingRole;
}

function inferRoleFromLocation(): UserRole | undefined {
  if (typeof window === "undefined") return undefined;

  const params = new URLSearchParams(window.location.search);
  const queryRole = params.get("role");
  if (queryRole === "pm" || queryRole === "helper") {
    return queryRole;
  }

  const pathname = window.location.pathname;
  if (pathname.startsWith("/helpers")) return "helper";
  if (pathname.startsWith("/login/pm")) return "pm";

  return undefined;
}

async function syncServerSession(user: User | null) {
  if (!user) {
    await fetch("/api/session", { method: "DELETE" });
    return;
  }

  const idToken = await user.getIdToken();
  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken })
  });

  if (!response.ok) {
    let responseCode: string | undefined;
    try {
      const payload = (await response.json()) as {
        code?: string;
      };
      responseCode = payload?.code;
    } catch {
      responseCode = undefined;
    }

    const code = responseCode as SessionApiErrorCode | undefined;
    throw new Error(code ?? "SESSION_SYNC_FAILED");
  }
}

function enforceEntryContextRole(
  appUser: AppUser,
  entryContext: "pm" | "helper" | "general"
) {
  if (entryContext === "general") return;
  if (entryContext === appUser.role) return;
  throw new Error("UNAUTHORIZED_PORTAL_ROLE");
}

async function resolveAppUser(
  firebaseUser: User,
  options?: { selectedRole?: UserRole; providerId?: string | null }
): Promise<AppUser> {
  try {
    return await resolveOrCreateUserProfile(firebaseUser, options);
  } catch (error) {
    throw error;
  }
}

async function requireAuthClient() {
  const auth = await getFirebaseAuth();
  if (!auth) {
    throw new Error(FIREBASE_CLIENT_CONFIG_ERROR);
  }
  return auth;
}

function requireDbClient() {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error(FIREBASE_CLIENT_CONFIG_ERROR);
  }
  return db;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseClientAvailable()) {
      toast.error(FIREBASE_CLIENT_CONFIG_ERROR_MESSAGE);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const auth = await requireAuthClient();
      const authModule = await import("firebase/auth");

      void authModule.getRedirectResult(auth).catch((error) => {
        if (getFirebaseErrorCode(error) === "auth/operation-not-allowed") {
          toast.error(
            "Social sign-in provider is not configured. Enable Google/Apple in Firebase Authentication."
          );
          return;
        }
        toast.error("Could not complete redirected sign-in.");
      });

      unsubscribe = authModule.onAuthStateChanged(auth, async (nextUser) => {
        if (cancelled) return;

        setLoading(true);
        setFirebaseUser(nextUser);

        if (!nextUser) {
          setUser(null);
          setSessionCookies(null);
          try {
            await syncServerSession(null);
          } catch {
            // Best effort cleanup only.
          }
          setLoading(false);
          return;
        }

        try {
          const pendingRole = consumePendingSocialRole() ?? inferRoleFromLocation();
          const providerId = nextUser.providerData[0]?.providerId ?? null;
          const appUser = await resolveAppUser(nextUser, {
            selectedRole: pendingRole,
            providerId
          });

          setUser(appUser);
          setSessionCookies(appUser);
          await syncServerSession(nextUser);
        } catch (error) {
          const message = getAuthErrorMessage(error, "login");
          if (message) {
            toast.error(message);
          }
          setUser(null);
          setSessionCookies(null);
          try {
            await authModule.signOut(auth);
          } catch {
            // Best effort cleanup only.
          }
          try {
            await syncServerSession(null);
          } catch {
            // Best effort cleanup only.
          }
        } finally {
          setLoading(false);
        }
      });
    })().catch((error) => {
      const message = getAuthErrorMessage(error, "login");
      if (message) {
        toast.error(message);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      firebaseUser,
      loading,
      login: async (email, password, options) => {
        const entryContext = options?.entryContext ?? "general";

        try {
          const appUser = await loginAndResolveRole(email, password);
          enforceEntryContextRole(appUser, entryContext);
          toast.success("Signed in.");
          return appUser;
        } catch (error) {
          if (error instanceof Error && error.message === "UNAUTHORIZED_PORTAL_ROLE") {
            const message =
              entryContext === "pm"
                ? "Unauthorized. Please use the Helper Portal."
                : "Unauthorized. Please use the PM Portal.";
            toast.error(message);
            const auth = await getFirebaseAuth();
            if (auth) {
              const authModule = await import("firebase/auth");
              await authModule.signOut(auth);
            }
            setSessionCookies(null);
            throw error;
          }
          toast.error(getAuthErrorMessage(error, "login"));
          throw error;
        }
      },
      loginWithGoogle: async (selectedRole) => {
        const auth = await requireAuthClient();
        const authModule = await import("firebase/auth");
        const provider = new authModule.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });

        try {
          const credential = await authModule.signInWithPopup(auth, provider);
          const appUser = await resolveAppUser(credential.user, {
            selectedRole,
            providerId: provider.providerId
          });
          toast.success("Signed in with Google.");
          return appUser;
        } catch (error) {
          const errorCode = getFirebaseErrorCode(error);
          if (errorCode === "auth/popup-blocked" || errorCode === "auth/popup-closed-by-user") {
            persistPendingSocialRole(selectedRole);
            await authModule.signInWithRedirect(auth, provider);
            throw new Error("REDIRECT_IN_PROGRESS");
          }
          const message = getAuthErrorMessage(error, "google");
          if (message) {
            toast.error(message);
          }
          throw error;
        }
      },
      loginWithApple: async (selectedRole) => {
        const auth = await requireAuthClient();
        const authModule = await import("firebase/auth");
        const provider = new authModule.OAuthProvider("apple.com");
        provider.addScope("email");
        provider.addScope("name");

        try {
          const credential = await authModule.signInWithPopup(auth, provider);
          const appUser = await resolveAppUser(credential.user, {
            selectedRole,
            providerId: provider.providerId
          });
          toast.success("Signed in with Apple.");
          return appUser;
        } catch (error) {
          if (getFirebaseErrorCode(error) === "auth/popup-blocked") {
            persistPendingSocialRole(selectedRole);
            await authModule.signInWithRedirect(auth, provider);
            throw new Error("REDIRECT_IN_PROGRESS");
          }
          const message = getAuthErrorMessage(error, "apple");
          if (message) {
            toast.error(message);
          }
          throw error;
        }
      },
      signup: async (email, password, role) => {
        const auth = await requireAuthClient();
        const db = requireDbClient();
        const authModule = await import("firebase/auth");
        const firestoreModule = await import("firebase/firestore");
        let credential: Awaited<ReturnType<typeof authModule.createUserWithEmailAndPassword>> | null = null;
        try {
          credential = await authModule.createUserWithEmailAndPassword(auth, email, password);
          await firestoreModule.setDoc(firestoreModule.doc(db, "users", credential.user.uid), {
            email,
            role,
            displayName: credential.user.displayName ?? "",
            expertise: "",
            availability: "",
            authProviders: ["password"],
            createdAt: firestoreModule.serverTimestamp()
          });
          toast.success("Account created.");
        } catch (error) {
          const firebaseErrorCode = getFirebaseErrorCode(error);
          // Roll back partially-created auth user if profile write fails.
          if (credential?.user && firebaseErrorCode && !firebaseErrorCode.startsWith("auth/")) {
            try {
              await authModule.deleteUser(credential.user);
            } catch {
              // Best effort rollback only.
            }
            toast.error(getFirestoreProfileErrorMessage(error));
          } else {
            toast.error(getAuthErrorMessage(error, "signup"));
          }
          throw error;
        }
      },
      logout: async () => {
        try {
          if (typeof window !== "undefined") {
            sessionStorage.removeItem(PENDING_SOCIAL_ROLE_KEY);
          }
          const auth = await getFirebaseAuth();
          if (auth) {
            const authModule = await import("firebase/auth");
            await authModule.signOut(auth);
          }
          setSessionCookies(null);
          await syncServerSession(null);
          toast.success("Signed out.");
          if (typeof window !== "undefined") {
            window.location.assign("/");
          }
        } catch (error) {
          toast.error(getAuthErrorMessage(error, "logout"));
          throw error;
        }
      }
    }),
    [firebaseUser, loading, user]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used inside SessionProvider.");
  }
  return context;
}
