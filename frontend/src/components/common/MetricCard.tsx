import React from "react";
import clsx from "clsx";

interface MetricBadge {
  label: string;
  variant?: "default" | "success" | "warning" | "danger" | "info";
}

interface Props {
  label?: string;
  title?: string;
  value: string | number;
  sub?: string;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  accent?: "default" | "critical" | "high" | "medium" | "teal";
  icon?: React.ReactNode;
  badge?: MetricBadge;
  className?: string;
}

const ACCENT_VALUE: Record<NonNullable<Props["accent"]>, string> = {
  default:  "text-brand-text",
  critical: "text-status-critical",
  high:     "text-status-warning",
  medium:   "text-status-warning",
  teal:     "text-peach-primary",
};

const ACCENT_BORDER: Record<NonNullable<Props["accent"]>, string> = {
  default:  "border-surface-700",
  critical: "border-status-critical/40 hover:border-status-critical/70",
  high:     "border-status-warning/40 hover:border-status-warning/70",
  medium:   "border-status-warning/30 hover:border-status-warning/60",
  teal:     "border-peach-primary/30 hover:border-peach-primary/60",
};

const BADGE_STYLES: Record<string, string> = {
  default: "bg-surface-750 text-brand-secondary border-surface-700",
  success: "bg-status-success/15 text-status-success border-status-success/30",
  warning: "bg-status-warning/15 text-status-warning border-status-warning/30",
  danger:  "bg-status-critical/15 text-status-critical border-status-critical/30",
  info:    "bg-peach-surface text-peach-primary border-peach-primary/30",
};

export default function MetricCard({
  label,
  title,
  value,
  sub,
  subtitle,
  trendLabel,
  accent = "default",
  icon,
  badge,
  className,
}: Props) {
  const displayLabel = title || label || "";
  const displaySub = subtitle || sub || trendLabel || "";

  return (
    <div
      className={clsx(
        "p-4 rounded-card flex flex-col justify-between select-none bg-surface-800 border transition-all duration-150 hover:bg-surface-750/70 shadow-card hover:shadow-card-hover",
        ACCENT_BORDER[accent],
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="flex-shrink-0 text-brand-muted">{icon}</span>}
          <p className="text-2xs uppercase font-semibold tracking-wider text-brand-muted truncate font-sans">
            {displayLabel}
          </p>
        </div>
        {badge && (
          <span
            className={clsx(
              "text-3xs font-mono font-semibold px-2 py-0.5 rounded border uppercase tracking-wider",
              BADGE_STYLES[badge.variant || "default"]
            )}
          >
            {badge.label}
          </span>
        )}
      </div>

      <div className="my-2.5">
        <p className={clsx("text-2xl sm:text-3xl font-bold tabular-nums tracking-tight font-mono", ACCENT_VALUE[accent])}>
          {typeof value === "number" ? value.toLocaleString("en-US") : value}
        </p>
      </div>

      {displaySub && (
        <p className="text-2xs text-brand-muted truncate border-t border-surface-700/60 pt-2 font-sans">
          {displaySub}
        </p>
      )}
    </div>
  );
}
