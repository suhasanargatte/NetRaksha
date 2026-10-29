import clsx from "clsx";
import type { Severity } from "@/types";

interface Props {
  severity: Severity;
  className?: string;
}

const LABELS: Record<Severity, string> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

export default function SeverityBadge({ severity, className }: Props) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-semibold tracking-wider uppercase",
        `badge-${severity}`,
        className
      )}
    >
      {LABELS[severity]}
    </span>
  );
}

