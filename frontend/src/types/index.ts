/**
 * Shared TypeScript interfaces that mirror the backend Pydantic schemas.
 * Keep in sync with backend/app/schemas/.
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

export type LogFormat = "csv" | "syslog" | "auth_log" | "apache_access" | "nginx_access" | "unknown";
export type LogStatus = "pending" | "parsing" | "ready" | "error";
export type Severity = "low" | "medium" | "high" | "critical";
export type AlertStatus = "New" | "Under Review" | "Benign" | "Confirmed Incident";
export type InvestigationStatus = "open" | "in_progress" | "closed";

// ── API envelope types ────────────────────────────────────────────────────────

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    field?: string;
  };
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

// ── Health ────────────────────────────────────────────────────────────────────

export interface HealthStatus {
  status: "ok" | "degraded";
  app_name: string;
  version: string;
  environment: string;
  database: string;
}

// ── LogFile & Upload ──────────────────────────────────────────────────────────

export interface ValidationSummary {
  total_rows: number;
  valid_rows: number;
  malformed_rows: number;
  duplicate_rows: number;
  missing_timestamp_rows: number;
  detected_columns: string[];
  column_mapping: Record<string, string>;
}

export interface LogFile {
  id: number;
  filename: string;
  original_filename: string;
  sha256: string;
  size_bytes: number;
  format: LogFormat;
  line_count: number;
  status: LogStatus;
  error_detail?: string | null;
  uploaded_at: string;
  parsed_at?: string | null;
}

export interface LogFileListItem {
  id: number;
  original_filename: string;
  sha256: string;
  size_bytes: number;
  format: LogFormat;
  status: LogStatus;
  line_count: number;
  uploaded_at: string;
}

export interface LogUploadData {
  log_file: LogFile;
  validation: ValidationSummary;
}

export interface ParsedEvent {
  id: number;
  log_file_id: number;
  line_number: number;
  timestamp?: string | null;
  source_ip?: string | null;
  dest_ip?: string | null;
  user?: string | null;
  action?: string | null;
  service?: string | null;
  http_method?: string | null;
  http_path?: string | null;
  http_status?: number | null;
  response_bytes?: number | null;
  message?: string | null;
  raw_line: string;
}

// ── Alert ─────────────────────────────────────────────────────────────────────

export interface EvidenceItem {
  event_id?: number | null;
  line_number: number;
  raw_line: string;
  reason: string;
}

export interface Alert {
  id: number;
  log_file_id: number;
  investigation_id?: number | null;
  rule_id: string;
  rule_name: string;
  severity: Severity;
  status: AlertStatus;
  description: string;
  affected_entity?: string | null;
  timestamp?: string | null;
  analyst_notes?: string | null;
  evidence: EvidenceItem[];
  supporting_event_ids: number[];
  ml_score?: number | null;
  created_at: string;
}

export interface AlertListItem {
  id: number;
  log_file_id: number;
  investigation_id?: number | null;
  rule_id: string;
  rule_name: string;
  severity: Severity;
  status: AlertStatus;
  description: string;
  affected_entity?: string | null;
  timestamp?: string | null;
  analyst_notes?: string | null;
  supporting_event_count: number;
  ml_score?: number | null;
  created_at: string;
}

export interface AlertReviewUpdate {
  status?: AlertStatus;
  analyst_notes?: string;
  investigation_id?: number | null;
}

// ── Investigation & Audit ─────────────────────────────────────────────────────

export interface AuditRecord {
  id: number;
  investigation_id?: number | null;
  action: string;
  entity_type: string;
  entity_id: string;
  detail?: string | null;
  actor: string;
  timestamp: string;
}

export interface Investigation {
  id: number;
  title: string;
  status: InvestigationStatus;
  notes?: string | null;
  alert_count: number;
  created_at: string;
  updated_at: string;
}

export interface InvestigationCreate {
  title: string;
  notes?: string;
}

export interface InvestigationUpdate {
  title?: string;
  status?: InvestigationStatus;
  notes?: string;
}

// ── File Integrity ────────────────────────────────────────────────────────────

export interface IntegrityVerifyResult {
  filename: string;
  reference_hash: string;
  calculated_hash: string;
  matched: boolean;
  file_size_bytes: number;
  verified_at: string;
  explanation: string;
}

export interface FileIntegrityRecord {
  id: number;
  filename: string;
  reference_sha256: string;
  calculated_sha256?: string | null;
  status: "match" | "mismatch" | "unverified";
  file_size_bytes?: number | null;
  last_verified_at?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface IntegrityRecordCreate {
  filename: string;
  reference_sha256: string;
  notes?: string;
}

// ── Dashboard summary ─────────────────────────────────────────────────────────

export interface DashboardSummary {
  total_log_files: number;
  total_events: number;
  total_alerts: number;
  open_investigations: number;
  alerts_by_severity: Record<Severity, number>;
  recent_alerts: AlertListItem[];
}
