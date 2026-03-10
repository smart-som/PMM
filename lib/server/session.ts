export const SESSION_COOKIE_NAME = "pp_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  };
}
