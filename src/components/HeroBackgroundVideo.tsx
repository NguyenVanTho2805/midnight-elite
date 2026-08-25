"use client";

import { useTheme } from "@/contexts/ThemeContext";

export default function HeroBackgroundVideo() {
  const { theme } = useTheme();
  const src = theme === "dark" ? "/videos/hero-night.mp4" : "/videos/hero-day.mp4";

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      <video
        key={src}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="w-full h-full object-cover"
        src={src}
      />
      <div className="absolute inset-0" style={{ background: "rgba(10,21,48,0.55)" }} />
    </div>
  );
}
