/**
 * Smoke test for the EmptyState component.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import EmptyState from "@/components/common/EmptyState";

describe("EmptyState", () => {
  it("renders the default title", () => {
    render(<EmptyState />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("renders a custom title", () => {
    render(<EmptyState title="Nothing here yet" />);
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  it("renders a description when provided", () => {
    render(<EmptyState title="Empty" description="Upload a file first." />);
    expect(screen.getByText("Upload a file first.")).toBeInTheDocument();
  });

  it("does not render a description element when omitted", () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByText(/upload/i)).not.toBeInTheDocument();
  });
});

