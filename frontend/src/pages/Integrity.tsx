import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  ShieldCheck,
  Hash,
  AlertCircle,
  FileText,
  Upload,
  RefreshCw,
  Info,
  Check,
  XCircle,
} from "lucide-react";
import DemoBanner from "@/components/common/DemoBanner";
import DataTable, { Column } from "@/components/common/DataTable";
import { fetchLogFiles } from "@/api/logs";
import { verifyFileIntegrity, verifyLogFileIntegrity } from "@/api/integrity";
import { DEMO_ANALYSIS_RUNS, DEMO_BANNER, DemoAnalysisRun } from "@/data/sampleData";
import { formatDateTime, formatBytes } from "@/utils/formatters";
import type { LogFileListItem, IntegrityVerifyResult } from "@/types";

interface DisplayVaultFile {
  id: number;
  filename: string;
  sha256: string;
  sizeBytes: number;
  status: string;
  analysedAt: string;
  isDemo?: boolean;
}

export default function Integrity() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Verification tool form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [referenceHash, setReferenceHash] = useState("");
  const [verifyMode, setVerifyMode] = useState<"file" | "stored">("file");
  const [selectedLogId, setSelectedLogId] = useState<string>("");
  const [activeResult, setActiveResult] = useState<IntegrityVerifyResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch stored logs
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ["logs"],
    queryFn: () => fetchLogFiles(),
  });

  const hasLiveLogs = (logsData?.total ?? 0) > 0;

  const rawList: DisplayVaultFile[] = hasLiveLogs
    ? logsData!.data.map((f: LogFileListItem) => ({
        id: f.id,
        filename: f.original_filename,
        sha256: f.sha256,
        sizeBytes: f.size_bytes,
        status: f.status,
        analysedAt: f.uploaded_at,
        isDemo: false,
      }))
    : DEMO_ANALYSIS_RUNS.map((d: DemoAnalysisRun) => ({
        id: d.id,
        filename: d.filename,
        sha256: d.sha256,
        sizeBytes: 15420,
        status: d.status,
        analysedAt: d.analysedAt,
        isDemo: true,
      }));

  // Mutation for verifying uploaded file bytes
  const verifyFileMutation = useMutation({
    mutationFn: (vars: { file: File; refHash: string }) =>
      verifyFileIntegrity(vars.file, vars.refHash),
    onSuccess: (result) => {
      setActiveResult(result);
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ["logs"] });
    },
    onError: (err: Error) => {
      setErrorMessage(err.message);
      setActiveResult(null);
    },
  });

  // Mutation for verifying stored log archive from disk
  const verifyLogMutation = useMutation({
    mutationFn: (vars: { logId: number; refHash?: string }) =>
      verifyLogFileIntegrity(vars.logId, vars.refHash),
    onSuccess: (result) => {
      setActiveResult(result);
      setErrorMessage(null);
    },
    onError: (err: Error) => {
      setErrorMessage(err.message);
      setActiveResult(null);
    },
  });

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanRef = referenceHash.trim().toLowerCase();
    if (!cleanRef || cleanRef.length !== 64) {
      setErrorMessage("Reference hash must be exactly 64 hexadecimal characters.");
      return;
    }

    if (verifyMode === "file") {
      if (!selectedFile) {
        setErrorMessage("Please select a file to compute its SHA-256 checksum.");
        return;
      }
      verifyFileMutation.mutate({ file: selectedFile, refHash: cleanRef });
    } else {
      if (!selectedLogId) {
        setErrorMessage("Please select a stored log archive to verify.");
        return;
      }
      verifyLogMutation.mutate({
        logId: parseInt(selectedLogId, 10),
        refHash: cleanRef,
      });
    }
  };

  const handleVerifyLogDirectly = (log: DisplayVaultFile) => {
    if (log.isDemo) {
      setActiveResult({
        filename: log.filename,
        reference_hash: log.sha256,
        calculated_hash: log.sha256,
        matched: true,
        file_size_bytes: log.sizeBytes,
        verified_at: new Date().toISOString(),
        explanation:
          "Matching hashes prove equality to the reference, not the original file's authenticity.",
      });
      return;
    }
    verifyLogMutation.mutate({ logId: log.id });
  };

  const columns: Column<DisplayVaultFile>[] = [
    {
      key: "filename",
      header: "Log Artifact",
      render: (row) => (
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-muted flex-shrink-0" />
          <span className="font-mono text-xs text-gray-200">{row.filename}</span>
        </div>
      ),
    },
    {
      key: "sha256",
      header: "Ingestion SHA-256 Checksum",
      render: (row) => (
        <button
          type="button"
          onClick={() => {
            setReferenceHash(row.sha256);
            if (row.isDemo) {
              handleVerifyLogDirectly(row);
            } else {
              setVerifyMode("stored");
              setSelectedLogId(String(row.id));
              verifyLogMutation.mutate({ logId: row.id, refHash: row.sha256 });
            }
          }}
          className="font-mono text-xs text-teal-400 hover:text-teal-300 text-left select-all break-all transition-colors"
          title="Click to load into verification tool and check bytes"
        >
          {row.sha256}
        </button>
      ),
    },
    {
      key: "sizeBytes",
      header: "Size",
      width: "90px",
      align: "right",
      render: (row) => (
        <span className="font-mono text-xs text-muted">
          {formatBytes(row.sizeBytes)}
        </span>
      ),
    },
    {
      key: "analysedAt",
      header: "Ingest Date",
      align: "right",
      render: (row) => (
        <span className="text-2xs text-muted">
          {formatDateTime(row.analysedAt)}
        </span>
      ),
    },
    {
      key: "action",
      header: "Verification",
      width: "140px",
      align: "right",
      render: (row) => (
        <button
          type="button"
          onClick={() => handleVerifyLogDirectly(row)}
          disabled={verifyLogMutation.isPending}
          className="btn-secondary text-2xs py-1 px-2.5 flex items-center gap-1 ml-auto"
          title="Compute SHA-256 on disk bytes and compare"
        >
          <ShieldCheck className="w-3 h-3 text-teal-400" />
          Verify Bytes
        </button>
      ),
    },
  ];

  const isVerifying = verifyFileMutation.isPending || verifyLogMutation.isPending;

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-6">
      {!hasLiveLogs && <DemoBanner message={DEMO_BANNER} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-semibold text-gray-100 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-teal-400" />
            File Integrity & Evidence Provenance
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Cryptographic SHA-256 verification of raw file bytes against reference baselines.
          </p>
        </div>
      </div>

      {/* Explanation Banner */}
      <div className="p-3.5 rounded bg-surface-900 border border-surface-700 flex items-start gap-3 text-xs leading-relaxed">
        <Info className="w-4 h-4 text-accent-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-gray-200">
            Cryptographic Verification Principle
          </span>
          <p className="text-muted text-2xs">
            Matching hashes prove equality to the reference, not the original file's authenticity. A successful match confirms that the analyzed file bytes are bit-for-bit identical to the reference hash established at ingestion; it does not attest to whether the reference content itself was benign or untampered prior to establishment.
          </p>
        </div>
      </div>

      {/* Interactive Verification Tool */}
      <div className="nr-card p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-surface-600/50 pb-2">
          <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-2">
            <Hash className="w-3.5 h-3.5 text-accent-400" />
            SHA-256 Hash Comparator & Byte Verifier
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setVerifyMode("file");
                setActiveResult(null);
                setErrorMessage(null);
              }}
              className={`text-2xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                verifyMode === "file"
                  ? "bg-peach-primary text-surface-900 font-semibold shadow-peach-glow"
                  : "bg-surface-750 text-brand-muted hover:text-brand-text border border-surface-700"
              }`}
            >
              Verify Uploaded File
            </button>
            <button
              type="button"
              onClick={() => {
                setVerifyMode("stored");
                setActiveResult(null);
                setErrorMessage(null);
              }}
              className={`text-2xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                verifyMode === "stored"
                  ? "bg-peach-primary text-surface-900 font-semibold shadow-peach-glow"
                  : "bg-surface-750 text-brand-muted hover:text-brand-text border border-surface-700"
              }`}
            >
              Verify Ingested Archive
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-status-critical/15 border border-status-critical/30 text-status-critical text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {verifyMode === "file" ? (
              <div>
                <label className="text-2xs uppercase text-muted font-semibold tracking-wider block mb-1">
                  Source File (Bytes Read Locally by Backend) *
                </label>
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 flex-1 text-left truncate"
                  >
                    <Upload className="w-3.5 h-3.5 flex-shrink-0 text-muted" />
                    <span className="truncate">
                      {selectedFile ? selectedFile.name : "Choose File to Check..."}
                    </span>
                  </button>
                  {selectedFile && (
                    <span className="text-2xs font-mono text-muted self-center">
                      ({formatBytes(selectedFile.size)})
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="text-2xs uppercase text-muted font-semibold tracking-wider block mb-1">
                  Stored Log Archive *
                </label>
                <select
                  value={selectedLogId}
                  onChange={(e) => {
                    setSelectedLogId(e.target.value);
                    const found = rawList.find((l) => String(l.id) === e.target.value);
                    if (found && !referenceHash) {
                      setReferenceHash(found.sha256);
                    }
                  }}
                  className="nr-input w-full text-xs"
                >
                  <option value="">Select an ingested log archive...</option>
                  {rawList.map((log) => (
                    <option key={log.id} value={String(log.id)}>
                      #{log.id}: {log.filename} ({formatBytes(log.sizeBytes)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-2xs uppercase text-muted font-semibold tracking-wider block mb-1">
                Reference SHA-256 Hash (64 Hex Characters) *
              </label>
              <input
                type="text"
                value={referenceHash}
                onChange={(e) => setReferenceHash(e.target.value)}
                placeholder="Paste expected 64-character SHA-256 hexadecimal hash..."
                className="nr-input w-full font-mono text-xs"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="submit"
              disabled={isVerifying}
              className="btn-primary text-xs py-1.5 px-4 flex items-center gap-1.5"
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Computing SHA-256 from Raw Bytes...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Execute Integrity Check
                </>
              )}
            </button>
          </div>
        </form>

        {/* Verification Result Display */}
        {activeResult && (
          <div
            className={`mt-4 p-4 rounded border space-y-3 ${
              activeResult.matched
                ? "bg-teal-950/20 border-teal-800/50 text-teal-300"
                : "bg-red-950/20 border-red-800/50 text-red-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {activeResult.matched ? (
                  <Check className="w-5 h-5 text-teal-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    {activeResult.matched
                      ? "Cryptographic Match Confirmed"
                      : "Integrity Mismatch Detected"}
                  </h4>
                  <span className="text-2xs opacity-80">
                    Target: {activeResult.filename} • Checked at{" "}
                    {formatDateTime(activeResult.verified_at)} • Size:{" "}
                    {formatBytes(activeResult.file_size_bytes)}
                  </span>
                </div>
              </div>

              <span
                className={`font-mono text-2xs px-2.5 py-0.5 rounded border uppercase font-semibold ${
                  activeResult.matched
                    ? "bg-teal-900/60 border-teal-600/60 text-teal-200"
                    : "bg-red-900/60 border-red-600/60 text-red-200"
                }`}
              >
                {activeResult.matched ? "MATCH" : "MISMATCH"}
              </span>
            </div>

            {/* Side-by-side or stacked hash display */}
            <div className="space-y-1.5 font-mono text-2xs bg-surface-950/60 p-3 rounded border border-surface-800">
              <div className="space-y-0.5">
                <span className="text-muted block text-[10px] uppercase font-semibold tracking-wider">
                  Calculated Hash (Computed from File Bytes)
                </span>
                <span className="text-gray-100 select-all break-all">
                  {activeResult.calculated_hash}
                </span>
              </div>
              <div className="space-y-0.5 pt-1 border-t border-surface-800">
                <span className="text-muted block text-[10px] uppercase font-semibold tracking-wider">
                  Reference Hash (Supplied Baseline)
                </span>
                <span
                  className={`select-all break-all ${
                    activeResult.matched ? "text-teal-300" : "text-red-400"
                  }`}
                >
                  {activeResult.reference_hash}
                </span>
              </div>
            </div>

            <p className="text-2xs leading-relaxed opacity-90 italic">
              "{activeResult.explanation}"
            </p>
          </div>
        )}
      </div>

      {/* Vault Artifacts Table */}
      <div className="nr-card">
        <div className="px-4 py-3 border-b border-surface-600/50">
          <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
            Evidence Vault Checksums & Audit Provenance
          </h3>
          <p className="text-2xs text-muted mt-0.5">
            Immutable SHA-256 digests computed at ingest. Click any hash to verify its integrity against raw disk bytes.
          </p>
        </div>

        <DataTable
          columns={columns}
          data={rawList}
          keyExtractor={(row) => row.id}
          isLoading={logsLoading}
        />
      </div>
    </div>
  );
}
