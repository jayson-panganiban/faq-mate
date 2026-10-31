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
    const trigger = screen.getByRole("button", { name: "Open navigation" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Page action").closest("[inert]")).not.toBeNull();
    const first = within(dialog).getByRole("button", { name: "Start new chat" });
    const last = within(dialog).getByRole("button", { name: "Clear all history" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Close navigation backdrop" }));
    expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("keeps new chat and navigation available on mobile and in the collapsed sidebar", async () => {
    const reset = vi.fn();
    const compare = vi.fn();
    render(
      <AppShell onReset={reset} onToggleComparison={compare}>
        <div>Body</div>
      </AppShell>
    );
    fireEvent.click(screen.getByTestId("mobile-new-chat-button"));
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
    const trigger = screen.getByRole("button", { name: "Open navigation" });
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

  it("styles the sidebar New Chat as a distinct bordered primary action", () => {
    render(
      <AppShell onReset={vi.fn()} onToggleComparison={vi.fn()}>
        <div>Body</div>
      </AppShell>
    );

    const newChat = screen.getByTestId("reset-chat-button");
    // Hairline border + faint surface visually separate it from the list
    expect(newChat.className).toContain("border-slate-200");
    expect(newChat.className).toContain("bg-slate-50");

    // Navigation rows must not adopt the primary container
    const chatTab = screen.getByRole("button", { name: "Chat" });
    expect(chatTab.className).not.toContain("border-slate-200");
    expect(chatTab.className).not.toContain("bg-slate-50");
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

  it("renders the empty history placeholder as a muted italic prompt", () => {
    render(
      <AppShell historyItems={[]} onReset={vi.fn()}>
        <div>Body</div>
      </AppShell>
    );

    const heading = screen.getByRole("heading", { name: "History" });
    // The header stays semibold slate-500; the placeholder recedes below it
    expect(heading.className).toContain("font-semibold");
    expect(heading.className).toContain("text-slate-500");
    const placeholder = screen.getByText("Your questions will appear here.");
    expect(placeholder.className).toContain("italic");
    expect(placeholder.className).toContain("text-slate-400");
    expect(placeholder.className).not.toContain("text-slate-500 ");
  });

  it("pins the drawer close control to the right edge with a 44x44 hit area", () => {
    render(
      <AppShell onReset={vi.fn()}>
        <div>Body</div>
      </AppShell>
    );

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    const newChat = within(dialog).getByRole("button", { name: "Start new chat" });
    const row = newChat.parentElement as HTMLElement;

    // Justified header row: the close control never crowds New Chat on narrow
    // viewports because the row itself is space-between, not growth-dependent.
    expect(row.className).toContain("justify-between");
    // Mobile New Chat keeps its natural width; flex growth is desktop-only.
    expect(newChat.className).not.toContain("flex-1");

    const close = within(dialog).getByRole("button", { name: "Close navigation" });
    expect(close.className).toContain("h-11");
    expect(close.className).toContain("w-11");
    expect(close.className).toContain("justify-center");
    // The glyph is centered inside an exact 44x44 target that cannot shrink
    // below the touch minimum or be squeezed by siblings.
    expect(close.className).toContain("min-h-[44px]");
    expect(close.className).toContain("min-w-[44px]");
    expect(close.className).toContain("shrink-0");
    // It is the last control of the row, pushed to the drawer's right edge.
    expect(row.lastElementChild).toBe(close);
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
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
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
