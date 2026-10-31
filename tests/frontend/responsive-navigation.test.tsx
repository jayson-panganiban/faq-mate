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

  it("tracks the visual viewport height and ignores pinch zoom", () => {
    const original = Object.getOwnPropertyDescriptor(window, "visualViewport");
    const viewport = new EventTarget() as VisualViewport;
    Object.defineProperties(viewport, {
      height: { value: 600, writable: true },
      scale: { value: 1, writable: true },
    });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    const { container, unmount } = render(
      <AppShell>
        <div>Body</div>
      </AppShell>
    );
    const shell = container.querySelector(".chat-app") as HTMLElement;
    expect(shell.style.height).toBe("600px");
    Object.assign(viewport, { height: 400, scale: 2 });
    act(() => {
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(shell.style.height).toBe("");
    Object.assign(viewport, { height: 400, scale: 1 });
    act(() => {
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(shell.style.height).toBe("400px");
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
