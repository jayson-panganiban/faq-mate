import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CitationDrawer } from "../../src/frontend/components/CitationDrawer";
import { MarkdownText } from "../../src/frontend/components/MarkdownText";
import { PolicyComparisonView } from "../../src/frontend/components/PolicyComparisonView";
import type { GroundedChunk } from "../../src/frontend/types/chat-ui";
import { sanitizeSourceMarkdown } from "../../src/frontend/utils/markdown";

afterEach(() => {
  cleanup();
});

const CLAUSE_CHUNK: GroundedChunk = {
  id: "chunk-clause",
  relevanceScore: 0.9,
  content:
    '### Definitions — Hospital\n\n**Clause Classification:** `Definition`\n\n**Hospital** means an established hospital registered under any legislation that applies to it.\n\n- Official Source URL: [https://www.example.com/docs/hospital-pds.pdf](https://www.example.com/docs/hospital-pds.pdf)\n- The general definition also appears at https://www.example.com/glossary.md.\n\n> \u26a0\ufe0f **Mandatory Embargo:** a strict 72-hour embargo applies.\n\n<script>alert(\'xss\')</script><img src=x onerror="alert(2)"><a href="javascript:alert(3)">bad</a>',
  source: {
    insurer: "SUNCORP",
    product: "Suncorp Classic Home",
    docType: "PDS",
    section: "Section 2: Definitions",
  },
};

describe("Markdown sanitizer pre-processing (utils/markdown)", () => {
  it("strips internal backend tags like Clause Classification before parsing", () => {
    const sanitized = sanitizeSourceMarkdown(CLAUSE_CHUNK.content);

    expect(sanitized).not.toMatch(/clause classification/i);
    expect(sanitized).not.toMatch(/official source url/i);
    // The substantive copy survives the pass.
    expect(sanitized).toContain("**Hospital** means an established hospital");
  });

  it("formats raw markdown URLs into clean, clickable anchors with the original destination", () => {
    const { container } = render(<MarkdownText markdown={CLAUSE_CHUNK.content} />);

    const anchors = Array.from(container.querySelectorAll("a"));
    expect(anchors.length).toBeGreaterThanOrEqual(2);
    // Never show the URL as visible text; label it cleanly instead.
    for (const anchor of anchors) {
      expect(anchor.textContent).not.toMatch(/^https?:\/\//);
      expect(anchor.getAttribute("href")).toMatch(/^https:\/\/www\.example\.com/);
      expect(anchor.getAttribute("target")).toBe("_blank");
      expect(anchor.getAttribute("rel")).toContain("noopener");
    }
    // The redundant "Official Source URL:" announcement prefix is stripped.
    expect(container.textContent).not.toMatch(/official source url/i);
  });

  it("renders headings, lists and blockquotes structurally and drops raw HTML", () => {
    const { container } = render(<MarkdownText markdown={CLAUSE_CHUNK.content} />);

    expect(container.querySelector("h3")?.textContent).toContain("Definitions");
    expect(container.querySelector("strong")?.textContent).toContain("Hospital");
    expect(container.querySelector("blockquote")).not.toBeNull();
    expect(container.querySelector("ul")).not.toBeNull();

    // Sanitization invariant: raw HTML nodes never reach the DOM.
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("a[href^='javascript']")).toBeNull();
    expect(container.textContent).not.toContain("alert('xss')");
    expect(container.textContent).not.toContain("alert(2)");
    expect(container.textContent).not.toContain("alert(3)");
  });
});

describe("MarkdownText component", () => {
  it("renders bold text as emphasis and ### as a proper HTML header, never raw syntax", () => {
    render(
      <MarkdownText
        markdown={"### Cover Details\n\n**Storm damage** is covered under this section.\n"}
      />
    );

    const body = screen.getByTestId("markdown-text");
    expect(body.querySelector("h3")).not.toBeNull();
    expect(body.querySelector("strong")?.textContent).toBe("Storm damage");
    expect(body.textContent).not.toContain("###");
    expect(body.textContent).not.toContain("**");
  });

  it("never carries backend tags or raw URLs into the rendered UI", () => {
    render(<MarkdownText markdown={CLAUSE_CHUNK.content} />);

    const body = screen.getByTestId("markdown-text");
    expect(body.textContent).not.toMatch(/clause classification/i);
    expect(body.textContent).not.toMatch(/official source url/i);
    expect(body.textContent).not.toMatch(/https:\/\//);
    expect(body.querySelector("h3")).not.toBeNull();
  });
});

describe("Derived markdown surfaces consume the pipeline", () => {
  it("the citation drawer parses the excerpt but copies the verbatim original", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeText },
      configurable: true,
      writable: true,
    });

    render(<CitationDrawer chunks={[CLAUSE_CHUNK]} isOpen onClose={vi.fn()} />);

    const excerpt = screen.getByRole("region", { name: "Operative policy excerpt" });
    expect(excerpt.querySelector("h3")).not.toBeNull();
    expect(excerpt.textContent).not.toMatch(/clause classification/i);
    expect(excerpt.textContent).not.toMatch(/https:\/\//);
    expect(excerpt.textContent).toContain("registered under any legislation");

    fireEvent.click(screen.getByRole("button", { name: "Copy excerpt" }));
    // Copy stays untouched: the legal verbatim source, markdown included.
    await expect(writeText).toHaveBeenCalledWith(CLAUSE_CHUNK.content);
  });

  it("the policy comparison view never renders raw chunk markdown", () => {
    render(<PolicyComparisonView chunks={[CLAUSE_CHUNK]} />);

    const view = screen.getByTestId("policy-comparison-view");
    expect(view.textContent).not.toMatch(/clause classification/i);
    expect(view.textContent).not.toMatch(/https:\/\//);
    expect(view.textContent).not.toContain("###");
    // Parsed excerpts/sources mount through the shared pipeline.
    expect(within(view).getAllByTestId("markdown-text").length).toBeGreaterThan(0);
  });
});
