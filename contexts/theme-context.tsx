"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
};

const STORAGE_KEY = "orbitplus-theme";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function resolveTheme(mode: ThemeMode) {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

function applyThemeClass(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const initialMode: ThemeMode =
      stored === "light" || stored === "dark" || stored === "system" ? stored : "dark";
    setModeState(initialMode);
    const initialResolvedTheme = resolveTheme(initialMode);
    setResolvedTheme(initialResolvedTheme);
    applyThemeClass(initialResolvedTheme);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => {
      const nextResolvedTheme = resolveTheme(mode);
      setResolvedTheme(nextResolvedTheme);
      applyThemeClass(nextResolvedTheme);
    };

    syncTheme();
    mediaQuery.addEventListener("change", syncTheme);
    return () => {
      mediaQuery.removeEventListener("change", syncTheme);
    };
  }, [mode]);

  const setMode = (nextMode: ThemeMode) => {
    setModeState(nextMode);
    window.localStorage.setItem(STORAGE_KEY, nextMode);
  };

  const value = useMemo(
    () => ({
      mode,
      resolvedTheme,
      setMode
    }),
    [mode, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
