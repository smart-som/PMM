import { NextResponse } from "next/server";

import { getAdminAuth } from "@/lib/firebase/admin";
import {
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS
} from "@/lib/server/session";

type SessionRequestBody = {
  idToken?: string;
};

type SessionErrorCode =
  | "SESSION_ID_TOKEN_MISSING"
  | "SESSION_REQUEST_INVALID"
  | "SESSION_ADMIN_CONFIG_MISSING"
  | "SESSION_ID_TOKEN_INVALID"
  | "SESSION_COOKIE_CREATE_FAILED";

function getDeploymentRevision() {
  return (
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_APP_COMMIT_SHA ??
    "unknown"
  );
}

function getFirebaseAdminErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  if (!("code" in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function isAdminConfigError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("Missing Firebase Admin credentials")
  );
}

function isInvalidSessionTokenError(error: unknown) {
  const code = getFirebaseAdminErrorCode(error);
  return (
    code === "auth/argument-error" ||
    code === "auth/id-token-expired" ||
    code === "auth/id-token-revoked" ||
    code === "auth/invalid-id-token"
  );
}

function logSessionFailure(code: SessionErrorCode) {
  console.error(`[session] code=${code} revision=${getDeploymentRevision()}`);
}

function sessionErrorResponse(
  status: number,
  code: SessionErrorCode,
  error: string
) {
  logSessionFailure(code);
  return NextResponse.json({ error, code }, { status });
}

export async function POST(request: Request) {
  try {
    let body: SessionRequestBody;
    try {
      body = (await request.json()) as SessionRequestBody;
    } catch {
      return sessionErrorResponse(
        400,
        "SESSION_REQUEST_INVALID",
        "Invalid session request payload."
      );
    }
    const idToken = body.idToken?.trim();

    if (!idToken) {
      return sessionErrorResponse(400, "SESSION_ID_TOKEN_MISSING", "Missing id token.");
    }

    let sessionCookie: string;
    try {
      const adminAuth = getAdminAuth();
      sessionCookie = await adminAuth.createSessionCookie(idToken, {
        expiresIn: SESSION_MAX_AGE_SECONDS * 1000
      });
    } catch (error) {
      if (isAdminConfigError(error)) {
        return sessionErrorResponse(
          500,
          "SESSION_ADMIN_CONFIG_MISSING",
          "Server auth config missing. Set FIREBASE_ADMIN_* in deployment."
        );
      }

      if (isInvalidSessionTokenError(error)) {
        return sessionErrorResponse(
          401,
          "SESSION_ID_TOKEN_INVALID",
          "Session token is invalid or expired."
        );
      }

      return sessionErrorResponse(
        401,
        "SESSION_COOKIE_CREATE_FAILED",
        "Could not create session cookie."
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, getSessionCookieOptions());
    return response;
  } catch {
    return sessionErrorResponse(
      401,
      "SESSION_COOKIE_CREATE_FAILED",
      "Could not create session cookie."
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(),
    maxAge: 0
  });
  return response;
}
