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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SessionRequestBody;
    const idToken = body.idToken?.trim();

    if (!idToken) {
      return NextResponse.json({ error: "Missing id token." }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_SECONDS * 1000
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, getSessionCookieOptions());
    return response;
  } catch {
    return NextResponse.json({ error: "Could not create session cookie." }, { status: 401 });
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
