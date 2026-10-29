import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchInvestigations,
  createInvestigation,
  updateInvestigation,
  fetchInvestigationAlerts,
  addAlertsToInvestigation,
  removeAlertFromInvestigation,
  fetchInvestigationAudit,
} from "@/api/investigations";
import { fetchAlerts } from "@/api/alerts";
import DataTable, { Column } from "@/components/common/DataTable";
import FilterBar from "@/components/common/FilterBar";
import DemoBanner from "@/components/common/DemoBanner";
import ErrorMessage from "@/components/common/ErrorMessage";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import SeverityBadge from "@/components/common/SeverityBadge";
import { DEMO_INVESTIGATIONS, DEMO_BANNER, DemoInvestigation } from "@/data/sampleData";
import { formatDateTime } from "@/utils/formatters";
import {
  FolderSearch,
  Plus,
  ShieldCheck,
  Clock,
  CheckCircle2,
  X,
  History,
  Link,
  Unlink,
  Save,
  AlertTriangle,
  Download,
  FileText,
} from "lucide-react";
import { downloadInvestigationReport } from "@/api/reports";
import type { Investigation, InvestigationStatus } from "@/types";

interface DisplayInvestigation {
  id: number;
  title: string;
  status: InvestigationStatus;
  alert_count: number;
  notes?: string | null;
  created_at: string;
  isDemo?: boolean;
}

export default function Investigations() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Selected investigation for dossier view
  const [selectedInvId, setSelectedInvId] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState<string>("");
  const [editStatus, setEditStatus] = useState<InvestigationStatus>("open");
  const [selectedAlertToAdd, setSelectedAlertToAdd] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"alerts" | "audit">("alerts");

  // 1. Fetch investigations
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["investigations"],
    queryFn: () => fetchInvestigations(),
  });

  // 2. Fetch selected investigation alerts and audit records
  const { data: invAlerts, isLoading: alertsLoading } = useQuery({
    queryKey: ["investigation-alerts", selectedInvId],
    queryFn: () => (selectedInvId ? fetchInvestigationAlerts(selectedInvId) : []),
    enabled: selectedInvId !== null,
  });

  const { data: invAudit, isLoading: auditLoading } = useQuery({
    queryKey: ["investigation-audit", selectedInvId],
    queryFn: () => (selectedInvId ? fetchInvestigationAudit(selectedInvId) : []),
    enabled: selectedInvId !== null,
  });

  // 3. Fetch all alerts for linking options
  const { data: allAlertsData } = useQuery({
    queryKey: ["alerts-unassigned"],
    queryFn: () => fetchAlerts({ page_size: 100 }),
    enabled: selectedInvId !== null,
  });

  // Creation Mutation
  const createMutation = useMutation({
    mutationFn: (payload: { title: string; notes?: string }) =>
      createInvestigation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investigations"] });
      setIsModalOpen(false);
      setNewTitle("");
      setNewNotes("");
      setFormError(null);
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: (payload: { id: number; status?: InvestigationStatus; notes?: string }) =>
      updateInvestigation(payload.id, {
        status: payload.status,
        notes: payload.notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investigations"] });
      queryClient.invalidateQueries({ queryKey: ["investigation-audit", selectedInvId] });
    },
  });

  // Link Alert Mutation
  const linkAlertMutation = useMutation({
    mutationFn: (payload: { invId: number; alertId: number }) =>
      addAlertsToInvestigation(payload.invId, [payload.alertId]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investigations"] });
      queryClient.invalidateQueries({ queryKey: ["investigation-alerts", selectedInvId] });
      queryClient.invalidateQueries({ queryKey: ["investigation-audit", selectedInvId] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      setSelectedAlertToAdd("");
    },
  });

  // Unlink Alert Mutation
  const unlinkAlertMutation = useMutation({
    mutationFn: (payload: { invId: number; alertId: number }) =>
      removeAlertFromInvestigation(payload.invId, payload.alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investigations"] });
      queryClient.invalidateQueries({ queryKey: ["investigation-alerts", selectedInvId] });
      queryClient.invalidateQueries({ queryKey: ["investigation-audit", selectedInvId] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || newTitle.trim().length < 3) {
      setFormError("Title must be at least 3 characters.");
      return;
    }
    createMutation.mutate({
      title: newTitle.trim(),
      notes: newNotes.trim() ? newNotes.trim() : undefined,
    });
  };

  const hasBackendData = data && data.data.length > 0;

  const rawList: DisplayInvestigation[] = hasBackendData
    ? data.data.map((inv: Investigation) => ({
        id: inv.id,
        title: inv.title,
        status: inv.status,
        alert_count: inv.alert_count,
        notes: inv.notes,
        created_at: inv.created_at,
        isDemo: false,
      }))
    : DEMO_INVESTIGATIONS.map((d: DemoInvestigation) => ({
        id: d.id,
        title: d.title,
        status: d.status as InvestigationStatus,
        alert_count: d.alertCount,
        notes: d.notes,
        created_at: d.createdAt,
        isDemo: true,
      }));

  const filtered = rawList.filter((inv) => {
    const matchesSearch =
      searchQuery === "" ||
      inv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.notes && inv.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === "all" || inv.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const selectedInv = rawList.find((i) => i.id === selectedInvId);

  const columns: Column<DisplayInvestigation>[] = [
    {
      key: "title",
      header: "Investigation Subject",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-xs text-gray-200">{row.title}</span>
          {row.notes && (
            <span className="text-2xs text-muted truncate max-w-md">
              {row.notes}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "120px",
      render: (row) => {
        if (row.status === "open") {
          return (
            <span className="inline-flex items-center gap-1 text-2xs font-medium text-amber-400 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-800/40">
              <Clock className="w-3 h-3" />
              Open
            </span>
          );
        }
        if (row.status === "in_progress") {
          return (
            <span className="inline-flex items-center gap-1 text-2xs font-medium text-accent-400 bg-accent-950/30 px-2 py-0.5 rounded border border-accent-800/40">
              <ShieldCheck className="w-3 h-3" />
              In Progress
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 text-2xs font-medium text-muted bg-surface-700/60 px-2 py-0.5 rounded border border-surface-600/40">
            <CheckCircle2 className="w-3 h-3" />
            Closed
          </span>
        );
      },
    },
    {
      key: "alert_count",
      header: "Correlated Alerts",
      width: "130px",
      align: "right",
      render: (row) => (
        <span className="font-mono text-xs tabular-nums text-gray-300">
          {row.alert_count} alerts
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Initiated",
      align: "right",
      render: (row) => (
        <span className="text-2xs text-muted">
          {formatDateTime(row.created_at)}
        </span>
      ),
    },
  ];

  // Candidates for grouping (alerts not already in this investigation)
  const currentAlertIds = new Set((invAlerts || []).map((a) => a.id));
  const linkableAlerts = (allAlertsData?.data || []).filter(
    (a) => !currentAlertIds.has(a.id)
  );

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-6">
      {!hasBackendData && <DemoBanner message={DEMO_BANNER} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-semibold text-gray-100 flex items-center gap-2">
            <FolderSearch className="w-4 h-4 text-accent-400" />
            Incident Investigations & Case Files
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Group correlated security events, manage analyst notes, and maintain audit integrity.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          New Investigation
        </button>
      </div>

      {isError && (
        <ErrorMessage
          message="Could not load investigations from backend"
          detail={(error as Error).message}
        />
      )}

      <div className="nr-card">
        <div className="px-4 py-2 border-b border-surface-600/50">
          <FilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search case title or notes..."
            filters={[
              {
                id: "status",
                label: "Status",
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  { label: "All Statuses", value: "all" },
                  { label: "Open", value: "open" },
                  { label: "In Progress", value: "in_progress" },
                  { label: "Closed", value: "closed" },
                ],
              },
            ]}
          />
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
          onRowClick={(row) => {
            setSelectedInvId(row.id);
            setEditNotes(row.notes ?? "");
            setEditStatus(row.status);
          }}
          emptyTitle="No investigations found"
          emptyDescription="Create a new investigation case or import log archives."
          emptyIcon={<FolderSearch className="w-8 h-8" />}
        />
      </div>

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="nr-card w-full max-w-md overflow-hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-600/50">
              <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-3.5 h-3.5 text-accent-400" />
                Initiate New Investigation
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-200 p-1"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-4 space-y-3">
              {formError && (
                <div className="p-2 rounded bg-red-950/30 border border-red-800/40 text-red-400 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="text-2xs uppercase text-muted font-semibold tracking-wider block mb-1">
                  Investigation Title *
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Unauthorized Sudo Escalation: Web Server 02"
                  className="nr-input w-full text-xs"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="text-2xs uppercase text-muted font-semibold tracking-wider block mb-1">
                  Initial Case Notes
                </label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Document initial findings, affected hosts, and immediate triage actions taken."
                  className="nr-input w-full text-xs h-24 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-surface-600/40">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-ghost text-xs py-1.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary text-xs py-1.5"
                >
                  {createMutation.isPending ? "Creating..." : "Create Case"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Investigation Dossier Drawer */}
      {selectedInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="nr-card w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-600/50">
              <div className="flex items-center gap-2">
                <FolderSearch className="w-4 h-4 text-accent-400" />
                <h3 className="text-xs font-semibold text-gray-200">
                  Case #{selectedInv.id}: {selectedInv.title}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {!selectedInv.isDemo && (
                  <>
                    <button
                      type="button"
                      onClick={() => downloadInvestigationReport(selectedInv.id, "csv")}
                      className="btn-ghost text-2xs py-1 px-2 border border-surface-700 text-gray-300 hover:text-accent-300"
                      title="Export CSV"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadInvestigationReport(selectedInv.id, "pdf")}
                      className="btn-primary text-2xs py-1 px-2.5 flex items-center gap-1"
                      title="Export PDF Dossier"
                    >
                      <FileText className="w-3 h-3" />
                      PDF Dossier
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedInvId(null)}
                  className="text-gray-400 hover:text-gray-200 p-1"
                  aria-label="Close dossier"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {/* Status and Notes Card */}
              <div className="p-3 rounded bg-surface-900 border border-surface-700 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-2xs uppercase text-muted font-semibold tracking-wider">
                      Status:
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as InvestigationStatus)}
                      disabled={selectedInv.isDemo}
                      className="nr-input text-xs py-1"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>

                  {!selectedInv.isDemo && (
                    <button
                      type="button"
                      onClick={() => {
                        updateMutation.mutate({
                          id: selectedInv.id,
                          status: editStatus,
                          notes: editNotes,
                        });
                      }}
                      disabled={updateMutation.isPending}
                      className="btn-primary text-xs py-1 px-3 flex items-center gap-1 self-start sm:self-auto"
                    >
                      <Save className="w-3 h-3" />
                      {updateMutation.isPending ? "Saving..." : "Save Case Notes"}
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-2xs uppercase text-muted font-semibold tracking-wider block mb-1">
                    Analyst Findings & Incident Notes
                  </label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Document forensic timeline, verified threat actors, and remediation steps taken..."
                    disabled={selectedInv.isDemo}
                    className="nr-input w-full text-xs h-20 resize-none"
                  />
                </div>
              </div>

              {/* Tabs: Correlated Alerts vs Audit Trail */}
              <div className="border-b border-surface-700 flex gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("alerts")}
                  className={`pb-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === "alerts"
                      ? "border-accent-400 text-gray-100"
                      : "border-transparent text-muted hover:text-gray-300"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Correlated Alerts ({invAlerts?.length ?? selectedInv.alert_count})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("audit")}
                  className={`pb-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === "audit"
                      ? "border-teal-400 text-gray-100"
                      : "border-transparent text-muted hover:text-gray-300"
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  Audit Trail & Chain of Custody ({invAudit?.length ?? 0})
                </button>
              </div>

              {/* Tab 1: Correlated Alerts */}
              {activeTab === "alerts" && (
                <div className="space-y-3">
                  {/* Link unassigned alert bar */}
                  {!selectedInv.isDemo && linkableAlerts.length > 0 && (
                    <div className="flex items-center gap-2 bg-surface-800/60 p-2 rounded border border-surface-700">
                      <select
                        value={selectedAlertToAdd}
                        onChange={(e) => setSelectedAlertToAdd(e.target.value)}
                        className="nr-input text-xs flex-1"
                      >
                        <option value="">Select alert to group under this case...</option>
                        {linkableAlerts.map((a) => (
                          <option key={a.id} value={String(a.id)}>
                            Alert #{a.id} [{a.severity.toUpperCase()}]: {a.rule_name}, {a.affected_entity ?? "Host"}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedAlertToAdd) {
                            linkAlertMutation.mutate({
                              invId: selectedInv.id,
                              alertId: parseInt(selectedAlertToAdd, 10),
                            });
                          }
                        }}
                        disabled={!selectedAlertToAdd || linkAlertMutation.isPending}
                        className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1 whitespace-nowrap"
                      >
                        <Link className="w-3 h-3" />
                        {linkAlertMutation.isPending ? "Linking..." : "Link Alert"}
                      </button>
                    </div>
                  )}

                  {alertsLoading ? (
                    <div className="py-8 flex justify-center">
                      <LoadingSpinner size="sm" label="Loading correlated alerts..." />
                    </div>
                  ) : invAlerts && invAlerts.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {invAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          className="p-2.5 rounded bg-surface-900 border border-surface-700/80 flex items-center justify-between gap-2"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <SeverityBadge severity={alert.severity} />
                              <span className="font-mono text-2xs text-gray-400">
                                {alert.rule_id}
                              </span>
                              <span className="text-xs font-medium text-gray-200">
                                {alert.rule_name}
                              </span>
                            </div>
                            <div className="text-2xs text-muted truncate">
                              {alert.description}
                            </div>
                            <div className="font-mono text-[11px] text-accent-400">
                              {alert.affected_entity ?? `Log Archive #${alert.log_file_id}`}
                            </div>
                          </div>

                          {!selectedInv.isDemo && (
                            <button
                              type="button"
                              onClick={() =>
                                unlinkAlertMutation.mutate({
                                  invId: selectedInv.id,
                                  alertId: alert.id,
                                })
                              }
                              disabled={unlinkAlertMutation.isPending}
                              className="text-gray-400 hover:text-red-400 p-1 flex items-center gap-1 text-2xs"
                              title="Unlink from case"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Unlink</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded bg-surface-900 border border-surface-800 text-center text-muted text-xs">
                      No security alerts are currently linked to this investigation case.
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Audit Trail */}
              {activeTab === "audit" && (
                <div className="space-y-2">
                  <p className="text-2xs text-muted">
                    Immutable event log documenting all triage decisions, status transitions, and evidence attachments.
                  </p>

                  {auditLoading ? (
                    <div className="py-8 flex justify-center">
                      <LoadingSpinner size="sm" label="Loading audit history..." />
                    </div>
                  ) : invAudit && invAudit.length > 0 ? (
                    <div className="space-y-2 max-h-72 overflow-y-auto font-mono text-2xs">
                      {invAudit.map((record) => (
                        <div
                          key={record.id}
                          className="p-2.5 rounded bg-surface-900 border border-surface-700/70 space-y-1"
                        >
                          <div className="flex items-center justify-between text-muted text-[11px]">
                            <span className="text-teal-400 font-semibold uppercase">
                              {record.action}
                            </span>
                            <span>{formatDateTime(record.timestamp)}</span>
                          </div>
                          <div className="text-gray-300">
                            {record.detail ?? "No detail provided"}
                          </div>
                          <div className="text-gray-500 text-[10px]">
                            Actor: {record.actor} • Target: {record.entity_type} #{record.entity_id}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded bg-surface-900 border border-surface-800 text-center text-muted text-xs">
                      No audit events recorded for this case yet.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-surface-600/50 flex justify-end">
              <button
                onClick={() => setSelectedInvId(null)}
                className="btn-ghost text-xs py-1"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
