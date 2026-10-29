import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileBarChart2, Download, FileText, CheckCircle2, ShieldCheck, AlertCircle } from "lucide-react";
import DemoBanner from "@/components/common/DemoBanner";
import DataTable, { Column } from "@/components/common/DataTable";
import { fetchInvestigations } from "@/api/investigations";
import { downloadInvestigationReport, downloadAlertsCsv } from "@/api/reports";
import { DEMO_INVESTIGATIONS, DEMO_BANNER, DemoInvestigation } from "@/data/sampleData";
import { formatDateTime } from "@/utils/formatters";
import type { Investigation, InvestigationStatus } from "@/types";

interface DisplayReportCase {
  id: number;
  title: string;
  status: InvestigationStatus;
  alertCount: number;
  createdAt: string;
  isDemo?: boolean;
}

export default function Reports() {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<number | null>(null);

  const { data: invData, isLoading } = useQuery({
    queryKey: ["investigations"],
    queryFn: () => fetchInvestigations(),
  });

  const hasBackendCases = (invData?.total ?? 0) > 0;

  const rawList: DisplayReportCase[] = hasBackendCases
    ? invData!.data.map((inv: Investigation) => ({
        id: inv.id,
        title: inv.title,
        status: inv.status,
        alertCount: inv.alert_count,
        createdAt: inv.created_at,
        isDemo: false,
      }))
    : DEMO_INVESTIGATIONS.map((d: DemoInvestigation) => ({
        id: d.id,
        title: d.title,
        status: d.status as InvestigationStatus,
        alertCount: d.alertCount,
        createdAt: d.createdAt,
        isDemo: true,
      }));

  const handleExport = async (caseId: number, title: string, format: "csv" | "pdf", isDemo = false) => {
    setDownloadError(null);
    if (isDemo) {
      // Deterministic demo artifact
      const dataStr = JSON.stringify(
        {
          reportId: caseId,
          investigation: title,
          format: format.toUpperCase(),
          generatedAt: new Date().toISOString(),
          classification: "RESTRICTED // CYBERSECURITY AUDIT",
          summary: "Demonstration report from NetRakshak local engine.",
        },
        null,
        2
      );
      const blob = new Blob([dataStr], {
        type: format === "pdf" ? "application/pdf" : "text/csv",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `NetRakshak-Case-${caseId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloadSuccess(`Downloaded demonstration ${format.toUpperCase()} for "${title}"`);
      setTimeout(() => setDownloadSuccess(null), 4000);
      return;
    }

    try {
      setIsExporting(caseId);
      await downloadInvestigationReport(caseId, format);
      setDownloadSuccess(`Successfully exported ${format.toUpperCase()} dossier for "${title}"`);
      setTimeout(() => setDownloadSuccess(null), 4000);
    } catch (err: unknown) {
      const error = err as Error;
      setDownloadError(`Export failed: ${error.message || "Could not generate report"}`);
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportAlertsCsv = async () => {
    setDownloadError(null);
    try {
      await downloadAlertsCsv();
      setDownloadSuccess("Successfully exported all security alerts to CSV");
      setTimeout(() => setDownloadSuccess(null), 4000);
    } catch (err: unknown) {
      const error = err as Error;
      setDownloadError(`Alerts export failed: ${error.message || "Could not export alerts"}`);
    }
  };

  const columns: Column<DisplayReportCase>[] = [
    {
      key: "title",
      header: "Investigation Subject",
      render: (row) => (
        <div className="flex items-center gap-2">
          <FileBarChart2 className="w-3.5 h-3.5 text-accent-400 flex-shrink-0" />
          <div className="flex flex-col">
            <span className="font-medium text-xs text-gray-200">
              Case #{row.id}: {row.title}
            </span>
            <span className="text-2xs text-muted">
              {row.alertCount} correlated security alert{row.alertCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Case Status",
      width: "110px",
      render: (row) => (
        <span className="font-mono text-2xs uppercase px-2 py-0.5 rounded bg-surface-700 border border-surface-600 text-gray-300">
          {row.status}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Initiated",
      align: "right",
      render: (row) => (
        <span className="text-2xs text-muted">
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
    {
      key: "action",
      header: "Export Dossier",
      align: "right",
      width: "180px",
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleExport(row.id, row.title, "csv", row.isDemo)}
            disabled={isExporting === row.id}
            className="btn-ghost text-2xs py-1 px-2 text-gray-300 hover:text-accent-300 border border-surface-700"
            title="Download structured CSV"
          >
            <Download className="w-3 h-3 mr-1" />
            CSV
          </button>
          <button
            onClick={() => handleExport(row.id, row.title, "pdf", row.isDemo)}
            disabled={isExporting === row.id}
            className="btn-primary text-2xs py-1 px-2.5 flex items-center gap-1"
            title="Download formal PDF investigation dossier"
          >
            <FileText className="w-3 h-3" />
            PDF Dossier
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-6">
      {!hasBackendCases && <DemoBanner message={DEMO_BANNER} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-semibold text-gray-100 flex items-center gap-2">
            <FileBarChart2 className="w-4 h-4 text-accent-400" />
            Investigation Reports & Case Summaries
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Export formal incident analysis dossiers with full event evidence and SHA-256 integrity proofs.
          </p>
        </div>

        <button
          onClick={handleExportAlertsCsv}
          className="btn-secondary text-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5 text-accent-400" />
          Export All Alerts (CSV)
        </button>
      </div>

      {downloadSuccess && (
        <div className="p-3 bg-status-success/15 border border-status-success/30 text-status-success text-xs rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{downloadSuccess}</span>
        </div>
      )}

      {downloadError && (
        <div className="p-3 bg-status-critical/15 border border-status-critical/30 text-status-critical text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{downloadError}</span>
        </div>
      )}

      {/* Report Features Callout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-3.5 rounded-lg bg-surface-800 border border-surface-700 space-y-1">
          <div className="flex items-center gap-2 text-peach-primary font-semibold">
            <FileText className="w-4 h-4" />
            <span>Formal PDF Incident Dossiers</span>
          </div>
          <p className="text-2xs text-brand-muted leading-relaxed font-sans">
            Compiled with ReportLab completely offline. Includes case classification headers, analyst triage notes, correlated alert breakdown with ML anomaly scores, and full chain-of-custody audit logs.
          </p>
        </div>

        <div className="p-3 rounded bg-surface-900 border border-surface-700/80 space-y-1">
          <div className="flex items-center gap-2 text-teal-400 font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>Cryptographic Verifiability</span>
          </div>
          <p className="text-2xs text-muted leading-relaxed">
            Every exported report references verifiable SHA-256 checksums from ingested evidence archives, ensuring zero-tampering audit compliance across technical and non-technical stakeholder reviews.
          </p>
        </div>
      </div>

      <div className="nr-card">
        <div className="px-4 py-3 border-b border-surface-600/50">
          <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
            Available Case Files for Export
          </h3>
          <p className="text-2xs text-muted mt-0.5">
            Select any active or closed investigation case to download forensic CSV summaries or printable PDF dossiers
          </p>
        </div>

        <DataTable
          columns={columns}
          data={rawList}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
