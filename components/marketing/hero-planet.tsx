const STAR_FIELD = [
  { top: "12%", left: "14%", size: "2px", delay: "0.1s", duration: "2.9s" },
  { top: "22%", left: "72%", size: "1px", delay: "0.5s", duration: "3.8s" },
  { top: "78%", left: "9%", size: "2px", delay: "0.2s", duration: "3.1s" },
  { top: "58%", left: "81%", size: "2px", delay: "0.9s", duration: "2.7s" },
  { top: "37%", left: "43%", size: "1px", delay: "0.7s", duration: "3.3s" },
  { top: "16%", left: "47%", size: "2px", delay: "1.2s", duration: "2.5s" },
  { top: "84%", left: "61%", size: "1px", delay: "0.4s", duration: "3.6s" },
  { top: "66%", left: "25%", size: "2px", delay: "1.4s", duration: "2.8s" },
  { top: "45%", left: "90%", size: "1px", delay: "0.8s", duration: "3.4s" },
  { top: "29%", left: "6%", size: "2px", delay: "1.1s", duration: "2.6s" }
];

export function HeroPlanet() {
  return (
    <div className="hero-planet-scene">
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
import { CSSProperties } from "react";
