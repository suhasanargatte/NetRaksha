import { Shield, Database, Cpu, HardDrive, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "@/api/logs";

export default function Settings() {
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
  });

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-6 font-sans">
      <div>
        <h1 className="text-base font-semibold text-brand-text flex items-center gap-2">
          <Shield className="w-4 h-4 text-peach-primary" />
          Platform Configuration & Engine Settings
        </h1>
        <p className="text-xs text-brand-muted mt-0.5">
          Local engine parameters, database status, and ML anomaly detector thresholds.
        </p>
      </div>

      {/* Offline Status Card */}
      <div className="nr-card p-4 border-l-2 border-l-peach-primary bg-surface-800">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-peach-primary flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-xs font-semibold text-brand-text tracking-wide">
              Air-Gapped Operation Mode Active
            </h3>
            <p className="text-2xs text-brand-secondary mt-1 leading-relaxed">
              NetRakshak is running completely offline. Zero telemetry, outbound network requests, or external AI API calls are permitted. All log parsing, rule evaluation, and Scikit-learn anomaly scoring occur locally inside the backend runtime.
            </p>
          </div>
        </div>
      </div>

      {/* Backend & Database */}
      <div className="nr-card overflow-hidden">
        <div className="nr-card-header">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-peach-primary" />
            <h3 className="text-xs font-semibold text-brand-text">
              Backend Runtime & Database
            </h3>
          </div>
        </div>
        <div className="divide-y divide-surface-700 text-xs">
          <div className="flex justify-between py-2.5 px-4">
            <span className="text-brand-muted">Application Name</span>
            <span className="font-mono text-brand-text">{health?.app_name ?? "NetRakshak"}</span>
          </div>
          <div className="flex justify-between py-2.5 px-4">
            <span className="text-brand-muted">Application Version</span>
            <span className="font-mono text-brand-text">{health?.version ?? "0.1.0"}</span>
          </div>
          <div className="flex justify-between py-2.5 px-4">
            <span className="text-brand-muted">Runtime Environment</span>
            <span className="font-mono text-brand-text">{health?.environment ?? "development"}</span>
          </div>
          <div className="flex justify-between py-2.5 px-4">
            <span className="text-brand-muted">Database Engine</span>
            <span className="font-mono text-status-success">SQLite Async (aiosqlite)</span>
          </div>
          <div className="flex justify-between py-2.5 px-4">
            <span className="text-brand-muted">Database Health</span>
            <span className="font-mono text-status-success">{health?.database ?? "checking..."}</span>
          </div>
        </div>
      </div>

      {/* ML Engine Parameters */}
      <div className="nr-card overflow-hidden">
        <div className="nr-card-header">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-peach-primary" />
            <h3 className="text-xs font-semibold text-brand-text">
              Machine Learning Detection Parameters
            </h3>
          </div>
        </div>
        <div className="divide-y divide-surface-700 text-xs">
          <div className="flex justify-between py-2.5 px-4">
            <div>
              <span className="text-brand-text font-medium block">Anomaly Algorithm</span>
              <span className="text-2xs text-brand-muted">Unsupervised statistical outlier detection</span>
            </div>
            <span className="font-mono text-brand-text">Isolation Forest (Scikit-learn)</span>
          </div>
          <div className="flex justify-between py-2.5 px-4">
            <div>
              <span className="text-brand-text font-medium block">Contamination Rate</span>
              <span className="text-2xs text-brand-muted">Target anomaly proportion</span>
            </div>
            <span className="font-mono text-brand-text">0.05 (5%)</span>
          </div>
          <div className="flex justify-between py-2.5 px-4">
            <div>
              <span className="text-brand-text font-medium block">Alert Escalation Threshold</span>
              <span className="text-2xs text-brand-muted">Score required to escalate event to alert</span>
            </div>
            <span className="font-mono text-brand-text">0.70</span>
          </div>
          <div className="flex justify-between py-2.5 px-4">
            <div>
              <span className="text-brand-text font-medium block">Model Training Scope</span>
              <span className="text-2xs text-brand-muted">Per-file transparent feature extraction</span>
            </div>
            <span className="font-mono text-brand-text">Dynamic Ingest (No pre-trained weights)</span>
          </div>
        </div>
      </div>

      {/* Storage and Archival */}
      <div className="nr-card overflow-hidden">
        <div className="nr-card-header">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-peach-primary" />
            <h3 className="text-xs font-semibold text-brand-text">
              Storage & Hash Verification
            </h3>
          </div>
        </div>
        <div className="divide-y divide-surface-700 text-xs">
          <div className="flex justify-between py-2.5 px-4">
            <span className="text-brand-muted">Storage Directory</span>
            <span className="font-mono text-brand-text">./uploads</span>
          </div>
          <div className="flex justify-between py-2.5 px-4">
            <span className="text-brand-muted">Maximum File Size</span>
            <span className="font-mono text-brand-text">100 MB</span>
          </div>
          <div className="flex justify-between py-2.5 px-4">
            <span className="text-brand-muted">Integrity Hashing Algorithm</span>
            <span className="font-mono text-brand-text">SHA-256 (FIPS 180-4)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
