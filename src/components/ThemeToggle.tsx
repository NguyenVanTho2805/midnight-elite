"use client";

import { Sun, Moon } from "griddy-icons";
import { useTheme } from "@/contexts/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
      className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface)]"
      style={{ color: "var(--steel)" }}
    >
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
