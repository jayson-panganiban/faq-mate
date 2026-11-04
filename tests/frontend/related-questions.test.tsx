import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RelatedQuestions } from "../../src/frontend/components/RelatedQuestions";

describe("RelatedQuestions Component (Spec 05 & Spec 07 Section 6)", () => {
  it("renders nothing when questions array is empty or undefined", () => {
    const { container: emptyContainer } = render(
      <RelatedQuestions questions={[]} onSelectQuestion={vi.fn()} />
    );
    expect(emptyContainer.firstChild).toBeNull();

    const { container: nullContainer } = render(
      // @ts-expect-error testing undefined handling
      <RelatedQuestions questions={undefined} onSelectQuestion={vi.fn()} />
    );
    expect(nullContainer.firstChild).toBeNull();
  });

  it("renders questions and fires callback with correct query string", () => {
    const handleSelect = vi.fn();
    render(
      <RelatedQuestions
        title="Related questions"
        questions={[
          "What is the 72-hour flood embargo?",
          {
            label: "Compare flood definitions between Suncorp and NRMA",
            query: "Compare flood definitions between SUNCORP and NRMA",
          },
        ]}
        onSelectQuestion={handleSelect}
      />
    );

    expect(screen.getByText("Related questions")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "What is the 72-hour flood embargo?" })
    ).toBeInTheDocument();

    const comparativeButton = screen.getByRole("button", {
      name: "Compare flood definitions between Suncorp and NRMA",
    });
    expect(comparativeButton).toBeInTheDocument();

    // Verify conversational mobile-first attributes and classes
    expect(comparativeButton).toHaveAttribute("data-follow-up");
    expect(comparativeButton).toHaveAttribute("data-compact-action");
    expect(comparativeButton.className).toContain("citation-standalone");
    expect(comparativeButton.className).toContain("text-left");

    // Click plain string question
    fireEvent.click(screen.getByRole("button", { name: "What is the 72-hour flood embargo?" }));
    expect(handleSelect).toHaveBeenCalledWith("What is the 72-hour flood embargo?");

    // Click object question (submits query payload)
    fireEvent.click(comparativeButton);
    expect(handleSelect).toHaveBeenCalledWith("Compare flood definitions between SUNCORP and NRMA");
  });

  it("supports custom title, id, and dataTestId", () => {
    render(
      <RelatedQuestions
        id="custom-heading-id"
        title="Suggested Inquiries"
        dataTestId="custom-follow-ups"
        questions={["How does storm surge differ from flood?"]}
        onSelectQuestion={vi.fn()}
      />
    );

    expect(screen.getByTestId("custom-follow-ups")).toBeInTheDocument();
    const heading = screen.getByText("Suggested Inquiries");
    expect(heading).toHaveAttribute("id", "custom-heading-id");
  });
});
