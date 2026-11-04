import { Monitor, Moon, Sun } from "lucide-react";
import type { Theme } from "../hooks/useTheme";

export interface ThemeSwitcherProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  className?: string;
}

const NEXT_THEME: Record<Theme, Theme> = {
  system: "light",
  light: "dark",
  dark: "system",
};

/**
 * Minimalist theme switcher: a single, clean icon button that cycles through
 * System, Light, and Dark modes without visual clutter.
 */
export function ThemeSwitcher({ theme, onThemeChange, className = "" }: ThemeSwitcherProps) {
  const nextTheme = NEXT_THEME[theme] ?? "light";

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      data-theme={theme}
      aria-label={`Current theme: ${theme}. Switch to ${nextTheme} theme`}
      title={`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)} (click to switch)`}
      onClick={() => onThemeChange(nextTheme)}
      className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 transition-colors ${className}`.trim()}
    >
      {theme === "light" && <Sun size={18} aria-hidden="true" />}
      {theme === "dark" && <Moon size={18} aria-hidden="true" />}
      {theme === "system" && <Monitor size={18} aria-hidden="true" />}
    </button>
  );
}
