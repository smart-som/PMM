import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "@/app/globals.css";
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

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
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
