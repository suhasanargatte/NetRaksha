import { Info } from "lucide-react";
import clsx from "clsx";

interface Props {
  message: string;
  className?: string;
}

/**
 * DemoBanner: displayed on any page or section that uses synthetic sample data.
 * Clearly visible so analysts know demo data is in use.
 */
export default function DemoBanner({ message, className }: Props) {
  return (
    <div
      className={clsx(
        "flex items-center gap-2.5 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3.5 py-2.5 font-sans",
        className
      )}
      role="note"
      aria-label="Demonstration data notice"
    >
      <Info className="w-4 h-4 text-status-warning flex-shrink-0" />
      <p className="text-2xs font-medium text-status-warning leading-relaxed">{message}</p>
    </div>
  );
}
