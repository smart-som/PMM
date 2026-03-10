"use client";

import { ReactNode, useEffect } from "react";
import { Toaster } from "sonner";

import { SessionProvider } from "@/contexts/session-context";
import { ThemeProvider, useTheme } from "@/contexts/theme-context";
import { initializeFirebaseAnalytics } from "@/lib/firebase/analytics";
import { QueryProvider } from "@/providers/query-provider";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster richColors closeButton theme={resolvedTheme} />;
}

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
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
