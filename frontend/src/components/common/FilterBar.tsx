import React from "react";
import clsx from "clsx";
import { Search } from "lucide-react";

export interface FilterOption {
  label: string;
  value: string;
}

interface FilterBarProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  filters?: {
    id: string;
    label: string;
    options: FilterOption[];
    value: string;
    onChange: (value: string) => void;
  }[];
  actions?: React.ReactNode;
  className?: string;
}

export default function FilterBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Filter records...",
  filters = [],
  actions,
  className,
}: FilterBarProps) {
  return (
    <div
      className={clsx(
        "flex flex-wrap items-center justify-between gap-2.5 py-2.5",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[200px]">
        {onSearchChange !== undefined && (
          <div className="relative flex-1 max-w-xs min-w-[160px]">
            <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="nr-input pl-8 py-1 text-xs w-full"
            />
          </div>
        )}

        {filters.map((filter) => (
          <div key={filter.id} className="flex items-center gap-1.5">
            <span className="text-2xs uppercase text-muted font-semibold tracking-wider">
              {filter.label}:
            </span>
            <select
              value={filter.value}
              onChange={(e) => filter.onChange(e.target.value)}
              className="nr-input py-1 text-xs bg-surface-850 border border-surface-700 text-brand-text"
            >
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

