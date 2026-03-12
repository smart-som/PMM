"use client";

import { useEffect } from "react";

const MARKETING_SCROLL_CLASS = "orbitplus-marketing-scroll";

export function MarketingSmoothScroll() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(MARKETING_SCROLL_CLASS);

    return () => {
      root.classList.remove(MARKETING_SCROLL_CLASS);
    };
  }, []);

  return null;
}
