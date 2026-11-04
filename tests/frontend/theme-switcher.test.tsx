import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../../src/frontend/components/AppShell";
import { ThemeSwitcher } from "../../src/frontend/components/ThemeSwitcher";
import {
  applyTheme,
  getInitialTheme,
  getSystemTheme,
  THEME_STORAGE_KEY,
  useTheme,
} from "../../src/frontend/hooks/useTheme";

function TestHookConsumer() {
  const { theme, setTheme, resolvedDark } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <span data-testid="resolved-dark">{resolvedDark ? "dark" : "light"}</span>
      <button type="button" onClick={() => setTheme("light")}>
        Set Light
      </button>
      <button type="button" onClick={() => setTheme("dark")}>
        Set Dark
      </button>
      <button type="button" onClick={() => setTheme("system")}>
        Set System
      </button>
    </div>
  );
}

const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

describe("Theme System & Minimalist ThemeSwitcher", () => {
  const originalMatchMedia = window.matchMedia;
  let storageMock: ReturnType<typeof createStorageMock>;

  beforeEach(() => {
    storageMock = createStorageMock();
    Object.defineProperty(window, "localStorage", {
      value: storageMock,
      writable: true,
      configurable: true,
    });
    document.documentElement.className = "";
  });

  afterEach(() => {
    cleanup();
    document.documentElement.className = "";
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  describe("useTheme & theme utilities", () => {
    it("defaults to system theme when localStorage is empty", () => {
      expect(getInitialTheme()).toBe("system");
    });

    it("restores saved theme preference from localStorage", () => {
      window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
      expect(getInitialTheme()).toBe("dark");

      window.localStorage.setItem(THEME_STORAGE_KEY, "light");
      expect(getInitialTheme()).toBe("light");
    });

    it("safely queries system dark mode preference", () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-color-scheme: dark)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      expect(getSystemTheme()).toBe(true);
    });

    it("applies dark and light class names to documentElement", () => {
      applyTheme("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.documentElement.classList.contains("light")).toBe(false);
      expect(document.documentElement.style.colorScheme).toBe("dark");

      applyTheme("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(document.documentElement.classList.contains("light")).toBe(true);
      expect(document.documentElement.style.colorScheme).toBe("light");
    });

    it("updates theme state, localStorage, and DOM classes through useTheme", () => {
      render(<TestHookConsumer />);
      expect(screen.getByTestId("current-theme")).toHaveTextContent("system");

      fireEvent.click(screen.getByText("Set Dark"));
      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
      expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);

      fireEvent.click(screen.getByText("Set Light"));
      expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
      expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(document.documentElement.classList.contains("light")).toBe(true);
    });
  });

  describe("Minimalist ThemeSwitcher Component", () => {
    it("renders a single clean button with accessible label and icon", () => {
      const onThemeChange = vi.fn();
      render(<ThemeSwitcher theme="light" onThemeChange={onThemeChange} />);

      const toggle = screen.getByTestId("theme-toggle");
      expect(toggle).toBeInTheDocument();
      expect(toggle).toHaveAttribute("data-theme", "light");
      expect(toggle).toHaveAttribute("aria-label", "Current theme: light. Switch to dark theme");
      expect(toggle.querySelector("svg")).toHaveClass("lucide-sun");
    });

    it("cycles through system -> light -> dark -> system on click", () => {
      const onThemeChange = vi.fn();
      const { rerender } = render(<ThemeSwitcher theme="system" onThemeChange={onThemeChange} />);

      const toggle = screen.getByTestId("theme-toggle");
      expect(toggle).toHaveAttribute("aria-label", "Current theme: system. Switch to light theme");
      expect(toggle.querySelector("svg")).toHaveClass("lucide-monitor");

      fireEvent.click(toggle);
      expect(onThemeChange).toHaveBeenCalledWith("light");

      rerender(<ThemeSwitcher theme="light" onThemeChange={onThemeChange} />);
      expect(toggle).toHaveAttribute("aria-label", "Current theme: light. Switch to dark theme");
      expect(toggle.querySelector("svg")).toHaveClass("lucide-sun");

      fireEvent.click(toggle);
      expect(onThemeChange).toHaveBeenCalledWith("dark");

      rerender(<ThemeSwitcher theme="dark" onThemeChange={onThemeChange} />);
      expect(toggle).toHaveAttribute("aria-label", "Current theme: dark. Switch to system theme");
      expect(toggle.querySelector("svg")).toHaveClass("lucide-moon");

      fireEvent.click(toggle);
      expect(onThemeChange).toHaveBeenCalledWith("system");
    });
  });

  describe("AppShell Integration with ThemeSwitcher", () => {
    it("renders the minimalist theme toggle in the application header", () => {
      render(
        <AppShell>
          <div>Content</div>
        </AppShell>
      );

      const toggle = screen.getByTestId("theme-toggle");
      expect(toggle).toBeInTheDocument();
      expect(toggle.closest("header")).not.toBeNull();
    });

    it("toggles theme and updates documentElement classes through AppShell control", () => {
      render(
        <AppShell>
          <div>Content</div>
        </AppShell>
      );

      const toggle = screen.getByTestId("theme-toggle");
      // Initial is system. Click to cycle to light.
      fireEvent.click(toggle);
      expect(document.documentElement.classList.contains("light")).toBe(true);

      // Click again to cycle to dark.
      fireEvent.click(toggle);
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });
});
