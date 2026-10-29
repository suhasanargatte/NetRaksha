import type { Severity } from "@/types";

// ── Severity helpers (Peach Precision Palette) ────────────────────────────────

export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "#FF6B72",
  high:     "#F2B85B",
  medium:   "#F2B85B",
  low:      "#89858A",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Critical",
  high:     "High",
  medium:   "Medium",
  low:      "Low",
};

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 4,
  high:     3,
  medium:   2,
  low:      1,
};

export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITY_ORDER[b] - SEVERITY_ORDER[a];
}
