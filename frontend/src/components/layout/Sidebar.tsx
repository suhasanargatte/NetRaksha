import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  AlertTriangle,
  FolderSearch,
  Clock,
  ShieldCheck,
  FileBarChart2,
  Settings as SettingsIcon,
  Shield,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import clsx from "clsx";

interface NavItem {
  to: string;
  label: string;
  code: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard",      label: "Overview",         code: "01", icon: LayoutDashboard },
  { to: "/logs",           label: "Log Analyzer",     code: "02", icon: FileText },
  { to: "/alerts",         label: "Threat Detection", code: "03", icon: AlertTriangle },
  { to: "/investigations", label: "Investigations",   code: "04", icon: FolderSearch },
  { to: "/timeline",       label: "Event Timeline",   code: "05", icon: Clock },
  { to: "/integrity",      label: "File Integrity",   code: "06", icon: ShieldCheck },
  { to: "/reports",        label: "Reports Engine",   code: "07", icon: FileBarChart2 },
  { to: "/settings",       label: "Configuration",    code: "08", icon: SettingsIcon },
];

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={clsx(
        "flex-shrink-0 bg-surface-850 border-r border-surface-700 flex flex-col transition-all duration-200 z-20 select-none",
        isCollapsed ? "w-14" : "w-60"
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-surface-700 min-h-[52px] bg-surface-900/60">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-7 h-7 rounded-lg bg-peach-surface border border-peach-primary/30 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Shield className="w-4 h-4 text-peach-primary" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-xs tracking-wider text-brand-text uppercase truncate">
                NetRakshak
              </span>
              <span className="text-[10px] text-peach-primary font-mono tracking-wider uppercase leading-none mt-0.5">
                Cyber Ops &bull; v0.1.0
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-brand-muted hover:text-brand-text hover:bg-surface-750 p-1.5 rounded-lg transition-colors"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-2.5 py-3.5 space-y-1 overflow-y-auto">
        {!isCollapsed && (
          <div className="px-2 pb-2 text-2xs font-semibold uppercase tracking-wider text-brand-muted font-sans">
            Navigation
          </div>
        )}
        {NAV_ITEMS.map(({ to, label, code, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-colors group relative font-sans",
                isActive
                  ? "bg-peach-surface text-brand-text border border-peach-primary/30 shadow-sm font-medium"
                  : "text-brand-secondary hover:bg-surface-750 hover:text-brand-text border border-transparent"
              )
            }
            title={isCollapsed ? label : undefined}
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={clsx(
                    "w-4 h-4 flex-shrink-0 transition-colors",
                    isActive
                      ? "text-peach-primary"
                      : "text-brand-muted group-hover:text-brand-text"
                  )}
                />
                {!isCollapsed && (
                  <div className="flex items-center justify-between flex-1 min-w-0">
                    <span className="truncate text-xs font-medium">
                      {label}
                    </span>
                    <span
                      className={clsx(
                        "text-3xs font-mono px-1.5 py-0.5 rounded",
                        isActive
                          ? "bg-surface-800 text-peach-primary border border-peach-primary/30"
                          : "text-brand-muted group-hover:text-brand-secondary"
                      )}
                    >
                      {code}
                    </span>
                  </div>
                )}
                {/* Active indicator bar */}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 bg-peach-primary rounded-r" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Persistent System Status Footer */}
      {!isCollapsed && (
        <div className="px-3.5 py-3 border-t border-surface-700 bg-surface-900/60 text-2xs space-y-1.5 font-sans">
          <div className="flex items-center justify-between text-brand-muted">
            <span>Detection:</span>
            <span className="text-status-success font-medium font-mono">Rules + ML</span>
          </div>
          <div className="flex items-center justify-between text-brand-muted">
            <span>Integrity:</span>
            <span className="text-brand-secondary font-mono">SHA-256</span>
          </div>
          <div className="flex items-center justify-between text-brand-muted">
            <span>Environment:</span>
            <span className="text-peach-primary font-medium font-mono">Air-Gapped</span>
          </div>
        </div>
      )}
    </aside>
  );
}
