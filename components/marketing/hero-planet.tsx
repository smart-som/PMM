"use client";

import { CSSProperties, useRef } from "react";

import { cn } from "@/lib/utils";

const STAR_FIELD = [
  { top: "12%", left: "14%", size: "2px", delay: "0.1s", duration: "2.9s" },
  { top: "22%", left: "72%", size: "1px", delay: "0.5s", duration: "3.8s" },
  { top: "78%", left: "9%", size: "2px", delay: "0.2s", duration: "3.1s" },
  { top: "37%", left: "43%", size: "1px", delay: "0.7s", duration: "3.3s" },
  { top: "16%", left: "47%", size: "2px", delay: "1.2s", duration: "2.5s" },
  { top: "66%", left: "25%", size: "2px", delay: "1.4s", duration: "2.8s" },
  { top: "45%", left: "90%", size: "1px", delay: "0.8s", duration: "3.4s" }
];

export function HeroPlanet({ className }: { className?: string }) {
  const sceneRef = useRef<HTMLDivElement>(null);

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const node = sceneRef.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    node.style.transform = `perspective(1400px) rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(
      x * 5
    ).toFixed(2)}deg)`;
    node.style.setProperty("--hero-glow-x", `${50 + x * 18}%`);
    node.style.setProperty("--hero-glow-y", `${50 + y * 18}%`);
  }

  function resetPointerState() {
    const node = sceneRef.current;
    if (!node) return;

    node.style.transform = "perspective(1400px) rotateX(0deg) rotateY(0deg)";
    node.style.setProperty("--hero-glow-x", "50%");
    node.style.setProperty("--hero-glow-y", "50%");
  }

  return (
    <div
      ref={sceneRef}
      className={cn("hero-planet-scene", className)}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointerState}
      style={
        {
          "--hero-glow-x": "50%",
          "--hero-glow-y": "50%"
        } as CSSProperties & Record<string, string>
      }
    >
      <div className="hero-planet-stars">
        {STAR_FIELD.map((star, index) => (
          <span
            key={index}
            className="hero-planet-star"
            style={
              {
                top: star.top,
                left: star.left,
                width: star.size,
                height: star.size,
                "--star-delay": star.delay,
                "--star-duration": star.duration
              } as CSSProperties & Record<string, string>
            }
          />
        ))}
      </div>

      <div className="hero-planet-ring hero-planet-ring-outer" />
      <div className="hero-planet-ring hero-planet-ring-inner" />

      <div className="hero-planet-core">
        <span className="hero-planet-band hero-planet-band-a" />
        <span className="hero-planet-band hero-planet-band-b" />
      </div>

      <span className="hero-planet-satellite hero-planet-satellite-a" />
      <span className="hero-planet-satellite hero-planet-satellite-b" />
    </div>
  );
}
