import clsx from "clsx";

interface Props {
  size?: "sm" | "md";
  className?: string;
  label?: string;
}

export default function LoadingSpinner({ size = "md", className, label = "Loading..." }: Props) {
  const sz = size === "sm" ? "w-4 h-4 border-2" : "w-6 h-6 border-2";
  return (
    <div className={clsx("flex items-center gap-2", className)} role="status" aria-label={label}>
      <span
        className={clsx(
          sz,
          "rounded-full border-surface-600 border-t-accent-500 animate-spin flex-shrink-0"
        )}
      />
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

