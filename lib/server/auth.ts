import { cookies } from "next/headers";

import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { UserRole } from "@/types/app";
import { SESSION_COOKIE_NAME } from "@/lib/server/session";

type ServerUser = {
  uid: string;
  email: string | null;
  role: UserRole;
};

async function getServerUser(): Promise<ServerUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const userRef = getAdminDb().collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return null;

    const role = userSnap.data()?.role;
    if (role !== "pm" && role !== "helper") return null;

    return {
      uid: decoded.uid,
      email: typeof userSnap.data()?.email === "string" ? userSnap.data()?.email : null,
      role
    };
  } catch {
    return null;
  }
}

export async function requirePmServerUser() {
  const user = await getServerUser();
  if (!user || user.role !== "pm") {
    throw new Error("Unauthorized request.");
  }
  return user;
}
