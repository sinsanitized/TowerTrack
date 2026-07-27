"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";
const STORAGE_KEY = "towertrack-theme";

function savedTheme(): Theme {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  if (document.documentElement.dataset.theme === "dark") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const saved = savedTheme();
    document.documentElement.dataset.theme = saved;
    setTheme(saved);
  }, []);

  function toggleTheme() {
    const next = savedTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem(STORAGE_KEY, next);
    setTheme(next);
  }

  const dark = theme === "dark";
  return (
    <button
      type="button"
      className="theme-toggle ml-4"
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      title={dark ? "Use light mode" : "Use dark mode"}
    >
      {dark ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}
