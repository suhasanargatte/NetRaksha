import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  FileText,
  ArrowRight,
  ShieldAlert,
  Database,
  FolderSearch,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import MetricCard from "@/components/common/MetricCard";
import ChartContainer from "@/components/common/ChartContainer";
import DataTable, { Column } from "@/components/common/DataTable";
import SeverityBadge from "@/components/common/SeverityBadge";
import DemoBanner from "@/components/common/DemoBanner";
import OpsActivityVisualizer from "@/components/common/OpsActivityVisualizer";
import { fetchLogFiles } from "@/api/logs";
import { fetchAlerts } from "@/api/alerts";
import { fetchInvestigations } from "@/api/investigations";
import {
  DEMO_METRICS,
  DEMO_RECENT_ALERTS,
  DEMO_ANALYSIS_RUNS,
  DEMO_SEVERITY_COUNTS,
  DEMO_EVENT_VOLUME,
  DEMO_BANNER,
} from "@/data/sampleData";
import { formatNumber, formatDateTime } from "@/utils/formatters";
import type { Severity, LogFileListItem, AlertListItem } from "@/types";

interface DisplayRunRow {
  id: number;
  filename: string;
  format: string;
  lineCount: number;
  alertCount?: number;
  sizeBytes?: number;
  sha256: string;
  analysedAt: string;
}

interface DisplayAlertRow {
  id: number;
  severity: Severity;
  ruleId: string;
  ruleName: string;
  description: string;
  affectedEntity: string;
  evidenceCount: number;
  mlScore?: number | null;
  timestamp: string;
}

export default function Dashboard() {
  const [selectedAlertForContext, setSelectedAlertForContext] = useState<DisplayAlertRow | null>(null);

  // Query real backend APIs
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ["logs"],
    queryFn: () => fetchLogFiles(1, 10),
  });

  const { data: alertsData } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => fetchAlerts({ page: 1, page_size: 15 }),
  });

  const { data: investigationsData } = useQuery({
    queryKey: ["investigations"],
    queryFn: () => fetchInvestigations(1, 10),
  });

  const hasLiveLogs = (logsData?.total ?? 0) > 0;
  const hasLiveAlerts = (alertsData?.total ?? 0) > 0;
  const hasLiveInvestigations = (investigationsData?.total ?? 0) > 0;

  // Real or demo metric values
  const totalEvents = hasLiveLogs
    ? logsData!.data.reduce((acc: number, f: LogFileListItem) => acc + f.line_count, 0)
    : DEMO_METRICS.totalEvents;

  const alertsForReview = hasLiveAlerts
    ? alertsData!.total
    : DEMO_METRICS.alertsForReview;

  const highPriorityAlerts = hasLiveAlerts
    ? alertsData!.data.filter(
        (a: AlertListItem) => a.severity === "high" || a.severity === "critical"
      ).length
    : DEMO_METRICS.highPriorityAlerts;

  const openInvestigations = hasLiveInvestigations
    ? investigationsData!.data.filter((i) => i.status === "open").length
    : DEMO_METRICS.openInvestigations;

  const isUsingDemo = !hasLiveLogs && !hasLiveAlerts;

  // Display logs table
  const displayedRuns: DisplayRunRow[] = hasLiveLogs
    ? logsData!.data.map((f: LogFileListItem) => ({
        id: f.id,
        filename: f.original_filename,
        format: f.format,
        lineCount: f.line_count,
        sizeBytes: f.size_bytes,
        sha256: f.sha256,
        analysedAt: f.uploaded_at,
      }))
    : DEMO_ANALYSIS_RUNS.map((r) => ({
        id: r.id,
        filename: r.filename,
        format: r.format,
        lineCount: r.lineCount,
        alertCount: r.alertCount,
        sha256: r.sha256,
        analysedAt: r.analysedAt,
      }));

  // Display alerts table
  const displayedAlerts: DisplayAlertRow[] = hasLiveAlerts
    ? alertsData!.data.map((a: AlertListItem) => ({
        id: a.id,
        severity: a.severity,
        ruleId: a.rule_id,
        ruleName: a.rule_name,
        description: a.description,
        affectedEntity: a.affected_entity ?? `Log Archive #${a.log_file_id}`,
        evidenceCount: a.supporting_event_count,
        mlScore: a.ml_score,
        timestamp: a.timestamp ?? a.created_at,
      }))
    : DEMO_RECENT_ALERTS.map((a) => ({
        id: a.id,
        severity: a.severity,
        ruleId: a.ruleId,
        ruleName: a.ruleName,
        description: a.description,
        affectedEntity: a.sourceIp ? `IP: ${a.sourceIp}` : "Host",
        evidenceCount: a.evidenceCount,
        timestamp: a.timestamp,
      }));

  const latestLog = displayedRuns[0];
  const activeContextAlert = selectedAlertForContext || displayedAlerts[0] || null;

  // Dynamic severity breakdown from live alerts
  const severityBreakdown = hasLiveAlerts
    ? [
        {
          severity: "critical",
          label: "Critical",
          count: alertsData!.data.filter((a) => a.severity === "critical").length,
          color: "#FF6B72",
        },
        {
          severity: "high",
          label: "High",
          count: alertsData!.data.filter((a) => a.severity === "high").length,
          color: "#F2B85B",
        },
        {
          severity: "medium",
          label: "Medium",
          count: alertsData!.data.filter((a) => a.severity === "medium").length,
          color: "#F2B85B",
        },
        {
          severity: "low",
          label: "Low",
          count: alertsData!.data.filter((a) => a.severity === "low").length,
          color: "#89858A",
        },
      ]
    : DEMO_SEVERITY_COUNTS;

  // Recent Ingested Evidence Columns
  const logColumns: Column<DisplayRunRow>[] = [
    {
      key: "filename",
      header: "Log Artifact",
      render: (row) => (
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-3.5 h-3.5 text-muted flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="font-mono text-xs text-gray-200 truncate">
              {row.filename}
            </span>
            <span className="text-3xs font-mono text-muted truncate">
              SHA: {row.sha256 ? `${row.sha256.substring(0, 16)}...` : "VERIFIED"}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "format",
      header: "Format",
      width: "80px",
      render: (row) => (
        <span className="font-mono text-2xs uppercase px-1.5 py-0.2 rounded bg-surface-750 border border-surface-700 text-gray-400">
          {row.format}
        </span>
      ),
    },
    {
      key: "lineCount",
      header: "Events",
      width: "90px",
      align: "right",
      render: (row) => (
        <span className="font-mono text-xs tabular-nums text-gray-300">
          {formatNumber(row.lineCount)}
        </span>
      ),
    },
    {
      key: "analysedAt",
      header: "Ingest Date",
      width: "120px",
      align: "right",
      render: (row) => (
        <span className="text-2xs text-muted font-mono">
          {formatDateTime(row.analysedAt).split(" ")[0]}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8 font-sans">
      {isUsingDemo && <DemoBanner message={DEMO_BANNER} />}

      {/* ── 1. Cyber Operations Center Live Visualizer ────────────────── */}
      <OpsActivityVisualizer
        alerts={alertsData?.data || []}
        totalEvents={totalEvents}
        latestLogFilename={latestLog?.filename}
        latestSha256={latestLog?.sha256}
        isIdle={!hasLiveLogs && !hasLiveAlerts}
      />

      {/* ── 2. High-Density Tactical Metric Cards ──────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          title="Total Events Ingested"
          value={formatNumber(totalEvents)}
          subtitle={
            hasLiveLogs
              ? `${logsData?.total ?? 0} log archives normalized`
              : "Demo ingestion dataset"
          }
          icon={<Database className="w-4 h-4 text-accent-400" />}
          badge={{ label: "LOCAL DB", variant: "default" }}
        />

        <MetricCard
          title="Threats Requiring Review"
          value={formatNumber(alertsForReview)}
          subtitle={
            hasLiveAlerts
              ? `${alertsData?.total ?? 0} security rule & ML alerts`
              : "Demo detections requiring review"
          }
          icon={<ShieldAlert className="w-4 h-4 text-amber-400" />}
          badge={{
            label: alertsForReview > 0 ? "ACTION REQ" : "CLEAR",
            variant: alertsForReview > 0 ? "warning" : "success",
          }}
        />

        <MetricCard
          title="Critical / High Priorities"
          value={formatNumber(highPriorityAlerts)}
          subtitle="Immediate forensic investigation"
          icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
          badge={{
            label: highPriorityAlerts > 0 ? "ELEVATED" : "NOMINAL",
            variant: highPriorityAlerts > 0 ? "danger" : "success",
          }}
        />

        <MetricCard
          title="Open Incident Cases"
          value={formatNumber(openInvestigations)}
          subtitle={
            hasLiveInvestigations
              ? `${investigationsData?.total ?? 0} total case files recorded`
              : "Demo investigation dossiers"
          }
          icon={<FolderSearch className="w-4 h-4 text-teal-400" />}
          badge={{
            label: openInvestigations > 0 ? "INVESTIGATING" : "IDLE",
            variant: "info",
          }}
        />
      </div>

      {/* ── 3. Main Live Cyber Operations Split Workspace ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Section: Active Threat Radar & Context Inspector (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Active Threat Queue Table */}
          <div className="nr-card overflow-hidden">
            <div className="nr-card-header">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-status-warning" />
                <h3 className="text-xs font-semibold text-brand-text font-sans">
                  Active Security Alerts
                </h3>
              </div>
              <Link
                to="/alerts"
                className="text-2xs font-mono text-peach-primary hover:text-peach-hover flex items-center gap-1 transition-colors"
              >
                <span>Full Threat Queue</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="divide-y divide-surface-700/60 max-h-80 overflow-y-auto">
              {displayedAlerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  onClick={() => setSelectedAlertForContext(alert)}
                  className={`p-3.5 cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                    activeContextAlert?.id === alert.id
                      ? "bg-peach-surface/60 border-l-2 border-peach-primary"
                      : "hover:bg-surface-750/50"
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <SeverityBadge severity={alert.severity} />
                      <span className="font-mono text-3xs text-brand-muted uppercase">
                        {alert.ruleId}
                      </span>
                      <span className="text-xs font-medium text-brand-text truncate">
                        {alert.ruleName}
                      </span>
                      {alert.mlScore != null && (
                        <span className="font-mono text-3xs px-1.5 py-0.2 rounded bg-surface-750 text-peach-primary border border-peach-primary/30">
                          ML: {(alert.mlScore * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <p className="text-2xs text-brand-secondary line-clamp-1 font-sans">
                      {alert.description}
                    </p>
                    <div className="flex items-center gap-3 text-3xs font-mono text-brand-muted pt-0.5">
                      <span>Entity: <span className="text-brand-text">{alert.affectedEntity}</span></span>
                      <span>&bull;</span>
                      <span>Evidence: <span className="text-status-success">{alert.evidenceCount} events</span></span>
                    </div>
                  </div>

                  <span className="text-3xs font-mono text-brand-muted whitespace-nowrap self-center">
                    {formatDateTime(alert.timestamp).split(" ")[1] || "Just now"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Forensic Context & Evidence Inspector Panel */}
          {activeContextAlert && (
            <div className="nr-card p-4 space-y-3 border-l-2 border-l-peach-primary bg-surface-800">
              <div className="flex items-center justify-between border-b border-surface-700 pb-2.5">
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={activeContextAlert.severity} />
                  <span className="font-sans text-xs font-semibold text-brand-text">
                    Forensic Context: {activeContextAlert.ruleName}
                  </span>
                </div>
                <Link
                  to="/alerts"
                  className="text-2xs font-mono text-peach-primary hover:text-peach-hover flex items-center gap-1"
                >
                  Inspect in Triage <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              <p className="text-xs text-brand-secondary leading-relaxed font-sans bg-surface-850 p-3 rounded-lg border border-surface-700">
                {activeContextAlert.description}
              </p>

              <div className="grid grid-cols-3 gap-2 font-mono text-2xs text-brand-muted pt-1">
                <div>
                  <span className="text-3xs block uppercase font-sans text-brand-muted">Target Entity</span>
                  <span className="text-brand-text font-semibold truncate block">
                    {activeContextAlert.affectedEntity}
                  </span>
                </div>
                <div>
                  <span className="text-3xs block uppercase font-sans text-brand-muted">Supporting Lines</span>
                  <span className="text-status-success font-semibold block">
                    {activeContextAlert.evidenceCount} verifiable rows
                  </span>
                </div>
                <div>
                  <span className="text-3xs block uppercase font-sans text-brand-muted">Occurrence</span>
                  <span className="text-brand-secondary block truncate">
                    {formatDateTime(activeContextAlert.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Section: Ingested Evidence Archives & Severity Distribution (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Severity Distribution Tactical Chart */}
          <ChartContainer
            title="Threat Severity Distribution"
            subtitle="Categorized breakdown of security alerts"
            headerAction={
              <span className="font-mono text-3xs text-brand-muted uppercase">
                {isUsingDemo ? "Simulated" : "Live Analysis"}
              </span>
            }
          >
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={severityBreakdown}
                  margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="2 2"
                    stroke="#35353E"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#89858A", fontSize: 10, fontFamily: "Inter" }}
                    axisLine={{ stroke: "#35353E" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#89858A", fontSize: 10, fontFamily: "JetBrains Mono" }}
                    axisLine={{ stroke: "#35353E" }}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1D1D23",
                      border: "1px solid #35353E",
                      borderRadius: "8px",
                      fontSize: "11px",
                      fontFamily: "Inter",
                      color: "#F4F1EF",
                    }}
                    labelStyle={{ color: "#F4F1EF", fontWeight: 600 }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {severityBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartContainer>

          {/* Ingested Evidence Archives Table */}
          <div className="nr-card overflow-hidden">
            <div className="nr-card-header">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-peach-primary" />
                <h3 className="text-xs font-semibold text-brand-text font-sans">
                  Ingested Log Archives
                </h3>
              </div>
              <Link
                to="/logs"
                className="text-2xs font-mono text-peach-primary hover:text-peach-hover flex items-center gap-1 transition-colors"
              >
                <span>Upload New</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <DataTable
              columns={logColumns}
              data={displayedRuns.slice(0, 4)}
              keyExtractor={(row) => row.id}
              isLoading={logsLoading}
              emptyTitle="No Log Archives Ingested"
              emptyDescription="Upload a CSV, log, or auth archive to begin offline analysis."
            />
          </div>
        </div>
      </div>

      {/* ── 4. Lower Workspace: Event Density Trace ────────────────────── */}
      <ChartContainer
        title="Event Density & Timeline Trace"
        subtitle="Normalized timeline volume across analyzed security events"
        headerAction={
          <div className="flex items-center gap-3 text-3xs font-mono text-brand-muted">
            <span className="flex items-center gap-1.5 font-sans">
              <span className="w-2.5 h-2.5 rounded-full bg-peach-primary inline-block" />
              Raw Events
            </span>
            <span className="flex items-center gap-1.5 font-sans">
              <span className="w-2.5 h-2.5 rounded-full bg-status-critical inline-block" />
              Alerts
            </span>
          </div>
        }
      >
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={DEMO_EVENT_VOLUME}
              margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="eventGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FFB69E" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#FFB69E" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="alertGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF6B72" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#FF6B72" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="2 2"
                stroke="#35353E"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                tick={{ fill: "#89858A", fontSize: 10, fontFamily: "JetBrains Mono" }}
                axisLine={{ stroke: "#35353E" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#89858A", fontSize: 10, fontFamily: "JetBrains Mono" }}
                axisLine={{ stroke: "#35353E" }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1D1D23",
                  border: "1px solid #35353E",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontFamily: "Inter",
                  color: "#F4F1EF",
                }}
              />
              <Area
                type="monotone"
                dataKey="events"
                stroke="#FFB69E"
                strokeWidth={1.5}
                fillOpacity={1}
                fill="url(#eventGrad)"
              />
              <Area
                type="monotone"
                dataKey="alerts"
                stroke="#FF6B72"
                strokeWidth={1.5}
                fillOpacity={1}
                fill="url(#alertGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartContainer>
    </div>
  );
}
