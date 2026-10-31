import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InsurerFilterMenu } from "../../src/frontend/components/InsurerFilterMenu";

const originalMatchMedia = window.matchMedia;

/**
 * Stubs `matchMedia` explicitly for each suite instead of relying on the
 * happy-dom default viewport so the responsive branch is deterministic.
 */
function overrideMatchMedia(matches: boolean) {
  window.matchMedia = () => {
    const media = new EventTarget() as EventTarget & { matches: boolean };
    Object.defineProperty(media, "matches", { value: matches, configurable: true });
    return media as unknown as MediaQueryList;
  };
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

function Harness({
  initial = "",
  onSelect,
}: {
  initial?: string;
  onSelect?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div>
      <button type="button" data-testid="outside-surface">
        Outside
      </button>
      <InsurerFilterMenu
        value={value}
        onSelect={(next) => {
          onSelect?.(next);
          setValue(next);
        }}
      />
    </div>
  );
}

const openMenu = () => {
  fireEvent.click(screen.getByTestId("insurer-filter-trigger"));
  return screen.getByTestId("insurer-filter-menu");
};

describe("InsurerFilterMenu (Ticket 6 responsive insurer filter)", () => {
  describe("Desktop viewport (anchored command palette)", () => {
    beforeEach(() => {
      overrideMatchMedia(true);
    });

    it("renders a floating palette anchored to the trigger with 12px radius, drop shadow and constrained width", () => {
      render(<Harness />);
      const menu = openMenu();

      expect(menu).toHaveAttribute("role", "dialog");
      expect(menu).toHaveAttribute("aria-modal", "true");
      expect(menu.className).toContain("rounded-xl");
      expect(menu.className).toContain("shadow-lg");
      expect(menu.className).toContain("w-[320px]");
      expect(menu.className).toContain("max-w-[calc(100vw-2rem)]");

      const trigger = screen.getByTestId("insurer-filter-trigger");
      expect(trigger).toHaveAttribute("aria-expanded", "true");
      expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    });

    it("shares internal UI: sticky hairline search bar, small-caps group headers and flat full-width rows", () => {
      render(<Harness />);
      openMenu();

      const search = screen.getByTestId("insurer-filter-search");
      const searchRow = search.closest("div") as HTMLElement;
      expect(searchRow.className).toContain("sticky");
      expect(searchRow.className).toContain("top-0");
      expect(searchRow.className).toContain("border-b");

      const majorsHeader = screen.getByText("Major Insurers (4)");
      expect(majorsHeader.className).toContain("uppercase");
      expect(majorsHeader.className).toContain("text-slate-500");

      const nrma = screen.getByRole("option", { name: "NRMA" });
      expect(nrma.className).toContain("w-full");
      expect(nrma.className).toContain("h-11");
      // Faint 1px divider defines each touch target.
      expect(nrma.className).toContain("border-b");
      expect(nrma.className).toContain("border-slate-200/70");
    });

    it("filters grouped insurers by label or code and shows an empty state", () => {
      render(<Harness />);
      openMenu();
      const search = screen.getByTestId("insurer-filter-search");

      fireEvent.change(search, { target: { value: "allianz" } });
      expect(screen.getByRole("option", { name: "Allianz" })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "NRMA" })).not.toBeInTheDocument();
      expect(screen.getByText("Major Insurers (4)")).toBeInTheDocument();

      fireEvent.change(search, { target: { value: "scti" } });
      expect(
        screen.getByRole("option", { name: "Southern Cross Travel Insurance" })
      ).toBeInTheDocument();

      fireEvent.change(search, { target: { value: "zzzorp" } });
      expect(screen.getByText(/No insurers match/i)).toBeInTheDocument();
    });

    it("marks the active selection with a checkmark on a deepened gray block and resets via All Insurers", () => {
      const onSelect = vi.fn();
      render(<Harness onSelect={onSelect} />);
      openMenu();

      fireEvent.click(screen.getByRole("option", { name: "NRMA" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(onSelect).toHaveBeenCalledWith("NRMA");

      const trigger = screen.getByTestId("insurer-filter-trigger");
      expect(trigger).toHaveAccessibleDescription("Selected insurer: NRMA");
      fireEvent.click(trigger);
      const nrma = screen.getByRole("option", { name: "NRMA" });
      expect(nrma).toHaveAttribute("aria-selected", "true");
      expect(nrma.className).toContain("bg-slate-200");
      expect(nrma.querySelector("svg")).not.toBeNull();
      expect(screen.getByRole("option", { name: "Allianz" })).toHaveAttribute(
        "aria-selected",
        "false"
      );

      fireEvent.click(screen.getByRole("option", { name: "All Insurers (39)" }));
      expect(onSelect).toHaveBeenCalledWith("");
    });

    it("dismisses via Escape, outside mousedown and trigger toggle, restoring focus", async () => {
      render(<Harness />);
      const trigger = screen.getByTestId("insurer-filter-trigger");
      trigger.focus();
      fireEvent.click(trigger);

      fireEvent.keyDown(document, { key: "Escape" });
      await waitFor(() =>
        expect(screen.queryByTestId("insurer-filter-menu")).not.toBeInTheDocument()
      );
      await waitFor(() => expect(trigger).toHaveFocus());

      fireEvent.click(trigger);
      fireEvent.mouseDown(screen.getByTestId("outside-surface"));
      expect(screen.queryByTestId("insurer-filter-menu")).not.toBeInTheDocument();

      fireEvent.click(trigger);
      expect(screen.getByTestId("insurer-filter-menu")).toBeInTheDocument();
      fireEvent.click(trigger);
      expect(screen.queryByTestId("insurer-filter-menu")).not.toBeInTheDocument();
    });

    it("moves focus through options with Arrow keys starting from the search bar", async () => {
      render(<Harness />);
      openMenu();
      const search = screen.getByTestId("insurer-filter-search");
      await waitFor(() => expect(search).toHaveFocus());

      fireEvent.keyDown(search, { key: "ArrowDown" });
      const allOption = screen.getByRole("option", { name: "All Insurers (39)" });
      expect(allOption).toHaveFocus();

      fireEvent.keyDown(allOption, { key: "ArrowDown" });
      expect(screen.getByRole("option", { name: "Suncorp" })).toHaveFocus();

      fireEvent.keyDown(screen.getByRole("option", { name: "Suncorp" }), {
        key: "ArrowUp",
      });
      expect(allOption).toHaveFocus();
    });

    it("stays closed while disabled (streaming or throttled)", () => {
      const { rerender } = render(<InsurerFilterMenu value="" onSelect={vi.fn()} disabled />);
      const trigger = screen.getByTestId("insurer-filter-trigger");
      expect(trigger).toBeDisabled();

      fireEvent.click(trigger);
      expect(screen.queryByTestId("insurer-filter-menu")).not.toBeInTheDocument();

      rerender(<InsurerFilterMenu value="" onSelect={vi.fn()} />);
      fireEvent.click(trigger);
      expect(screen.getByTestId("insurer-filter-menu")).toBeInTheDocument();
    });
  });

  describe("Mobile viewport (bottom sheet)", () => {
    beforeEach(() => {
      overrideMatchMedia(false);
    });

    it("renders the menu as a bottom sheet with a muted drag handle and full-width targets", () => {
      render(<Harness />);
      const menu = openMenu();

      expect(menu.className).toContain("inset-x-0");
      expect(menu.className).toContain("bottom-0");
      expect(menu.className).toContain("max-h-[min(75dvh,36rem)]");

      const handle = screen.getByTestId("insurer-filter-drag-handle");
      expect(handle).toBeInTheDocument();
      expect(handle.className).toContain("bg-slate-300");

      const nrma = screen.getByRole("option", { name: "NRMA" });
      expect(nrma.className).toContain("w-full");

      // The sheet scrolls without the desktop-style scrollbar track.
      expect(screen.getByTestId("insurer-filter-scroll")).toBeInTheDocument();

      // The palette wrapper must not be mounted simultaneously.
      expect(document.querySelectorAll("[data-testid='insurer-filter-menu']").length).toBe(1);
    });

    it("closes via backdrop tap and Escape with focus restored to the trigger", async () => {
      render(<Harness />);
      const trigger = screen.getByTestId("insurer-filter-trigger");
      trigger.focus();
      fireEvent.click(trigger);

      fireEvent.click(screen.getByTestId("insurer-filter-backdrop"));
      await waitFor(() =>
        expect(screen.queryByTestId("insurer-filter-menu")).not.toBeInTheDocument()
      );
      await waitFor(() => expect(trigger).toHaveFocus());

      fireEvent.click(trigger);
      fireEvent.keyDown(document, { key: "Escape" });
      await waitFor(() =>
        expect(screen.queryByTestId("insurer-filter-menu")).not.toBeInTheDocument()
      );
    });

    it("commits dismissal when dragged past the threshold and snaps back otherwise", async () => {
      render(<Harness />);
      openMenu();
      const grip = screen.getByTestId("insurer-filter-grip");

      fireEvent.pointerDown(grip, { pointerId: 1, isPrimary: true, clientY: 10 });
      fireEvent.pointerMove(grip, { pointerId: 1, isPrimary: true, clientY: 40 });
      const menu = screen.getByTestId("insurer-filter-menu");
      expect(menu.style.transform).toBe("translateY(30px)");
      fireEvent.pointerUp(grip, { pointerId: 1, isPrimary: true, clientY: 40 });

      expect(screen.getByTestId("insurer-filter-menu")).toBeInTheDocument();

      fireEvent.pointerDown(grip, { pointerId: 2, isPrimary: true, clientY: 10 });
      fireEvent.pointerMove(grip, { pointerId: 2, isPrimary: true, clientY: 160 });
      fireEvent.pointerUp(grip, { pointerId: 2, isPrimary: true, clientY: 160 });

      await waitFor(() =>
        expect(screen.queryByTestId("insurer-filter-menu")).not.toBeInTheDocument()
      );
      await waitFor(() => expect(screen.getByTestId("insurer-filter-trigger")).toHaveFocus());
    });
    it("still opens the bottom sheet when the trigger is container-anchored", () => {
      render(
        <div className="relative">
          <InsurerFilterMenu value="" onSelect={vi.fn()} anchorTo="container" />
        </div>
      );

      const menu = openMenu();
      expect(menu).toBeInTheDocument();
      expect(screen.getByTestId("insurer-filter-scroll")).toBeInTheDocument();
      expect(screen.getByTestId("insurer-filter-drag-handle")).toBeInTheDocument();
      // Tapping the toolbar filter never surfaces a floating palette on mobile
      expect(menu.className).toContain("inset-x-0");
      expect(menu.className).toContain("bottom-0");
    });
  });
});
