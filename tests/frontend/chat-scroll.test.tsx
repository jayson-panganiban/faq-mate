import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatContainer } from "../../src/frontend/components/ChatContainer";
import type { ChatMessage } from "../../src/frontend/types/chat-ui";

const base: ChatMessage[] = [
  { id: "question", role: "user", content: "Explain this policy term.", timestamp: 1 },
  { id: "answer", role: "assistant", content: "First part of the answer.", timestamp: 2 },
];
const props = { status: "STREAMING" as const, citations: [], onSelectCitation: vi.fn() };

function metrics(feed: HTMLElement) {
  const size = { height: 1000, viewport: 400, top: 0 };
  Object.defineProperties(feed, {
    scrollHeight: { configurable: true, get: () => size.height },
    clientHeight: { configurable: true, get: () => size.viewport },
    scrollTop: {
      configurable: true,
      get: () => size.top,
      set: (top: number) => {
        size.top = Math.max(0, Math.min(top, size.height - size.viewport));
      },
    },
  });
  return size;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Chat scrolling", () => {
  it("keeps a streaming answer pinned to the feed bottom", () => {
    const { rerender } = render(<ChatContainer {...props} messages={base} />);
    const feed = screen.getByTestId("chat-scroll-container");
    const size = metrics(feed);
    rerender(
      <ChatContainer
        {...props}
        messages={[...base, { id: "more", role: "assistant", content: "More text.", timestamp: 3 }]}
      />
    );
    expect(feed.scrollTop).toBe(600);
    size.height = 1200;
    rerender(
      <ChatContainer
        {...props}
        messages={base.map((message) => ({ ...message, content: `${message.content} More.` }))}
      />
    );
    expect(feed.scrollTop).toBe(800);
    expect(screen.queryByTestId("scroll-to-bottom-button")).not.toBeInTheDocument();
  });

  it("preserves manual reading position and clears stale controls when a resize makes content fit", () => {
    const resized: (() => void)[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resized.push(callback);
        }
        observe() {}
        disconnect() {}
      }
    );
    const { rerender } = render(<ChatContainer {...props} messages={base} />);
    const feed = screen.getByTestId("chat-scroll-container");
    const size = metrics(feed);
    feed.scrollTop = 200;
    fireEvent.scroll(feed);
    rerender(
      <ChatContainer
        {...props}
        messages={base.map((message) => ({ ...message, content: `${message.content} More.` }))}
      />
    );
    expect(feed.scrollTop).toBe(200);
    expect(screen.getByTestId("scroll-to-bottom-button")).toBeInTheDocument();
    size.viewport = 1200;
    size.top = 0;
    act(() => {
      for (const callback of resized) callback();
    });
    expect(screen.queryByTestId("scroll-to-bottom-button")).not.toBeInTheDocument();
  });

  it("returns to the actual feed bottom when the user requests it", () => {
    render(<ChatContainer {...props} messages={base} />);
    const feed = screen.getByTestId("chat-scroll-container");
    metrics(feed);
    feed.scrollTop = 200;
    fireEvent.scroll(feed);
    fireEvent.click(screen.getByTestId("scroll-to-bottom-button"));
    expect(feed.scrollTop).toBe(600);
    expect(screen.queryByTestId("scroll-to-bottom-button")).not.toBeInTheDocument();
  });
});
