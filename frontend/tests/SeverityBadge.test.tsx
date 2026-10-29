/**
 * Smoke test for the SeverityBadge component.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import SeverityBadge from "@/components/common/SeverityBadge";

describe("SeverityBadge", () => {
  it("renders the severity label in uppercase", () => {
    render(<SeverityBadge severity="high" />);
    expect(screen.getByText("HIGH")).toBeInTheDocument();
  });

  it("applies the badge-critical class for critical severity", () => {
    const { container } = render(<SeverityBadge severity="critical" />);
    expect(container.firstChild).toHaveClass("badge-critical");
  });

  it("applies the badge-low class for low severity", () => {
    const { container } = render(<SeverityBadge severity="low" />);
    expect(container.firstChild).toHaveClass("badge-low");
  });

  it("renders all severities without throwing", () => {
    const severities = ["low", "medium", "high", "critical"] as const;
    for (const s of severities) {
      expect(() => render(<SeverityBadge severity={s} />)).not.toThrow();
    }
  });
});

