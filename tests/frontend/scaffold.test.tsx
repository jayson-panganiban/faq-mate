import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { App } from "../../src/frontend/App";

describe("Frontend Scaffolding (Ticket 1)", () => {
  it("renders the initial app shell in a browser environment", () => {
    render(<App />);
    expect(screen.getByText(/FAQ-Mate Edge RAG/i)).toBeInTheDocument();
  });
});
