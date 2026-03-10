"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { Apple, Chrome } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/contexts/session-context";
import { UserRole } from "@/types/app";

function routeForRole(role: UserRole) {
  return role === "pm" ? "/dashboard/pm" : "/portal/helper";
}

function getAuthErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  if (!("code" in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function isExistingAccountSignupError(error: unknown) {
  const code = getAuthErrorCode(error);
  return (
    code === "auth/email-already-in-use" ||
    code === "auth/account-exists-with-different-credential"
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, login, loginWithApple, loginWithGoogle, signup } = useSession();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const roleParam = searchParams.get("role");
  const role: UserRole = roleParam === "helper" ? "helper" : "pm";
  const roleLabel = role === "pm" ? "PM" : "Helper";
  const homeHref = role === "pm" ? "/" : "/helpers";

  function switchToRoleLoginMode() {
    setMode("login");
    router.replace(`/login?mode=login&role=${role}`);
  }

  useEffect(() => {
    const queryMode = searchParams.get("mode");
    if (queryMode === "signup") {
      setMode("signup");
    }
    if (queryMode === "login") {
      setMode("login");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!loading && user) {
      router.replace(routeForRole(user.role));
    }
  }, [loading, router, user]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      if (mode === "login") {
        await login(email, password, { entryContext: role });
      } else {
        await signup(email, password, role);
      }
    } catch (error) {
      if (mode === "signup" && isExistingAccountSignupError(error)) {
        switchToRoleLoginMode();
      }
      // Toasts are handled in session context.
    } finally {
      setSubmitting(false);
    }
  }

  async function onSocialLogin(provider: "google" | "apple") {
    setSubmitting(true);

    try {
      if (provider === "google") {
        const appUser = await loginWithGoogle(role);
        if (appUser) {
          router.replace(routeForRole(appUser.role));
        }
      } else {
        const appUser = await loginWithApple(role);
        if (appUser) {
          router.replace(routeForRole(appUser.role));
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message === "REDIRECT_IN_PROGRESS") {
        return;
      }
      if (mode === "signup" && isExistingAccountSignupError(error)) {
        switchToRoleLoginMode();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-6">
      <Card className="w-full max-w-lg border-accent/25 shadow-[0_20px_50px_hsl(var(--accent)/0.18)]">
        <CardHeader>
          <CardTitle>{roleLabel} Portal Access</CardTitle>
          <CardDescription>
            Continue with email, Google, or Apple for your {roleLabel} account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={mode === "login" ? "default" : "outline"}
              onClick={() => setMode("login")}
            >
              Login
            </Button>
            <Button
              type="button"
              variant={mode === "signup" ? "default" : "outline"}
              onClick={() => setMode("signup")}
            >
              Sign Up
            </Button>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              disabled={submitting || loading}
              onClick={() => void onSocialLogin("google")}
              className="w-full"
            >
              <Chrome className="mr-2 size-4" />
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={submitting || loading}
              onClick={() => void onSocialLogin("apple")}
              className="w-full"
            >
              <Apple className="mr-2 size-4" />
              Continue with Apple
            </Button>
          </div>

          <div className="my-4 border-t border-border" />

          <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <Button className="w-full" type="submit" disabled={submitting || loading}>
              {submitting ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Back to <Link href={homeHref}>home</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center p-6">Loading...</main>}>
      <LoginPageContent />
    </Suspense>
  );
}


