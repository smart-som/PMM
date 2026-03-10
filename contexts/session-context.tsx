"use client";

import {
  GoogleAuthProvider,
  OAuthProvider,
  User,
  createUserWithEmailAndPassword,
  deleteUser,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
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
  auth,
  db,
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
      [FIREBASE_CLIENT_CONFIG_ERROR]: FIREBASE_CLIENT_CONFIG_ERROR_MESSAGE
    };

    if (customErrorMap[error.message] !== undefined) {
      return customErrorMap[error.message];
    }
  }

  if (error instanceof FirebaseError) {
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
    return map[error.code] ?? `Auth error: ${error.code}`;
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

  if (error instanceof FirebaseError) {
    if (error.code === "permission-denied") {
      return "Profile write denied by Firestore rules. Deploy latest firestore.rules.";
    }
    if (error.code === "failed-precondition") {
      return "Firestore is not fully configured in this Firebase project.";
    }
    return `Profile save failed: ${error.code}`;
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
    throw new Error("SESSION_SYNC_FAILED");
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

    void getRedirectResult(auth).catch((error) => {
      if (error instanceof FirebaseError && error.code === "auth/operation-not-allowed") {
        toast.error(
          "Social sign-in provider is not configured. Enable Google/Apple in Firebase Authentication."
        );
        return;
      }
      toast.error("Could not complete redirected sign-in.");
    });

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
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
          await signOut(auth);
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

    return () => unsubscribe();
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
            await signOut(auth);
            setSessionCookies(null);
            throw error;
          }
          toast.error(getAuthErrorMessage(error, "login"));
          throw error;
        }
      },
      loginWithGoogle: async (selectedRole) => {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });

        try {
          const credential = await signInWithPopup(auth, provider);
          const appUser = await resolveAppUser(credential.user, {
            selectedRole,
            providerId: provider.providerId
          });
          toast.success("Signed in with Google.");
          return appUser;
        } catch (error) {
          if (error instanceof FirebaseError && error.code === "auth/popup-blocked") {
            persistPendingSocialRole(selectedRole);
            await signInWithRedirect(auth, provider);
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
        const provider = new OAuthProvider("apple.com");
        provider.addScope("email");
        provider.addScope("name");

        try {
          const credential = await signInWithPopup(auth, provider);
          const appUser = await resolveAppUser(credential.user, {
            selectedRole,
            providerId: provider.providerId
          });
          toast.success("Signed in with Apple.");
          return appUser;
        } catch (error) {
          if (error instanceof FirebaseError && error.code === "auth/popup-blocked") {
            persistPendingSocialRole(selectedRole);
            await signInWithRedirect(auth, provider);
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
        let credential: Awaited<ReturnType<typeof createUserWithEmailAndPassword>> | null = null;
        try {
          credential = await createUserWithEmailAndPassword(auth, email, password);
          await setDoc(doc(db, "users", credential.user.uid), {
            email,
            role,
            displayName: credential.user.displayName ?? "",
            expertise: "",
            availability: "",
            authProviders: ["password"],
            createdAt: serverTimestamp()
          });
          toast.success("Account created.");
        } catch (error) {
          // Roll back partially-created auth user if profile write fails.
          if (
            credential?.user &&
            error instanceof FirebaseError &&
            !error.code.startsWith("auth/")
          ) {
            try {
              await deleteUser(credential.user);
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
          await signOut(auth);
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
