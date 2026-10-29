import React from "react";
import clsx from "clsx";

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export default function ChartContainer({
  title,
  subtitle,
  action,
  headerAction,
  children,
  className,
}: ChartContainerProps) {
  const displayAction = action || headerAction;
  return (
    <div className={clsx("nr-card flex flex-col", className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700 bg-surface-750/70 rounded-t-card">
        <div>
          <h3 className="text-xs font-semibold text-brand-text font-sans tracking-wide">
            {title}
          </h3>
          {subtitle && (
            <p className="text-2xs text-brand-muted mt-0.5 font-sans">{subtitle}</p>
          )}
        </div>
        {displayAction && <div>{displayAction}</div>}
      </div>
      <div className="p-4 flex-1 min-h-[200px]">{children}</div>
    </div>
  );
}
