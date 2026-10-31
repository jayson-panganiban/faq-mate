import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { App } from "../../src/frontend/App";

describe("Frontend Scaffolding (Ticket 1)", () => {
  it("renders the initial app shell in a browser environment", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "FAQ-Mate" })).toBeInTheDocument();
  });
});
