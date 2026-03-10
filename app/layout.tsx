import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "@/app/globals.css";
import { getMissingFirebasePublicEnvKeys } from "@/lib/firebase/config";
import { AppProviders } from "@/providers/app-providers";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans"
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono"
});

const THEME_BOOTSTRAP_SCRIPT = `
(() => {
  try {
    const key = "orbitplus-theme";
    const stored = localStorage.getItem(key);
    const mode = stored === "light" || stored === "dark" || stored === "system" ? stored : "dark";
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldUseDark = mode === "dark" || (mode === "system" && prefersDark);
    document.documentElement.classList.toggle("dark", shouldUseDark);
    document.documentElement.style.colorScheme = shouldUseDark ? "dark" : "light";
  } catch (error) {
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
  }
})();
`;

export const metadata: Metadata = {
  title: "OrbitPlus",
  description: "All-in-one PM platform for discovery, research, and PRD delivery"
};

let hasLoggedDeploymentDiagnostics = false;

function logDeploymentDiagnostics() {
  if (hasLoggedDeploymentDiagnostics) return;
  hasLoggedDeploymentDiagnostics = true;

  const revision =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    "unknown";
  const missingFirebaseKeys = getMissingFirebasePublicEnvKeys();

  if (missingFirebaseKeys.length) {
    console.warn(
      `[deploy] revision=${revision} missing Firebase public env keys: ${missingFirebaseKeys.join(", ")}`
    );
    return;
  }

  console.info(
    `[deploy] revision=${revision} Firebase public env keys are present.`
  );
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  logDeploymentDiagnostics();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable}`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
