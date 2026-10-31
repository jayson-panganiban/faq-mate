import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/frontend/App";
import { AppShell } from "../../src/frontend/components/AppShell";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("Responsive navigation", () => {
  it("traps focus in the drawer and restores it on Escape or backdrop dismissal", async () => {
    render(
      <AppShell historyItems={[{ id: "one", label: "Flood question" }]}>
        <button type="button">Page action</button>
      </AppShell>
    );
    const trigger = screen.getByTestId("mobile-sidebar-toggle");
    trigger.focus();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Page action").closest("[inert]")).not.toBeNull();
    const first = within(dialog).getByRole("button", { name: "Close navigation" });
    const last = within(dialog).getByRole("button", { name: "Clear all history" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
    const drawer = document.getElementById("mobile-navigation");
    expect(drawer).toHaveAttribute("aria-hidden", "true");
    expect(drawer).toHaveAttribute("inert");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(trigger).toHaveFocus());
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Close navigation backdrop" }));
    expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("uses the sidebar panel toggle to open and close mobile navigation", async () => {
    render(
      <AppShell>
        <button type="button">Page action</button>
      </AppShell>
    );

    const trigger = screen.getByTestId("mobile-sidebar-toggle");
    expect(trigger).toHaveAccessibleName("Toggle sidebar");
    expect(trigger.querySelector("svg")).toHaveClass("lucide-panel-left");
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger.querySelector("svg")).toHaveClass("lucide-panel-left");
    expect(screen.getByRole("dialog", { name: "Navigation" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close navigation" }));

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger.querySelector("svg")).toHaveClass("lucide-panel-left");
    expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("keeps mobile branding and drawer navigation available alongside the collapsible desktop sidebar", async () => {
    const reset = vi.fn();
    const compare = vi.fn();
    const { container } = render(
      <AppShell onReset={reset} onToggleComparison={compare}>
        <div>Body</div>
      </AppShell>
    );
    const mobileHeaderBrand = screen.getByRole("heading", { name: "FAQ-Mate" });
    expect(mobileHeaderBrand.parentElement).toHaveClass("md:hidden");
    expect(mobileHeaderBrand.parentElement?.querySelector("svg")).toHaveClass("lucide-shield");
    expect(mobileHeaderBrand.parentElement?.parentElement?.firstElementChild).toBe(
      screen.getByTestId("mobile-sidebar-toggle")
    );
    expect(screen.queryByTestId("mobile-new-chat-button")).not.toBeInTheDocument();

    const sidebar = container.querySelector("#desktop-sidebar");
    expect(sidebar).toHaveClass("hidden", "md:flex", "w-[260px]");
    fireEvent.click(screen.getByTestId("mobile-sidebar-toggle"));
    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    expect(dialog).toHaveClass("w-[75vw]", "max-w-[320px]");
    const mobileNavigation = within(dialog).getByRole("navigation", {
      name: "Mobile navigation",
    });
    expect(mobileNavigation.firstElementChild).toHaveAccessibleName("Start new chat");
    fireEvent.click(within(mobileNavigation).getByRole("button", { name: "Start new chat" }));
    expect(reset).toHaveBeenCalledTimes(1);

    const toggle = document.getElementById("sidebar-toggle") as HTMLButtonElement;
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById("desktop-sidebar")).toHaveAttribute("data-collapsed", "true");
    expect(sidebar).toHaveClass("w-20");
    expect(screen.getByTestId("reset-chat-button")).toHaveAccessibleName("Start new chat");
    expect(screen.getByTestId("comparison-toggle")).toHaveAccessibleName(
      "Switch to policy comparison view"
    );
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(screen.getByRole("heading", { name: "History" })).toHaveFocus());
    const trigger = screen.getByTestId("mobile-sidebar-toggle");
    fireEvent.click(trigger);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Start new chat" })
    );
    expect(reset).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("tracks the visual viewport height, offsets keyboard panning, and ignores pinch zoom", () => {
    const original = Object.getOwnPropertyDescriptor(window, "visualViewport");
    const viewport = new EventTarget() as VisualViewport;
    Object.defineProperties(viewport, {
      height: { value: 600, writable: true },
      scale: { value: 1, writable: true },
      offsetTop: { value: 0, writable: true },
    });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    const { container, unmount } = render(
      <AppShell>
        <div>Body</div>
      </AppShell>
    );
    const shell = container.querySelector(".chat-app") as HTMLElement;
    expect(shell.style.height).toBe("600px");
    // iOS scrolls the layout viewport when the keyboard opens; the shell must
    // stay glued under the visual viewport while the composer keeps its
    // bottom-anchored position above the keyboard edge.
    Object.assign(viewport, { height: 400, offsetTop: 120 });
    act(() => {
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(shell.style.height).toBe("400px");
    expect(shell.style.transform).toBe("translateY(120px)");
    Object.assign(viewport, { offsetTop: 200 });
    act(() => {
      viewport.dispatchEvent(new Event("scroll"));
    });
    expect(shell.style.transform).toBe("translateY(200px)");
    // Pinch zoom frees the shell entirely from keyboard compensation.
    Object.assign(viewport, { height: 400, scale: 2, offsetTop: 200 });
    act(() => {
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(shell.style.height).toBe("");
    expect(shell.style.transform).toBe("");
    unmount();
    if (original) Object.defineProperty(window, "visualViewport", original);
    else Reflect.deleteProperty(window, "visualViewport");
  });

  it("lists current user questions and repeatedly jumps to them while preserving the draft", () => {
    sessionStorage.setItem(
      "faq_mate_chat_session",
      JSON.stringify([
        { id: "u1", role: "user", content: "What is flood cover?", timestamp: 1 },
        { id: "a1", role: "assistant", content: "Flood answer", timestamp: 2 },
        { id: "u2", role: "user", content: "What about excess?", timestamp: 3 },
      ])
    );
    render(<App />);
    const navigation = screen.getByRole("navigation", { name: "Main navigation" });
    expect(
      within(navigation.parentElement as HTMLElement).getByRole("button", {
        name: "What is flood cover?",
      })
    ).toBeInTheDocument();
    expect(
      within(navigation.parentElement as HTMLElement).queryByRole("button", {
        name: "Flood answer",
      })
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId("chat-input-textarea"), { target: { value: "My draft" } });
    fireEvent.click(screen.getByTestId("comparison-toggle"));
    const question = within(navigation.parentElement as HTMLElement).getByRole("button", {
      name: "What is flood cover?",
    });
    const feed = screen.getByTestId("chat-scroll-container");
    const target = feed.querySelector<HTMLElement>('[data-message-id="u1"]');
    if (!target) throw new Error("Expected restored question in feed");
    vi.spyOn(feed, "getBoundingClientRect").mockImplementation(() => ({ top: 100 }) as DOMRect);
    vi.spyOn(target, "getBoundingClientRect").mockImplementation(
      () => ({ top: 350 - feed.scrollTop }) as DOMRect
    );
    fireEvent.click(question);
    expect(screen.getByTestId("chat-input-textarea")).toHaveValue("My draft");
    expect(feed.scrollTop).toBe(250);
    fireEvent.click(question);
    expect(feed.scrollTop).toBe(250);
  });

  it("places the desktop sidebar toggle in the app header and New Chat first in navigation", () => {
    render(
      <AppShell isComparisonMode onReset={vi.fn()} onToggleComparison={vi.fn()}>
        <div>Body</div>
      </AppShell>
    );

    const sidebar = document.getElementById("desktop-sidebar");
    if (!sidebar) throw new Error("Expected the desktop navigation sidebar");
    const header = sidebar.firstElementChild as HTMLElement;
    const brand = within(header).getByRole("img", { name: "FAQ-Mate" });
    const logo = brand.querySelector("svg");
    expect(logo).toHaveClass("lucide-shield");
    expect(logo).toHaveAttribute("width", "24");
    expect(logo).toHaveAttribute("height", "24");
    expect(brand).toHaveTextContent("FAQ-Mate");
    expect(brand.className).toContain("px-2.5");
    expect(
      within(header).queryByRole("button", { name: "Collapse sidebar" })
    ).not.toBeInTheDocument();
    const desktopToggle = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(desktopToggle.id).toBe("sidebar-toggle");
    expect(desktopToggle.closest("header")).not.toBeNull();
    expect(desktopToggle.querySelector("svg")).toHaveClass("lucide-panel-left");

    const desktopHeaderBrand = screen.getByRole("heading", { name: "FAQ-Mate" });
    expect(desktopHeaderBrand.parentElement).toHaveClass("md:hidden");
    const navigation = within(sidebar).getByRole("navigation", { name: "Main navigation" });
    const newChat = screen.getByTestId("reset-chat-button");
    const chatTab = within(navigation).getByRole("button", { name: "Chat" });
    expect(newChat.parentElement).toBe(navigation);
    expect(navigation.firstElementChild).toBe(newChat);
    expect(newChat.className.trim()).toBe(chatTab.className.trim());
    expect(newChat.className).not.toContain("border");
    expect(newChat.className).not.toContain("bg-slate-50");

    fireEvent.click(screen.getByTestId("mobile-sidebar-toggle"));
    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    expect(dialog).toHaveClass("w-[75vw]", "max-w-[320px]");
    const mobileHeader = dialog.firstElementChild as HTMLElement;
    expect(within(mobileHeader).queryByRole("img", { name: "FAQ-Mate" })).not.toBeInTheDocument();
    expect(mobileHeader.lastElementChild).toBe(
      within(mobileHeader).getByRole("button", { name: "Close navigation" })
    );
    const mobileNavigation = within(dialog).getByRole("navigation", {
      name: "Mobile navigation",
    });
    const mobileNewChat = within(dialog).getByRole("button", { name: "Start new chat" });
    const mobileChatTab = within(dialog).getByRole("button", { name: "Chat" });
    expect(mobileNewChat.parentElement).toBe(mobileNavigation);
    expect(mobileNavigation.firstElementChild).toBe(mobileNewChat);
    expect(mobileNewChat.className.trim()).toBe(mobileChatTab.className.trim());
  });

  it("centers the logo over the navigation icons when the desktop sidebar is collapsed", () => {
    render(
      <AppShell>
        <div>Body</div>
      </AppShell>
    );

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    const sidebar = document.getElementById("desktop-sidebar");
    if (!sidebar) throw new Error("Expected the desktop navigation sidebar");
    const header = sidebar.firstElementChild as HTMLElement;
    expect(header.className).toContain("justify-center");
    expect(header.className).not.toContain("justify-between");
  });

  it("aligns the collapsed History button with the other navigation buttons", () => {
    render(
      <AppShell>
        <div>Body</div>
      </AppShell>
    );

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    const sidebar = document.getElementById("desktop-sidebar");
    if (!sidebar) throw new Error("Expected the desktop navigation sidebar");
    const history = within(sidebar).getByRole("button", { name: "History" });
    expect(history.parentElement).toHaveClass("px-2");
    expect(history.className).toContain("w-full");
    expect(history.className).toContain("justify-center");
    expect(history.className).toContain("px-0");
    expect(history.className).not.toContain("mt-");
    expect(history.className).not.toContain("mx-2");
  });

  it("marks the active navigation tab with a muted gray highlight instead of the pale-green block", () => {
    const { rerender } = render(
      <AppShell onReset={vi.fn()} onToggleComparison={vi.fn()}>
        <div>Body</div>
      </AppShell>
    );

    const chatTab = screen.getByRole("button", { name: "Chat" });
    expect(chatTab).toHaveAttribute("aria-current", "page");
    expect(chatTab.className).toContain("bg-slate-100");
    expect(chatTab.className).toContain("font-semibold");
    expect(chatTab.className).not.toContain("bg-teal-50");

    rerender(
      <AppShell isComparisonMode onReset={vi.fn()} onToggleComparison={vi.fn()}>
        <div>Body</div>
      </AppShell>
    );
    const compareTab = screen.getByRole("button", { name: "Switch to chat view" });
    expect(compareTab).toHaveAttribute("aria-current", "page");
    expect(compareTab.className).toContain("bg-slate-100");
    expect(compareTab.className).toContain("font-semibold");
    expect(compareTab.className).not.toContain("bg-teal-50");
  });

  it("separates history with a hairline and uses a tracked heading with regular placeholder text", () => {
    render(
      <AppShell historyItems={[]} onReset={vi.fn()}>
        <div>Body</div>
      </AppShell>
    );

    const sidebar = document.getElementById("desktop-sidebar");
    if (!sidebar) throw new Error("Expected the desktop navigation sidebar");
    const section = within(sidebar).getByRole("heading", { name: "History" }).closest("section");
    if (!section) throw new Error("Expected the history section");
    expect(section.className).toContain("border-t");
    expect(section.className).toContain("border-slate-200");
    const heading = within(section).getByRole("heading", { name: "History" });
    expect(heading.className).toContain("font-semibold");
    expect(heading.className).toContain("uppercase");
    expect(heading.className).toContain("tracking-wider");
    expect(heading.className).toContain("text-slate-500");
    expect(within(sidebar).queryByText("This conversation")).not.toBeInTheDocument();
    const placeholder = within(section).getByText("Your questions will appear here.");
    expect(placeholder.className).toContain("font-normal");
    expect(placeholder.className).toContain("text-slate-400");
    expect(placeholder.className).not.toContain("text-slate-500 ");
    expect(placeholder.className).not.toContain("italic");
  });

  it("pins the drawer close control to the right edge with a 44x44 hit area", () => {
    render(
      <AppShell onReset={vi.fn()}>
        <div>Body</div>
      </AppShell>
    );

    fireEvent.click(screen.getByTestId("mobile-sidebar-toggle"));
    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    expect(dialog.className).toContain("w-[75vw]");
    expect(dialog.className).toContain("max-w-[320px]");
    const header = dialog.firstElementChild as HTMLElement;
    const close = within(header).getByRole("button", { name: "Close navigation" });
    expect(close.querySelector("svg")).toHaveClass("lucide-chevron-left");
    expect(close.className).toContain("h-11");
    expect(close.className).toContain("w-11");
    expect(close.className).toContain("justify-center");
    // The glyph is centered inside an exact 44x44 target that cannot shrink
    // below the touch minimum or be squeezed by siblings.
    expect(close.className).toContain("min-h-[44px]");
    expect(close.className).toContain("min-w-[44px]");
    expect(close.className).toContain("shrink-0");
    // The drawer close control stays on the far right of the logo row.
    expect(header.lastElementChild).toBe(close);
  });

  it("exposes the developer debug mode as a subtle footer switch", () => {
    const onToggleDebug = vi.fn();
    const { rerender } = render(
      <AppShell debugMode={false} onToggleDebugMode={onToggleDebug}>
        <div>Body</div>
      </AppShell>
    );

    const sw = screen.getByRole("switch", { name: "Developer debug mode" });
    // Subtle by default: no amber tint until enabled.
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(sw.textContent).toBe("Debug");
    expect(sw.className).not.toContain("text-amber-700");

    fireEvent.click(sw);
    expect(onToggleDebug).toHaveBeenCalledTimes(1);

    rerender(
      <AppShell debugMode onToggleDebugMode={onToggleDebug}>
        <div>Body</div>
      </AppShell>
    );
    expect(screen.getByRole("switch", { name: "Developer debug mode" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("switch", { name: "Developer debug mode" }).textContent).toBe(
      "Debug on"
    );

    // Without the toggle callback the control never renders.
    rerender(
      <AppShell>
        <div>Body</div>
      </AppShell>
    );
    expect(screen.queryByRole("switch", { name: "Developer debug mode" })).not.toBeInTheDocument();
  });
});

describe("history actions", () => {
  it("uses the same neutral hover colors as the sidebar navigation", () => {
    render(
      <AppShell historyItems={[{ id: "one", label: "Flood question" }]}>
        <div>Body</div>
      </AppShell>
    );

    const sidebar = document.getElementById("desktop-sidebar");
    if (!sidebar) throw new Error("Expected the desktop navigation sidebar");
    const historyItem = within(sidebar).getByTestId("history-item-one");
    const historyButton = within(historyItem).getByRole("button", { name: "Flood question" });
    expect(historyButton).toHaveClass(
      "hover:bg-slate-100",
      "hover:text-slate-900",
      "dark:hover:bg-slate-800",
      "dark:hover:text-white"
    );
    expect(historyButton.className).not.toContain("hover:bg-teal-50");
    expect(historyButton.className).not.toContain("hover:text-teal-800");
  });

  it("deletes without selecting, and reveals the mobile action only after a left swipe", () => {
    const select = vi.fn();
    const remove = vi.fn();
    render(
      <AppShell
        historyItems={[{ id: "one", label: "Flood question" }]}
        onSelectHistory={select}
        onDeleteHistory={remove}
      >
        <div>Body</div>
      </AppShell>
    );
    fireEvent.click(screen.getByTestId("history-delete-one"));
    expect(remove).toHaveBeenCalledWith("one");
    expect(select).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("mobile-sidebar-toggle"));
    const dialog = screen.getByRole("dialog");
    const row = within(dialog).getByTestId("history-item-one");
    const action = within(row).getByTestId("history-swipe-delete-one");
    expect(action).toBeDisabled();
    const surface = within(row).getByRole("button", { name: "Flood question" }).parentElement!;
    fireEvent.pointerDown(surface, { clientX: 100, clientY: 10, pointerType: "touch" });
    fireEvent.pointerMove(surface, { clientX: 104, clientY: 70, pointerType: "touch" });
    fireEvent.pointerUp(surface, { clientX: 104, clientY: 70, pointerType: "touch" });
    expect(action).toBeDisabled();
    fireEvent.pointerDown(surface, { clientX: 100, clientY: 10, pointerType: "touch" });
    fireEvent.pointerMove(surface, { clientX: 45, clientY: 12, pointerType: "touch" });
    fireEvent.pointerUp(surface, { clientX: 45, clientY: 12, pointerType: "touch" });
    expect(action).toBeEnabled();
    expect(remove).toHaveBeenCalledTimes(1);
    fireEvent.click(action);
    expect(remove).toHaveBeenCalledTimes(2);
  });
});
