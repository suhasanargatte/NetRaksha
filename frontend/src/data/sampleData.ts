/**
 * Deterministic demonstration dataset.
 *
 * ⚠ DEMONSTRATION DATA: No live security analysis is connected.
 * All values below are synthetic and representative only.
 * Import real log files through the Log Analyzer to see actual results.
 */

import type { Severity } from "@/types";

export const DEMO_BANNER =
  "DEMONSTRATION DATA: No live analysis is connected. Import log files for real results.";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DemoAlert {
  id: number;
  timestamp: string;
  severity: Severity;
  ruleId: string;
  ruleName: string;
  sourceIp: string;
  description: string;
  logFile: string;
  evidenceCount: number;
}

export interface DemoAnalysisRun {
  id: number;
  filename: string;
  format: string;
  lineCount: number;
  alertCount: number;
  status: "ready" | "parsing" | "error";
  analysedAt: string;
  sha256: string;
}

export interface DemoInvestigation {
  id: number;
  title: string;
  status: "open" | "in_progress" | "closed";
  alertCount: number;
  createdAt: string;
  updatedAt: string;
  notes: string;
}

export interface SeverityCount {
  severity: Severity;
  label: string;
  count: number;
  color: string;
}

export interface EventVolumePoint {
  time: string;
  events: number;
  alerts: number;
}

export interface DemoTimelineEvent {
  id: number;
  timestamp: string;
  severity: Severity;
  type: string;
  sourceIp: string;
  user: string;
  message: string;
}

// ── Sample data ───────────────────────────────────────────────────────────────

export const DEMO_RECENT_ALERTS: DemoAlert[] = [
  {
    id: 1,
    timestamp: "2026-10-28T17:12:04Z",
    severity: "critical",
    ruleId: "R01",
    ruleName: "Brute Force Login",
    sourceIp: "192.168.4.77",
    description: "47 failed SSH login attempts from 192.168.4.77 within 60 s",
    logFile: "auth.log",
    evidenceCount: 47,
  },
  {
    id: 2,
    timestamp: "2026-10-28T16:55:11Z",
    severity: "high",
    ruleId: "R07",
    ruleName: "SQLi Pattern",
    sourceIp: "10.0.2.88",
    description: "SQL injection pattern detected in HTTP request path",
    logFile: "access.log",
    evidenceCount: 3,
  },
  {
    id: 3,
    timestamp: "2026-10-28T16:40:22Z",
    severity: "high",
    ruleId: "R03",
    ruleName: "Privilege Escalation",
    sourceIp: "192.168.1.14",
    description: "sudo usage following repeated authentication failure for user 'deploy'",
    logFile: "auth.log",
    evidenceCount: 5,
  },
  {
    id: 4,
    timestamp: "2026-10-28T15:33:00Z",
    severity: "medium",
    ruleId: "R06",
    ruleName: "Repeated 404",
    sourceIp: "203.0.113.42",
    description: "24 HTTP 404 responses to 203.0.113.42 within 60 s, possible path enumeration",
    logFile: "access.log",
    evidenceCount: 24,
  },
  {
    id: 5,
    timestamp: "2026-10-28T14:18:45Z",
    severity: "medium",
    ruleId: "R05",
    ruleName: "After-Hours Access",
    sourceIp: "172.16.0.55",
    description: "Successful authentication at 02:18 UTC for user 'rsync-agent'",
    logFile: "auth.log",
    evidenceCount: 1,
  },
  {
    id: 6,
    timestamp: "2026-10-28T13:07:19Z",
    severity: "low",
    ruleId: "R11",
    ruleName: "Service Crash Loop",
    sourceIp: "-",
    description: "nginx restarted 4 times within 10 minutes",
    logFile: "syslog",
    evidenceCount: 4,
  },
];

export const DEMO_ANALYSIS_RUNS: DemoAnalysisRun[] = [
  {
    id: 1,
    filename: "auth.log",
    format: "auth_log",
    lineCount: 84_210,
    alertCount: 12,
    status: "ready",
    analysedAt: "2026-10-28T17:00:00Z",
    sha256: "a3f5d2c1e8b04f72a9d1b3e6c5f8a2d4e7b0c3f6a9d2b5e8c1f4a7d0b3e6c9f2",
  },
  {
    id: 2,
    filename: "access.log",
    format: "apache_access",
    lineCount: 212_445,
    alertCount: 7,
    status: "ready",
    analysedAt: "2026-10-28T16:45:00Z",
    sha256: "c7e2a5d8f1b4c0e3a6d9f2b5e8c1f4a7d0b3e6c9f2a3d6b9e2c5f8a1d4b7e0c3",
  },
  {
    id: 3,
    filename: "syslog.1",
    format: "syslog",
    lineCount: 31_008,
    alertCount: 3,
    status: "ready",
    analysedAt: "2026-10-28T15:20:00Z",
    sha256: "f0a3d6b9e2c5f8a1d4b7e0c3a6d9f2b5e8c1f4a7d0b3e6c9f2a3d6b9e2c5f8a1",
  },
  {
    id: 4,
    filename: "nginx-error.log",
    format: "syslog",
    lineCount: 5_120,
    alertCount: 1,
    status: "ready",
    analysedAt: "2026-10-27T22:05:00Z",
    sha256: "b5e8c1f4a7d0b3e6c9f2a3d6b9e2c5f8a1d4b7e0c3a6d9f2b5e8c1f4a7d0b3e6",
  },
];

export const DEMO_INVESTIGATIONS: DemoInvestigation[] = [
  {
    id: 1,
    title: "SSH Brute Force: 192.168.4.77",
    status: "open",
    alertCount: 5,
    createdAt: "2026-10-28T17:15:00Z",
    updatedAt: "2026-10-28T17:15:00Z",
    notes: "Ongoing investigation. Source IP blocked at perimeter firewall pending review.",
  },
  {
    id: 2,
    title: "SQLi Probe: access.log 28 Oct",
    status: "in_progress",
    alertCount: 3,
    createdAt: "2026-10-28T16:58:00Z",
    updatedAt: "2026-10-28T17:02:00Z",
    notes: "Payload analysis in progress. No successful injection confirmed yet.",
  },
  {
    id: 3,
    title: "After-Hours Logins: Week of 20 Oct",
    status: "closed",
    alertCount: 8,
    createdAt: "2026-10-21T09:00:00Z",
    updatedAt: "2026-10-25T14:30:00Z",
    notes: "Confirmed legitimate scheduled maintenance window. Closed.",
  },
];

export const DEMO_SEVERITY_COUNTS: SeverityCount[] = [
  { severity: "critical", label: "Critical", count: 4,  color: "#FF6B72" },
  { severity: "high",     label: "High",     count: 11, color: "#F2B85B" },
  { severity: "medium",   label: "Medium",   count: 7,  color: "#F2B85B" },
  { severity: "low",      label: "Low",      count: 1,  color: "#89858A" },
];

export const DEMO_EVENT_VOLUME: EventVolumePoint[] = [
  { time: "00:00", events: 1420, alerts: 0 },
  { time: "02:00", events: 880,  alerts: 1 },
  { time: "04:00", events: 640,  alerts: 0 },
  { time: "06:00", events: 1100, alerts: 0 },
  { time: "08:00", events: 4800, alerts: 2 },
  { time: "10:00", events: 7200, alerts: 3 },
  { time: "12:00", events: 6100, alerts: 1 },
  { time: "14:00", events: 5500, alerts: 4 },
  { time: "16:00", events: 8400, alerts: 7 },
  { time: "18:00", events: 3200, alerts: 5 },
  { time: "20:00", events: 2100, alerts: 0 },
  { time: "22:00", events: 1700, alerts: 0 },
];

export const DEMO_TIMELINE_EVENTS: DemoTimelineEvent[] = [
  {
    id: 1,
    timestamp: "2026-10-28T17:12:04Z",
    severity: "critical",
    type: "Brute Force",
    sourceIp: "192.168.4.77",
    user: "root",
    message: "Failed password for root from 192.168.4.77 port 52440 ssh2",
  },
  {
    id: 2,
    timestamp: "2026-10-28T16:55:11Z",
    severity: "high",
    type: "SQLi Pattern",
    sourceIp: "10.0.2.88",
    user: "-",
    message: "GET /search?q=%27%20OR%201%3D1-- HTTP/1.1 200 4821",
  },
  {
    id: 3,
    timestamp: "2026-10-28T16:40:22Z",
    severity: "high",
    type: "Privilege Escalation",
    sourceIp: "192.168.1.14",
    user: "deploy",
    message: "sudo: deploy : TTY=pts/1 ; PWD=/var/www ; COMMAND=/bin/bash",
  },
  {
    id: 4,
    timestamp: "2026-10-28T15:33:00Z",
    severity: "medium",
    type: "Repeated 404",
    sourceIp: "203.0.113.42",
    user: "-",
    message: "24 × HTTP 404 in 60 s, path enumeration suspected",
  },
  {
    id: 5,
    timestamp: "2026-10-28T14:18:45Z",
    severity: "medium",
    type: "After-Hours Access",
    sourceIp: "172.16.0.55",
    user: "rsync-agent",
    message: "Accepted publickey for rsync-agent from 172.16.0.55 port 61100 ssh2",
  },
  {
    id: 6,
    timestamp: "2026-10-28T13:07:19Z",
    severity: "low",
    type: "Service Crash",
    sourceIp: "-",
    user: "-",
    message: "nginx[3841]: start request repeated too quickly for nginx.service",
  },
];

// ── Summary metrics (derived from samples above) ──────────────────────────────

export const DEMO_METRICS = {
  totalEvents: 332_783,
  alertsForReview: 23,
  highPriorityAlerts: 15,
  openInvestigations: 2,
};

