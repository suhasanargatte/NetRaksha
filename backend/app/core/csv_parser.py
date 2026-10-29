"""
CSV Log Parser and Validator using Pandas.
Preserves raw forensic evidence while normalizing fields for SIEM analysis.
"""

from __future__ import annotations

import io
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from dateutil import parser as date_parser

from app.schemas.log_file import ValidationSummary


COLUMN_CANDIDATES: Dict[str, List[str]] = {
    "timestamp": [
        "timestamp", "time", "datetime", "date_time", "event_time",
        "eventtime", "@timestamp", "date"
    ],
    "source_ip": [
        "source_ip", "src_ip", "src", "source", "client_ip", "clientip",
        "c_ip", "remote_addr", "ip", "srcip"
    ],
    "dest_ip": [
        "dest_ip", "dst_ip", "dst", "destination_ip", "target_ip",
        "server_ip", "host_ip", "dstip"
    ],
    "user": [
        "user", "username", "account", "src_user", "login", "user_name",
        "actor", "account_name"
    ],
    "action": [
        "action", "event", "event_type", "event_name", "activity",
        "operation", "status", "cmd", "command", "signature"
    ],
    "service": [
        "service", "app", "application", "protocol", "process",
        "daemon", "component", "facility"
    ],
    "http_method": [
        "http_method", "method", "verb", "request_method"
    ],
    "http_path": [
        "http_path", "path", "uri", "url", "request_uri", "request_path"
    ],
    "http_status": [
        "http_status", "status_code", "response_code", "code"
    ],
    "response_bytes": [
        "response_bytes", "bytes", "size", "bytes_sent", "length", "body_bytes_sent"
    ],
    "message": [
        "message", "msg", "description", "details", "info", "raw",
        "log_message", "payload"
    ],
}


class CSVLogParser:
    """Parses and validates CSV log files without mutating raw input evidence."""

    def __init__(self, raw_content: bytes, original_filename: str = "upload.csv") -> None:
        self.raw_content = raw_content
        self.original_filename = original_filename

    def _decode_content(self) -> str:
        """Decode bytes safely, falling back to latin-1 if utf-8 fails."""
        try:
            return self.raw_content.decode("utf-8")
        except UnicodeDecodeError:
            try:
                return self.raw_content.decode("latin-1")
            except Exception as exc:
                raise ValueError(f"Unable to decode log file content: {exc}") from exc

    def _map_columns(self, available_columns: List[str]) -> Dict[str, str]:
        """
        Map available CSV columns to normalized NetRakshak schema fields.
        Returns a dict of {canonical_field: actual_csv_column}.
        """
        lower_cols = {col.strip().lower(): col for col in available_columns}
        mapping: Dict[str, str] = {}

        for canonical_name, candidates in COLUMN_CANDIDATES.items():
            for cand in candidates:
                if cand in lower_cols:
                    mapping[canonical_name] = lower_cols[cand]
                    break

        return mapping

    def parse(self) -> Tuple[List[Dict[str, Any]], ValidationSummary]:
        """
        Parse and validate CSV content.

        Raises
        ------
        ValueError
            If file is empty, has no headers, or fails structural CSV validation.

        Returns
        -------
        Tuple[List[Dict[str, Any]], ValidationSummary]
            List of parsed event dictionaries and validation metrics.
        """
        if not self.raw_content or len(self.raw_content.strip()) == 0:
            raise ValueError("Uploaded file is empty.")

        text = self._decode_content()
        lines = [line for line in text.splitlines() if line.strip()]
        if not lines:
            raise ValueError("Uploaded file contains no data rows.")

        total_lines_submitted = len(lines) - 1  # Excluding header

        # Read CSV with pandas
        try:
            # We read raw values as strings without treating empty string as NaN yet
            df = pd.read_csv(
                io.StringIO(text),
                dtype=str,
                keep_default_na=False,
                on_bad_lines="skip",
            )
        except pd.errors.EmptyDataError:
            raise ValueError("File is empty or contains no parseable columns.")
        except Exception as exc:
            raise ValueError(f"Malformed CSV structure: {exc}") from exc

        if df.empty or len(df.columns) == 0:
            raise ValueError("File contains header but zero data records.")

        detected_columns = [str(c).strip() for c in df.columns]
        mapping = self._map_columns(detected_columns)

        # Count duplicates safely without dropping them (preserves evidence)
        duplicate_rows_count = int(df.duplicated().sum())

        # Count malformed rows skipped by CSV engine
        parsed_rows_count = len(df)
        malformed_rows_count = max(0, total_lines_submitted - parsed_rows_count)

        missing_timestamp_count = 0
        events: List[Dict[str, Any]] = []

        # Iterate over records to construct normalized events
        for idx, row in df.iterrows():
            line_no = int(idx) + 2  # 1-indexed, accounting for header line

            # Build raw line representation for audit trail
            raw_repr = ", ".join(f"{col}={row[col]}" for col in df.columns if row[col] != "")

            event_dict: Dict[str, Any] = {
                "line_number": line_no,
                "timestamp": None,
                "source_ip": None,
                "dest_ip": None,
                "user": None,
                "action": None,
                "service": None,
                "http_method": None,
                "http_path": None,
                "http_status": None,
                "response_bytes": None,
                "message": None,
                "raw_line": raw_repr,
            }

            # Map fields safely
            for canonical_field, csv_col in mapping.items():
                val = str(row.get(csv_col, "")).strip()
                if not val or val.lower() in {"null", "none", "nan", "n/a", "-"}:
                    continue

                if canonical_field == "timestamp":
                    # Parse timestamp safely
                    try:
                        parsed_dt = date_parser.parse(val)
                        event_dict["timestamp"] = parsed_dt
                    except (ValueError, TypeError, OverflowError):
                        missing_timestamp_count += 1
                        event_dict["timestamp"] = None
                elif canonical_field in {"http_status", "response_bytes"}:
                    try:
                        # Extract integer if possible
                        event_dict[canonical_field] = int(float(val))
                    except ValueError:
                        event_dict[canonical_field] = None
                else:
                    event_dict[canonical_field] = val

            # If message was not mapped, populate with remaining columns
            if not event_dict["message"]:
                unmapped_cols = [c for c in df.columns if c not in mapping.values()]
                if unmapped_cols:
                    event_dict["message"] = " | ".join(
                        f"{c}: {row[c]}" for c in unmapped_cols if str(row[c]).strip()
                    )
                elif event_dict["action"]:
                    event_dict["message"] = f"Action: {event_dict['action']}"
                else:
                    event_dict["message"] = raw_repr

            if "timestamp" in mapping and event_dict["timestamp"] is None and row.get(mapping["timestamp"], "") == "":
                missing_timestamp_count += 1

            events.append(event_dict)

        valid_rows_count = len(events)

        summary = ValidationSummary(
            total_rows=total_lines_submitted,
            valid_rows=valid_rows_count,
            malformed_rows=malformed_rows_count,
            duplicate_rows=duplicate_rows_count,
            missing_timestamp_rows=missing_timestamp_count,
            detected_columns=detected_columns,
            column_mapping=mapping,
        )

        return events, summary

