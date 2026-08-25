"use client";

import { motion } from "framer-motion";
import { useTheme } from "@/contexts/ThemeContext";

export default function HeroVideoReveal() {
  const { theme } = useTheme();
  const src = theme === "dark" ? "/videos/hero-night.mp4" : "/videos/hero-day.mp4";

  return (
    <motion.div
      className="relative w-full overflow-hidden rounded-2xl"
      style={{
        aspectRatio: "4 / 5",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "rgba(3,8,20,0.5) 0px 24px 48px -12px",
      }}
      initial={{ clipPath: "inset(0% 0% 0% 100%)" }}
      animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
    >
      <video
        key={src}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover"
        src={src}
      />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgba(10,21,48,0) 45%, rgba(10,21,48,0.6) 100%)" }}
      />
    </motion.div>
  );
}
