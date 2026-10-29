import { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchHealth, fetchLogFiles } from "@/api/logs";
import { fetchAlerts } from "@/api/alerts";
import {
  User,
  Settings as SettingsIcon,
  RefreshCw,
  Terminal,
  Lock,
} from "lucide-react";
import clsx from "clsx";

const ROUTE_TITLES: Record<string, { title: string; code: string }> = {
  "/dashboard": { title: "Operations Overview", code: "OPS-01" },
  "/logs": { title: "Log Ingestion & Analyzer", code: "LOG-02" },
  "/alerts": { title: "Threat Radar & Detections", code: "THR-03" },
  "/investigations": { title: "Incident Case Files", code: "INV-04" },
  "/timeline": { title: "Chronological Forensics", code: "TIM-05" },
  "/integrity": { title: "SHA-256 Provenance Vault", code: "INT-06" },
  "/reports": { title: "Dossier Export Engine", code: "REP-07" },
  "/settings": { title: "Engine Configuration", code: "CFG-08" },
};

export default function TopBar() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [utcTime, setUtcTime] = useState("");

  const routeMeta = ROUTE_TITLES[location.pathname] || {
    title: "Security Operations",
    code: "OPS-XX",
  };

  // Live UTC Forensics Clock
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setUtcTime(`${d.toISOString().slice(11, 19)} UTC`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Backend Health Ping
  const { data: healthData, isError, isLoading } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 15_000,
    retry: false,
  });

  // Query live count summaries for quick topbar metrics
  const { data: logsData } = useQuery({
    queryKey: ["logs"],
    queryFn: () => fetchLogFiles(1, 1),
    staleTime: 30_000,
  });

  const { data: alertsData } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => fetchAlerts({ page_size: 1 }),
    staleTime: 30_000,
  });

  const isOnline = !isError && healthData?.status === "ok";

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["health"] }),
      queryClient.invalidateQueries({ queryKey: ["logs"] }),
      queryClient.invalidateQueries({ queryKey: ["alerts"] }),
      queryClient.invalidateQueries({ queryKey: ["investigations"] }),
    ]);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <header className="h-12 flex items-center justify-between px-4 border-b border-surface-700 bg-surface-850 flex-shrink-0 select-none text-xs font-sans">
      {/* Workspace Indicator & Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-3xs uppercase tracking-wider text-peach-primary font-bold px-2 py-0.5 rounded-md bg-peach-surface border border-peach-primary/30 font-mono">
          {routeMeta.code}
        </span>
        <span className="text-surface-600 hidden sm:inline">/</span>
        <h2 className="text-xs font-semibold text-brand-text tracking-wide truncate">
          {routeMeta.title}
        </h2>
      </div>

      {/* Telemetry Metrics & Health Ribbon */}
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        {/* Active Archive & Alert Badges */}
        <div className="hidden lg:flex items-center gap-3 text-2xs text-brand-muted">
          <span className="flex items-center gap-1.5 font-sans">
            <span className="text-brand-secondary">Archives:</span>
            <span className="text-peach-primary font-semibold font-mono tabular-nums">
              {logsData?.total ?? 0}
            </span>
          </span>
          <span className="text-surface-600">&bull;</span>
          <span className="flex items-center gap-1.5 font-sans">
            <span className="text-brand-secondary">Alerts:</span>
            <span
              className={clsx(
                "font-semibold font-mono tabular-nums",
                (alertsData?.total ?? 0) > 0 ? "text-status-warning" : "text-brand-muted"
              )}
            >
              {alertsData?.total ?? 0}
            </span>
          </span>
        </div>

        {/* Live UTC Forensics Timestamp */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-900 border border-surface-700 text-3xs text-brand-secondary font-mono">
          <Terminal className="w-3 h-3 text-brand-muted" />
          <span className="tabular-nums tracking-tight">{utcTime}</span>
        </div>

        {/* Backend Heartbeat Status Pill */}
        <div
          className={clsx(
            "inline-flex items-center gap-1.5 text-2xs font-medium px-2.5 py-1 rounded-lg border transition-colors",
            isLoading
              ? "text-brand-muted bg-surface-800 border-surface-700"
              : isOnline
              ? "text-status-success bg-status-success/10 border-status-success/30"
              : "text-status-critical bg-status-critical/10 border-status-critical/30"
          )}
          title={
            isOnline
              ? `Backend Connected (FastAPI @ ${healthData?.environment})`
              : "Backend unreachable on http://localhost:8000"
          }
        >
          <span
            className={clsx(
              "w-2 h-2 rounded-full flex-shrink-0",
              isLoading
                ? "bg-brand-muted animate-pulse"
                : isOnline
                ? "bg-status-success shadow-[0_0_8px_rgba(101,201,154,0.6)]"
                : "bg-status-critical shadow-[0_0_8px_rgba(255,107,114,0.6)]"
            )}
          />
          <span className="tracking-wide uppercase font-semibold text-3xs font-mono">
            {isLoading ? "Sync" : isOnline ? "Online" : "Offline"}
          </span>
        </div>

        {/* Air-gap security stamp */}
        <div className="hidden xl:flex items-center gap-1.5 text-3xs text-brand-secondary bg-surface-800 px-2 py-1 rounded-lg border border-surface-700 tracking-wider font-mono">
          <Lock className="w-2.5 h-2.5 text-peach-primary" />
          <span>AIR-GAP</span>
        </div>

        {/* Refresh Action */}
        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="p-1.5 rounded-lg text-brand-muted hover:text-brand-text hover:bg-surface-750 transition-colors"
          title="Refresh Telemetry"
          aria-label="Refresh Telemetry"
        >
          <RefreshCw
            className={clsx("w-3.5 h-3.5", isRefreshing && "animate-spin text-peach-primary")}
          />
        </button>

        {/* Analyst Profile & Settings */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-surface-700">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-900 border border-surface-700 text-brand-secondary text-2xs"
            title="Authenticated Analyst"
          >
            <User className="w-3 h-3 text-peach-primary" />
            <span className="hidden sm:inline font-mono">analyst</span>
          </div>

          <Link
            to="/settings"
            className="p-1.5 rounded-lg text-brand-muted hover:text-brand-text hover:bg-surface-750 transition-colors"
            title="System Configuration"
            aria-label="System Configuration"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
