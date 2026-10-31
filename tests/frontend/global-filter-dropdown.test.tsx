import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GlobalFilterDropdown } from "../../src/frontend/components/GlobalFilterDropdown";

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

const GROUPS = [
  {
    id: "alpha",
    label: "Alpha Group",
    options: [
      { value: "ALPHA", label: "Alpha One", title: "Alpha Underwriting" },
      { value: "BETA", label: "Beta Two" },
      { value: "GAMMA", label: "Gamma Three" },
    ],
  },
  { id: "omega", label: "Omega Group", options: [{ value: "OMEGA", label: "Omega Nine" }] },
];

function Harness({
  initial = "ALPHA",
  onSelect,
  disabledOptionValues,
  variant = "chip",
  prefix = "domain-prefix",
}: {
  initial?: string;
  onSelect?: (value: string) => void;
  disabledOptionValues?: string[];
  variant?: "chip" | "field";
  prefix?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div>
      <button type="button" data-testid="outside-surface">
        Outside
      </button>
      <GlobalFilterDropdown
        variant={variant}
        value={value}
        onSelect={(next) => {
          onSelect?.(next);
          setValue(next);
        }}
        groups={GROUPS}
        allOption={{ value: "", label: "Everything (3)" }}
        emptyLabel="All options"
        disabledOptionValues={disabledOptionValues}
        testIdPrefix={prefix}
        ariaLabel={variant === "field" ? "Field picker" : "Domain filter"}
        optionsAriaLabel="Picker options"
        searchAriaLabel="Search options"
        searchPlaceholder="Search options…"
      />
    </div>
  );
}

describe("GlobalFilterDropdown — the single approved dropdown system", () => {
  it("screens render the field variant as a full-width hairline row, never a pill or native select", () => {
    render(<Harness variant="field" />);

    const trigger = screen.getByTestId("domain-prefix-trigger");
    expect(trigger.className).toContain("w-full");
    expect(trigger.className).toContain("min-h-[44px]");
    expect(trigger.className).toContain("rounded-xl");
    expect(trigger.className).toContain("border-slate-300");
    // No bloated pill container: no full rounding, no 2px border, no select.
    expect(trigger.className).not.toContain("rounded-full");
    expect(trigger.className).not.toContain("border-2");
    expect(trigger.querySelector("span")).toHaveTextContent("Alpha One");
    // Accessible state mirrors a select: expanded launcher semantics.
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("locks the shared internal UI: sticky hairline search, small-caps headers, hairline rows with the gray block and checkmark", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("domain-prefix-trigger"));

    const menu = screen.getByTestId("domain-prefix-menu");
    expect(menu.className).toContain("rounded-xl");
    expect(menu.className).toContain("shadow-lg");
    expect(menu.className).toContain("w-[320px]");

    const searchRow = screen.getByTestId("domain-prefix-search").closest("div");
    expect(searchRow?.className).toContain("sticky");
    expect(searchRow?.className).toContain("top-0");
    expect(searchRow?.className).toContain("border-b");
    expect(searchRow?.className).toContain("border-slate-200");

    const header = screen.getByText("Alpha Group");
    expect(header.className).toContain("uppercase");
    expect(header.className).toContain("text-slate-500");

    // The active selection: deepened gray block + teal checkmark, hairline row.
    const selected = screen.getByRole("option", { name: "Alpha One" });
    expect(selected.className).toContain("border-b");
    expect(selected.className).toContain("border-slate-200/70");
    expect(selected.className).toContain("bg-slate-200");
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(selected.querySelector("svg")).not.toBeNull();

    // The unselected aesthetic: light-gray hover on a hairline target.
    const unselected = screen.getByRole("option", { name: "Beta Two" });
    expect(unselected.className).toContain("hover:bg-slate-50");
    expect(unselected.getAttribute("title")).toBeNull();
    expect(unselected.querySelector("svg")).toBeNull();
  });

  it("searches by label or value and formats the group-aware empty state", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("domain-prefix-trigger"));

    const search = screen.getByTestId("domain-prefix-search");
    fireEvent.change(search, { target: { value: "omega" } });
    expect(screen.getByRole("option", { name: "Omega Nine" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Alpha One" })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "zzzorp" } });
    expect(screen.getByText(/No matches for/i)).toBeInTheDocument();
  });

  it("guards disabled options out of both the pointer path and the arrow-key roving focus", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} disabledOptionValues={["BETA"]} />);

    fireEvent.click(screen.getByTestId("domain-prefix-trigger"));
    const blocked = screen.getByRole("option", { name: "Beta Two" });
    expect(blocked).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(blocked);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByTestId("domain-prefix-menu")).toBeInTheDocument();

    // Roving focus skips the disabled row: Alpha -> Gamma, never Beta.
    fireEvent.keyDown(screen.getByRole("option", { name: "Alpha One" }), { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: "Gamma Three" })).toHaveFocus();
    expect(screen.queryByRole("option", { name: "Beta Two" })).not.toHaveFocus();

    onSelect.mockClear();
    fireEvent.click(screen.getByRole("option", { name: "Gamma Three" }));
    expect(onSelect).toHaveBeenCalledWith("GAMMA");
  });

  it("mounts the portalled bottom sheet below the breakpoint with prefix-scoped testids", () => {
    overrideMatchMedia(false);
    render(<Harness />);
    fireEvent.click(screen.getByTestId("domain-prefix-trigger"));

    expect(screen.getByTestId("domain-prefix-scroll")).toBeInTheDocument();
    expect(screen.getByTestId("domain-prefix-drag-handle")).toBeInTheDocument();
    expect(document.body.contains(screen.getByTestId("domain-prefix-menu"))).toBe(true);
    // The palette wrapper must not be mounted simultaneously.
    expect(document.querySelectorAll("[role='dialog']").length).toBe(1);

    fireEvent.click(screen.getByTestId("domain-prefix-backdrop"));
    expect(screen.queryByTestId("domain-prefix-menu")).not.toBeInTheDocument();
  });
});
