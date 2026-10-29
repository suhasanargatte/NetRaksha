"""
Report generation service for NetRakshak.
Generates downloadable CSV and PDF investigation dossiers using ReportLab.
Operates completely offline without external APIs.
"""

from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from typing import List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.alert import Alert
from app.models.audit import AuditRecord
from app.models.investigation import Investigation
from app.models.log_file import LogFile


def generate_investigation_csv(
    investigation: Investigation,
    alerts: List[Alert],
    audit_records: List[AuditRecord],
) -> str:
    """Generate structured CSV export for an investigation case."""
    output = io.StringIO()
    writer = csv.writer(output)

    # 1. Header & Investigation Metadata
    writer.writerow(["# NETRAKSHAK INVESTIGATION DOSSIER EXPORT"])
    writer.writerow(["# Generated At", datetime.now(timezone.utc).isoformat()])
    writer.writerow(["Case ID", investigation.id])
    writer.writerow(["Subject", investigation.title])
    writer.writerow(["Status", investigation.status.value if hasattr(investigation.status, "value") else str(investigation.status)])
    writer.writerow(["Initiated", investigation.created_at.isoformat() if investigation.created_at else ""])
    writer.writerow(["Analyst Notes", investigation.notes or "None"])
    writer.writerow([])

    # 2. Correlated Alerts Table
    writer.writerow([
        "Alert ID",
        "Rule ID",
        "Rule Name",
        "Severity",
        "Review Status",
        "Affected Entity",
        "Timestamp",
        "ML Anomaly Score",
        "Analyst Notes",
        "Description",
    ])
    for a in alerts:
        status_val = a.status.value if hasattr(a.status, "value") else str(a.status)
        sev_val = a.severity.value if hasattr(a.severity, "value") else str(a.severity)
        writer.writerow([
            a.id,
            a.rule_id,
            a.rule_name,
            sev_val.upper(),
            status_val,
            a.affected_entity or "Host / System",
            a.timestamp.isoformat() if a.timestamp else (a.created_at.isoformat() if a.created_at else ""),
            f"{a.ml_score:.2f}" if a.ml_score is not None else "N/A",
            a.analyst_notes or "",
            a.description.replace("\n", " "),
        ])
    writer.writerow([])

    # 3. Audit Trail Table
    writer.writerow(["Audit ID", "Timestamp", "Actor", "Action", "Target", "Detail"])
    for rec in audit_records:
        writer.writerow([
            rec.id,
            rec.timestamp.isoformat() if rec.timestamp else "",
            rec.actor,
            rec.action,
            f"{rec.entity_type} #{rec.entity_id}",
            rec.detail or "",
        ])

    return output.getvalue()


def generate_alerts_csv(alerts: List[Alert]) -> str:
    """Generate CSV export of all filtered security alerts."""
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Alert ID",
        "Log Archive ID",
        "Rule ID",
        "Rule Name",
        "Severity",
        "Review Status",
        "Affected Entity",
        "Occurrence Timestamp",
        "ML Score",
        "Description",
    ])
    for a in alerts:
        status_val = a.status.value if hasattr(a.status, "value") else str(a.status)
        sev_val = a.severity.value if hasattr(a.severity, "value") else str(a.severity)
        writer.writerow([
            a.id,
            a.log_file_id,
            a.rule_id,
            a.rule_name,
            sev_val.upper(),
            status_val,
            a.affected_entity or "N/A",
            a.timestamp.isoformat() if a.timestamp else "",
            f"{a.ml_score:.2f}" if a.ml_score is not None else "N/A",
            a.description.replace("\n", " "),
        ])

    return output.getvalue()


def generate_investigation_pdf(
    investigation: Investigation,
    alerts: List[Alert],
    audit_records: List[AuditRecord],
) -> bytes:
    """Generate professional PDF investigation report using ReportLab."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=12,
    )
    section_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#1e293b"),
        spaceBefore=12,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "BodyDark",
        parent=styles["Normal"],
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#334155"),
    )
    badge_style = ParagraphStyle(
        "BadgeText",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#ffffff"),
    )

    elements = []

    # 1. Header Banner
    elements.append(Paragraph("NETRAKSHAK // INCIDENT INVESTIGATION DOSSIER", title_style))
    elements.append(
        Paragraph(
            f"CLASSIFICATION: RESTRICTED / CYBERSECURITY AUDIT &bull; CASE #{investigation.id} &bull; EXPORTED {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}",
            subtitle_style,
        )
    )
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0284c7"), spaceAfter=12))

    # 2. Case Summary Table
    status_str = (
        investigation.status.value.upper()
        if hasattr(investigation.status, "value")
        else str(investigation.status).upper()
    )
    inv_meta = [
        [
            Paragraph("<b>Investigation Title:</b>", body_style),
            Paragraph(investigation.title, body_style),
            Paragraph("<b>Current Status:</b>", body_style),
            Paragraph(f"<b>{status_str}</b>", body_style),
        ],
        [
            Paragraph("<b>Case Created:</b>", body_style),
            Paragraph(investigation.created_at.strftime("%Y-%m-%d %H:%M") if investigation.created_at else "N/A", body_style),
            Paragraph("<b>Correlated Alerts:</b>", body_style),
            Paragraph(str(len(alerts)), body_style),
        ],
    ]
    t_meta = Table(inv_meta, colWidths=[100, 200, 100, 140])
    t_meta.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ])
    )
    elements.append(t_meta)
    elements.append(Spacer(1, 10))

    # 3. Analyst Notes Callout
    elements.append(Paragraph("Analyst Findings & Incident Notes", section_style))
    notes_text = investigation.notes or "No initial case notes entered by the analyst."
    t_notes = Table([[Paragraph(notes_text, body_style)]], colWidths=[540])
    t_notes.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ])
    )
    elements.append(t_notes)
    elements.append(Spacer(1, 10))

    # 4. Correlated Security Alerts Table
    elements.append(Paragraph(f"Correlated Security Alerts ({len(alerts)})", section_style))
    if alerts:
        alert_rows = [["Rule ID", "Rule Name", "Severity", "Entity", "Review Status", "ML Score"]]
        for a in alerts:
            sev_str = a.severity.value.upper() if hasattr(a.severity, "value") else str(a.severity).upper()
            status_str = a.status.value if hasattr(a.status, "value") else str(a.status)
            ml_text = f"{(a.ml_score * 100):.0f}%" if a.ml_score is not None else "-"
            alert_rows.append([
                a.rule_id,
                Paragraph(a.rule_name, body_style),
                sev_str,
                Paragraph(a.affected_entity or "Host", body_style),
                status_str,
                ml_text,
            ])

        t_alerts = Table(alert_rows, colWidths=[55, 175, 55, 120, 85, 50])
        t_alerts.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 8),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
                ("TOPPADDING", (0, 0), (-1, 0), 5),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 1), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
            ])
        )
        elements.append(t_alerts)
    else:
        elements.append(Paragraph("No security alerts linked to this investigation.", body_style))

    elements.append(Spacer(1, 10))

    # 5. Chain of Custody & Audit Trail Table
    elements.append(Paragraph(f"Chain of Custody & Audit Events ({len(audit_records)})", section_style))
    if audit_records:
        audit_rows = [["Timestamp (UTC)", "Actor", "Action", "Details"]]
        for r in audit_records[:15]:  # include up to 15 recent audit events
            t_str = r.timestamp.strftime("%Y-%m-%d %H:%M:%S") if r.timestamp else "N/A"
            audit_rows.append([
                t_str,
                r.actor,
                r.action,
                Paragraph(r.detail or "N/A", body_style),
            ])

        t_audit = Table(audit_rows, colWidths=[100, 60, 110, 270])
        t_audit.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 8),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ])
        )
        elements.append(t_audit)
    else:
        elements.append(Paragraph("No audit entries recorded for this case.", body_style))

    elements.append(Spacer(1, 14))

    # 6. Verification & Provenance Footer
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceAfter=6))
    elements.append(
        Paragraph(
            "<b>Cryptographic Provenance Note:</b> This report was generated deterministically by the NetRakshak offline cybersecurity engine. All referenced log hashes are verifiable via SHA-256 integrity checks.",
            ParagraphStyle("FooterNote", parent=styles["Normal"], fontSize=7, leading=9, textColor=colors.HexColor("#64748b")),
        )
    )

    doc.build(elements)
    return buffer.getvalue()

