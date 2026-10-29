import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Search,
  Hash,
  X,
} from "lucide-react";
import { fetchLogFiles, uploadLogFile, fetchLogEvents, deleteLogFile } from "@/api/logs";
import DataTable, { Column } from "@/components/common/DataTable";
import FilterBar from "@/components/common/FilterBar";
import DemoBanner from "@/components/common/DemoBanner";
import ErrorMessage from "@/components/common/ErrorMessage";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { DEMO_ANALYSIS_RUNS, DEMO_BANNER, DemoAnalysisRun } from "@/data/sampleData";
import { formatNumber, formatDateTime, formatBytes, formatSha256Short } from "@/utils/formatters";
import type { LogFileListItem, LogUploadData, ParsedEvent } from "@/types";

interface DisplayLogItem {
  id: number;
  original_filename: string;
  sha256: string;
  size_bytes: number;
  format: string;
  status: string;
  line_count: number;
  uploaded_at: string;
  isDemo?: boolean;
}

export default function LogAnalysis() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter & pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [formatFilter, setFormatFilter] = useState("all");
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsSearch, setEventsSearch] = useState("");

  // Upload UI state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastValidation, setLastValidation] = useState<LogUploadData | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // 1. Fetch uploaded log files
  const { data: logsData, isLoading: logsLoading, isError: logsError, error: logsErrorObj } = useQuery({
    queryKey: ["logs"],
    queryFn: () => fetchLogFiles(),
  });

  const hasBackendLogs = (logsData?.total ?? 0) > 0;

  // 2. Fetch events for selected log file
  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ["log-events", selectedLogId, eventsPage, eventsSearch],
    queryFn: () => (selectedLogId ? fetchLogEvents(selectedLogId, eventsPage, 50, eventsSearch) : null),
    enabled: selectedLogId !== null,
  });

  // 3. Upload mutation
  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadLogFile(file),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["logs"] });
      setLastValidation(data);
      setSelectedFile(null);
      setUploadError(null);
      setShowUploadModal(false);
      setSelectedLogId(data.log_file.id);
      setEventsPage(1);
    },
    onError: (err: Error) => {
      setUploadError(err.message);
    },
  });

  // 4. Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteLogFile(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["logs"] });
      if (selectedLogId === deletedId) {
        setSelectedLogId(null);
      }
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadError(null);
    }
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError("Please select a file to upload.");
      return;
    }
    uploadMutation.mutate(selectedFile);
  };

  const rawList: DisplayLogItem[] = hasBackendLogs
    ? logsData!.data.map((f: LogFileListItem) => ({
        id: f.id,
        original_filename: f.original_filename,
        sha256: f.sha256,
        size_bytes: f.size_bytes,
        format: f.format,
        status: f.status,
        line_count: f.line_count,
        uploaded_at: f.uploaded_at,
        isDemo: false,
      }))
    : DEMO_ANALYSIS_RUNS.map((d: DemoAnalysisRun) => ({
        id: d.id,
        original_filename: d.filename,
        sha256: d.sha256,
        size_bytes: d.lineCount * 85,
        format: d.format,
        status: d.status,
        line_count: d.lineCount,
        uploaded_at: d.analysedAt,
        isDemo: true,
      }));

  const filteredLogs = rawList.filter((log) => {
    const matchesSearch =
      searchQuery === "" ||
      log.original_filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.sha256.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFormat =
      formatFilter === "all" || log.format === formatFilter;

    return matchesSearch && matchesFormat;
  });

  const logColumns: Column<DisplayLogItem>[] = [
    {
      key: "original_filename",
      header: "Log Filename",
      render: (row) => (
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-muted flex-shrink-0" />
          <span className="font-mono text-xs text-gray-200">
            {row.original_filename}
          </span>
          {selectedLogId === row.id && (
            <span className="text-[10px] bg-accent-500/20 text-accent-400 px-1.5 py-0.2 rounded border border-accent-500/40">
              Active View
            </span>
          )}
        </div>
      ),
    },
    {
      key: "format",
      header: "Format",
      width: "110px",
      render: (row) => (
        <span className="font-mono text-2xs uppercase bg-surface-700/60 px-1.5 py-0.5 rounded border border-surface-600/40 text-gray-300">
          {row.format}
        </span>
      ),
    },
    {
      key: "size_bytes",
      header: "Size",
      width: "90px",
      align: "right",
      render: (row) => (
        <span className="text-2xs text-muted tabular-nums">
          {formatBytes(row.size_bytes)}
        </span>
      ),
    },
    {
      key: "line_count",
      header: "Events",
      width: "100px",
      align: "right",
      render: (row) => (
        <span className="font-mono text-xs tabular-nums text-gray-300">
          {formatNumber(row.line_count)}
        </span>
      ),
    },
    {
      key: "sha256",
      header: "SHA-256 Checksum",
      render: (row) => (
        <span
          className="font-mono text-2xs text-teal-400 select-all"
          title={row.sha256}
        >
          {formatSha256Short(row.sha256)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "90px",
      render: (row) => {
        if (row.status === "ready") {
          return (
            <span className="inline-flex items-center gap-1 text-2xs text-teal-400 bg-teal-950/30 px-1.5 py-0.5 rounded border border-teal-800/40">
              <CheckCircle2 className="w-3 h-3" />
              Ready
            </span>
          );
        }
        if (row.status === "parsing") {
          return (
            <span className="inline-flex items-center gap-1 text-2xs text-amber-400 bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-800/40">
              <Clock className="w-3 h-3" />
              Parsing
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 text-2xs text-red-400 bg-red-950/30 px-1.5 py-0.5 rounded border border-red-800/40">
            <AlertCircle className="w-3 h-3" />
            Error
          </span>
        );
      },
    },
    {
      key: "uploaded_at",
      header: "Uploaded",
      align: "right",
      render: (row) => (
        <span className="text-2xs text-muted">
          {formatDateTime(row.uploaded_at)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "60px",
      align: "right",
      render: (row) =>
        !row.isDemo ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete log file "${row.original_filename}"?`)) {
                deleteMutation.mutate(row.id);
              }
            }}
            className="text-gray-400 hover:text-red-400 p-1"
            title="Delete Log File"
            aria-label="Delete Log File"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        ) : null,
    },
  ];

  const eventColumns: Column<ParsedEvent>[] = [
    {
      key: "line_number",
      header: "Line",
      width: "60px",
      render: (row) => (
        <span className="font-mono text-2xs text-muted tabular-nums">
          #{row.line_number}
        </span>
      ),
    },
    {
      key: "timestamp",
      header: "Timestamp",
      width: "160px",
      render: (row) => (
        <span className="font-mono text-2xs text-gray-300">
          {row.timestamp ? formatDateTime(row.timestamp) : <span className="text-muted italic">missing</span>}
        </span>
      ),
    },
    {
      key: "source_ip",
      header: "Source IP",
      width: "120px",
      render: (row) => (
        <span className="font-mono text-2xs text-gray-300">
          {row.source_ip ?? "-"}
        </span>
      ),
    },
    {
      key: "dest_ip",
      header: "Dest IP",
      width: "120px",
      render: (row) => (
        <span className="font-mono text-2xs text-gray-400">
          {row.dest_ip ?? "-"}
        </span>
      ),
    },
    {
      key: "user",
      header: "User",
      width: "100px",
      render: (row) => (
        <span className="font-mono text-2xs text-gray-200">
          {row.user ?? "-"}
        </span>
      ),
    },
    {
      key: "action",
      header: "Action / Event",
      width: "130px",
      render: (row) => (
        <span className="text-2xs font-medium text-accent-400">
          {row.action ?? "-"}
        </span>
      ),
    },
    {
      key: "message",
      header: "Normalized Message / Raw Evidence",
      render: (row) => (
        <span className="font-mono text-2xs text-gray-300 break-all select-all">
          {row.message ?? row.raw_line}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-6">
      {!hasBackendLogs && <DemoBanner message={DEMO_BANNER} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-semibold text-gray-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-accent-400" />
            Log Analyzer & Ingestion Engine
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Accept and normalize CSV system log archives locally using FastAPI and Pandas.
          </p>
        </div>

        <button
          onClick={() => {
            setShowUploadModal(true);
            setUploadError(null);
          }}
          className="btn-primary text-xs"
        >
          <Upload className="w-3.5 h-3.5 mr-1" />
          Upload & Ingest Log CSV
        </button>
      </div>

      {/* Upload Modal Dialog */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="nr-card w-full max-w-lg overflow-hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-600/50">
              <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-2">
                <Upload className="w-3.5 h-3.5 text-accent-400" />
                Ingest System Log File
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-gray-200 p-1"
                aria-label="Close upload dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-4 space-y-3">
              {uploadError && (
                <ErrorMessage
                  message="Log ingestion failed"
                  detail={uploadError}
                />
              )}

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-surface-600 hover:border-accent-500 rounded p-6 text-center cursor-pointer transition-colors bg-surface-900/40"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.log,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className="w-8 h-8 text-muted mx-auto mb-2 opacity-60" />
                {selectedFile ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-200 font-mono">
                      {selectedFile.name}
                    </p>
                    <p className="text-2xs text-muted">
                      {formatBytes(selectedFile.size)}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-300">
                      Click to choose or drop a CSV log file
                    </p>
                    <p className="text-2xs text-muted">
                      Accepts .csv, .log, and .txt files up to 100 MB.
                    </p>
                  </div>
                )}
              </div>

              <div className="text-2xs text-muted space-y-1 bg-surface-700/30 p-2.5 rounded border border-surface-600/30">
                <p className="font-semibold text-gray-300 uppercase tracking-wider">
                  Ingestion Guarantees:
                </p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Computes immutable SHA-256 hash immediately upon arrival.</li>
                  <li>Detects duplicate records without discarding original evidence.</li>
                  <li>Handles unparseable timestamps and missing values safely.</li>
                </ul>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-surface-600/40">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="btn-ghost text-xs py-1.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || uploadMutation.isPending}
                  className="btn-primary text-xs py-1.5"
                >
                  {uploadMutation.isPending ? (
                    <LoadingSpinner size="sm" label="Validating & Ingesting..." />
                  ) : (
                    "Ingest Log"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Validation Result Banner (when an upload completes) */}
      {lastValidation && (
        <div className="nr-card p-4 border-l-2 border-l-teal-500 bg-surface-800">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-400 flex-shrink-0" />
              <div>
                <h3 className="text-xs font-semibold text-gray-200">
                  Ingestion & Validation Complete: {lastValidation.log_file.original_filename}
                </h3>
                <p className="text-2xs text-muted">
                  SHA-256: <span className="font-mono text-teal-400">{lastValidation.log_file.sha256}</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setLastValidation(null)}
              className="text-muted hover:text-gray-200"
              aria-label="Dismiss summary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-surface-600/40 text-xs">
            <div className="bg-surface-700/40 p-2 rounded">
              <span className="text-2xs text-muted block uppercase">Total Rows</span>
              <span className="font-mono text-sm font-semibold text-gray-200">
                {lastValidation.validation.total_rows.toLocaleString()}
              </span>
            </div>
            <div className="bg-surface-700/40 p-2 rounded">
              <span className="text-2xs text-muted block uppercase">Valid Analyzed</span>
              <span className="font-mono text-sm font-semibold text-teal-400">
                {lastValidation.validation.valid_rows.toLocaleString()}
              </span>
            </div>
            <div className="bg-surface-700/40 p-2 rounded">
              <span className="text-2xs text-muted block uppercase">Duplicates Preserved</span>
              <span className="font-mono text-sm font-semibold text-amber-400">
                {lastValidation.validation.duplicate_rows.toLocaleString()}
              </span>
            </div>
            <div className="bg-surface-700/40 p-2 rounded">
              <span className="text-2xs text-muted block uppercase">Missing / Malformed</span>
              <span className="font-mono text-sm font-semibold text-muted">
                {lastValidation.validation.missing_timestamp_rows + lastValidation.validation.malformed_rows}
              </span>
            </div>
          </div>
        </div>
      )}

      {logsError && (
        <ErrorMessage
          message="Could not connect to backend log repository"
          detail={(logsErrorObj as Error).message}
        />
      )}

      {/* Ingested Log Archives Table */}
      <div className="nr-card">
        <div className="px-4 py-2 border-b border-surface-600/50">
          <FilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Filter archives by name or SHA-256..."
            filters={[
              {
                id: "format",
                label: "Format",
                value: formatFilter,
                onChange: setFormatFilter,
                options: [
                  { label: "All Formats", value: "all" },
                  { label: "CSV", value: "csv" },
                  { label: "Syslog", value: "syslog" },
                  { label: "Auth Log", value: "auth_log" },
                  { label: "Apache Access", value: "apache_access" },
                ],
              },
            ]}
          />
        </div>

        <DataTable
          columns={logColumns}
          data={filteredLogs}
          keyExtractor={(row) => row.id}
          isLoading={logsLoading}
          onRowClick={(row) => {
            if (!row.isDemo) {
              setSelectedLogId(row.id);
              setEventsPage(1);
            }
          }}
          emptyTitle="No log files in vault"
          emptyDescription="Upload a CSV log file to begin local SIEM analysis."
          emptyIcon={<FileText className="w-8 h-8" />}
        />
      </div>

      {/* Parsed Events Viewer (when a backend log file is selected) */}
      {selectedLogId && (
        <div className="nr-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 border-b border-surface-600/50 gap-2">
            <div>
              <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-accent-400" />
                Parsed Events (Log #{selectedLogId})
              </h3>
              <p className="text-2xs text-muted mt-0.5">
                Normalized SIEM events extracted directly from the stored log artifact.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={eventsSearch}
                  onChange={(e) => {
                    setEventsSearch(e.target.value);
                    setEventsPage(1);
                  }}
                  placeholder="Filter events by IP, user, action..."
                  className="nr-input pl-8 py-1 text-xs w-48 sm:w-64"
                />
              </div>
              <button
                onClick={() => setSelectedLogId(null)}
                className="btn-ghost text-2xs py-1 px-2"
              >
                Close Viewer
              </button>
            </div>
          </div>

          <DataTable
            columns={eventColumns}
            data={eventsData?.data ?? []}
            keyExtractor={(row) => row.id}
            isLoading={eventsLoading}
            emptyTitle="No matching events found"
            emptyDescription="Try clearing your search terms or verify parsed lines."
          />

          {/* Pagination Controls */}
          {eventsData && eventsData.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-surface-600/50 text-xs">
              <span className="text-2xs text-muted">
                Showing {((eventsPage - 1) * 50) + 1} -{" "}
                {Math.min(eventsPage * 50, eventsData.total)} of{" "}
                {eventsData.total.toLocaleString()} events
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={eventsPage <= 1}
                  onClick={() => setEventsPage((p) => Math.max(1, p - 1))}
                  className="btn-ghost text-xs p-1 disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-2xs text-gray-300 px-2">
                  Page {eventsPage} of {eventsData.pages}
                </span>
                <button
                  disabled={eventsPage >= eventsData.pages}
                  onClick={() => setEventsPage((p) => Math.min(eventsData.pages, p + 1))}
                  className="btn-ghost text-xs p-1 disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
