import { AlertCircle } from "lucide-react";
import clsx from "clsx";

interface Props {
  message: string;
  detail?: string;
  className?: string;
}

export default function ErrorMessage({ message, detail, className }: Props) {
  return (
    <div
      className={clsx(
        "flex items-start gap-2.5 rounded-lg border border-status-critical/30 bg-status-critical/10 px-3.5 py-2.5 font-sans",
        className
      )}
      role="alert"
    >
      <AlertCircle className="w-4 h-4 text-status-critical flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-status-critical">{message}</p>
        {detail && <p className="text-2xs text-brand-muted mt-0.5 break-words font-mono">{detail}</p>}
      </div>
    </div>
  );
}
