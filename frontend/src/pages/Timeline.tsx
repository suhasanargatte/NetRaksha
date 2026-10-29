import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, ShieldAlert, Terminal, Eye, X, Radio } from "lucide-react";
import FilterBar from "@/components/common/FilterBar";
import SeverityBadge from "@/components/common/SeverityBadge";
import DemoBanner from "@/components/common/DemoBanner";
import DataTable, { Column } from "@/components/common/DataTable";
import { fetchRecentEvents } from "@/api/logs";
import { fetchAlerts } from "@/api/alerts";
import { DEMO_TIMELINE_EVENTS, DemoTimelineEvent, DEMO_BANNER } from "@/data/sampleData";
import { formatDateTime } from "@/utils/formatters";
import type { Severity, ParsedEvent, AlertListItem } from "@/types";

interface DisplayTimelineEvent {
  id: number;
  timestamp: string;
  severity: Severity;
  type: string;
  sourceIp: string;
  user: string;
  message: string;
  rawLine?: string;
  isAlert?: boolean;
}

export default function Timeline() {
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState<DisplayTimelineEvent | null>(null);

  // Fetch real parsed events and alerts
  const { data: recentEventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ["recent-events"],
    queryFn: () => fetchRecentEvents(1, 50),
  });

  const { data: alertsData } = useQuery({
    queryKey: ["alerts-timeline"],
    queryFn: () => fetchAlerts({ page_size: 50 }),
  });

  const hasLiveEvents = (recentEventsData?.total ?? 0) > 0;

  // Build unified chronological timeline
  let timelineList: DisplayTimelineEvent[] = [];

  if (hasLiveEvents) {
    const rawEvents: DisplayTimelineEvent[] = (recentEventsData?.data || []).map((e: ParsedEvent) => {
      // Determine inferred severity for event display
      let sev: Severity = "low";
      const action = (e.action || "").toLowerCase();
      const msg = (e.message || "").toLowerCase();
      if (action.includes("fail") || msg.includes("failed") || msg.includes("error")) {
        sev = "medium";
      } else if (action.includes("root") || action.includes("sudo") || msg.includes("unauthorized")) {
        sev = "high";
      }

      return {
        id: e.id,
        timestamp: e.timestamp || new Date().toISOString(),
        severity: sev,
        type: e.service ? `${e.service.toUpperCase()} EVENT` : "SYSTEM LOG",
        sourceIp: e.source_ip || "Internal / Host",
        user: e.user || "system",
        message: e.message || e.action || e.raw_line,
        rawLine: e.raw_line,
        isAlert: false,
      };
    });

    // Also include real alerts into timeline
    const alertEvents: DisplayTimelineEvent[] = (alertsData?.data || []).map((a: AlertListItem) => ({
      id: 100_000 + a.id,
      timestamp: a.timestamp || a.created_at,
      severity: a.severity,
      type: `DETECTION: ${a.rule_id}`,
      sourceIp: a.affected_entity || "Target Host",
      user: "threat-engine",
      message: `${a.rule_name}: ${a.description}`,
      rawLine: `Rule ${a.rule_id} triggered with ${a.supporting_event_count} evidence events.`,
      isAlert: true,
    }));

    timelineList = [...alertEvents, ...rawEvents].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } else {
    timelineList = DEMO_TIMELINE_EVENTS.map((d: DemoTimelineEvent) => ({
      id: d.id,
      timestamp: d.timestamp,
      severity: d.severity,
      type: d.type,
      sourceIp: d.sourceIp,
      user: d.user,
      message: d.message,
      rawLine: d.message,
      isAlert: false,
    }));
  }

  const filteredEvents = timelineList.filter((ev) => {
    const matchesSearch =
      searchQuery === "" ||
      ev.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.sourceIp.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.type.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeverity =
      severityFilter === "all" || ev.severity === severityFilter;

    return matchesSearch && matchesSeverity;
  });

  const columns: Column<DisplayTimelineEvent>[] = [
    {
      key: "timestamp",
      header: "Timestamp (UTC)",
      width: "160px",
      render: (row) => (
        <div className="flex items-center gap-1.5 font-mono text-2xs text-gray-300">
          <Clock className="w-3 h-3 text-muted flex-shrink-0" />
          <span className="tabular-nums">{formatDateTime(row.timestamp)}</span>
        </div>
      ),
    },
    {
      key: "severity",
      header: "Severity",
      width: "90px",
      render: (row) => <SeverityBadge severity={row.severity} />,
    },
    {
      key: "type",
      header: "Classification",
      width: "150px",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          {row.isAlert && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
          <span className={`text-2xs font-mono font-medium ${row.isAlert ? "text-amber-300" : "text-gray-300"}`}>
            {row.type}
          </span>
        </div>
      ),
    },
    {
      key: "sourceIp",
      header: "Entity / Host",
      width: "140px",
      render: (row) => (
        <span className="font-mono text-2xs text-gray-300 truncate block">
          {row.sourceIp}
        </span>
      ),
    },
    {
      key: "user",
      header: "Account",
      width: "100px",
      render: (row) => (
        <span className="font-mono text-2xs text-muted">
          {row.user}
        </span>
      ),
    },
    {
      key: "message",
      header: "Forensic Audit Record",
      render: (row) => (
        <span className="font-mono text-2xs text-gray-300 break-all select-all">
          {row.message}
        </span>
      ),
    },
    {
      key: "action",
      header: "",
      width: "45px",
      align: "right",
      render: (row) => (
        <button
          type="button"
          onClick={() => setSelectedEvent(row)}
          className="p-1 text-gray-400 hover:text-accent-400 transition-colors"
          title="Inspect raw log entry"
          aria-label="Inspect raw log entry"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8 font-sans">
      {!hasLiveEvents && <DemoBanner message={DEMO_BANNER} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-semibold text-gray-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent-400" />
            Chronological Forensics & Event Stream
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Normalized chronological stream of parsed system events, authentication attempts, and correlated threat detections.
          </p>
        </div>

        {/* Live Stream Status Pill */}
        <div className="flex items-center gap-2 text-2xs font-mono bg-surface-850 px-3 py-1.5 rounded-lg border border-surface-700 self-start sm:self-auto">
          <Radio className="w-3.5 h-3.5 text-peach-primary" />
          <span className="text-brand-muted uppercase font-sans">Stream:</span>
          <span className="text-brand-text font-bold">{filteredEvents.length} Records</span>
        </div>
      </div>

      <div className="nr-card">
        <div className="px-3.5 py-2 border-b border-surface-700/60 bg-surface-850/60">
          <FilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Filter by entity, user, message or rule..."
            filters={[
              {
                id: "severity",
                label: "Severity",
                value: severityFilter,
                onChange: setSeverityFilter,
                options: [
                  { label: "All Severities", value: "all" },
                  { label: "Critical", value: "critical" },
                  { label: "High", value: "high" },
                  { label: "Medium", value: "medium" },
                  { label: "Low", value: "low" },
                ],
              },
            ]}
          />
        </div>

        <DataTable
          columns={columns}
          data={filteredEvents}
          keyExtractor={(row) => row.id}
          isLoading={eventsLoading}
          onRowClick={(row) => setSelectedEvent(row)}
          emptyTitle="No timeline events match filter"
          emptyDescription="Upload a log archive or adjust your search filter criteria."
          emptyIcon={<ShieldAlert className="w-8 h-8" />}
        />
      </div>

      {/* Raw Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="nr-card w-full max-w-xl overflow-hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700/60 bg-surface-850">
              <div className="flex items-center gap-2 font-mono text-xs font-semibold text-gray-200">
                <Terminal className="w-4 h-4 text-accent-400" />
                <span>Forensic Event Record #{selectedEvent.id}</span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-200 p-1"
                aria-label="Close event detail"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-2 text-2xs bg-surface-900 p-2.5 rounded border border-surface-750">
                <div>
                  <span className="text-muted block text-3xs uppercase">Timestamp</span>
                  <span className="text-gray-200">{formatDateTime(selectedEvent.timestamp)}</span>
                </div>
                <div>
                  <span className="text-muted block text-3xs uppercase">Severity</span>
                  <SeverityBadge severity={selectedEvent.severity} />
                </div>
                <div>
                  <span className="text-muted block text-3xs uppercase">Entity / IP</span>
                  <span className="text-accent-400">{selectedEvent.sourceIp}</span>
                </div>
                <div>
                  <span className="text-muted block text-3xs uppercase">Target Account</span>
                  <span className="text-gray-200">{selectedEvent.user}</span>
                </div>
              </div>

              <div>
                <span className="text-3xs text-muted uppercase font-bold tracking-wider block mb-1">
                  Raw Line Content
                </span>
                <pre className="p-3 rounded bg-surface-950 border border-surface-750 text-2xs text-gray-300 break-all whitespace-pre-wrap select-all">
                  {selectedEvent.rawLine || selectedEvent.message}
                </pre>
              </div>
            </div>

            <div className="px-4 py-2.5 border-t border-surface-700/60 bg-surface-850 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="btn-ghost text-xs py-1"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
