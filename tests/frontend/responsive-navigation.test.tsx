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
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Navigation" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close navigation" }));

    expect(trigger).toHaveAttribute("aria-expanded", "false");
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
    expect(mobileHeaderBrand).toBeInTheDocument();
    expect(screen.getByTestId("mobile-sidebar-toggle")).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-new-chat-button")).not.toBeInTheDocument();

    const sidebar = container.querySelector("#desktop-sidebar");
    expect(sidebar).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("mobile-sidebar-toggle"));
    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    expect(dialog).toBeInTheDocument();
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

  it("places the desktop sidebar toggle inside the sidebar and New Chat first in navigation", () => {
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
    expect(logo).toHaveAttribute("width", "24");
    expect(logo).toHaveAttribute("height", "24");
    expect(brand).toHaveTextContent("FAQ-Mate");
    const desktopToggle = within(header).getByRole("button", { name: "Collapse sidebar" });
    expect(desktopToggle.id).toBe("sidebar-toggle");
    expect(desktopToggle.closest("#desktop-sidebar")).not.toBeNull();
    const appHeader = document.querySelector("header") as HTMLElement;
    expect(
      within(appHeader).queryByRole("button", { name: "Collapse sidebar" })
    ).not.toBeInTheDocument();

    const desktopHeaderBrand = screen.getByRole("heading", { name: "FAQ-Mate" });
    expect(desktopHeaderBrand).toBeInTheDocument();
    const navigation = within(sidebar).getByRole("navigation", { name: "Main navigation" });
    const newChat = screen.getByTestId("reset-chat-button");
    expect(newChat.parentElement).toBe(navigation);
    expect(navigation.firstElementChild).toBe(newChat);

    fireEvent.click(screen.getByTestId("mobile-sidebar-toggle"));
    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    expect(dialog).toBeInTheDocument();
    const mobileHeader = dialog.firstElementChild as HTMLElement;
    expect(within(mobileHeader).queryByRole("img", { name: "FAQ-Mate" })).not.toBeInTheDocument();
    expect(mobileHeader.lastElementChild).toBe(
      within(mobileHeader).getByRole("button", { name: "Close navigation" })
    );
    const mobileNavigation = within(dialog).getByRole("navigation", {
      name: "Mobile navigation",
    });
    const mobileNewChat = within(dialog).getByRole("button", { name: "Start new chat" });
    expect(mobileNewChat.parentElement).toBe(mobileNavigation);
    expect(mobileNavigation.firstElementChild).toBe(mobileNewChat);
  });

  it("matches the app header background color to the body and maintains flat design without dividing line", () => {
    render(
      <AppShell>
        <div>Body</div>
      </AppShell>
    );

    const appHeader = document.querySelector("header") as HTMLElement;
    expect(appHeader.className).toContain("bg-slate-50");
    expect(appHeader.className).toContain("dark:bg-slate-950");
    expect(appHeader.className).not.toContain("border-b");
    expect(appHeader.className).not.toContain("bg-white");
    expect(appHeader.className).not.toContain("dark:bg-slate-900");
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
    expect(history).toBeInTheDocument();
  });

  it("marks the active navigation tab with aria-current", () => {
    const { rerender } = render(
      <AppShell onReset={vi.fn()} onToggleComparison={vi.fn()}>
        <div>Body</div>
      </AppShell>
    );

    const chatTab = screen.getByRole("button", { name: "Chat" });
    expect(chatTab).toHaveAttribute("aria-current", "page");

    rerender(
      <AppShell isComparisonMode onReset={vi.fn()} onToggleComparison={vi.fn()}>
        <div>Body</div>
      </AppShell>
    );
    const compareTab = screen.getByRole("button", { name: "Switch to chat view" });
    expect(compareTab).toHaveAttribute("aria-current", "page");
  });

  it("renders history section heading and placeholder when history is empty", () => {
    render(
      <AppShell historyItems={[]} onReset={vi.fn()}>
        <div>Body</div>
      </AppShell>
    );

    const sidebar = document.getElementById("desktop-sidebar");
    if (!sidebar) throw new Error("Expected the desktop navigation sidebar");
    const section = within(sidebar).getByRole("heading", { name: "History" }).closest("section");
    if (!section) throw new Error("Expected the history section");
    expect(within(section).getByRole("heading", { name: "History" })).toBeInTheDocument();
    expect(within(section).getByText("Your questions will appear here.")).toBeInTheDocument();
  });

  it("right-aligns the drawer close chevron control in the mobile dialog header", () => {
    render(
      <AppShell onReset={vi.fn()}>
        <div>Body</div>
      </AppShell>
    );

    fireEvent.click(screen.getByTestId("mobile-sidebar-toggle"));
    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    expect(dialog).toBeInTheDocument();
    const header = dialog.firstElementChild as HTMLElement;
    expect(header.className).toContain("justify-end");
    const close = within(header).getByRole("button", { name: "Close navigation" });
    expect(close).toBeInTheDocument();
    expect(close.className).toContain("ml-auto");
    expect(close.querySelector("svg")).toHaveClass("lucide-chevron-left");
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
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(sw.textContent).toBe("Debug");

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
  it("renders history item button in sidebar navigation", () => {
    render(
      <AppShell historyItems={[{ id: "one", label: "Flood question" }]}>
        <div>Body</div>
      </AppShell>
    );

    const sidebar = document.getElementById("desktop-sidebar");
    if (!sidebar) throw new Error("Expected the desktop navigation sidebar");
    const historyItem = within(sidebar).getByTestId("history-item-one");
    const historyButton = within(historyItem).getByRole("button", { name: "Flood question" });
    expect(historyButton).toBeInTheDocument();
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
    const button = within(row).getByRole("button", { name: "Flood question" });
    const surface = button.parentElement;
    if (!surface) throw new Error("Expected button parentElement");
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

describe("application brand mark", () => {
  it("renders brand icon in desktop and mobile headers", () => {
    render(
      <AppShell>
        <div>Body</div>
      </AppShell>
    );

    const icons = screen.getAllByTestId("app-icon");
    expect(icons).toHaveLength(2);
    for (const icon of icons) {
      expect(icon).toHaveAttribute("width", "24");
      expect(icon).toHaveAttribute("height", "24");
    }
  });
});
