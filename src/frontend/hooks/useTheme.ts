import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "faq_mate_theme";

/**
 * Checks system dark mode preference safely across SSR / browser / testdom.
 */
export function getSystemTheme(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

/**
 * Reads initial theme from localStorage with safe fallback to "system".
 */
export function getInitialTheme(): Theme {
  if (typeof window === "undefined" || !window.localStorage) {
    return "system";
  }
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
  } catch {
    // Storage restricted
  }
  return "system";
}

/**
 * Applies resolved theme class to documentElement and updates meta theme-color.
 */
export function applyTheme(theme: Theme): boolean {
  if (typeof document === "undefined") return false;
  const isDark = theme === "dark" || (theme === "system" && getSystemTheme());
  const root = document.documentElement;

  if (isDark) {
    root.classList.add("dark");
    root.classList.remove("light");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.classList.add("light");
    root.style.colorScheme = "light";
  }

  // Update meta theme-color tag if present
  try {
    const metaTags = document.querySelectorAll('meta[name="theme-color"]');
    for (const tag of metaTags) {
      if (!tag.hasAttribute("media")) {
        tag.setAttribute("content", isDark ? "#020617" : "#f8fafc");
      }
    }
  } catch {
    // Ignore
  }

  return isDark;
}

/**
 * Custom hook to manage application theme with localStorage persistence and
 * system OS dark mode auto-detection.
 */
export function useTheme(initialTheme?: Theme) {
  const [theme, setThemeState] = useState<Theme>(() => initialTheme ?? getInitialTheme());
  const [resolvedDark, setResolvedDark] = useState<boolean>(() => {
    const current = initialTheme ?? getInitialTheme();
    return current === "dark" || (current === "system" && getSystemTheme());
  });

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      }
    } catch {
      // Storage restricted
    }
    const isDark = applyTheme(next);
    setResolvedDark(isDark);
  }, []);

  // Sync on mount and when theme changes
  useEffect(() => {
    const isDark = applyTheme(theme);
    setResolvedDark(isDark);
  }, [theme]);

  // Listen for system theme changes when theme === "system"
  useEffect(() => {
    if (theme !== "system") return;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    try {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => {
        const isDark = applyTheme("system");
        setResolvedDark(isDark);
      };
      if (typeof media.addEventListener === "function") {
        media.addEventListener("change", onChange);
        return () => media.removeEventListener("change", onChange);
      }
      if (
        typeof (media as unknown as { addListener: (cb: () => void) => void }).addListener ===
        "function"
      ) {
        (media as unknown as { addListener: (cb: () => void) => void }).addListener(onChange);
        return () =>
          (media as unknown as { removeListener: (cb: () => void) => void }).removeListener(
            onChange
          );
      }
    } catch {
      // Ignore
    }
  }, [theme]);

  return { theme, setTheme, resolvedDark };
}
