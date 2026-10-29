import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAlerts, fetchAlert, updateAlertReview } from "@/api/alerts";
import { fetchInvestigations } from "@/api/investigations";
import SeverityBadge from "@/components/common/SeverityBadge";
import DataTable, { Column } from "@/components/common/DataTable";
import FilterBar from "@/components/common/FilterBar";
import DemoBanner from "@/components/common/DemoBanner";
import ErrorMessage from "@/components/common/ErrorMessage";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { DEMO_RECENT_ALERTS, DEMO_BANNER } from "@/data/sampleData";
import { formatDateTime } from "@/utils/formatters";
import { AlertTriangle, ShieldAlert, X, Eye, Hash, Shield, Cpu, CheckSquare, Save } from "lucide-react";
import type { Severity, AlertListItem, AlertStatus } from "@/types";

interface DisplayAlert {
  id: number;
  rule_id: string;
  rule_name: string;
  severity: Severity;
  status: AlertStatus;
  description: string;
  log_file_id?: number;
  investigation_id?: number | null;
  affected_entity?: string | null;
  timestamp?: string | null;
  analyst_notes?: string | null;
  created_at: string;
  supporting_event_count: number;
  ml_score?: number | null;
  isDemo?: boolean;
}

export default function Alerts() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
  const [selectedDemoAlert, setSelectedDemoAlert] = useState<DisplayAlert | null>(null);

  // Review form state inside drawer
  const [reviewStatus, setReviewStatus] = useState<AlertStatus>("New");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewInvId, setReviewInvId] = useState<string>("");

  // 1. Fetch alerts list
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => fetchAlerts(),
  });

  const hasBackendAlerts = data && data.data.length > 0;

  // 2. Fetch selected alert details if backend alert is chosen
  const { data: alertDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["alert-detail", selectedAlertId],
    queryFn: async () => {
      if (!selectedAlertId) return null;
      const res = await fetchAlert(selectedAlertId);
      setReviewStatus(res.status ?? "New");
      setReviewNotes(res.analyst_notes ?? "");
      setReviewInvId(res.investigation_id ? String(res.investigation_id) : "");
      return res;
    },
    enabled: selectedAlertId !== null,
  });

  // 3. Fetch investigations list for grouping dropdown
  const { data: invList } = useQuery({
    queryKey: ["investigations"],
    queryFn: () => fetchInvestigations(1, 100),
  });

  const reviewMutation = useMutation({
    mutationFn: (payload: { id: number; status?: AlertStatus; analyst_notes?: string; investigation_id?: number | null }) =>
      updateAlertReview(payload.id, {
        status: payload.status,
        analyst_notes: payload.analyst_notes,
        investigation_id: payload.investigation_id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alert-detail", selectedAlertId] });
      queryClient.invalidateQueries({ queryKey: ["investigations"] });
    },
  });

  // Construct table list
  const rawList: DisplayAlert[] = hasBackendAlerts
    ? data.data.map((a: AlertListItem) => ({
        id: a.id,
        rule_id: a.rule_id,
        rule_name: a.rule_name,
        severity: a.severity,
        status: a.status ?? "New",
        description: a.description,
        log_file_id: a.log_file_id,
        investigation_id: a.investigation_id,
        affected_entity: a.affected_entity,
        timestamp: a.timestamp,
        analyst_notes: a.analyst_notes,
        created_at: a.created_at,
        supporting_event_count: a.supporting_event_count,
        ml_score: a.ml_score,
        isDemo: false,
      }))
    : DEMO_RECENT_ALERTS.map((d) => ({
        id: d.id,
        rule_id: d.ruleId,
        rule_name: d.ruleName,
        severity: d.severity,
        status: "New" as AlertStatus,
        description: d.description,
        affected_entity: d.sourceIp ? `IP: ${d.sourceIp}` : "Host",
        timestamp: d.timestamp,
        created_at: d.timestamp,
        supporting_event_count: d.evidenceCount,
        isDemo: true,
      }));

  const filteredAlerts = rawList.filter((alert) => {
    const matchesSearch =
      searchQuery === "" ||
      alert.rule_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.rule_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (alert.affected_entity && alert.affected_entity.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSeverity =
      severityFilter === "all" || alert.severity === severityFilter;

    const matchesStatus =
      statusFilter === "all" || alert.status === statusFilter;

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const columns: Column<DisplayAlert>[] = [
    {
      key: "severity",
      header: "Severity",
      width: "95px",
      render: (row) => <SeverityBadge severity={row.severity} />,
    },
    {
      key: "status",
      header: "Status",
      width: "125px",
      render: (row) => {
        const s = row.status;
        if (s === "Confirmed Incident") {
          return (
            <span className="inline-flex items-center text-[10px] font-semibold text-red-300 bg-red-950/50 border border-red-700/60 px-2 py-0.5 rounded">
              Confirmed Incident
            </span>
          );
        }
        if (s === "Under Review") {
          return (
            <span className="inline-flex items-center text-[10px] font-medium text-amber-300 bg-amber-950/50 border border-amber-700/60 px-2 py-0.5 rounded">
              Under Review
            </span>
          );
        }
        if (s === "Benign") {
          return (
            <span className="inline-flex items-center text-[10px] font-medium text-teal-300 bg-teal-950/50 border border-teal-700/60 px-2 py-0.5 rounded">
              Benign
            </span>
          );
        }
        return (
          <span className="inline-flex items-center text-[10px] font-medium text-blue-300 bg-blue-950/50 border border-blue-700/60 px-2 py-0.5 rounded">
            New
          </span>
        );
      },
    },
    {
      key: "rule_id",
      header: "Rule ID",
      width: "75px",
      render: (row) => (
        <span className="font-mono text-2xs text-gray-400">{row.rule_id}</span>
      ),
    },
    {
      key: "rule_name",
      header: "Detection Rule",
      render: (row) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-gray-200">{row.rule_name}</span>
            {row.ml_score != null && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-purple-950/70 border border-purple-700/50 text-purple-300">
                ML: {(row.ml_score * 100).toFixed(0)}%
              </span>
            )}
          </div>
          <span className="text-2xs text-muted truncate max-w-sm">
            {row.description}
          </span>
        </div>
      ),
    },
    {
      key: "affected_entity",
      header: "Affected Entity",
      width: "160px",
      render: (row) => (
        <span className="font-mono text-xs text-gray-300">
          {row.affected_entity ?? `Log #${row.log_file_id}`}
        </span>
      ),
    },
    {
      key: "supporting_event_count",
      header: "Evidence",
      width: "90px",
      align: "right",
      render: (row) => (
        <span className="font-mono text-xs tabular-nums text-muted">
          {row.supporting_event_count} events
        </span>
      ),
    },
    {
      key: "timestamp",
      header: "Occurred",
      align: "right",
      render: (row) => (
        <span className="text-2xs text-muted">
          {formatDateTime(row.timestamp ?? row.created_at)}
        </span>
      ),
    },
    {
      key: "action",
      header: "",
      width: "50px",
      align: "right",
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (row.isDemo) {
              setSelectedDemoAlert(row);
            } else {
              setSelectedAlertId(row.id);
            }
          }}
          className="text-gray-400 hover:text-accent-400 p-1"
          title="Inspect Alert Evidence"
          aria-label="Inspect Alert Evidence"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  const activeAlert = alertDetail ?? selectedDemoAlert;

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-6">
      {!hasBackendAlerts && <DemoBanner message={DEMO_BANNER} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-semibold text-gray-100 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-orange-400" />
            Threat Detection & Security Alerts
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Deterministic rule-based detections with verified event evidence and affected entities.
          </p>
        </div>
      </div>

      {isError && (
        <ErrorMessage
          message="Could not connect to backend alert service"
          detail={(error as Error).message}
        />
      )}

      <div className="nr-card">
        <div className="px-4 py-2 border-b border-surface-600/50">
          <FilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search rule, entity, description..."
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
              {
                id: "status",
                label: "Status",
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  { label: "All Statuses", value: "all" },
                  { label: "New", value: "New" },
                  { label: "Under Review", value: "Under Review" },
                  { label: "Benign", value: "Benign" },
                  { label: "Confirmed Incident", value: "Confirmed Incident" },
                ],
              },
            ]}
          />
        </div>

        <DataTable
          columns={columns}
          data={filteredAlerts}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
          onRowClick={(row) => {
            if (row.isDemo) {
              setSelectedDemoAlert(row);
            } else {
              setSelectedAlertId(row.id);
            }
          }}
          emptyTitle="No alerts detected"
          emptyDescription="Upload a log file to run automated threat detection rules."
          emptyIcon={<AlertTriangle className="w-8 h-8" />}
        />
      </div>

      {/* Alert Evidence Inspector Drawer */}
      {(selectedAlertId || selectedDemoAlert) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="nr-card w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {detailLoading ? (
              <div className="py-16 flex justify-center">
                <LoadingSpinner size="md" label="Loading alert evidence..." />
              </div>
            ) : activeAlert ? (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b border-surface-600/50">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={activeAlert.severity} />
                    <span className="font-mono text-xs text-gray-400">
                      {activeAlert.rule_id}
                    </span>
                    <h3 className="text-xs font-semibold text-gray-200">
                      {activeAlert.rule_name}
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedAlertId(null);
                      setSelectedDemoAlert(null);
                    }}
                    className="text-gray-400 hover:text-gray-200 p-1"
                    aria-label="Close details"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4 overflow-y-auto space-y-3.5 text-xs">
                  <div>
                    <span className="text-2xs uppercase text-muted font-semibold tracking-wider">
                      Detection Explanation
                    </span>
                    <p className="text-gray-100 mt-1 leading-relaxed bg-surface-900/50 p-2.5 rounded border border-surface-700">
                      {activeAlert.description}
                    </p>
                  </div>

                  {/* ML Anomaly Score Callout */}
                  {"ml_score" in activeAlert && activeAlert.ml_score != null && (
                    <div className="p-3 rounded bg-purple-950/30 border border-purple-800/60 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-2xs uppercase text-purple-300 font-semibold tracking-wider flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-purple-400" />
                          Unsupervised ML Anomaly Detection (Isolation Forest)
                        </span>
                        <span className="font-mono text-xs font-bold text-purple-300 bg-purple-900/60 px-2 py-0.5 rounded border border-purple-700/50">
                          Anomaly Score: {(activeAlert.ml_score * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-2xs text-purple-200/80 leading-relaxed pt-1">
                        Statistical Outlier Alert: This entity or event pattern exhibited high divergence across multi-dimensional feature space (temporal burst, failure ratio, after-hours timing). Note: This is an unsupervised statistical anomaly detection and does not constitute confirmed hostile intent.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-2xs bg-surface-700/40 p-2.5 rounded border border-surface-600/40 font-mono">
                    <div>
                      <span className="text-muted block">Affected Entity</span>
                      <span className="text-accent-400 font-semibold">
                        {"affected_entity" in activeAlert && activeAlert.affected_entity
                          ? activeAlert.affected_entity
                          : "Host / Service"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block">Occurrence Time</span>
                      <span className="text-gray-200">
                        {formatDateTime(
                          ("timestamp" in activeAlert && activeAlert.timestamp)
                            ? activeAlert.timestamp
                            : activeAlert.created_at
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block">Associated Log</span>
                      <span className="text-gray-200">
                        {activeAlert.log_file_id ? `Archive #${activeAlert.log_file_id}` : "Sample log"}
                      </span>
                    </div>
                  </div>

                  {/* Analyst Review & Triage Section */}
                  <div className="p-3 rounded bg-surface-900 border border-surface-700/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-2xs uppercase text-accent-400 font-semibold tracking-wider flex items-center gap-1.5">
                        <CheckSquare className="w-3.5 h-3.5 text-accent-400" />
                        Analyst Triage & Investigation Assignment
                      </span>
                      {selectedAlertId && (
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedAlertId) {
                              reviewMutation.mutate({
                                id: selectedAlertId,
                                status: reviewStatus,
                                analyst_notes: reviewNotes,
                                investigation_id: reviewInvId ? parseInt(reviewInvId, 10) : null,
                              });
                            }
                          }}
                          disabled={reviewMutation.isPending}
                          className="btn-primary text-xs py-1 px-2.5 flex items-center gap-1"
                        >
                          <Save className="w-3 h-3" />
                          {reviewMutation.isPending ? "Saving..." : "Save Review"}
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-2xs uppercase text-muted font-semibold tracking-wider block mb-1">
                          Review Status
                        </label>
                        <select
                          value={reviewStatus}
                          onChange={(e) => setReviewStatus(e.target.value as AlertStatus)}
                          disabled={!selectedAlertId}
                          className="nr-input w-full text-xs"
                        >
                          <option value="New">New</option>
                          <option value="Under Review">Under Review</option>
                          <option value="Benign">Benign</option>
                          <option value="Confirmed Incident">Confirmed Incident</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-2xs uppercase text-muted font-semibold tracking-wider block mb-1">
                          Investigation Group
                        </label>
                        <select
                          value={reviewInvId}
                          onChange={(e) => setReviewInvId(e.target.value)}
                          disabled={!selectedAlertId}
                          className="nr-input w-full text-xs"
                        >
                          <option value="">(None - Unassigned)</option>
                          {invList?.data.map((inv) => (
                            <option key={inv.id} value={String(inv.id)}>
                              Case #{inv.id}: {inv.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-2xs uppercase text-muted font-semibold tracking-wider block mb-1">
                        Analyst Notes
                      </label>
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Document analyst triage steps, rationale for benign or confirmed status, and investigation notes..."
                        disabled={!selectedAlertId}
                        className="nr-input w-full text-xs h-16 resize-none"
                      />
                    </div>
                  </div>

                  {/* Supporting Event IDs */}
                  {"supporting_event_ids" in activeAlert &&
                    activeAlert.supporting_event_ids &&
                    activeAlert.supporting_event_ids.length > 0 && (
                      <div>
                        <span className="text-2xs uppercase text-muted font-semibold tracking-wider flex items-center gap-1">
                          <Hash className="w-3 h-3 text-teal-400" />
                          Supporting Event IDs ({activeAlert.supporting_event_ids.length})
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {activeAlert.supporting_event_ids.map((eid) => (
                            <span
                              key={eid}
                              className="font-mono text-2xs px-2 py-0.5 rounded bg-surface-700 border border-surface-600 text-teal-300"
                            >
                              Event #{eid}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Evidence Items */}
                  <div>
                    <span className="text-2xs uppercase text-muted font-semibold tracking-wider flex items-center gap-1">
                      <Shield className="w-3 h-3 text-orange-400" />
                      Forensic Evidence Lines
                    </span>
                    <p className="text-2xs text-muted mt-0.5 mb-2">
                      Verifiable log entries matching this detection rule:
                    </p>

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {"evidence" in activeAlert && activeAlert.evidence && activeAlert.evidence.length > 0 ? (
                        activeAlert.evidence.map((ev, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded bg-surface-900 border border-surface-700/80 font-mono text-2xs space-y-1"
                          >
                            <div className="flex items-center justify-between text-muted text-[11px]">
                              <span>Line #{ev.line_number}</span>
                              <span className="text-orange-400/90">{ev.reason}</span>
                            </div>
                            <div className="text-gray-300 break-all select-all pt-1 border-t border-surface-800">
                              {ev.raw_line}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-2.5 rounded bg-surface-900 border border-surface-700 font-mono text-2xs text-gray-400">
                          Sample evidence lines linked from demo log file.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-4 py-2.5 border-t border-surface-600/50 flex justify-end">
                  <button
                    onClick={() => {
                      setSelectedAlertId(null);
                      setSelectedDemoAlert(null);
                    }}
                    className="btn-ghost text-xs py-1"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
