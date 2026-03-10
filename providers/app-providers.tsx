"use client";

import { ReactNode, useEffect } from "react";
import { Toaster } from "sonner";

import { SessionProvider } from "@/contexts/session-context";
import { ThemeProvider, useTheme } from "@/contexts/theme-context";
import {
  getFirebaseClientDiagnostics,
  isFirebaseClientAvailable
} from "@/lib/firebase/client";
import { initializeFirebaseAnalytics } from "@/lib/firebase/analytics";
import { QueryProvider } from "@/providers/query-provider";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster richColors closeButton theme={resolvedTheme} />;
}

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_DEPLOY_DIAGNOSTICS === "1") {
      const diagnostics = getFirebaseClientDiagnostics();
      console.info(
        `[deploy:client] revision=${diagnostics.deploymentRevision} firebaseClientAvailable=${String(
          diagnostics.isAvailable
        )} missingKeys=${diagnostics.missingKeys.join(",") || "none"}`
      );
    }

    if (!isFirebaseClientAvailable()) return;
    void initializeFirebaseAnalytics();
  }, []);

  return (
    <ThemeProvider>
      <QueryProvider>
        <SessionProvider>
          {children}
          <ThemedToaster />
        </SessionProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
